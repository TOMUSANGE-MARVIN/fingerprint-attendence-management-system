"""
Views for Analytics and Reporting.
"""
from rest_framework import generics, viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Count, Avg, Sum, Q
from datetime import timedelta
from .models import AttendanceReport, AttendanceTrend
from .serializers import (
    AttendanceReportSerializer,
    AttendanceReportCreateSerializer, AttendanceTrendSerializer
)
from .services import ReportService
from apps.users.permissions import IsAdmin, IsLecturer, IsStudent, IsLecturerOrAdmin
from apps.attendance.models import AttendanceRecord, AttendanceSession
from apps.courses.models import Course, Enrollment

User = get_user_model()


class AttendanceReportViewSet(viewsets.ModelViewSet):
    """ViewSet for Attendance Reports."""
    permission_classes = [permissions.IsAuthenticated, IsLecturerOrAdmin]

    def get_queryset(self):
        user = self.request.user
        queryset = AttendanceReport.objects.all()

        if user.role == 'lecturer':
            queryset = queryset.filter(
                Q(generated_by=user) | Q(course__lecturer=user)
            )

        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return AttendanceReportCreateSerializer
        return AttendanceReportSerializer

    def perform_create(self, serializer):
        report = serializer.save(generated_by=self.request.user)
        self._generate_report(report)

    def _generate_report(self, report):
        """Generate report data."""
        records = AttendanceRecord.objects.filter(
            session__date__gte=report.period_start,
            session__date__lte=report.period_end
        )

        if report.course:
            records = records.filter(session__course=report.course)
        if report.department:
            records = records.filter(session__course__department=report.department)

        total = records.count()
        present = records.filter(status='present').count()
        late = records.filter(status='late').count()
        absent = records.filter(status='absent').count()

        report.summary = {
            'total_records': total,
            'present': present,
            'late': late,
            'absent': absent,
            'attendance_rate': round((present + late) / total * 100, 1) if total > 0 else 0
        }
        report.status = 'completed'
        report.generated_at = timezone.now()
        report.save()


class AttendanceTrendViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for Attendance Trends."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AttendanceTrendSerializer

    def get_queryset(self):
        queryset = AttendanceTrend.objects.all()

        course_id = self.request.query_params.get('course')
        department = self.request.query_params.get('department')
        granularity = self.request.query_params.get('granularity')

        if course_id:
            queryset = queryset.filter(course_id=course_id)
        if department:
            queryset = queryset.filter(department=department)
        if granularity:
            queryset = queryset.filter(granularity=granularity)

        return queryset


