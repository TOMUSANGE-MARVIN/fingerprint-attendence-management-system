"""
Serializers for Course models.
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Course, Enrollment, TimetableSlot, Faculty, AcademicPeriod, AcademicYear, Programme, Cohort, CohortGroupCoordinator

User = get_user_model()


class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicYear
        fields = ['id', 'label', 'start_year', 'is_current', 'start_date', 'end_date', 'created_at']
        read_only_fields = ['id', 'created_at']


class ProgrammeSerializer(serializers.ModelSerializer):
    faculty_name = serializers.CharField(source='faculty.name', read_only=True, default=None)
    cohort_count = serializers.SerializerMethodField()

    class Meta:
        model = Programme
        fields = ['id', 'code', 'name', 'duration_years', 'faculty', 'faculty_name', 'is_active', 'cohort_count', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_cohort_count(self, obj):
        return obj.cohorts.filter(is_active=True).count()


class CohortSerializer(serializers.ModelSerializer):
    programme_code = serializers.CharField(source='programme.code', read_only=True)
    programme_name = serializers.CharField(source='programme.name', read_only=True)
    intake_year_label = serializers.CharField(source='intake_year.label', read_only=True)
    coordinator_name = serializers.CharField(source='coordinator.full_name', read_only=True, default=None)
    group_coordinators = serializers.SerializerMethodField()
    name = serializers.ReadOnlyField()
    current_year_of_study = serializers.ReadOnlyField()
    current_semester_label = serializers.ReadOnlyField()
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = Cohort
        fields = [
            'id', 'programme', 'programme_code', 'programme_name',
            'intake_year', 'intake_year_label', 'coordinator', 'coordinator_name',
            'group_coordinators',
            'name', 'current_year_of_study', 'current_semester_label',
            'student_count', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_student_count(self, obj):
        return obj.students.filter(is_active=True).count()

    def get_group_coordinators(self, obj):
        entries = CohortGroupCoordinator.objects.filter(cohort=obj).select_related('coordinator')
        result = {}
        for entry in entries:
            result[entry.study_time] = {
                'coordinator_id': str(entry.coordinator_id) if entry.coordinator_id else None,
                'coordinator_name': (
                    f"{entry.coordinator.first_name} {entry.coordinator.last_name}".strip()
                    if entry.coordinator else None
                ),
            }
        return result


class TimetableSlotSerializer(serializers.ModelSerializer):
    """Serializer for TimetableSlot model."""

    duration_minutes = serializers.ReadOnlyField()
    course_code  = serializers.CharField(source='course.code', read_only=True)
    course_name  = serializers.CharField(source='course.name', read_only=True)
    cohort_name  = serializers.CharField(source='cohort.name', read_only=True, default=None)
    lecturer_name = serializers.SerializerMethodField()

    class Meta:
        model = TimetableSlot
        fields = [
            'id', 'course', 'course_code', 'course_name',
            'cohort', 'cohort_name',
            'lecturer', 'lecturer_name',
            'day_of_week', 'start_time', 'end_time',
            'room', 'building', 'study_time', 'duration_minutes', 'is_active'
        ]
        read_only_fields = ['id']

    def get_lecturer_name(self, obj):
        # Use slot-specific lecturer first, fall back to course lecturer
        lec = obj.lecturer or (obj.course.lecturer if obj.course else None)
        if lec:
            return f"{lec.first_name} {lec.last_name}".strip()
        return None



class FacultySerializer(serializers.ModelSerializer):
    dean_name = serializers.CharField(source='dean.full_name', read_only=True, default=None)
    course_count = serializers.SerializerMethodField()

    class Meta:
        model = Faculty
        fields = ['id', 'name', 'code', 'description', 'dean', 'dean_name', 'is_active', 'course_count', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_course_count(self, obj):
        return obj.courses.filter(is_active=True).count()


class AcademicPeriodSerializer(serializers.ModelSerializer):
    course_count = serializers.SerializerMethodField()

    class Meta:
        model = AcademicPeriod
        fields = ['id', 'academic_year', 'semester', 'start_date', 'end_date', 'is_current', 'course_count', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_course_count(self, obj):
        return obj.courses.filter(is_active=True).count()


class CourseListSerializer(serializers.ModelSerializer):
    """Serializer for listing courses."""

    lecturer_name = serializers.ReadOnlyField()
    total_students = serializers.ReadOnlyField()
    schedule = TimetableSlotSerializer(source='timetable_slots', many=True, read_only=True)
    faculty_name = serializers.CharField(source='faculty.name', read_only=True, default=None)
    academic_period_display = serializers.CharField(source='academic_period.__str__', read_only=True, default=None)
    programme_code = serializers.CharField(source='programme.code', read_only=True, default=None)
    coordinator_name = serializers.SerializerMethodField()
    coordinator_id = serializers.CharField(source='coordinator.id', read_only=True, default=None)

    def get_coordinator_name(self, obj):
        if obj.coordinator:
            return f"{obj.coordinator.first_name} {obj.coordinator.last_name}".strip()
        return None

    class Meta:
        model = Course
        fields = [
            'id', 'code', 'name', 'department', 'semester', 'academic_year',
            'faculty', 'faculty_name', 'academic_period', 'academic_period_display',
            'programme', 'programme_code', 'year_level', 'semester_number',
            'lecturer', 'lecturer_name', 'total_students', 'attendance_threshold',
            'coordinator', 'coordinator_id', 'coordinator_name',
            'is_active', 'schedule', 'created_at'
        ]


class CourseDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for Course model."""

    lecturer_name = serializers.ReadOnlyField()
    total_students = serializers.ReadOnlyField()
    schedule = TimetableSlotSerializer(source='timetable_slots', many=True, read_only=True)
    lecturer_info = serializers.SerializerMethodField()
    faculty_name = serializers.CharField(source='faculty.name', read_only=True, default=None)
    academic_period_display = serializers.CharField(source='academic_period.__str__', read_only=True, default=None)
    programme_code = serializers.CharField(source='programme.code', read_only=True, default=None)
    programme_name = serializers.CharField(source='programme.name', read_only=True, default=None)
    coordinator_name = serializers.SerializerMethodField()
    coordinator_id = serializers.CharField(source='coordinator.id', read_only=True, default=None)

    def get_coordinator_name(self, obj):
        if obj.coordinator:
            return f"{obj.coordinator.first_name} {obj.coordinator.last_name}".strip()
        return None

    class Meta:
        model = Course
        fields = [
            'id', 'code', 'name', 'description', 'credits', 'department',
            'semester', 'academic_year', 'faculty', 'faculty_name',
            'academic_period', 'academic_period_display',
            'programme', 'programme_code', 'programme_name', 'year_level', 'semester_number',
            'lecturer', 'lecturer_name',
            'lecturer_info', 'total_students', 'attendance_threshold',
            'coordinator', 'coordinator_id', 'coordinator_name',
            'is_active', 'schedule', 'created_at', 'updated_at'
        ]
    
    def get_lecturer_info(self, obj):
        if obj.lecturer:
            return {
                'id': str(obj.lecturer.id),
                'name': obj.lecturer.full_name,
                'email': obj.lecturer.email,
                'avatar': obj.lecturer.avatar.url if obj.lecturer.avatar else None
            }
        return None


class CourseCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating courses."""

    department = serializers.CharField(required=False, allow_blank=True, default="")
    semester = serializers.CharField(required=False, allow_blank=True, default="")
    academic_year = serializers.CharField(required=False, allow_blank=True, default="")

    class Meta:
        model = Course
        fields = [
            'code', 'name', 'description', 'credits', 'department',
            'semester', 'academic_year', 'faculty', 'academic_period',
            'programme', 'year_level', 'semester_number',
            'lecturer', 'coordinator', 'attendance_threshold', 'is_active'
        ]

    def validate_lecturer(self, value):
        if value and value.role != 'lecturer':
            raise serializers.ValidationError("Selected user is not a lecturer.")
        return value


class EnrollmentSerializer(serializers.ModelSerializer):
    """Serializer for Enrollment model."""
    
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    student_email = serializers.CharField(source='student.email', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    is_at_risk = serializers.ReadOnlyField()
    
    class Meta:
        model = Enrollment
        fields = [
            'id', 'student', 'student_name', 'student_id', 'student_email',
            'course', 'course_code', 'course_name', 'enrollment_date',
            'is_active', 'total_sessions', 'attended_sessions',
            'attendance_percentage', 'is_at_risk', 'created_at'
        ]
        read_only_fields = ['id', 'enrollment_date', 'total_sessions', 'attended_sessions', 'attendance_percentage', 'created_at']


class EnrollmentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating enrollments."""
    
    class Meta:
        model = Enrollment
        fields = ['student', 'course']
    
    def validate(self, attrs):
        student = attrs.get('student')
        course = attrs.get('course')
        
        if student.role != 'student':
            raise serializers.ValidationError({"student": "User is not a student."})
        
        if Enrollment.objects.filter(student=student, course=course).exists():
            raise serializers.ValidationError("Student is already enrolled in this course.")
        
        return attrs


class StudentCourseSerializer(serializers.ModelSerializer):
    """Serializer for student's view of their courses."""
    
    lecturer_name = serializers.ReadOnlyField()
    schedule = TimetableSlotSerializer(source='timetable_slots', many=True, read_only=True)
    enrollment_info = serializers.SerializerMethodField()
    
    class Meta:
        model = Course
        fields = [
            'id', 'code', 'name', 'description', 'credits', 'department',
            'semester', 'lecturer_name', 'attendance_threshold', 'schedule',
            'enrollment_info'
        ]
    
    def get_enrollment_info(self, obj):
        request = self.context.get('request')
        if request and request.user:
            try:
                enrollment = Enrollment.objects.get(student=request.user, course=obj)
                return {
                    'enrollment_id': str(enrollment.id),
                    'enrollment_date': enrollment.enrollment_date,
                    'total_sessions': enrollment.total_sessions,
                    'attended_sessions': enrollment.attended_sessions,
                    'attendance_percentage': float(enrollment.attendance_percentage),
                    'is_at_risk': enrollment.is_at_risk
                }
            except Enrollment.DoesNotExist:
                return None
        return None


class LecturerCourseSerializer(serializers.ModelSerializer):
    """Serializer for lecturer's view of their courses."""
    
    total_students = serializers.ReadOnlyField()
    schedule = TimetableSlotSerializer(source='timetable_slots', many=True, read_only=True)
    average_attendance = serializers.SerializerMethodField()
    at_risk_students = serializers.SerializerMethodField()
    
    class Meta:
        model = Course
        fields = [
            'id', 'code', 'name', 'description', 'credits', 'department',
            'semester', 'total_students', 'attendance_threshold', 'schedule',
            'average_attendance', 'at_risk_students', 'is_active', 'created_at'
        ]
    
    def get_average_attendance(self, obj):
        enrollments = obj.enrollments.filter(is_active=True)
        if enrollments.exists():
            total = sum(float(e.attendance_percentage) for e in enrollments)
            return round(total / enrollments.count(), 1)
        return 0
    
    def get_at_risk_students(self, obj):
        return obj.enrollments.filter(
            is_active=True,
            attendance_percentage__lt=obj.attendance_threshold
        ).count()
