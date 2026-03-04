"""
Report service for attendance analytics (rule-based).
"""
from django.db.models import Count, Avg, Q
from django.utils import timezone
from datetime import timedelta
from apps.attendance.models import AttendanceRecord, AttendanceSession
from apps.courses.models import Course, Enrollment
from django.contrib.auth import get_user_model

User = get_user_model()


class ReportService:
    """Service for generating rule-based attendance reports and analytics."""

    @staticmethod
    def get_at_risk_students(course=None, threshold=75):
        """Get students whose attendance is below the given threshold."""
        queryset = Enrollment.objects.filter(is_active=True)

        if course:
            queryset = queryset.filter(course=course)
            threshold = course.attendance_threshold

        at_risk = queryset.filter(attendance_percentage__lt=threshold)

        return [
            {
                'student_id': str(e.student.id),
                'student_name': e.student.full_name,
                'student_email': e.student.email,
                'course_code': e.course.code,
                'course_name': e.course.name,
                'attendance_percentage': float(e.attendance_percentage),
                'threshold': threshold,
                'gap': round(threshold - float(e.attendance_percentage), 1),
                'total_sessions': e.total_sessions,
                'attended_sessions': e.attended_sessions,
            }
            for e in at_risk.select_related('student', 'course')
        ]

    @staticmethod
    def generate_attendance_report(course, period_start, period_end):
        """Generate an attendance report for a course over a date range."""
        records = AttendanceRecord.objects.filter(
            session__course=course,
            session__date__gte=period_start,
            session__date__lte=period_end,
        )

        total = records.count()
        present = records.filter(status='present').count()
        late = records.filter(status='late').count()
        absent = records.filter(status='absent').count()
        excused = records.filter(status='excused').count()

        # Per-session breakdown
        sessions = AttendanceSession.objects.filter(
            course=course,
            date__gte=period_start,
            date__lte=period_end,
        ).order_by('date')

        session_data = []
        for session in sessions:
            session_data.append({
                'date': session.date.isoformat(),
                'title': session.title,
                'attendance_rate': session.attendance_rate,
                'present': session.present_count,
                'late': session.late_count,
                'absent': session.absent_count,
            })

        return {
            'course': {
                'id': str(course.id),
                'code': course.code,
                'name': course.name,
            },
            'period': {
                'start': period_start.isoformat(),
                'end': period_end.isoformat(),
            },
            'summary': {
                'total_records': total,
                'present': present,
                'late': late,
                'absent': absent,
                'excused': excused,
                'attendance_rate': round((present + late) / total * 100, 1) if total > 0 else 0,
            },
            'sessions': session_data,
        }

    @staticmethod
    def calculate_attendance_trends(course=None, department=None, granularity='weekly'):
        """Calculate attendance trends grouped by granularity."""
        records = AttendanceRecord.objects.all()

        if course:
            records = records.filter(session__course=course)
        if department:
            records = records.filter(session__course__department=department)

        # Get date range
        thirty_days_ago = timezone.now().date() - timedelta(days=30)
        records = records.filter(session__date__gte=thirty_days_ago)

        # Group by date
        trend_data = []
        current_date = thirty_days_ago
        today = timezone.now().date()

        if granularity == 'daily':
            while current_date <= today:
                day_records = records.filter(session__date=current_date)
                total = day_records.count()
                present = day_records.filter(status__in=['present', 'late']).count()
                rate = round((present / total * 100), 1) if total > 0 else 0
                if total > 0:
                    trend_data.append({
                        'date': current_date.isoformat(),
                        'rate': rate,
                        'total': total,
                        'present': present,
                    })
                current_date += timedelta(days=1)
        elif granularity == 'weekly':
            # Group into weeks
            week_start = thirty_days_ago
            while week_start <= today:
                week_end = min(week_start + timedelta(days=6), today)
                week_records = records.filter(
                    session__date__gte=week_start,
                    session__date__lte=week_end,
                )
                total = week_records.count()
                present = week_records.filter(status__in=['present', 'late']).count()
                rate = round((present / total * 100), 1) if total > 0 else 0
                if total > 0:
                    trend_data.append({
                        'week_start': week_start.isoformat(),
                        'week_end': week_end.isoformat(),
                        'rate': rate,
                        'total': total,
                        'present': present,
                    })
                week_start += timedelta(days=7)

        return trend_data
