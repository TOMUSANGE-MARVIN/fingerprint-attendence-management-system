"""
Course models for the attendance management system.
"""
from django.db import models
from django.conf import settings
import uuid



class Faculty(models.Model):
    """Faculty/School within the institution."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True, null=True)
    dean = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dean_of_faculties',
        limit_choices_to={'role': 'lecturer'}
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'faculties'
        verbose_name = 'Faculty'
        verbose_name_plural = 'Faculties'
        ordering = ['name']

    def __str__(self):
        return f"{self.code} - {self.name}"


class AcademicPeriod(models.Model):
    """Academic year and semester period."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    academic_year = models.CharField(max_length=20)  # e.g., "2025-2026"
    semester = models.CharField(max_length=50)  # e.g., "Semester 1", "Semester 2"
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'academic_periods'
        verbose_name = 'Academic Period'
        verbose_name_plural = 'Academic Periods'
        ordering = ['-start_date']
        unique_together = ['academic_year', 'semester']

    def __str__(self):
        return f"{self.academic_year} - {self.semester}"

    def save(self, *args, **kwargs):
        # Ensure only one period is current
        if self.is_current:
            AcademicPeriod.objects.filter(is_current=True).exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)


class AcademicYear(models.Model):
    """Academic year e.g. '2023/2024'."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    label = models.CharField(max_length=20, unique=True)   # "2023/2024"
    start_year = models.IntegerField()                      # 2023
    is_current = models.BooleanField(default=False)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'academic_years'
        verbose_name = 'Academic Year'
        verbose_name_plural = 'Academic Years'
        ordering = ['-start_year']

    def __str__(self):
        return self.label

    def save(self, *args, **kwargs):
        if self.is_current:
            AcademicYear.objects.filter(is_current=True).exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)


class Programme(models.Model):
    """Degree programme e.g. BIT (3 years), DIT (2 years)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=20, unique=True)    # "BIT"
    name = models.CharField(max_length=200)                # "Bachelor of Information Technology"
    duration_years = models.IntegerField(default=3)
    faculty = models.ForeignKey(
        'Faculty',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='programmes'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'programmes'
        verbose_name = 'Programme'
        verbose_name_plural = 'Programmes'
        ordering = ['code']

    def __str__(self):
        return f"{self.code} - {self.name}"


class Cohort(models.Model):
    """A group of students on the same programme who started in the same academic year."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    programme = models.ForeignKey(
        Programme,
        on_delete=models.CASCADE,
        related_name='cohorts'
    )
    intake_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.PROTECT,
        related_name='cohorts'
    )
    coordinator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='coordinated_cohorts',
        limit_choices_to={'role': 'lecturer'}
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'cohorts'
        verbose_name = 'Cohort'
        verbose_name_plural = 'Cohorts'
        unique_together = ['programme', 'intake_year']
        ordering = ['programme', '-intake_year__start_year']

    def __str__(self):
        return f"{self.programme.code} {self.intake_year.label}"

    @property
    def name(self):
        return str(self)

    @property
    def current_year_of_study(self):
        """Compute the current year of study based on the current academic year."""
        current = AcademicYear.objects.filter(is_current=True).first()
        if current:
            computed = current.start_year - self.intake_year.start_year + 1
            if self.programme and self.programme.duration_years:
                return max(1, min(computed, self.programme.duration_years))
            return max(1, computed)
        return None

    @property
    def current_semester_label(self):
        """Returns a label like '2:1' meaning Year 2, Semester 1."""
        period = AcademicPeriod.objects.filter(is_current=True).first()
        year = self.current_year_of_study
        if period and year:
            sem_str = period.semester.lower()
            sem_num = 2 if '2' in sem_str else 1
            return f"{year}:{sem_num}"
        return None


class CohortGroupCoordinator(models.Model):
    """One student coordinator per study-time group within a cohort."""
    STUDY_TIME_CHOICES = [
        ('day', 'Day'),
        ('evening', 'Evening'),
        ('weekend', 'Weekend'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cohort = models.ForeignKey(
        Cohort,
        on_delete=models.CASCADE,
        related_name='group_coordinators'
    )
    study_time = models.CharField(max_length=10, choices=STUDY_TIME_CHOICES)
    coordinator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='coordinated_groups',
        limit_choices_to={'role': 'student'}
    )

    class Meta:
        db_table = 'cohort_group_coordinators'
        unique_together = ['cohort', 'study_time']

    def __str__(self):
        return f"{self.cohort} · {self.study_time} coordinator"


class Course(models.Model):
    """
    Course model representing a subject/course in the institution.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=20, unique=True)  # e.g., CS101
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    credits = models.IntegerField(default=3)
    total_lectures = models.IntegerField(default=45, help_text="Total number of lectures/sessions planned for this course. Used as the denominator for attendance percentage.")
    department = models.CharField(max_length=100, blank=True, default="")
    semester = models.CharField(max_length=20, blank=True, default="")
    academic_year = models.CharField(max_length=20, blank=True, default="")
    faculty = models.ForeignKey(
        'Faculty',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='courses'
    )
    academic_period = models.ForeignKey(
        'AcademicPeriod',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='courses'
    )
    programme = models.ForeignKey(
        'Programme',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='courses'
    )
    year_level = models.IntegerField(null=True, blank=True)     # 1, 2, 3 — which year of the programme
    semester_number = models.IntegerField(null=True, blank=True)  # 1 or 2
    
    # Relationships
    lecturer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='taught_courses',
        limit_choices_to={'role': 'lecturer'}
    )
    coordinator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='coordinated_courses',
        limit_choices_to={'role': 'student'}
    )
    students = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through='Enrollment',
        related_name='enrolled_courses'
    )
    
    # Settings
    attendance_threshold = models.IntegerField(default=75)  # Minimum attendance percentage
    is_active = models.BooleanField(default=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'courses'
        verbose_name = 'Course'
        verbose_name_plural = 'Courses'
        ordering = ['code']
    
    def __str__(self):
        return f"{self.code} - {self.name}"
    
    @property
    def total_students(self):
        return self.enrollments.filter(is_active=True).count()
    
    @property
    def lecturer_name(self):
        return self.lecturer.full_name if self.lecturer else "Unassigned"


class Enrollment(models.Model):
    """
    Enrollment model representing student enrollment in a course.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='enrollments',
        limit_choices_to={'role': 'student'}
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='enrollments'
    )
    
    enrollment_date = models.DateField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    
    # Cached attendance data (updated periodically)
    total_sessions = models.IntegerField(default=0)
    attended_sessions = models.IntegerField(default=0)
    attendance_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'enrollments'
        verbose_name = 'Enrollment'
        verbose_name_plural = 'Enrollments'
        unique_together = ['student', 'course']
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.student.full_name} - {self.course.code}"
    
    def update_attendance_stats(self):
        """Update cached attendance statistics using course.total_lectures as denominator."""
        from apps.attendance.models import AttendanceRecord, AttendanceSession

        # Count all sessions held for this course
        sessions_held = AttendanceSession.objects.filter(course=self.course).count()

        # Count only records where the student was present/late
        self.attended_sessions = AttendanceRecord.objects.filter(
            student=self.student,
            session__course=self.course,
            status__in=['present', 'late']
        ).count()

        self.total_sessions = sessions_held

        # Use total_lectures as the base denominator for accurate percentage
        denominator = self.course.total_lectures if self.course.total_lectures > 0 else sessions_held

        if denominator > 0:
            self.attendance_percentage = round(
                (self.attended_sessions / denominator) * 100, 2
            )
        else:
            self.attendance_percentage = 0

        self.save(update_fields=['total_sessions', 'attended_sessions', 'attendance_percentage', 'updated_at'])
    
    @property
    def is_at_risk(self):
        """Check if student is at risk (below threshold)."""
        return self.attendance_percentage < self.course.attendance_threshold


class TimetableSlot(models.Model):
    """
    Timetable slot representing scheduled class times.
    """
    
    DAY_CHOICES = [
        ('monday', 'Monday'),
        ('tuesday', 'Tuesday'),
        ('wednesday', 'Wednesday'),
        ('thursday', 'Thursday'),
        ('friday', 'Friday'),
        ('saturday', 'Saturday'),
        ('sunday', 'Sunday'),
    ]

    STUDY_TIME_CHOICES = [
        ('day', 'Day'),
        ('evening', 'Evening'),
        ('weekend', 'Weekend'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='timetable_slots'
    )
    cohort = models.ForeignKey(
        'Cohort',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='timetable_slots'
    )

    lecturer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='timetable_slots',
        limit_choices_to={'role': 'lecturer'}
    )

    day_of_week = models.CharField(max_length=10, choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    room = models.CharField(max_length=50, blank=True, null=True)
    building = models.CharField(max_length=100, blank=True, null=True)
    study_time = models.CharField(max_length=10, choices=STUDY_TIME_CHOICES, default='day')

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'timetable_slots'
        verbose_name = 'Timetable Slot'
        verbose_name_plural = 'Timetable Slots'
        ordering = ['day_of_week', 'start_time']
    
    def __str__(self):
        return f"{self.course.code} - {self.day_of_week} {self.start_time}-{self.end_time}"
    
    @property
    def duration_minutes(self):
        """Calculate duration in minutes."""
        from datetime import datetime, timedelta
        start = datetime.combine(datetime.today(), self.start_time)
        end = datetime.combine(datetime.today(), self.end_time)
        return int((end - start).total_seconds() / 60)
