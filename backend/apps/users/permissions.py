"""
Custom permissions for the attendance system.
"""
from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """Permission class for admin users only."""
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'admin'


class IsLecturer(permissions.BasePermission):
    """Permission class for lecturer users only."""
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'lecturer'


class IsStudent(permissions.BasePermission):
    """Permission class for student users only."""
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'student'


class IsLecturerOrAdmin(permissions.BasePermission):
    """Permission class for lecturer or admin users."""
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['lecturer', 'admin']


class IsOwnerOrAdmin(permissions.BasePermission):
    """Permission class for object owner or admin."""
    
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        return obj == request.user or getattr(obj, 'user', None) == request.user
