"""
Serializers for Attendance models.
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import AttendanceSession, AttendanceRecord, AttendanceSummary

User = get_user_model()


class AttendanceRecordSerializer(serializers.ModelSerializer):
    """Serializer for AttendanceRecord."""
    
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    student_email = serializers.CharField(source='student.email', read_only=True)
    marked_by_name = serializers.CharField(source='marked_by.full_name', read_only=True)
    
    class Meta:
        model = AttendanceRecord
        fields = [
            'id', 'session', 'student', 'student_name', 'student_id', 'student_email',
            'status', 'verification_method', 'marked_at', 'marked_by', 'marked_by_name',
            'verification_confidence', 'notes', 'excuse_reason', 'created_at'
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
    
    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['lecturer'] = request.user if request else None
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