class AtRiskStudentsView(APIView):
    """Get students at risk of falling below attendance threshold."""
    permission_classes = [permissions.IsAuthenticated, IsLecturerOrAdmin]

    def get(self, request):
        course_id = request.query_params.get('course')
        threshold = int(request.query_params.get('threshold', 75))

        course = None
        if course_id:
            try:
                course = Course.objects.get(id=course_id)
                if request.user.role == 'lecturer' and course.lecturer != request.user:
                    return Response(
                        {"error": "Access denied"},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except Course.DoesNotExist:
                return Response(
                    {"error": "Course not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

        students = ReportService.get_at_risk_students(course=course, threshold=threshold)
        return Response(students)


class DashboardAnalyticsView(APIView):
    """Get analytics data for dashboards."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role == 'student':
            return self._student_analytics(user)
        elif user.role == 'lecturer':
            return self._lecturer_analytics(user)
        elif user.role == 'admin':
            return self._admin_analytics()

        return Response({})

    def _student_analytics(self, student):
        """Get analytics for student dashboard."""
        enrollments = Enrollment.objects.filter(student=student, is_active=True)

        total_sessions = sum(e.total_sessions for e in enrollments)
        attended_sessions = sum(e.attended_sessions for e in enrollments)
        overall_rate = round((attended_sessions / total_sessions * 100), 1) if total_sessions > 0 else 0

        at_risk_courses = [e.course.code for e in enrollments if e.is_at_risk]

        thirty_days_ago = timezone.now() - timedelta(days=30)
        records = AttendanceRecord.objects.filter(
            student=student,
            session__date__gte=thirty_days_ago.date()
        ).order_by('session__date')

        trend_data = []
        current_date = thirty_days_ago.date()
        while current_date <= timezone.now().date():
            day_records = records.filter(session__date=current_date)
            if day_records.exists():
                present = day_records.filter(status__in=['present', 'late']).count()
                total = day_records.count()
                rate = round((present / total * 100), 1) if total > 0 else 0
                trend_data.append({
                    'date': current_date.isoformat(),
                    'rate': rate
                })
            current_date += timedelta(days=1)

        return Response({
            'overall_attendance': overall_rate,
            'total_courses': enrollments.count(),
            'at_risk_courses': at_risk_courses,
            'attended_sessions': attended_sessions,
            'total_sessions': total_sessions,
            'trend': trend_data
        })

    def _lecturer_analytics(self, lecturer):
        """Get analytics for lecturer dashboard."""
        courses = Course.objects.filter(lecturer=lecturer)

        course_stats = []
        for course in courses:
            enrollments = course.enrollments.filter(is_active=True)
            sessions = course.attendance_sessions.all()

            avg_attendance = 0
            if sessions.exists():
                total_present = sum(s.present_count + s.late_count for s in sessions)
                total_expected = sum(s.total_enrolled for s in sessions)
                avg_attendance = round((total_present / total_expected * 100), 1) if total_expected > 0 else 0

            at_risk = enrollments.filter(
                attendance_percentage__lt=course.attendance_threshold
            ).count()

            course_stats.append({
                'course_id': str(course.id),
                'course_code': course.code,
                'course_name': course.name,
                'total_students': enrollments.count(),
                'average_attendance': avg_attendance,
                'at_risk_count': at_risk,
                'total_sessions': sessions.count()
            })

        active_sessions = AttendanceSession.objects.filter(
            lecturer=lecturer,
            is_active=True
        ).count()

        today_sessions = AttendanceSession.objects.filter(
            lecturer=lecturer,
            date=timezone.now().date()
        ).count()

        return Response({
            'courses': course_stats,
            'total_courses': courses.count(),
            'active_sessions': active_sessions,
            'today_sessions': today_sessions
        })

    def _admin_analytics(self):
        """Get analytics for admin dashboard."""
        total_students = User.objects.filter(role='student', is_active=True).count()
        total_lecturers = User.objects.filter(role='lecturer', is_active=True).count()
        total_courses = Course.objects.filter(is_active=True).count()

        all_records = AttendanceRecord.objects.all()
        total_records = all_records.count()
        present_records = all_records.filter(status__in=['present', 'late']).count()
        avg_attendance = round((present_records / total_records * 100), 1) if total_records > 0 else 0

        active_sessions = AttendanceSession.objects.filter(is_active=True).count()

        at_risk_count = Enrollment.objects.filter(
            is_active=True
        ).exclude(
            attendance_percentage__gte=75
        ).values('student').distinct().count()

        # Attendance by department with student counts
        attendance_by_department = []
        departments = set(Course.objects.filter(is_active=True).values_list('department', flat=True))
        for dept in departments:
            if not dept:
                continue
            dept_courses = Course.objects.filter(department=dept, is_active=True)
            dept_enrollments = Enrollment.objects.filter(course__in=dept_courses, is_active=True)
            student_count = dept_enrollments.values('student').distinct().count()
            
            dept_records = AttendanceRecord.objects.filter(session__course__in=dept_courses)
            dept_total = dept_records.count()
            dept_present = dept_records.filter(status__in=['present', 'late']).count()
            dept_percentage = round((dept_present / dept_total * 100), 1) if dept_total > 0 else 0
            
            attendance_by_department.append({
                'department': dept,
                'percentage': dept_percentage,
                'student_count': student_count
            })
        
        # Sort by percentage descending
        attendance_by_department.sort(key=lambda x: x['percentage'], reverse=True)

        # Weekly trends formatted for frontend charts
        recent_trends = []
        for i in range(5, -1, -1):
            week_start = timezone.now() - timedelta(weeks=i+1)
            week_end = timezone.now() - timedelta(weeks=i)
            week_records = all_records.filter(
                session__date__gte=week_start.date(),
                session__date__lt=week_end.date()
            )
            total = week_records.count()
            present = week_records.filter(status__in=['present', 'late']).count()
            percentage = round((present / total * 100), 1) if total > 0 else 0
            recent_trends.append({
                'period': f'Week {6-i}',
                'percentage': percentage,
                'sessions_attended': present,
                'total_sessions': total
            })

        return Response({
            'total_students': total_students,
            'total_lecturers': total_lecturers,
            'total_courses': total_courses,
            'active_sessions': active_sessions,
            'average_attendance': avg_attendance,
            'students_at_risk': at_risk_count,
            'attendance_by_department': attendance_by_department,
            'recent_trends': recent_trends
        })


class CourseAnalyticsView(APIView):
    """Get detailed analytics for a specific course."""
    permission_classes = [permissions.IsAuthenticated, IsLecturerOrAdmin]

    def get(self, request, course_id):
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response(
                {"error": "Course not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        if request.user.role == 'lecturer' and course.lecturer != request.user:
            return Response(
                {"error": "Access denied"},
                status=status.HTTP_403_FORBIDDEN
            )

        sessions = course.attendance_sessions.all()
        enrollments = course.enrollments.filter(is_active=True)

        session_data = []
        for session in sessions.order_by('date'):
            session_data.append({
                'date': session.date.isoformat(),
                'attendance_rate': session.attendance_rate,
                'present': session.present_count,
                'late': session.late_count,
                'absent': session.absent_count
            })

        distribution = {
            'excellent': enrollments.filter(attendance_percentage__gte=90).count(),
            'good': enrollments.filter(attendance_percentage__gte=75, attendance_percentage__lt=90).count(),
            'at_risk': enrollments.filter(attendance_percentage__gte=50, attendance_percentage__lt=75).count(),
            'critical': enrollments.filter(attendance_percentage__lt=50).count()
        }

        top_students = enrollments.order_by('-attendance_percentage')[:5]
        bottom_students = enrollments.order_by('attendance_percentage')[:5]

        return Response({
            'course': {
                'id': str(course.id),
                'code': course.code,
                'name': course.name,
                'threshold': course.attendance_threshold
            },
            'summary': {
                'total_sessions': sessions.count(),
                'total_students': enrollments.count(),
                'average_attendance': round(
                    sum(float(e.attendance_percentage) for e in enrollments) / enrollments.count(), 1
                ) if enrollments.exists() else 0
            },
            'session_data': session_data,
            'distribution': distribution,
            'top_students': [
                {
                    'name': e.student.full_name,
                    'student_id': e.student.student_id,
                    'attendance': float(e.attendance_percentage)
                }
                for e in top_students
            ],
            'bottom_students': [
                {
                    'name': e.student.full_name,
                    'student_id': e.student.student_id,
                    'attendance': float(e.attendance_percentage)
                }
                for e in bottom_students
            ]
        })
