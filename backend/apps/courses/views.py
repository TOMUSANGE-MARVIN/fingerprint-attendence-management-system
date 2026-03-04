"""
Views for Course management.
"""
from rest_framework import generics, viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import datetime
from .models import Course, Enrollment, TimetableSlot, Faculty, AcademicPeriod, AcademicYear, Programme, Cohort
from .serializers import (
    CourseListSerializer, CourseDetailSerializer, CourseCreateUpdateSerializer,
    EnrollmentSerializer, EnrollmentCreateSerializer, StudentCourseSerializer,
    LecturerCourseSerializer, TimetableSlotSerializer, FacultySerializer, AcademicPeriodSerializer,
    AcademicYearSerializer, ProgrammeSerializer, CohortSerializer
)
from apps.users.permissions import IsAdmin, IsLecturer, IsStudent, IsLecturerOrAdmin

User = get_user_model()


class CourseViewSet(viewsets.ModelViewSet):
    """ViewSet for Course management."""
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        queryset = Course.objects.filter(is_active=True)
        
        # Filter by user role
        if user.role == 'student':
            queryset = queryset.filter(enrollments__student=user, enrollments__is_active=True)
        elif user.role == 'lecturer':
            queryset = queryset.filter(lecturer=user)
        
        # Additional filters
        department = self.request.query_params.get('department')
        semester = self.request.query_params.get('semester')
        
        if department:
            queryset = queryset.filter(department=department)
        if semester:
            queryset = queryset.filter(semester=semester)
        
        return queryset.distinct()
    
    def get_serializer_class(self):
        user = self.request.user
        
        if self.action == 'create' or self.action == 'update' or self.action == 'partial_update':
            return CourseCreateUpdateSerializer
        elif self.action == 'retrieve':
            return CourseDetailSerializer
        elif user.role == 'student':
            return StudentCourseSerializer
        elif user.role == 'lecturer':
            return LecturerCourseSerializer
        
        return CourseListSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsLecturerOrAdmin()]
        return super().get_permissions()
    
    @action(detail=True, methods=['get'])
    def students(self, request, pk=None):
        """Get list of students enrolled in a course."""
        course = self.get_object()
        enrollments = Enrollment.objects.filter(course=course, is_active=True)
        serializer = EnrollmentSerializer(enrollments, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def enroll(self, request, pk=None):
        """Enroll a student in a course."""
        course = self.get_object()
        student_id = request.data.get('student_id')
        
        try:
            student = User.objects.get(id=student_id, role='student')
        except User.DoesNotExist:
            return Response(
                {"error": "Student not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if Enrollment.objects.filter(student=student, course=course).exists():
            return Response(
                {"error": "Student is already enrolled"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        enrollment = Enrollment.objects.create(student=student, course=course)
        serializer = EnrollmentSerializer(enrollment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def unenroll(self, request, pk=None):
        """Remove a student from a course."""
        course = self.get_object()
        student_id = request.data.get('student_id')
        
        try:
            enrollment = Enrollment.objects.get(
                student_id=student_id,
                course=course
            )
            enrollment.is_active = False
            enrollment.save()
            return Response({"message": "Student unenrolled successfully"})
        except Enrollment.DoesNotExist:
            return Response(
                {"error": "Enrollment not found"},
                status=status.HTTP_404_NOT_FOUND
            )


class StudentCoursesView(generics.ListAPIView):
    """List courses for the current student."""
    permission_classes = [permissions.IsAuthenticated, IsStudent]
    serializer_class = StudentCourseSerializer
    
    def get_queryset(self):
        return Course.objects.filter(
            enrollments__student=self.request.user,
            enrollments__is_active=True,
            is_active=True
        )


class LecturerCoursesView(generics.ListAPIView):
    """List courses for the current lecturer."""
    permission_classes = [permissions.IsAuthenticated, IsLecturer]
    serializer_class = LecturerCourseSerializer
    
    def get_queryset(self):
        return Course.objects.filter(lecturer=self.request.user, is_active=True)


class EnrollmentViewSet(viewsets.ModelViewSet):
    """ViewSet for Enrollment management."""
    permission_classes = [permissions.IsAuthenticated, IsLecturerOrAdmin]
    queryset = Enrollment.objects.all()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return EnrollmentCreateSerializer
        return EnrollmentSerializer
    
    def get_queryset(self):
        queryset = Enrollment.objects.all()
        
        course_id = self.request.query_params.get('course')
        student_id = self.request.query_params.get('student')
        
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def update_stats(self, request, pk=None):
        """Update attendance statistics for an enrollment."""
        enrollment = self.get_object()
        enrollment.update_attendance_stats()
        serializer = EnrollmentSerializer(enrollment)
        return Response(serializer.data)


class TimetableSlotViewSet(viewsets.ModelViewSet):
    """ViewSet for Timetable management."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TimetableSlotSerializer
    
    def get_queryset(self):
        queryset = TimetableSlot.objects.filter(is_active=True)
        
        course_id = self.request.query_params.get('course')
        day = self.request.query_params.get('day')
        
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        if day:
            queryset = queryset.filter(day_of_week=day)
        
        return queryset
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsLecturerOrAdmin()]
        return super().get_permissions()


class StudentTimetableView(generics.ListAPIView):
    """Get timetable for the current student."""
    permission_classes = [permissions.IsAuthenticated, IsStudent]
    serializer_class = TimetableSlotSerializer
    
    def get_queryset(self):
        enrolled_courses = Course.objects.filter(
            enrollments__student=self.request.user,
            enrollments__is_active=True
        )
        return TimetableSlot.objects.filter(
            course__in=enrolled_courses,
            is_active=True
        ).order_by('day_of_week', 'start_time')


class LecturerTimetableView(generics.ListAPIView):
    """Get timetable for the current lecturer."""
    permission_classes = [permissions.IsAuthenticated, IsLecturer]
    serializer_class = TimetableSlotSerializer
    
    def get_queryset(self):
        return TimetableSlot.objects.filter(
            course__lecturer=self.request.user,
            is_active=True
        ).order_by('day_of_week', 'start_time')


class FacultyViewSet(viewsets.ModelViewSet):
    """ViewSet for Faculty management."""
    serializer_class = FacultySerializer
    
    def get_queryset(self):
        queryset = Faculty.objects.all()
        if self.request.query_params.get('active_only'):
            queryset = queryset.filter(is_active=True)
        return queryset
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.IsAuthenticated()]


class AcademicPeriodViewSet(viewsets.ModelViewSet):
    """ViewSet for Academic Period management."""
    serializer_class = AcademicPeriodSerializer
    
    def get_queryset(self):
        queryset = AcademicPeriod.objects.all()
        if self.request.query_params.get('current_only'):
            queryset = queryset.filter(is_current=True)
        return queryset
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.IsAuthenticated()]
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get the current academic period."""
        period = AcademicPeriod.objects.filter(is_current=True).first()
        if period:
            serializer = self.get_serializer(period)
            return Response(serializer.data)
        return Response({"error": "No current academic period set"}, status=status.HTTP_404_NOT_FOUND)


class AcademicYearViewSet(viewsets.ModelViewSet):
    """ViewSet for Academic Year management."""
    serializer_class = AcademicYearSerializer

    def get_queryset(self):
        return AcademicYear.objects.all()

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get the current academic year."""
        year = AcademicYear.objects.filter(is_current=True).first()
        if year:
            return Response(self.get_serializer(year).data)
        return Response({"error": "No current academic year set"}, status=status.HTTP_404_NOT_FOUND)


class ProgrammeViewSet(viewsets.ModelViewSet):
    """ViewSet for Programme management."""
    serializer_class = ProgrammeSerializer

    def get_queryset(self):
        qs = Programme.objects.all()
        if self.request.query_params.get('active_only'):
            qs = qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.IsAuthenticated()]


class CohortViewSet(viewsets.ModelViewSet):
    """ViewSet for Cohort management."""
    serializer_class = CohortSerializer

    def get_queryset(self):
        qs = Cohort.objects.select_related('programme', 'intake_year', 'coordinator').all()
        programme = self.request.query_params.get('programme')
        if programme:
            qs = qs.filter(programme__code=programme)
        if self.request.query_params.get('active_only'):
            qs = qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.IsAuthenticated()]


class CoordinatorLecturesView(generics.GenericAPIView):
    """
    Returns the current and upcoming lectures for the authenticated coordinator/lecturer.
    Uses today's timetable slots to determine which lecture is happening now and what's next.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()
        today = now.date()
        current_time = now.time()

        day_name = today.strftime('%A').lower()  # e.g. "monday"

        slots_today = TimetableSlot.objects.filter(
            course__lecturer=user,
            day_of_week=day_name,
            is_active=True
        ).select_related('course', 'cohort').order_by('start_time')

        current_lecture = None
        upcoming_lectures = []

        for slot in slots_today:
            if slot.start_time <= current_time <= slot.end_time:
                current_lecture = TimetableSlotSerializer(slot).data
            elif slot.start_time > current_time:
                upcoming_lectures.append(TimetableSlotSerializer(slot).data)

        return Response({
            "today": day_name,
            "current_lecture": current_lecture,
            "upcoming_lectures": upcoming_lectures,
        })
