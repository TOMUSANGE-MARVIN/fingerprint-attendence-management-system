"""
Analytics models for reporting and trends.
"""
from django.db import models
from django.conf import settings
import uuid


class AttendanceReport(models.Model):
    """
    Generated attendance reports for various time periods.
    """

    REPORT_TYPE_CHOICES = [
        ('daily', 'Daily Report'),
        ('weekly', 'Weekly Report'),
        ('monthly', 'Monthly Report'),
        ('semester', 'Semester Report'),
        ('custom', 'Custom Period Report'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('generating', 'Generating'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    report_type = models.CharField(max_length=20, choices=REPORT_TYPE_CHOICES)
    title = models.CharField(max_length=200)

    # Scope
    course = models.ForeignKey(
        'courses.Course',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='reports'
    )
    department = models.CharField(max_length=100, blank=True, null=True)

    # Period
    period_start = models.DateField()
    period_end = models.DateField()

    # Report data
    summary = models.JSONField(blank=True, null=True)  # Summary statistics
    detailed_data = models.JSONField(blank=True, null=True)  # Detailed breakdown

    # File
    file_path = models.FileField(upload_to='reports/', blank=True, null=True)
    file_format = models.CharField(max_length=10, default='pdf')

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True, null=True)

    # Generation info
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='generated_reports'
    )
    generated_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attendance_reports'
        verbose_name = 'Attendance Report'
        verbose_name_plural = 'Attendance Reports'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.report_type} - {self.title}"


class AttendanceTrend(models.Model):
    """
    Aggregated attendance trends for analytics.
    """

    GRANULARITY_CHOICES = [
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Scope
    course = models.ForeignKey(
        'courses.Course',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='trends'
    )
    department = models.CharField(max_length=100, blank=True, null=True)

    granularity = models.CharField(max_length=10, choices=GRANULARITY_CHOICES)
    date = models.DateField()  # The date or start of period

    # Metrics
    total_sessions = models.IntegerField(default=0)
    total_students_expected = models.IntegerField(default=0)
    total_present = models.IntegerField(default=0)
    total_late = models.IntegerField(default=0)
    total_absent = models.IntegerField(default=0)

    attendance_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attendance_trends'
        verbose_name = 'Attendance Trend'
        verbose_name_plural = 'Attendance Trends'
        ordering = ['-date']
        unique_together = ['course', 'department', 'granularity', 'date']

    def __str__(self):
        scope = self.course.code if self.course else (self.department or "Institution")
        return f"{scope} - {self.granularity} - {self.date}"
