"""
Management command to auto-create attendance sessions from timetable.
Run daily via cron: 0 6 * * * python manage.py create_daily_sessions
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.courses.models import TimetableSlot
from apps.attendance.models import AttendanceSession


class Command(BaseCommand):
    help = 'Create attendance sessions for today based on timetable slots'

    def handle(self, *args, **options):
        today = timezone.now().date()
        day_name = today.strftime('%A').lower()
        
        slots = TimetableSlot.objects.filter(
            day_of_week=day_name,
            is_active=True,
            course__is_active=True
        ).select_related('course', 'course__lecturer')
        
        created_count = 0
        for slot in slots:
            session, created = AttendanceSession.objects.get_or_create(
                course=slot.course,
                date=today,
                start_time=slot.start_time,
                defaults={
                    'end_time': slot.end_time,
                    'lecturer': slot.course.lecturer,
                    'room': slot.room,
                    'building': slot.building,
                    'session_type': 'lecture',
                    'title': f"{slot.course.code} - {slot.course.name}",
                }
            )
            if created:
                created_count += 1
                self.stdout.write(f"  Created session: {session}")
        
        self.stdout.write(self.style.SUCCESS(
            f"Done. Created {created_count} sessions for {day_name.capitalize()}, {today}."
        ))
