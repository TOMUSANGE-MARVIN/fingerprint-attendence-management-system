"""
Views for Course management.
"""
from rest_framework import generics, viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Q
from datetime import datetime
from .models import Course, Enrollment, TimetableSlot, Faculty, AcademicPeriod, AcademicYear, Programme, Cohort, CohortGroupCoordinator
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
        programme = self.request.query_params.get('programme')
        faculty = self.request.query_params.get('faculty')
        cohort = self.request.query_params.get('cohort')
        year_level = self.request.query_params.get('year_level')
        semester_number = self.request.query_params.get('semester_number')

        if department:
            queryset = queryset.filter(department=department)
        if semester:
            queryset = queryset.filter(semester=semester)
        if programme:
            queryset = queryset.filter(programme=programme)
        if faculty:
            queryset = queryset.filter(faculty=faculty)
        if cohort:
            try:
                cohort_obj = Cohort.objects.get(pk=cohort)
                queryset = queryset.filter(
                    enrollments__student__cohort=cohort,
                    enrollments__is_active=True
                )
                # Auto-restrict to cohort's current year unless caller overrides
                if not year_level:
                    current_yr = cohort_obj.current_year_of_study
                    if current_yr:
                        queryset = queryset.filter(year_level=current_yr)
            except Cohort.DoesNotExist:
                pass
        if year_level:
            queryset = queryset.filter(year_level=year_level)
        if semester_number:
            queryset = queryset.filter(semester_number=semester_number)

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

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin])
    def set_coordinator(self, request, pk=None):
        """Admin: assign a student as coordinator for this course."""
        course = self.get_object()
        student_id = request.data.get('student_id')

        if student_id is None:
            # Clear coordinator
            course.coordinator = None
            course.save(update_fields=['coordinator'])
            return Response({'message': 'Coordinator removed', 'coordinator': None})

        try:
            student = User.objects.get(id=student_id, role='student')
        except User.DoesNotExist:
            return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

        course.coordinator = student
        course.save(update_fields=['coordinator'])
        return Response({
            'message': f'{student.full_name} set as coordinator',
            'coordinator': str(student.id),
            'coordinator_name': student.full_name,
        })


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
        queryset = TimetableSlot.objects.select_related('course__lecturer', 'lecturer').filter(is_active=True)

        course_id       = self.request.query_params.get('course')
        day             = self.request.query_params.get('day')
        programme       = self.request.query_params.get('programme')
        study_time      = self.request.query_params.get('study_time')
        year_level      = self.request.query_params.get('year_level')
        semester_number = self.request.query_params.get('semester_number')

        if course_id:
            queryset = queryset.filter(course_id=course_id)
        if day:
            queryset = queryset.filter(day_of_week=day)
        if programme:
            queryset = queryset.filter(course__programme=programme)
        if study_time:
            queryset = queryset.filter(study_time=study_time)
        if year_level:
            queryset = queryset.filter(course__year_level=year_level)
        if semester_number:
            queryset = queryset.filter(course__semester_number=semester_number)

        return queryset.order_by('course__year_level', 'course__semester_number', 'day_of_week', 'start_time')
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsLecturerOrAdmin()]
        return super().get_permissions()


