"""
Signals for attendance app.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import AttendanceRecord, AttendanceSession
from apps.courses.models import Enrollment


@receiver(post_save, sender=AttendanceRecord)
def update_enrollment_stats(sender, instance, **kwargs):
    """Update enrollment attendance stats when attendance is recorded."""
    try:
        enrollment = Enrollment.objects.get(
            student=instance.student,
            course=instance.session.course
        )
        enrollment.update_attendance_stats()
        
        # Check if student is now at risk
        if enrollment.is_at_risk and instance.status in ['present', 'absent']:
            from apps.users.notification_service import NotificationService
            NotificationService.notify_at_risk(
                instance.student,
                instance.session.course,
                float(enrollment.attendance_percentage),
                enrollment.course.attendance_threshold
            )
    except Enrollment.DoesNotExist:
        pass
