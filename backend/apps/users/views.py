"""
Views for user authentication and management.
"""
from rest_framework import generics, status, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from .serializers import (
    CustomTokenObtainPairSerializer, UserSerializer, UserCreateSerializer,
    UserUpdateSerializer, PasswordChangeSerializer, StudentSerializer,
    LecturerSerializer, AuditLogSerializer, NotificationSerializer
)
from .models import AuditLog, Notification
from .permissions import IsAdmin, IsLecturer, IsStudent, IsLecturerOrAdmin, IsLecturerOrAdminOrCoordinator

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom login view that returns user data along with tokens."""
    serializer_class = CustomTokenObtainPairSerializer
    
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == 200:
            # Log the login action
            user = User.objects.get(email=request.data.get('email'))
            AuditLog.objects.create(
                user=user,
                action='LOGIN',
                entity_type='User',
                entity_id=str(user.id),
                description=f"User {user.email} logged in",
                ip_address=self.get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', '')
            )
        
        return response
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class LogoutView(APIView):
    """Logout view that blacklists the refresh token."""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            
            # Log the logout action
            AuditLog.objects.create(
                user=request.user,
                action='LOGOUT',
                entity_type='User',
                entity_id=str(request.user.id),
                description=f"User {request.user.email} logged out",
                ip_address=self.get_client_ip(request)
            )
            
            return Response({"message": "Successfully logged out"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class CurrentUserView(APIView):
    """Get the current authenticated user."""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class UserProfileUpdateView(generics.UpdateAPIView):
    """Update current user's profile."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserUpdateSerializer
    
    def get_object(self):
        return self.request.user


