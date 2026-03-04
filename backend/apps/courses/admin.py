"""
Admin configuration for Courses app.
"""
from django.contrib import admin
from .models import Course, Enrollment, TimetableSlot, Faculty, AcademicPeriod, AcademicYear, Programme, Cohort


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'department', 'lecturer', 'semester', 'total_students', 'is_active')
    list_filter = ('department', 'semester', 'is_active')
    search_fields = ('code', 'name', 'lecturer__email')
    ordering = ('code',)
    
    fieldsets = (
        (None, {'fields': ('code', 'name', 'description')}),
        ('Academic Info', {'fields': ('credits', 'department', 'semester', 'academic_year', 'programme', 'year_level', 'semester_number')}),
        ('Assignment', {'fields': ('lecturer', 'attendance_threshold')}),
        ('Status', {'fields': ('is_active',)}),
    )


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('student', 'course', 'enrollment_date', 'attendance_percentage', 'is_active')
    list_filter = ('course', 'is_active', 'enrollment_date')
    search_fields = ('student__email', 'student__student_id', 'course__code')
    ordering = ('-enrollment_date',)
    readonly_fields = ('total_sessions', 'attended_sessions', 'attendance_percentage')


@admin.register(TimetableSlot)
class TimetableSlotAdmin(admin.ModelAdmin):
    list_display = ('course', 'cohort', 'day_of_week', 'start_time', 'end_time', 'room', 'is_active')
    list_filter = ('day_of_week', 'course', 'cohort', 'is_active')
    search_fields = ('course__code', 'room', 'building', 'cohort__programme__code')
    ordering = ('day_of_week', 'start_time')


@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'dean', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'code')
    ordering = ('name',)


@admin.register(AcademicPeriod)
class AcademicPeriodAdmin(admin.ModelAdmin):
    list_display = ('academic_year', 'semester', 'start_date', 'end_date', 'is_current')
    list_filter = ('is_current', 'academic_year')
    ordering = ('-start_date',)


@admin.register(AcademicYear)
class AcademicYearAdmin(admin.ModelAdmin):
    list_display = ('label', 'start_year', 'is_current', 'start_date', 'end_date')
    list_filter = ('is_current',)
    ordering = ('-start_year',)


@admin.register(Programme)
class ProgrammeAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'duration_years', 'faculty', 'is_active')
    list_filter = ('is_active', 'faculty')
    search_fields = ('code', 'name')
    ordering = ('code',)


@admin.register(Cohort)
class CohortAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'programme', 'intake_year', 'coordinator', 'current_year_of_study', 'is_active')
    list_filter = ('is_active', 'programme')
    search_fields = ('programme__code', 'intake_year__label', 'coordinator__email')
    ordering = ('programme', '-intake_year__start_year')
    readonly_fields = ('current_year_of_study', 'current_semester_label')
