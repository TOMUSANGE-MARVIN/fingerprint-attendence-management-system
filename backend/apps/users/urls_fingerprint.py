"""
URL patterns for fingerprint-related endpoints.
"""
from django.urls import path
from .views import FingerprintRegistrationView, FingerprintStatusView

urlpatterns = [
    path("register/<uuid:student_id>/", FingerprintRegistrationView.as_view(), name="fingerprint_register"),
    path("status/<uuid:student_id>/", FingerprintStatusView.as_view(), name="fingerprint_status"),
]
