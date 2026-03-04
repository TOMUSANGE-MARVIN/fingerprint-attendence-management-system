"""
URL patterns for admin-related endpoints.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, DashboardStatsView, AuditLogListView

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='admin-users')

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard_stats'),
    path('audit-logs/', AuditLogListView.as_view(), name='audit_logs'),
]
