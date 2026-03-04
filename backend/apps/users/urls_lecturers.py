"""
URL patterns for lecturer-related endpoints.
"""
from django.urls import path
from .views import LecturerListView, LecturerDetailView

urlpatterns = [
    path('', LecturerListView.as_view(), name='lecturer_list'),
    path('<uuid:pk>/', LecturerDetailView.as_view(), name='lecturer_detail'),
]
