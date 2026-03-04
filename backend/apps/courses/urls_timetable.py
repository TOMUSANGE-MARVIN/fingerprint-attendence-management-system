"""
URL patterns for timetable endpoints.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TimetableSlotViewSet, StudentTimetableView, LecturerTimetableView

router = DefaultRouter()
router.register(r'slots', TimetableSlotViewSet, basename='timetable-slots')

urlpatterns = [
    path('', include(router.urls)),
    path('my/student/', StudentTimetableView.as_view(), name='student_timetable'),
    path('my/lecturer/', LecturerTimetableView.as_view(), name='lecturer_timetable'),
]
