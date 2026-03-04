"""
Management command to send upcoming lecture reminders.
Run every 5 mins via cron: */5 * * * * python manage.py send_lecture_reminders
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.courses.models import TimetableSlot, Enrollment
from apps.users.notification_service import NotificationService


class Command(BaseCommand):
    help = 'Send notifications for lectures starting in the next 15 minutes'

    def handle(self, *args, **options):
        now = timezone.localtime()
        today = now.date()
        day_name = today.strftime('%A').lower()
        
        # Find slots starting in the next 15 minutes
        reminder_time = (now + timedelta(minutes=15)).time()
        current_time = now.time()
        
        slots = TimetableSlot.objects.filter(
            day_of_week=day_name,
            is_active=True,
            start_time__gt=current_time,
            start_time__lte=reminder_time,
            course__is_active=True
        ).select_related('course', 'course__lecturer')
        
        notified_count = 0
        for slot in slots:
            # Calculate minutes until lecture
            from datetime import datetime
            slot_start = datetime.combine(today, slot.start_time)
            now_dt = datetime.combine(today, current_time)
            minutes_before = int((slot_start - now_dt).total_seconds() / 60)
            
            # Notify enrolled students
            enrollments = Enrollment.objects.filter(
                course=slot.course,
                is_active=True
            ).select_related('student')
            
            for enrollment in enrollments:
                NotificationService.notify_upcoming_lecture(
                    enrollment.student, slot, minutes_before
                )
                notified_count += 1
            
            # Notify lecturer
            if slot.course.lecturer:
                NotificationService.notify_lecturer_session_reminder(
                    slot.course.lecturer, slot, minutes_before
                )
                notified_count += 1
        
        self.stdout.write(self.style.SUCCESS(
            f"Sent {notified_count} lecture reminders."
        ))
