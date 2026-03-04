"""
URL configuration for attendance_system project.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API endpoints
    path('api/auth/', include('apps.users.urls')),
    path('api/students/', include('apps.users.urls_students')),
    path('api/lecturers/', include('apps.users.urls_lecturers')),
    path('api/courses/', include('apps.courses.urls')),
    path('api/attendance/', include('apps.attendance.urls')),
    path('api/timetable/', include('apps.courses.urls_timetable')),
    path('api/analytics/', include('apps.analytics.urls')),
    path('api/admin/', include('apps.users.urls_admin')),
    path('api/fingerprint/', include('apps.users.urls_fingerprint')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