class StudentTimetableView(generics.ListAPIView):
    """Get timetable for the current student."""
    permission_classes = [permissions.IsAuthenticated, IsStudent]
    serializer_class = TimetableSlotSerializer
    
    def get_queryset(self):
        student = self.request.user

        # If student has a cohort, timetable should follow cohort hierarchy for current period
        # (programme + current year + current semester), not historical enrollments.
        if student.cohort_id:
            courses = Course.objects.filter(
                is_active=True,
                programme=student.cohort.programme
            )

            current_year = student.cohort.current_year_of_study
            if current_year:
                courses = courses.filter(year_level=current_year)

            current_semester = None
            semester_label = student.cohort.current_semester_label
            if semester_label and ':' in semester_label:
                try:
                    current_semester = int(semester_label.split(':', 1)[1])
                except (TypeError, ValueError):
                    current_semester = None

            if current_semester:
                courses = courses.filter(semester_number=current_semester)

            courses = courses.distinct()
        else:
            courses = Course.objects.filter(
                enrollments__student=student,
                enrollments__is_active=True,
                is_active=True
            ).distinct()

        qs = TimetableSlot.objects.filter(course__in=courses, is_active=True)

        # If slots are cohort-specific, prefer this student's cohort (but still allow generic slots).
        if student.cohort_id:
            qs = qs.filter(Q(cohort=student.cohort) | Q(cohort__isnull=True))

        # Filter by the student's study_time so they only see their session's slots.
        if student.study_time:
            qs = qs.filter(study_time=student.study_time)

        return qs.select_related('course', 'cohort', 'lecturer', 'course__lecturer').distinct().order_by('day_of_week', 'start_time')


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
        faculty = self.request.query_params.get('faculty')
        if faculty:
            qs = qs.filter(faculty=faculty)
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
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'set_student_coordinator']:
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.IsAuthenticated()]

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin])
    def set_student_coordinator(self, request, pk=None):
        """Admin: assign or remove a student coordinator for a specific study_time group."""
        cohort = self.get_object()
        student_id = request.data.get('student_id')
        study_time = request.data.get('study_time')

        VALID_STUDY_TIMES = ['day', 'evening', 'weekend']
        if study_time not in VALID_STUDY_TIMES:
            return Response({'error': f'study_time must be one of {VALID_STUDY_TIMES}'}, status=status.HTTP_400_BAD_REQUEST)

        if student_id is None:
            CohortGroupCoordinator.objects.filter(cohort=cohort, study_time=study_time).delete()
            return Response({'message': f'{study_time} coordinator removed', 'study_time': study_time, 'coordinator_id': None})

        try:
            student = User.objects.get(id=student_id, role='student')
        except User.DoesNotExist:
            return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

        if str(student.cohort_id) != str(cohort.id):
            return Response({'error': 'Student does not belong to this cohort'}, status=status.HTTP_400_BAD_REQUEST)

        if student.study_time != study_time:
            return Response({'error': f'Student is not in the {study_time} group'}, status=status.HTTP_400_BAD_REQUEST)

        obj, _ = CohortGroupCoordinator.objects.update_or_create(
            cohort=cohort, study_time=study_time,
            defaults={'coordinator': student}
        )
        return Response({
            'message': f'{student.full_name} set as {study_time} coordinator',
            'study_time': study_time,
            'coordinator_id': str(student.id),
            'coordinator_name': student.full_name,
        })


class MyCoordinatedCourseView(APIView):
    """
    Returns cohort info for the student coordinator:
    - cohort details
    - all students in the cohort
    - all courses those students are enrolled in
    - timetable slots for those courses (filtered by coordinator's study_time)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        group = CohortGroupCoordinator.objects.filter(coordinator=request.user).select_related('cohort__programme', 'cohort__intake_year').first()
        if not group:
            return Response({'is_coordinator': False, 'cohort': None, 'courses': [], 'students': []})
        cohort = group.cohort

        # All students in this cohort — filtered to the coordinator's study_time group
        User = get_user_model()
        students_qs = User.objects.filter(cohort=cohort, role='student', is_active=True)
        if request.user.study_time:
            students_qs = students_qs.filter(study_time=request.user.study_time)
        students = [
            {
                'id': str(s.id),
                'student_id': s.student_id,
                'first_name': s.first_name,
                'last_name': s.last_name,
                'email': s.email,
                'study_time': s.study_time,
                'fingerprint_registered': s.fingerprint_registered,
            }
            for s in students_qs
        ]

        # Cohort-aligned courses for the current study period:
        # programme + current year of study + current semester.
        courses_qs = Course.objects.filter(
            is_active=True,
            programme=cohort.programme
        )

        current_year = cohort.current_year_of_study
        if current_year:
            courses_qs = courses_qs.filter(year_level=current_year)

        current_semester = None
        semester_label = cohort.current_semester_label
        if semester_label and ':' in semester_label:
            try:
                current_semester = int(semester_label.split(':', 1)[1])
            except (TypeError, ValueError):
                current_semester = None

        if current_semester:
            courses_qs = courses_qs.filter(semester_number=current_semester)

        courses_qs = courses_qs.select_related('programme', 'lecturer').distinct()

        courses_data = []
        for course in courses_qs:
            # Timetable slots for this course matching the coordinator's study_time
            slots_qs = course.timetable_slots.filter(is_active=True)
            if request.user.study_time:
                slots_qs = slots_qs.filter(study_time=request.user.study_time)
            timetable = TimetableSlotSerializer(slots_qs, many=True).data

            courses_data.append({
                'course_id': str(course.id),
                'course_code': course.code,
                'course_name': course.name,
                'year_level': course.year_level,
                'semester_number': course.semester_number,
                'programme_code': course.programme.code if course.programme else None,
                'programme_name': course.programme.name if course.programme else None,
                'lecturer_name': course.lecturer.get_full_name() if course.lecturer else None,
                'timetable': timetable,
            })

        return Response({
            'is_coordinator': True,
            'cohort': {
                'id': str(cohort.id),
                'name': cohort.name,
                'programme_code': cohort.programme.code,
                'programme_name': cohort.programme.name,
                'intake_year': cohort.intake_year.label,
                'current_year_of_study': cohort.current_year_of_study,
                'current_semester_label': cohort.current_semester_label,
                'total_students': len(students),
            },
            'students': students,
            'courses': courses_data,
        })


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
