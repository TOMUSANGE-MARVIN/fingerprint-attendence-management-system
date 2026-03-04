"""
Admin configuration for Analytics app.
"""
from django.contrib import admin
from .models import AttendanceReport, AttendanceTrend


@admin.register(AttendanceReport)
class AttendanceReportAdmin(admin.ModelAdmin):
    list_display = ('title', 'report_type', 'course', 'status', 'generated_by', 'generated_at')
    list_filter = ('report_type', 'status', 'created_at')
    search_fields = ('title', 'course__code', 'generated_by__email')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'generated_at', 'created_at')


@admin.register(AttendanceTrend)
class AttendanceTrendAdmin(admin.ModelAdmin):
    list_display = ('date', 'granularity', 'course', 'department', 'attendance_rate', 'total_sessions')
    list_filter = ('granularity', 'course', 'department')
    ordering = ('-date',)
    readonly_fields = ('id', 'created_at')
