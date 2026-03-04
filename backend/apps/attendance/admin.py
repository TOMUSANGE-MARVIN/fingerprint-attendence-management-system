"""
Admin configuration for Attendance app.
"""
from django.contrib import admin
from .models import AttendanceSession, AttendanceRecord, AttendanceSummary


@admin.register(AttendanceSession)
class AttendanceSessionAdmin(admin.ModelAdmin):
    list_display = ('course', 'date', 'start_time', 'session_type', 'is_active', 'attendance_rate')
    list_filter = ('is_active', 'session_type', 'course', 'date')
    search_fields = ('course__code', 'course__name', 'lecturer__email')
    ordering = ('-date', '-start_time')
    date_hierarchy = 'date'
    
    fieldsets = (
        (None, {'fields': ('course', 'lecturer', 'title', 'session_type')}),
        ('Schedule', {'fields': ('date', 'start_time', 'end_time')}),
        ('Location', {'fields': ('room', 'building')}),
        ('Settings', {'fields': ('allow_late_marking', 'late_threshold_minutes')}),
        ('Status', {'fields': ('is_active', 'started_at', 'ended_at')}),
        ('Notes', {'fields': ('notes',)}),
    )
    readonly_fields = ('started_at', 'ended_at')


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ('student', 'session', 'status', 'verification_method', 'marked_at')
    list_filter = ('status', 'verification_method', 'session__course', 'session__date')
    search_fields = ('student__email', 'student__student_id', 'session__course__code')
    ordering = ('-created_at',)
    
    fieldsets = (
        (None, {'fields': ('session', 'student')}),
        ('Attendance', {'fields': ('status', 'verification_method', 'verification_confidence')}),
        ('Marking', {'fields': ('marked_at', 'marked_by')}),
        ('Notes', {'fields': ('notes', 'excuse_reason')}),
    )
    readonly_fields = ('marked_at',)


@admin.register(AttendanceSummary)
class AttendanceSummaryAdmin(admin.ModelAdmin):
    list_display = ('student', 'course', 'attendance_percentage', 'total_sessions', 'current_streak')
    list_filter = ('course', 'period_start', 'period_end')
    search_fields = ('student__email', 'student__student_id', 'course__code')
    ordering = ('-updated_at',)
    readonly_fields = ('total_sessions', 'present_count', 'late_count', 'absent_count', 'excused_count', 'attendance_percentage')
