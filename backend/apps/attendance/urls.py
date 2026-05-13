"""
URL patterns for attendance endpoints.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AttendanceSessionViewSet, AttendanceRecordViewSet,
    StudentAttendanceView, StudentCourseAttendanceView,
    LecturerCourseAttendanceView, ActiveSessionsView, TodaySessionsView,
    FingerprintAttendanceView, EnrolledTemplatesView, MarkPresentView,
    AdminCourseAttendanceSummaryView, CourseAttendanceRegisterView,
    AdminStudentAttendanceView,
)

router = DefaultRouter()
router.register(r'sessions', AttendanceSessionViewSet, basename='attendance-sessions')
router.register(r'records', AttendanceRecordViewSet, basename='attendance-records')

urlpatterns = [
    path('', include(router.urls)),
    path('my/student/', StudentAttendanceView.as_view(), name='student_attendance'),
    path('my/student/course/<uuid:course_id>/', StudentCourseAttendanceView.as_view(), name='student_course_attendance'),
    path('my/lecturer/', LecturerCourseAttendanceView.as_view(), name='lecturer_attendance'),
    path('my/lecturer/course/<uuid:course_id>/', LecturerCourseAttendanceView.as_view(), name='lecturer_course_attendance'),
    path('active/', ActiveSessionsView.as_view(), name='active_sessions'),
    path('today/', TodaySessionsView.as_view(), name='today_sessions'),
    path('fingerprint/verify/', FingerprintAttendanceView.as_view(), name='fingerprint_verify'),
    path('sessions/<uuid:session_id>/enrolled-templates/', EnrolledTemplatesView.as_view(), name='enrolled_templates'),
    path('sessions/<uuid:session_id>/mark-present/', MarkPresentView.as_view(), name='mark_present'),
    path('admin/course/<uuid:course_id>/', AdminCourseAttendanceSummaryView.as_view(), name='admin_course_attendance'),
    path('admin/student/<uuid:student_id>/', AdminStudentAttendanceView.as_view(), name='admin_student_attendance'),
    path('course/<uuid:course_id>/register/', CourseAttendanceRegisterView.as_view(), name='course-register'),
]
