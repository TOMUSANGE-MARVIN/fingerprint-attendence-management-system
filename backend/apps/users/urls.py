"""
URL patterns for authentication endpoints.
"""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CustomTokenObtainPairView, LogoutView, CurrentUserView,
    UserProfileUpdateView, PasswordChangeView, NotificationListView,
    NotificationMarkReadView, NotificationMarkAllReadView, NotificationCountView
)

urlpatterns = [
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', CurrentUserView.as_view(), name='current_user'),
    path('profile/', UserProfileUpdateView.as_view(), name='profile_update'),
    path('password/change/', PasswordChangeView.as_view(), name='password_change'),
    path('notifications/', NotificationListView.as_view(), name='notifications'),
    path('notifications/read-all/', NotificationMarkAllReadView.as_view(), name='notifications_read_all'),
    path('notifications/count/', NotificationCountView.as_view(), name='notifications_count'),
    path('notifications/<uuid:pk>/read/', NotificationMarkReadView.as_view(), name='notification_read'),
]
