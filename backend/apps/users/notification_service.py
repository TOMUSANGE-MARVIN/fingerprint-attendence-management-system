"""
Notification service for creating and managing user notifications.
"""
from .models import Notification


class NotificationService:
    """Service for creating notifications."""
    
    @staticmethod
    def notify_upcoming_lecture(student, timetable_slot, minutes_before=15):
        """Create notification for upcoming lecture."""
        Notification.objects.create(
            user=student,
            title="Upcoming Lecture",
            message=f"{timetable_slot.course.code} - {timetable_slot.course.name} starts in {minutes_before} minutes at {timetable_slot.room or 'TBA'}, {timetable_slot.building or ''}.",
            notification_type="info",
            link=f"/student/timetable"
        )
    
    @staticmethod
    def notify_attendance_confirmed(student, session, status):
        """Notify student their attendance was recorded."""
        status_text = "present" if status in ["present", "late"] else status
        Notification.objects.create(
            user=student,
            title="Attendance Recorded",
            message=f"You were marked as {status_text} for {session.course.code} - {session.course.name} on {session.date}.",
            notification_type="success",
            link=f"/student/attendance"
        )
    
    @staticmethod
    def notify_missed_lecture(student, session):
        """Alert student they missed a lecture."""
        Notification.objects.create(
            user=student,
            title="Missed Lecture",
            message=f"You missed {session.course.code} - {session.course.name} on {session.date}. Please check with your lecturer.",
            notification_type="warning",
            link=f"/student/attendance"
        )
    
    @staticmethod
    def notify_at_risk(student, course, current_percentage, threshold):
        """Warn student they are below attendance threshold."""
        Notification.objects.create(
            user=student,
            title="Attendance Warning",
            message=f"Your attendance for {course.code} - {course.name} is {current_percentage}%, below the required {threshold}%. Please improve your attendance.",
            notification_type="warning",
            link=f"/student/courses"
        )
    
    @staticmethod
    def notify_lecturer_session_reminder(lecturer, timetable_slot, minutes_before=15):
        """Remind lecturer about upcoming session."""
        Notification.objects.create(
            user=lecturer,
            title="Upcoming Session",
            message=f"Your {timetable_slot.course.code} class starts in {minutes_before} minutes at {timetable_slot.room or 'TBA'}.",
            notification_type="info",
            link=f"/lecturer/attendance"
        )
    
    @staticmethod
    def notify_fingerprint_registered(student):
        """Confirm fingerprint registration."""
        Notification.objects.create(
            user=student,
            title="Fingerprint Registered",
            message="Your fingerprint has been registered successfully. You can now mark attendance using biometric verification.",
            notification_type="success",
            link="/student"
        )
