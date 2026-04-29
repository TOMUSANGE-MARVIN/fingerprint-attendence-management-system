"""
Serializers for User authentication and management.
"""
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .models import AuditLog, Notification

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom token serializer that includes user data in response."""
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Add custom claims
        token['email'] = user.email
        token['role'] = user.role
        token['full_name'] = user.full_name
        
        return token
    
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Restructure response to match frontend expectations
        # Frontend expects: { user: {...}, tokens: { access, refresh } }
        tokens = {
            'access': data.pop('access'),
            'refresh': data.pop('refresh'),
        }
        
        data['tokens'] = tokens
        data['user'] = {
            'id': str(self.user.id),
            'email': self.user.email,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'role': self.user.role,
            'avatar': self.user.avatar.url if self.user.avatar else None,
            'student_id': self.user.student_id,
            'staff_id': self.user.staff_id,
        }
        
        return data


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""

    full_name = serializers.ReadOnlyField()
    cohort_name = serializers.CharField(source='cohort.name', read_only=True, default=None)
    academic_year_label = serializers.CharField(source='academic_year.label', read_only=True, default=None)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name', 'role',
            'phone', 'avatar', 'student_id', 'staff_id', 'department',
            'program', 'year_of_study', 'study_time', 'academic_year', 'academic_year_label',
            'cohort', 'cohort_name', 'faculty', 'specialization',
            'fingerprint_registered', 'is_active', 'created_at', 'last_login'
        ]
        read_only_fields = ['id', 'created_at', 'last_login', 'fingerprint_registered']


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new users."""
    
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = [
            'email', 'password', 'password_confirm', 'first_name', 'last_name',
            'role', 'phone', 'student_id', 'staff_id', 'department', 'program',
            'year_of_study', 'study_time', 'academic_year', 'cohort', 'faculty', 'specialization'
        ]
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user information."""
    
    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'phone', 'avatar', 'department',
            'program', 'year_of_study', 'study_time', 'academic_year',
            'faculty', 'specialization'
        ]


class PasswordChangeSerializer(serializers.Serializer):
    """Serializer for password change."""
    
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({"new_password": "Password fields didn't match."})
        return attrs


class StudentSerializer(serializers.ModelSerializer):
    """Serializer for Student-specific data."""

    full_name = serializers.ReadOnlyField()
    attendance_percentage = serializers.SerializerMethodField()
    cohort_name = serializers.CharField(source='cohort.name', read_only=True, default=None)
    academic_year_label = serializers.CharField(source='academic_year.label', read_only=True, default=None)
    current_year_of_study = serializers.IntegerField(source='cohort.current_year_of_study', read_only=True, default=None)
    current_semester_label = serializers.CharField(source='cohort.current_semester_label', read_only=True, default=None)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name', 'student_id',
            'phone', 'avatar', 'department', 'program', 'year_of_study', 'study_time',
            'academic_year', 'academic_year_label',
            'cohort', 'cohort_name', 'current_year_of_study', 'current_semester_label',
            'fingerprint_registered', 'is_active', 'attendance_percentage', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'fingerprint_registered']
    
    def get_attendance_percentage(self, obj):
        # This will be computed from attendance records
        from apps.attendance.models import AttendanceRecord
        total = AttendanceRecord.objects.filter(student=obj).count()
        present = AttendanceRecord.objects.filter(student=obj, status='present').count()
        return round((present / total * 100), 1) if total > 0 else 0


class LecturerSerializer(serializers.ModelSerializer):
    """Serializer for Lecturer-specific data."""
    
    full_name = serializers.ReadOnlyField()
    courses_count = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name', 'staff_id',
            'phone', 'avatar', 'faculty', 'specialization', 'is_active',
            'courses_count', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_courses_count(self, obj):
        return obj.taught_courses.count() if hasattr(obj, 'taught_courses') else 0


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for Audit Log."""
    
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'user_name', 'user_email', 'action', 'entity_type',
            'entity_id', 'description', 'ip_address', 'metadata', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notifications."""
    
    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'notification_type', 'is_read', 'link', 'created_at']
        read_only_fields = ['id', 'created_at']