class PasswordChangeView(APIView):
    """Change user's password."""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            if not user.check_password(serializer.validated_data['old_password']):
                return Response(
                    {"old_password": "Wrong password"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            
            return Response({"message": "Password updated successfully"}, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for managing users (Admin only for writes, lecturers can read)."""
    queryset = User.objects.all()

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsAdmin()]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer
    
    def get_queryset(self):
        from apps.courses.models import Cohort as CohortModel
        queryset = User.objects.all()
        role        = self.request.query_params.get('role', None)
        faculty     = self.request.query_params.get('faculty', None)
        programme   = self.request.query_params.get('programme', None)
        year_level  = self.request.query_params.get('year_level', None)
        semester_number = self.request.query_params.get('semester_number', None)
        academic_year = self.request.query_params.get('academic_year', None)
        course      = self.request.query_params.get('course', None)
        cohort      = self.request.query_params.get('cohort', None)
        study_time  = self.request.query_params.get('study_time', None)

        if role:
            queryset = queryset.filter(role=role)
        if cohort:
            queryset = queryset.filter(cohort=cohort)
        if course:
            # Primary: use enrollment records
            enrolled = queryset.filter(enrollments__course=course, enrollments__is_active=True)
            if enrolled.exists():
                queryset = enrolled
            else:
                # Fallback: match by programme + year_level via cohort
                from apps.courses.models import Course as CourseModel
                try:
                    c = CourseModel.objects.get(pk=course)
                    if c.programme_id:
                        cohort_qs = CohortModel.objects.filter(programme=c.programme_id)
                        if c.year_level:
                            matching_ids = [
                                ch.id for ch in cohort_qs
                                if ch.current_year_of_study == c.year_level
                            ]
                            queryset = queryset.filter(cohort__in=matching_ids)
                        else:
                            queryset = queryset.filter(cohort__in=cohort_qs)
                except CourseModel.DoesNotExist:
                    pass
        elif programme:
            cohort_qs = CohortModel.objects.filter(programme=programme)
            if year_level:
                matching = [c for c in cohort_qs if c.current_year_of_study == int(year_level)]
                matching_ids = [c.id for c in matching]
                if semester_number:
                    sem = str(semester_number)
                    matching_ids = [
                        c.id for c in matching
                        if c.current_semester_label and c.current_semester_label.endswith(f":{sem}")
                    ]
                queryset = queryset.filter(cohort__in=matching_ids)
            else:
                queryset = queryset.filter(cohort__in=cohort_qs)
        elif faculty:
            queryset = queryset.filter(cohort__programme__faculty=faculty)

        if study_time:
            queryset = queryset.filter(study_time=study_time)
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
        return queryset.distinct()
    
    def perform_create(self, serializer):
        user = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='CREATE',
            entity_type='User',
            entity_id=str(user.id),
            description=f"Admin created user: {user.email}",
            ip_address=self.get_client_ip(self.request)
        )
    
    def perform_destroy(self, instance):
        email = instance.email
        instance_id = str(instance.id)
        instance.delete()
        AuditLog.objects.create(
            user=self.request.user,
            action='DELETE',
            entity_type='User',
            entity_id=instance_id,
            description=f"Admin deleted user: {email}",
            ip_address=self.get_client_ip(self.request)
        )
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class StudentListView(generics.ListAPIView):
    """List all students."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = StudentSerializer
    
    def get_queryset(self):
        return User.objects.filter(role='student', is_active=True)


class StudentDetailView(generics.RetrieveAPIView):
    """Get student details."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = StudentSerializer
    queryset = User.objects.filter(role='student')


class LecturerListView(generics.ListAPIView):
    """List all lecturers."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LecturerSerializer

    def get_queryset(self):
        qs = User.objects.filter(role='lecturer', is_active=True)
        faculty = self.request.query_params.get('faculty')
        if faculty:
            qs = qs.filter(taught_courses__faculty=faculty).distinct()
        return qs


class LecturerDetailView(generics.RetrieveAPIView):
    """Get lecturer details."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LecturerSerializer
    queryset = User.objects.filter(role='lecturer')


class DashboardStatsView(APIView):
    """Get dashboard statistics for admin."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get(self, request):
        from apps.courses.models import Course
        from apps.attendance.models import AttendanceSession, AttendanceRecord
        from django.db.models import Avg
        
        total_students = User.objects.filter(role='student').count()
        total_lecturers = User.objects.filter(role='lecturer').count()
        total_courses = Course.objects.count()
        active_sessions = AttendanceSession.objects.filter(is_active=True).count()
        
        # Calculate average attendance
        total_records = AttendanceRecord.objects.count()
        present_records = AttendanceRecord.objects.filter(status='present').count()
        avg_attendance = round((present_records / total_records * 100), 1) if total_records > 0 else 0
        
        # Students at risk (below 75% attendance)
        at_risk_count = 0
        students = User.objects.filter(role='student')
        for student in students:
            total = AttendanceRecord.objects.filter(student=student).count()
            present = AttendanceRecord.objects.filter(student=student, status='present').count()
            if total > 0 and (present / total * 100) < 75:
                at_risk_count += 1
        
        return Response({
            'total_students': total_students,
            'total_lecturers': total_lecturers,
            'total_courses': total_courses,
            'active_sessions': active_sessions,
            'average_attendance': avg_attendance,
            'students_at_risk': at_risk_count,
        })


class AuditLogListView(generics.ListAPIView):
    """List audit logs (Admin only)."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.all()
    
    def get_queryset(self):
        queryset = AuditLog.objects.all()
        action = self.request.query_params.get('action', None)
        user_id = self.request.query_params.get('user_id', None)
        
        if action:
            queryset = queryset.filter(action=action)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        return queryset


class NotificationListView(generics.ListAPIView):
    """List notifications for current user."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NotificationSerializer
    
    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class NotificationMarkReadView(APIView):
    """Mark notification as read."""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        try:
            notification = Notification.objects.get(id=pk, user=request.user)
            notification.is_read = True
            notification.save()
            return Response({"message": "Notification marked as read"})
        except Notification.DoesNotExist:
            return Response({"error": "Notification not found"}, status=status.HTTP_404_NOT_FOUND)


class NotificationMarkAllReadView(APIView):
    """Mark all notifications as read."""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"message": f"{count} notifications marked as read"})


class NotificationCountView(APIView):
    """Get unread notification count."""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({"unread_count": count})


class FingerprintRegistrationView(APIView):
    """Register or update a student's fingerprint template."""
    permission_classes = [permissions.IsAuthenticated, IsLecturerOrAdminOrCoordinator]

    def post(self, request, student_id):
        fingerprint_template = request.data.get('fingerprint_template')

        if not fingerprint_template:
            return Response(
                {"error": "fingerprint_template is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            student = User.objects.get(id=student_id, role='student')
        except User.DoesNotExist:
            return Response(
                {"error": "Student not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # If requester is a student coordinator, verify the target student is in their group
        if request.user.role == 'student':
            from apps.courses.models import CohortGroupCoordinator
            group = CohortGroupCoordinator.objects.filter(coordinator=request.user).first()
            if group is None or str(student.cohort_id) != str(group.cohort_id) or student.study_time != request.user.study_time:
                return Response(
                    {"error": "You can only register fingerprints for students in your class"},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        import base64
        try:
            template_bytes = base64.b64decode(fingerprint_template)
        except Exception:
            return Response(
                {"error": "Invalid fingerprint template encoding"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        student.register_fingerprint(template_bytes)
        
        # Create notification for student
        Notification.objects.create(
            user=student,
            title="Fingerprint Registered",
            message="Your fingerprint has been registered successfully. You can now use biometric attendance.",
            notification_type='success',
            link="/student"
        )
        
        # Log the action
        AuditLog.objects.create(
            user=request.user,
            action='FINGERPRINT_REGISTERED',
            entity_type='User',
            entity_id=str(student.id),
            description=f"Fingerprint registered for {student.full_name}",
            ip_address=self.get_client_ip(request)
        )
        
        return Response({
            "success": True,
            "message": f"Fingerprint registered for {student.full_name}",
            "registered_at": student.fingerprint_registered_at.isoformat()
        })
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0]
        return request.META.get('REMOTE_ADDR')


class CohortFingerprintTemplatesView(APIView):
    """Return all enrolled fingerprint templates for the coordinator's cohort group.
    Used by the mobile app to check for duplicate fingerprints before enrolling."""
    permission_classes = [permissions.IsAuthenticated, IsLecturerOrAdminOrCoordinator]

    def get(self, request):
        import base64
        from apps.courses.models import CohortGroupCoordinator

        if request.user.role == 'student':
            group = CohortGroupCoordinator.objects.filter(coordinator=request.user).first()
            if not group:
                return Response({'students': []})
            students = User.objects.filter(
                cohort=group.cohort,
                study_time=request.user.study_time,
                role='student',
                fingerprint_registered=True,
            ).exclude(fingerprint_template=None)
        else:
            # Lecturer / admin: all enrolled students (they can pass cohort param)
            cohort_id = request.query_params.get('cohort')
            qs = User.objects.filter(role='student', fingerprint_registered=True).exclude(fingerprint_template=None)
            if cohort_id:
                qs = qs.filter(cohort_id=cohort_id)
            students = qs

        data = []
        for s in students:
            try:
                tmpl = base64.b64encode(s.fingerprint_template).decode('utf-8')
                data.append({'id': str(s.id), 'name': s.full_name, 'template': tmpl})
            except Exception:
                pass
        return Response({'students': data})


class FingerprintStatusView(APIView):
    """Check fingerprint registration status for a student."""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, student_id):
        try:
            student = User.objects.get(id=student_id, role='student')
        except User.DoesNotExist:
            return Response(
                {"error": "Student not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        return Response({
            "student_id": str(student.id),
            "student_name": student.full_name,
            "fingerprint_registered": student.fingerprint_registered,
            "registered_at": student.fingerprint_registered_at.isoformat() if student.fingerprint_registered_at else None
        })
