"""
URL patterns for analytics endpoints.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AttendanceReportViewSet, AttendanceTrendViewSet,
    DashboardAnalyticsView, CourseAnalyticsView, AtRiskStudentsView,
    AttendanceExportView, CoursePDFReportView, ThresholdExcelExportView,
    ReportFiltersView,
)

router = DefaultRouter()
router.register(r'reports', AttendanceReportViewSet, basename='reports')
router.register(r'trends', AttendanceTrendViewSet, basename='trends')

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard/', DashboardAnalyticsView.as_view(), name='dashboard_analytics'),
    path('course/<uuid:course_id>/', CourseAnalyticsView.as_view(), name='course_analytics'),
    path('course/<uuid:course_id>/pdf/', CoursePDFReportView.as_view(), name='course_pdf_report'),
    path('at-risk/', AtRiskStudentsView.as_view(), name='at_risk_students'),
    path('export/', AttendanceExportView.as_view(), name='attendance_export'),
    path('threshold-excel/', ThresholdExcelExportView.as_view(), name='threshold_excel'),
    path('report-filters/', ReportFiltersView.as_view(), name='report_filters'),
]
