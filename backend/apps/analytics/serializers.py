"""
Serializers for Analytics models.
"""
from rest_framework import serializers
from .models import AttendanceReport, AttendanceTrend


class AttendanceReportSerializer(serializers.ModelSerializer):
    """Serializer for Attendance Reports."""

    course_code = serializers.CharField(source='course.code', read_only=True)
    generated_by_name = serializers.CharField(source='generated_by.full_name', read_only=True)

    class Meta:
        model = AttendanceReport
        fields = [
            'id', 'report_type', 'title', 'course', 'course_code', 'department',
            'period_start', 'period_end', 'summary', 'file_path', 'file_format',
            'status', 'generated_by', 'generated_by_name', 'generated_at', 'created_at'
        ]
        read_only_fields = ['id', 'status', 'generated_at', 'created_at']


class AttendanceReportCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating attendance reports."""

    class Meta:
        model = AttendanceReport
        fields = ['report_type', 'title', 'course', 'department', 'period_start', 'period_end', 'file_format']


class AttendanceTrendSerializer(serializers.ModelSerializer):
    """Serializer for Attendance Trends."""

    course_code = serializers.CharField(source='course.code', read_only=True)

    class Meta:
        model = AttendanceTrend
        fields = [
            'id', 'course', 'course_code', 'department', 'granularity', 'date',
            'total_sessions', 'total_students_expected', 'total_present',
            'total_late', 'total_absent', 'attendance_rate', 'created_at'
        ]


class DashboardStatsSerializer(serializers.Serializer):
    """Serializer for dashboard statistics."""

    total_students = serializers.IntegerField()
    total_lecturers = serializers.IntegerField()
    total_courses = serializers.IntegerField()
    active_sessions = serializers.IntegerField()
    average_attendance = serializers.FloatField()
    students_at_risk = serializers.IntegerField()


class ChartDataSerializer(serializers.Serializer):
    """Serializer for chart data."""

    labels = serializers.ListField(child=serializers.CharField())
    datasets = serializers.ListField(child=serializers.DictField())
