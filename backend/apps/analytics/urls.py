"""
URL patterns for analytics endpoints.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AttendanceReportViewSet, AttendanceTrendViewSet,
    DashboardAnalyticsView, CourseAnalyticsView, AtRiskStudentsView
)

router = DefaultRouter()
router.register(r'reports', AttendanceReportViewSet, basename='reports')
router.register(r'trends', AttendanceTrendViewSet, basename='trends')

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard/', DashboardAnalyticsView.as_view(), name='dashboard_analytics'),
    path('course/<uuid:course_id>/', CourseAnalyticsView.as_view(), name='course_analytics'),
    path('at-risk/', AtRiskStudentsView.as_view(), name='at_risk_students'),
]
