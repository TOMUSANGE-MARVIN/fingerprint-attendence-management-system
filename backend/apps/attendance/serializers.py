"""
Serializers for Attendance models.
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import AttendanceSession, AttendanceRecord, AttendanceSummary
from apps.courses.models import TimetableSlot

User = get_user_model()


class AttendanceRecordSerializer(serializers.ModelSerializer):
    """Serializer for AttendanceRecord."""
    
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    student_email = serializers.CharField(source='student.email', read_only=True)
    marked_by_name = serializers.CharField(source='marked_by.full_name', read_only=True)
    session_date = serializers.DateField(source='session.date', read_only=True)
    session_start_time = serializers.TimeField(source='session.start_time', read_only=True)
    course_code = serializers.CharField(source='session.course.code', read_only=True)
    course_name = serializers.CharField(source='session.course.name', read_only=True)
    
    class Meta:
        model = AttendanceRecord
        fields = [
            'id', 'session', 'student', 'student_name', 'student_id', 'student_email',
            'status', 'verification_method', 'marked_at', 'marked_by', 'marked_by_name',
            'verification_confidence', 'notes', 'excuse_reason', 'created_at',
            'session_date', 'session_start_time', 'course_code', 'course_name'
        ]
        read_only_fields = ['id', 'created_at']


class AttendanceRecordCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating attendance records."""
    
    class Meta:
        model = AttendanceRecord
        fields = ['session', 'student', 'status', 'verification_method', 'notes']
    
    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['marked_by'] = request.user if request else None
        validated_data['marked_at'] = validated_data.get('marked_at') or None
        
        record, created = AttendanceRecord.objects.update_or_create(
            session=validated_data['session'],
            student=validated_data['student'],
            defaults=validated_data
        )
        return record


class BulkAttendanceSerializer(serializers.Serializer):
    """Serializer for bulk attendance marking."""
    
    session_id = serializers.UUIDField()
    records = serializers.ListField(
        child=serializers.DictField(
            child=serializers.CharField()
        )
    )
    
    def validate_records(self, value):
        for record in value:
            if 'student_id' not in record:
                raise serializers.ValidationError("Each record must have a student_id")
            if 'status' not in record:
                record['status'] = 'present'
        return value


