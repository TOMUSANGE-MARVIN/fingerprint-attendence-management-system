"""
Attendance models for the attendance management system.
"""
from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid


class AttendanceSession(models.Model):
    """
    Attendance Session representing a class session where attendance is taken.
    """
    
    SESSION_TYPE_CHOICES = [
        ('lecture', 'Lecture'),
        ('tutorial', 'Tutorial'),
        ('lab', 'Laboratory'),
        ('seminar', 'Seminar'),
        ('exam', 'Examination'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(
        'courses.Course',
        on_delete=models.CASCADE,
        related_name='attendance_sessions'
    )
    timetable_slot = models.ForeignKey(
        'courses.TimetableSlot',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sessions'
    )
    lecturer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='led_sessions',
        limit_choices_to={'role': 'lecturer'}
    )
    
    title = models.CharField(max_length=200, blank=True)
    session_type = models.CharField(max_length=20, choices=SESSION_TYPE_CHOICES, default='lecture')
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField(blank=True, null=True)
    
    # Session state
    is_active = models.BooleanField(default=False)  # Currently accepting attendance
    started_at = models.DateTimeField(blank=True, null=True)
    ended_at = models.DateTimeField(blank=True, null=True)
    
    # Location
    room = models.CharField(max_length=50, blank=True, null=True)
    building = models.CharField(max_length=100, blank=True, null=True)
    
    # Settings
    allow_late_marking = models.BooleanField(default=True)
    late_threshold_minutes = models.IntegerField(default=15)  # Minutes after start to be marked late
    
    # Notes
    notes = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'attendance_sessions'
        verbose_name = 'Attendance Session'
        verbose_name_plural = 'Attendance Sessions'
        ordering = ['-date', '-start_time']
    
    def __str__(self):
        return f"{self.course.code} - {self.date} {self.start_time}"
    
    def start_session(self):
        """Start the attendance session."""
        self.is_active = True
        self.started_at = timezone.now()
        self.save(update_fields=['is_active', 'started_at', 'updated_at'])
    
    def end_session(self):
        """End the attendance session."""
        self.is_active = False
        self.ended_at = timezone.now()
        self.save(update_fields=['is_active', 'ended_at', 'updated_at'])
    
    @property
    def total_enrolled(self):
        """Get total enrolled students for this course."""
        return self.course.enrollments.filter(is_active=True).count()
    
    @property
    def present_count(self):
        """Get count of present students."""
        return self.attendance_records.filter(status='present').count()
    
    @property
    def late_count(self):
        """Get count of late students."""
        return self.attendance_records.filter(status='late').count()
    
    @property
    def absent_count(self):
        """Get count of absent students."""
        return self.total_enrolled - self.present_count - self.late_count
    
    @property
    def is_expired(self):
        """True when the current time is past the session's scheduled end time."""
        import datetime
        end = None
        if self.timetable_slot:
            end = self.timetable_slot.end_time
        elif self.end_time:
            end = self.end_time

        if end and self.date:
            slot_end_naive = datetime.datetime.combine(self.date, end)
            slot_end = timezone.make_aware(slot_end_naive, timezone.get_current_timezone())
            return timezone.now() > slot_end
        return False

    @property
    def attendance_rate(self):
        """Calculate attendance rate for this session."""
        total = self.total_enrolled
        if total == 0:
            return 0
        present = self.present_count + self.late_count
        return round((present / total) * 100, 1)


class AttendanceRecord(models.Model):
    """
    Individual attendance record for a student in a session.
    """
    
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('late', 'Late'),
        ('absent', 'Absent'),
        ('excused', 'Excused'),
    ]
    
    VERIFICATION_METHOD_CHOICES = [
        ('fingerprint', 'Fingerprint'),
        ('manual', 'Manual'),
        ('qr_code', 'QR Code'),
        ('facial', 'Facial Recognition'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        AttendanceSession,
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='attendance_records',
        limit_choices_to={'role': 'student'}
    )
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='absent')
    verification_method = models.CharField(
        max_length=20,
        choices=VERIFICATION_METHOD_CHOICES,
        default='manual'
    )
    
    # Timestamps
    marked_at = models.DateTimeField(blank=True, null=True)
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='marked_attendances'
    )
    
    # For biometric verification
    verification_confidence = models.FloatField(blank=True, null=True)  # 0-100%
    
    # Notes
    notes = models.TextField(blank=True, null=True)
    excuse_reason = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'attendance_records'
        verbose_name = 'Attendance Record'
        verbose_name_plural = 'Attendance Records'
        unique_together = ['session', 'student']
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.student.full_name} - {self.session} - {self.status}"
    
    def mark_present(self, marked_by=None, verification_method='manual', confidence=None):
        """Mark student as present."""
        self.status = 'present'
        self.marked_at = timezone.now()
        self.marked_by = marked_by
        self.verification_method = verification_method
        if confidence:
            self.verification_confidence = confidence
        
        # Check if late
        session = self.session
        if session.started_at:
            time_diff = (timezone.now() - session.started_at).total_seconds() / 60
            if time_diff > session.late_threshold_minutes:
                self.status = 'late'
        
        self.save()
    
    def mark_absent(self, marked_by=None):
        """Mark student as absent."""
        self.status = 'absent'
        self.marked_at = timezone.now()
        self.marked_by = marked_by
        self.save()
    
    def mark_excused(self, reason, marked_by=None):
        """Mark student as excused."""
        self.status = 'excused'
        self.excuse_reason = reason
        self.marked_at = timezone.now()
        self.marked_by = marked_by
        self.save()


class AttendanceSummary(models.Model):
    """
    Aggregated attendance summary for reporting and analytics.
    This is a denormalized table for faster queries.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='attendance_summaries'
    )
    course = models.ForeignKey(
        'courses.Course',
        on_delete=models.CASCADE,
        related_name='attendance_summaries'
    )
    
    # Aggregated stats
    total_sessions = models.IntegerField(default=0)
    present_count = models.IntegerField(default=0)
    late_count = models.IntegerField(default=0)
    absent_count = models.IntegerField(default=0)
    excused_count = models.IntegerField(default=0)
    
    attendance_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    # Streak tracking
    current_streak = models.IntegerField(default=0)  # Current consecutive attendance
    longest_streak = models.IntegerField(default=0)  # Longest streak ever
    
    # Period
    period_start = models.DateField()
    period_end = models.DateField()
    
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'attendance_summaries'
        verbose_name = 'Attendance Summary'
        verbose_name_plural = 'Attendance Summaries'
        unique_together = ['student', 'course', 'period_start', 'period_end']
    
    def __str__(self):
        return f"{self.student.full_name} - {self.course.code} - {self.attendance_percentage}%"
    
    def recalculate(self):
        """Recalculate attendance statistics from records."""
        records = AttendanceRecord.objects.filter(
            student=self.student,
            session__course=self.course,
            session__date__gte=self.period_start,
            session__date__lte=self.period_end
        )
        
        self.total_sessions = records.count()
        self.present_count = records.filter(status='present').count()
        self.late_count = records.filter(status='late').count()
        self.absent_count = records.filter(status='absent').count()
        self.excused_count = records.filter(status='excused').count()
        
        effective_present = self.present_count + self.late_count
        if self.total_sessions > 0:
            self.attendance_percentage = round((effective_present / self.total_sessions) * 100, 2)
        else:
            self.attendance_percentage = 0
        
        self.save()