class AttendanceSessionListSerializer(serializers.ModelSerializer):
    """Serializer for listing attendance sessions."""

    course_code = serializers.CharField(source='course.code', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    lecturer_name = serializers.CharField(source='lecturer.full_name', read_only=True)
    total_enrolled = serializers.ReadOnlyField()
    present_count = serializers.ReadOnlyField()
    attendance_rate = serializers.ReadOnlyField()
    is_expired = serializers.ReadOnlyField()

    class Meta:
        model = AttendanceSession
        fields = [
            'id', 'course', 'course_code', 'course_name', 'lecturer', 'lecturer_name',
            'title', 'session_type', 'date', 'start_time', 'end_time',
            'is_active', 'is_expired', 'room', 'total_enrolled', 'present_count', 'attendance_rate',
            'created_at'
        ]


class AttendanceSessionDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for attendance session."""
    
    course_code = serializers.CharField(source='course.code', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    lecturer_name = serializers.CharField(source='lecturer.full_name', read_only=True)
    total_enrolled = serializers.ReadOnlyField()
    present_count = serializers.ReadOnlyField()
    late_count = serializers.ReadOnlyField()
    absent_count = serializers.ReadOnlyField()
    attendance_rate = serializers.ReadOnlyField()
    is_expired = serializers.ReadOnlyField()
    attendance_records = AttendanceRecordSerializer(many=True, read_only=True)

    class Meta:
        model = AttendanceSession
        fields = [
            'id', 'course', 'course_code', 'course_name', 'lecturer', 'lecturer_name',
            'title', 'session_type', 'date', 'start_time', 'end_time',
            'is_active', 'is_expired', 'started_at', 'ended_at', 'room', 'building',
            'allow_late_marking', 'late_threshold_minutes', 'notes',
            'total_enrolled', 'present_count', 'late_count', 'absent_count',
            'attendance_rate', 'attendance_records', 'created_at', 'updated_at'
        ]


class AttendanceSessionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating attendance sessions."""

    class Meta:
        model = AttendanceSession
        fields = [
            'id', 'course', 'timetable_slot', 'title', 'session_type', 'date', 'start_time', 'end_time',
            'room', 'building', 'allow_late_marking', 'late_threshold_minutes', 'notes'
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'course': {'required': False},
            'date': {'required': False},
            'start_time': {'required': False},
            'end_time': {'required': False},
        }

    def validate(self, attrs):
        request = self.context.get('request')
        course = attrs.get('course')
        timetable_slot = attrs.get('timetable_slot')
        session_date = attrs.get('date') or timezone.localdate()
        attrs['date'] = session_date

        # Timetable controls sessions: use provided slot or infer it from course + date (+ study_time).
        if timetable_slot:
            if course and timetable_slot.course_id != course.id:
                raise serializers.ValidationError({
                    'timetable_slot': 'Selected timetable slot does not belong to the selected course.'
                })
            attrs['course'] = timetable_slot.course
        else:
            if not course:
                raise serializers.ValidationError({
                    'course': 'course is required when timetable_slot is not provided.'
                })
            day_name = session_date.strftime('%A').lower()
            slots = TimetableSlot.objects.filter(
                course=course,
                day_of_week=day_name,
                is_active=True
            )
            if request and getattr(request.user, 'study_time', None):
                slots = slots.filter(study_time=request.user.study_time)

            slot_count = slots.count()
            if slot_count == 0:
                raise serializers.ValidationError({
                    'timetable_slot': (
                        f'No active timetable slot found for {course.code} on {day_name}. '
                        'Create/update timetable first or choose a matching session date.'
                    )
                })
            if slot_count > 1:
                raise serializers.ValidationError({
                    'timetable_slot': 'Multiple timetable slots match. Please specify timetable_slot explicitly.'
                })
            timetable_slot = slots.first()
            attrs['timetable_slot'] = timetable_slot

        expected_day = timetable_slot.day_of_week
        actual_day = session_date.strftime('%A').lower()
        if expected_day != actual_day:
            raise serializers.ValidationError({
                'date': f'Session date must be on {expected_day.title()} to match timetable slot.'
            })

        # Lock schedule fields to timetable slot values.
        attrs['start_time'] = timetable_slot.start_time
        attrs['end_time'] = timetable_slot.end_time
        if not attrs.get('room'):
            attrs['room'] = timetable_slot.room
        if not attrs.get('building'):
            attrs['building'] = timetable_slot.building

        if AttendanceSession.objects.filter(
            course=attrs['course'],
            timetable_slot=timetable_slot,
            date=session_date
        ).exists():
            raise serializers.ValidationError({
                'non_field_errors': ['A session for this timetable slot and date already exists.']
            })

        return attrs
    
    def create(self, validated_data):
        request = self.context.get('request')
        if request:
            if request.user.role == 'lecturer':
                validated_data['lecturer'] = request.user
            else:
                slot = validated_data.get('timetable_slot')
                validated_data['lecturer'] = (
                    slot.lecturer if slot and slot.lecturer else validated_data['course'].lecturer
                )
        return super().create(validated_data)


class AttendanceSummarySerializer(serializers.ModelSerializer):
    """Serializer for AttendanceSummary."""
    
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    
    class Meta:
        model = AttendanceSummary
        fields = [
            'id', 'student', 'student_name', 'course', 'course_code', 'course_name',
            'total_sessions', 'present_count', 'late_count', 'absent_count', 'excused_count',
            'attendance_percentage', 'current_streak', 'longest_streak',
            'period_start', 'period_end', 'updated_at'
        ]


class StudentAttendanceSerializer(serializers.Serializer):
    """Serializer for student's attendance view."""
    
    course_id = serializers.UUIDField()
    course_code = serializers.CharField()
    course_name = serializers.CharField()
    total_sessions = serializers.IntegerField()
    attended = serializers.IntegerField()
    late = serializers.IntegerField()
    absent = serializers.IntegerField()
    attendance_percentage = serializers.FloatField()
    threshold = serializers.IntegerField()
    is_at_risk = serializers.BooleanField()
    recent_records = AttendanceRecordSerializer(many=True)
