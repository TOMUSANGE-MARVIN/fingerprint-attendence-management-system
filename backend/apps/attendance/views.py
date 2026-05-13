"""
Views for Attendance management.
"""
from rest_framework import generics, viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Count, Avg, Q
from django.db.models import F
from django.db.models.functions import Coalesce
from datetime import datetime, timedelta
from .models import AttendanceSession, AttendanceRecord, AttendanceSummary
from .serializers import (
    AttendanceSessionListSerializer, AttendanceSessionDetailSerializer,
    AttendanceSessionCreateSerializer, AttendanceRecordSerializer,
    AttendanceRecordCreateSerializer, BulkAttendanceSerializer,
    AttendanceSummarySerializer, StudentAttendanceSerializer
)
from apps.users.permissions import IsAdmin, IsLecturer, IsStudent, IsLecturerOrAdmin, IsLecturerOrAdminOrCoordinator
from .fingerprint_utils import decode_template, find_matching_student
from apps.users.models import AuditLog
from apps.courses.models import Course, Enrollment

User = get_user_model()


def _with_effective_schedule(queryset):
    return queryset.annotate(
        effective_start_time=Coalesce(F('timetable_slot__start_time'), F('start_time')),
        effective_end_time=Coalesce(F('timetable_slot__end_time'), F('end_time')),
    )


def _active_window_query():
    now_local = timezone.localtime()
    return Q(
        date=now_local.date(),
        effective_start_time__lte=now_local.time(),
        effective_end_time__gte=now_local.time(),
    )


def _session_window_error(session):
    """Return a response when attendance marking is outside the timetable window."""
    session.sync_active_state()
    if session.is_active:
        return None
    if session.is_expired:
        return Response(
            {"error": "Session has expired — attendance is now locked"},
            status=status.HTTP_400_BAD_REQUEST
        )
    return Response(
        {"error": "Session is not active right now. Attendance is only allowed during the timetable slot time."},
        status=status.HTTP_400_BAD_REQUEST
    )


class AttendanceSessionViewSet(viewsets.ModelViewSet):
    """ViewSet for Attendance Session management."""
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        queryset = AttendanceSession.objects.all()
        
        if user.role == 'lecturer':
            queryset = queryset.filter(lecturer=user)
        elif user.role == 'student':
            enrolled_courses = Course.objects.filter(
                enrollments__student=user,
                enrollments__is_active=True
            )
            # If coordinator: also see sessions for all courses in the cohort
            from apps.courses.models import CohortGroupCoordinator
            group = CohortGroupCoordinator.objects.filter(coordinator=user).first()
            if group:
                cohort_courses = Course.objects.filter(
                    is_active=True,
                    programme=group.cohort.programme,
                )
                current_year = group.cohort.current_year_of_study
                if current_year:
                    cohort_courses = cohort_courses.filter(year_level=current_year)

                current_semester = None
                semester_label = group.cohort.current_semester_label
                if semester_label and ':' in semester_label:
                    try:
                        current_semester = int(semester_label.split(':', 1)[1])
                    except (TypeError, ValueError):
                        current_semester = None

                if current_semester:
                    cohort_courses = cohort_courses.filter(semester_number=current_semester)

                cohort_courses = cohort_courses.distinct()
                queryset = queryset.filter(
                    Q(course__in=enrolled_courses) | Q(course__in=cohort_courses)
                )
            else:
                queryset = queryset.filter(course__in=enrolled_courses)

        # Filters
        course_id = self.request.query_params.get('course')
        date = self.request.query_params.get('date')
        is_active = self.request.query_params.get('is_active')
        
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        if date:
            queryset = queryset.filter(date=date)
        if is_active is not None:
            is_active_bool = is_active.lower() == 'true'
            queryset = _with_effective_schedule(queryset)
            active_window = _active_window_query()
            queryset = queryset.filter(active_window) if is_active_bool else queryset.exclude(active_window)
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'create':
            return AttendanceSessionCreateSerializer
        elif self.action == 'retrieve':
            return AttendanceSessionDetailSerializer
        return AttendanceSessionListSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'start', 'end', 'mark_attendance', 'bulk_mark']:
            return [permissions.IsAuthenticated(), IsLecturerOrAdminOrCoordinator()]
        return super().get_permissions()
    
    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Compatibility endpoint: sessions are timetable-controlled."""
        session = self.get_object()

        session.sync_active_state()
        if not session.is_active:
            return Response(
                {"error": "Session is controlled by timetable time and is not active yet."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create absent records for all enrolled students
        enrollments = Enrollment.objects.filter(course=session.course, is_active=True)
        for enrollment in enrollments:
            AttendanceRecord.objects.get_or_create(
                session=session,
                student=enrollment.student,
                defaults={'status': 'absent'}
            )
        
        serializer = AttendanceSessionDetailSerializer(session)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def end(self, request, pk=None):
        """Sessions close automatically based on timetable end time."""
        session = self.get_object()
        session.sync_active_state()
        serializer = AttendanceSessionDetailSerializer(session)
        return Response(
            {
                "error": "Sessions are controlled by timetable time and end automatically.",
                "session": serializer.data,
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @action(detail=True, methods=['get'])
    def records(self, request, pk=None):
        """Get attendance records for a session."""
        session = self.get_object()
        records = session.attendance_records.all()
        serializer = AttendanceRecordSerializer(records, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_attendance(self, request, pk=None):
        """Mark attendance for a single student."""
        session = self.get_object()
        window_error = _session_window_error(session)
        if window_error:
            return window_error

        student_id = request.data.get('student_id')
        attendance_status = request.data.get('status', 'present')
        verification_method = request.data.get('verification_method', 'manual')
        
        try:
            student = User.objects.get(id=student_id, role='student')
        except User.DoesNotExist:
            return Response(
                {"error": "Student not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        record, created = AttendanceRecord.objects.get_or_create(
            session=session,
            student=student,
            defaults={'status': 'absent'}
        )
        
        if attendance_status == 'present':
            record.mark_present(
                marked_by=request.user,
                verification_method=verification_method
            )
        elif attendance_status == 'excused':
            record.mark_excused(
                reason=request.data.get('reason', ''),
                marked_by=request.user
            )
        else:
            record.status = attendance_status
            record.marked_by = request.user
            record.marked_at = timezone.now()
            record.save()
        
        # Log the action
        AuditLog.objects.create(
            user=request.user,
            action='ATTENDANCE_MARKED',
            entity_type='AttendanceRecord',
            entity_id=str(record.id),
            description=f"Marked {student.full_name} as {record.status} for {session.course.code}"
        )
        
        serializer = AttendanceRecordSerializer(record)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def bulk_mark(self, request, pk=None):
        """Mark attendance for multiple students at once."""
        session = self.get_object()
        window_error = _session_window_error(session)
        if window_error:
            return window_error

        records_data = request.data.get('records', [])
        
        results = []
        for record_data in records_data:
            student_id = record_data.get('student_id')
            attendance_status = record_data.get('status', 'present')
            
            try:
                student = User.objects.get(id=student_id, role='student')
                record, created = AttendanceRecord.objects.get_or_create(
                    session=session,
                    student=student,
                    defaults={'status': 'absent'}
                )
                
                record.status = attendance_status
                record.marked_by = request.user
                record.marked_at = timezone.now()
                record.verification_method = record_data.get('verification_method', 'manual')
                record.save()
                
                results.append({
                    'student_id': str(student_id),
                    'status': 'success',
                    'attendance_status': record.status
                })
            except User.DoesNotExist:
                results.append({
                    'student_id': str(student_id),
                    'status': 'error',
                    'message': 'Student not found'
                })
        
        return Response({'results': results})


class AttendanceRecordViewSet(viewsets.ModelViewSet):
    """ViewSet for Attendance Records."""
    permission_classes = [permissions.IsAuthenticated]
    queryset = AttendanceRecord.objects.all()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return AttendanceRecordCreateSerializer
        return AttendanceRecordSerializer
    
    def get_queryset(self):
        user = self.request.user
        queryset = AttendanceRecord.objects.all()
        
        if user.role == 'student':
            queryset = queryset.filter(student=user)
        elif user.role == 'lecturer':
            queryset = queryset.filter(session__lecturer=user)
        
        # Filters
        session_id = self.request.query_params.get('session')
        student_id = self.request.query_params.get('student')
        status_filter = self.request.query_params.get('status')
        
        if session_id:
            queryset = queryset.filter(session_id=session_id)
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset


class StudentAttendanceView(APIView):
    """Get attendance overview for the current student."""
    permission_classes = [permissions.IsAuthenticated, IsStudent]
    
    def get(self, request):
        student = request.user

        # If student is assigned to a cohort, show courses aligned to the cohort hierarchy
        # (programme + current year + current semester), instead of historical attendance courses.
        if student.cohort_id:
            courses = Course.objects.filter(
                is_active=True,
                programme=student.cohort.programme,
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
            enrolled_courses = Course.objects.filter(
                enrollments__student=student,
                enrollments__is_active=True
            )
            recorded_courses = Course.objects.filter(
                attendance_sessions__attendance_records__student=student
            )
            courses = (enrolled_courses | recorded_courses).distinct()
        
        result = []
        for course in courses:
            records = AttendanceRecord.objects.filter(
                student=student,
                session__course=course
            )
            
            total = records.count()
            present = records.filter(status__in=['present', 'late']).count()
            absent = records.filter(status='absent').count()
            
            attendance_pct = round((present / course.total_lectures) * 100, 1) if course.total_lectures > 0 else 0
            
            recent_records = records.order_by('-session__date')[:5]
            
            result.append({
                'course_id': str(course.id),
                'course_code': course.code,
                'course_name': course.name,
                'total_sessions': total,
                'attended': present,
                'late': 0,
                'absent': absent,
                'attendance_percentage': attendance_pct,
                'threshold': course.attendance_threshold,
                'is_at_risk': attendance_pct < course.attendance_threshold,
                'recent_records': AttendanceRecordSerializer(recent_records, many=True).data
            })
        
        return Response(result)


class AdminStudentAttendanceView(APIView):
    """Admin view: get full attendance report for any student."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request, student_id):
        UserModel = get_user_model()
        try:
            student = UserModel.objects.get(id=student_id, role='student')
        except UserModel.DoesNotExist:
            return Response({'detail': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Only show courses for the student's current year of study
        # so the analytics matches the attendance page filter
        current_year = student.cohort.current_year_of_study if student.cohort else None

        enrolled_courses = Course.objects.filter(
            enrollments__student=student, enrollments__is_active=True
        )
        if current_year is not None:
            enrolled_courses = enrolled_courses.filter(year_level=current_year)
        courses = enrolled_courses.distinct().order_by('semester_number', 'code')

        result = []
        for course in courses:
            # Get ALL sessions for this course ordered by date
            sessions = AttendanceSession.objects.filter(
                course=course
            ).order_by('date')

            # Build a lookup of records that actually exist for this student
            existing_records = {
                r.session_id: r
                for r in AttendanceRecord.objects.filter(
                    student=student, session__course=course
                ).select_related('session')
            }

            sessions_held = sessions.count()
            present = 0
            absent = 0
            trend = []
            running_present = 0

            for i, session in enumerate(sessions, 1):
                rec = existing_records.get(session.id)
                if rec and rec.status in ('present', 'late'):
                    running_present += 1
                    present += 1
                    s_status = rec.status
                else:
                    # No record or marked absent → counts as absent
                    absent += 1
                    s_status = rec.status if rec else 'absent'

                trend.append({
                    'session': i,
                    'date': str(session.date),
                    'status': s_status,
                    'cumulative_pct': round(running_present / course.total_lectures * 100, 1) if course.total_lectures > 0 else 0,
                })

            pct = round((present / course.total_lectures) * 100, 1) if course.total_lectures > 0 else 0

            result.append({
                'course_id': str(course.id),
                'course_code': course.code,
                'course_name': course.name,
                'total_lectures': course.total_lectures,
                'sessions_held': sessions_held,
                'attended': present,
                'absent': absent,
                'attendance_percentage': pct,
                'threshold': course.attendance_threshold,
                'is_at_risk': pct < course.attendance_threshold,
                'trend': trend,
            })

        return Response({
            'student': {
                'id': str(student.id),
                'name': student.get_full_name(),
                'student_number': student.student_id,
                'email': student.email,
                'study_time': student.study_time,
                'cohort': str(student.cohort) if student.cohort else None,
            },
            'courses': result,
            'overall_percentage': round(
                sum(c['attendance_percentage'] for c in result) / len(result), 1
            ) if result else 0,
        })


class StudentCourseAttendanceView(APIView):
    """Get detailed attendance for a specific course."""
    permission_classes = [permissions.IsAuthenticated, IsStudent]
    
    def get(self, request, course_id):
        student = request.user
        
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response(
                {"error": "Course not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        records = AttendanceRecord.objects.filter(
            student=student,
            session__course=course
        ).order_by('-session__date')
        
        serializer = AttendanceRecordSerializer(records, many=True)
        
        total = records.count()
        present = records.filter(status='present').count()
        
        return Response({
            'course': {
                'id': str(course.id),
                'code': course.code,
                'name': course.name,
                'threshold': course.attendance_threshold
            },
            'summary': {
                'total_sessions': total,
                'present': present,
                'late': 0,
                'absent': total - present,
                'attendance_percentage': round((present / course.total_lectures) * 100, 1) if course.total_lectures > 0 else 0
            },
            'records': serializer.data
        })


class LecturerCourseAttendanceView(APIView):
    """Get attendance analytics for lecturer's courses."""
    permission_classes = [permissions.IsAuthenticated, IsLecturer]
    
    def get(self, request, course_id=None):
        lecturer = request.user
        
        if course_id:
            courses = Course.objects.filter(id=course_id, lecturer=lecturer)
        else:
            courses = Course.objects.filter(lecturer=lecturer)
        
        result = []
        for course in courses:
            sessions = AttendanceSession.objects.filter(course=course)
            enrollments = Enrollment.objects.filter(course=course, is_active=True)
            
            # Calculate overall stats
            total_sessions = sessions.count()
            avg_attendance = 0
            if total_sessions > 0:
                total_present = sum(s.present_count for s in sessions)
                total_expected = sum(s.total_enrolled for s in sessions)
                avg_attendance = round((total_present / total_expected * 100), 1) if total_expected > 0 else 0
            
            # At-risk students
            at_risk = []
            for enrollment in enrollments:
                if float(enrollment.attendance_percentage) < course.attendance_threshold:
                    at_risk.append({
                        'student_id': str(enrollment.student.id),
                        'student_name': enrollment.student.full_name,
                        'attendance_percentage': float(enrollment.attendance_percentage)
                    })
            
            result.append({
                'course_id': str(course.id),
                'course_code': course.code,
                'course_name': course.name,
                'total_sessions': total_sessions,
                'total_students': enrollments.count(),
                'average_attendance': avg_attendance,
                'threshold': course.attendance_threshold,
                'at_risk_count': len(at_risk),
                'at_risk_students': at_risk
            })
        
        return Response(result)


class ActiveSessionsView(generics.ListAPIView):
    """List currently active attendance sessions."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AttendanceSessionListSerializer
    
    def get_queryset(self):
        user = self.request.user
        queryset = _with_effective_schedule(AttendanceSession.objects.all()).filter(_active_window_query())
        
        if user.role == 'lecturer':
            queryset = queryset.filter(lecturer=user)
        elif user.role == 'student':
            enrolled_courses = Course.objects.filter(
                enrollments__student=user,
                enrollments__is_active=True
            )
            queryset = queryset.filter(course__in=enrolled_courses)
        
        return queryset


class TodaySessionsView(generics.ListAPIView):
    """List today's attendance sessions."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AttendanceSessionListSerializer
    
    def get_queryset(self):
        user = self.request.user
        today = timezone.now().date()
        queryset = AttendanceSession.objects.filter(date=today)
        
        if user.role == 'lecturer':
            queryset = queryset.filter(lecturer=user)
        elif user.role == 'student':
            enrolled_courses = Course.objects.filter(
                enrollments__student=user,
                enrollments__is_active=True
            )
            queryset = queryset.filter(course__in=enrolled_courses)
        
        return queryset.order_by('start_time')

class FingerprintAttendanceView(APIView):
    """Verify fingerprint and mark attendance via 1:N identification."""
    permission_classes = [permissions.IsAuthenticated, IsLecturerOrAdminOrCoordinator]
    
    def post(self, request):
        session_id = request.data.get('session_id')
        fingerprint_template = request.data.get('fingerprint_template')
        
        if not session_id or not fingerprint_template:
            return Response(
                {"error": "session_id and fingerprint_template are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            session = AttendanceSession.objects.get(id=session_id)
        except AttendanceSession.DoesNotExist:
            return Response(
                {"error": "Session not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        window_error = _session_window_error(session)
        if window_error:
            return window_error

        # Decode the captured template
        from .fingerprint_utils import decode_template, find_matching_student
        try:
            captured_bytes = decode_template(fingerprint_template)
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get enrolled students for this course
        enrolled_students = User.objects.filter(
            enrollments__course=session.course,
            enrollments__is_active=True,
            role='student'
        )
        
        # 1:N matching
        matched_student, confidence = find_matching_student(captured_bytes, enrolled_students)
        
        if not matched_student:
            return Response({
                "matched": False,
                "message": "No matching student found. Please try again.",
                "confidence": 0
            })
        
        # Mark attendance
        record, created = AttendanceRecord.objects.get_or_create(
            session=session,
            student=matched_student,
            defaults={'status': 'absent'}
        )

        if not created and record.status in {'present', 'excused'}:
            return Response({
                "matched": True,
                "already_marked": True,
                "student_id": str(matched_student.id),
                "student_name": matched_student.full_name,
                "student_number": matched_student.student_id,
                "status": record.status,
                "message": f"{matched_student.full_name} already captured for this session"
            })
        
        record.mark_present(
            marked_by=request.user,
            verification_method='fingerprint',
            confidence=confidence
        )
        
        # Create notification for student
        from apps.users.models import Notification
        Notification.objects.create(
            user=matched_student,
            title="Attendance Recorded",
            message=f"Your attendance for {session.course.code} - {session.course.name} has been recorded via fingerprint.",
            notification_type='success',
            link=f"/student/attendance"
        )
        
        # Log the action
        AuditLog.objects.create(
            user=request.user,
            action='ATTENDANCE_MARKED',
            entity_type='AttendanceRecord',
            entity_id=str(record.id),
            description=f"Fingerprint attendance: {matched_student.full_name} marked as {record.status} for {session.course.code}",
            metadata={'verification_method': 'fingerprint', 'confidence': confidence}
        )
        
        return Response({
            "matched": True,
            "student_id": str(matched_student.id),
            "student_name": matched_student.full_name,
            "student_number": matched_student.student_id,
            "status": record.status,
            "confidence": confidence,
            "message": f"{matched_student.full_name} marked as {record.status}"
        })


class AdminCourseAttendanceSummaryView(APIView):
    """Admin: per-student attendance summary for a course, filtered by year/semester/study_time."""
    permission_classes = [permissions.IsAuthenticated, IsLecturerOrAdmin]

    def get(self, request, course_id):
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response({"error": "Course not found"}, status=status.HTTP_404_NOT_FOUND)

        enrollments = Enrollment.objects.filter(
            course=course, is_active=True
        ).select_related('student')

        # Optional filter by study_time
        study_time = request.query_params.get('study_time')
        if study_time:
            enrollments = enrollments.filter(student__study_time=study_time)

        sessions = AttendanceSession.objects.filter(course=course)
        total_sessions = sessions.count()

        students_data = []
        for e in enrollments:
            records = AttendanceRecord.objects.filter(session__course=course, student=e.student)
            present = records.filter(status='present').count()
            absent = records.filter(status='absent').count()
            pct = round((present / course.total_lectures) * 100, 1) if course.total_lectures > 0 else 0
            students_data.append({
                'student_id': str(e.student.id),
                'student_number': e.student.student_id,
                'first_name': e.student.first_name,
                'last_name': e.student.last_name,
                'email': e.student.email,
                'study_time': e.student.study_time,
                'fingerprint_registered': e.student.fingerprint_registered,
                'total_sessions': total_sessions,
                'present': present,
                'late': 0,
                'absent': absent,
                'attendance_percentage': pct,
                'is_at_risk': pct < course.attendance_threshold,
            })

        return Response({
            'course': {
                'id': str(course.id),
                'code': course.code,
                'name': course.name,
                'year_level': course.year_level,
                'semester_number': course.semester_number,
                'total_sessions': total_sessions,
                'threshold': course.attendance_threshold,
            },
            'students': students_data,
        })


class EnrolledTemplatesView(APIView):
    """Return fingerprint templates for all enrolled students in a session's course.
    Used by the Android app for device-side matching via Mantra MatchISO()."""
    permission_classes = [permissions.IsAuthenticated, IsLecturerOrAdminOrCoordinator]

    def get(self, request, session_id):
        try:
            session = AttendanceSession.objects.select_related('course').get(id=session_id)
        except AttendanceSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        import base64
        from apps.courses.models import Cohort

        # For coordinators: return all cohort students with fingerprints (they all attend all cohort courses)
        # For lecturers/admins: only return students enrolled in this specific course
        if request.user.role == 'student':
            from apps.courses.models import CohortGroupCoordinator
            group = CohortGroupCoordinator.objects.filter(coordinator=request.user).first()
            if group:
                students = User.objects.filter(
                    cohort=group.cohort,
                    study_time=request.user.study_time,
                    role='student',
                    fingerprint_registered=True
                ).exclude(fingerprint_template=None)
            else:
                students = User.objects.none()
        else:
            students = User.objects.filter(
                enrollments__course=session.course,
                enrollments__is_active=True,
                role='student',
                fingerprint_registered=True
            ).exclude(fingerprint_template=None)

        data = []
        for s in students:
            if s.fingerprint_template:
                data.append({
                    "student_id": str(s.id),
                    "student_name": s.full_name,
                    "student_number": s.student_id,
                    "template": base64.b64encode(bytes(s.fingerprint_template)).decode("utf-8"),
                })

        return Response({"students": data})


class MarkPresentView(APIView):
    """Mark a specific student present in a session (after device-side matching)."""
    permission_classes = [permissions.IsAuthenticated, IsLecturerOrAdminOrCoordinator]

    def post(self, request, session_id):
        student_id = request.data.get('student_id')
        if not student_id:
            return Response({"error": "student_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = AttendanceSession.objects.select_related('course').get(id=session_id)
        except AttendanceSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        window_error = _session_window_error(session)
        if window_error:
            return window_error

        try:
            student = User.objects.get(id=student_id, role='student')
        except User.DoesNotExist:
            return Response({"error": "Student not found"}, status=status.HTTP_404_NOT_FOUND)

        record, _ = AttendanceRecord.objects.get_or_create(
            session=session,
            student=student,
            defaults={'status': 'absent'}
        )

        if record.status in {'present', 'excused'}:
            return Response({
                "matched": True,
                "already_marked": True,
                "student_id": str(student.id),
                "student_name": student.full_name,
                "student_number": student.student_id,
                "status": record.status,
                "message": f"{student.full_name} already captured for this session"
            })

        record.mark_present(
            marked_by=request.user,
            verification_method='fingerprint',
            confidence=request.data.get('confidence', 0)
        )

        from apps.users.models import Notification
        Notification.objects.create(
            user=student,
            title="Attendance Recorded",
            message=f"Your attendance for {session.course.code} - {session.course.name} has been recorded via fingerprint.",
            notification_type='success',
            link="/student/attendance"
        )

        AuditLog.objects.create(
            user=request.user,
            action='ATTENDANCE_MARKED',
            entity_type='AttendanceRecord',
            entity_id=str(record.id),
            description=f"Fingerprint attendance: {student.full_name} marked present for {session.course.code}",
            metadata={'verification_method': 'fingerprint', 'confidence': request.data.get('confidence', 0)}
        )

        return Response({
            "matched": True,
            "already_marked": False,
            "student_id": str(student.id),
            "student_name": student.full_name,
            "student_number": student.student_id,
            "status": record.status,
            "message": f"{student.full_name} marked as present"
        })


class CourseAttendanceRegisterView(APIView):
    """
    Returns the full attendance register for a course:
    - All sessions ordered by date
    - All enrolled students
    - Per-student status for each session
    Filters: ?academic_period=<id>  ?study_time=<val>
    """
    permission_classes = [permissions.IsAuthenticated, IsLecturerOrAdminOrCoordinator]

    def get(self, request, course_id):
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response({"error": "Course not found"}, status=status.HTTP_404_NOT_FOUND)

        sessions_qs = AttendanceSession.objects.filter(course=course).order_by('date', 'start_time')

        academic_period = request.query_params.get('academic_period')
        if academic_period:
            sessions_qs = sessions_qs.filter(course__academic_period=academic_period)

        study_time = request.query_params.get('study_time')
        enrollments = Enrollment.objects.filter(course=course, is_active=True).select_related('student')
        if study_time:
            enrollments = enrollments.filter(student__study_time=study_time)

        sessions = list(sessions_qs)
        session_ids = [s.id for s in sessions]

        # Fetch all records for these sessions in one query
        records = AttendanceRecord.objects.filter(
            session_id__in=session_ids
        ).select_related('student')

        # Build lookup: {student_id: {session_id: record}}
        record_map = {}
        for rec in records:
            sid = str(rec.student_id)
            ssid = str(rec.session_id)
            if sid not in record_map:
                record_map[sid] = {}
            record_map[sid][ssid] = {
                'status': rec.status,
                'marked_at': rec.marked_at.isoformat() if rec.marked_at else None,
                'verification_method': rec.verification_method,
            }

        sessions_data = []
        for s in sessions:
            sessions_data.append({
                'id': str(s.id),
                'date': s.date.isoformat(),
                'start_time': str(s.start_time),
                'end_time': str(s.end_time) if s.end_time else None,
                'title': s.title or '',
                'session_type': s.session_type,
                'is_active': s.is_active,
                'room': s.room or '',
                'present_count': s.present_count,
                'late_count': 0,
                'absent_count': s.total_enrolled - s.present_count,
                'total_enrolled': s.total_enrolled,
                'attendance_rate': s.attendance_rate,
            })

        # Collect enrolled student IDs, then add any students who have records but aren't enrolled
        enrolled_student_ids = {str(e.student_id) for e in enrollments}
        recorded_student_ids = set(record_map.keys())
        extra_student_ids = recorded_student_ids - enrolled_student_ids

        extra_students = []
        if extra_student_ids:
            from apps.users.models import User as UserModel
            extra_students = list(UserModel.objects.filter(id__in=extra_student_ids))

        all_students = [(e.student, True) for e in enrollments] + [(s, False) for s in extra_students]

        students_data = []
        total_sessions = len(sessions)
        for student, is_enrolled in all_students:
            student_str = str(student.id)
            session_records = record_map.get(student_str, {})

            present = sum(1 for r in session_records.values() if r['status'] == 'present')
            absent = sum(1 for r in session_records.values() if r['status'] == 'absent')
            excused = sum(1 for r in session_records.values() if r['status'] == 'excused')
            attended = present
            pct = round(attended / course.total_lectures * 100, 1) if course.total_lectures > 0 else 0

            students_data.append({
                'student_id': student_str,
                'student_number': student.student_id,
                'first_name': student.first_name,
                'last_name': student.last_name,
                'email': student.email,
                'study_time': student.study_time,
                'fingerprint_registered': student.fingerprint_registered,
                'total_present': present,
                'total_late': 0,
                'total_absent': absent,
                'total_excused': excused,
                'attendance_percentage': pct,
                'is_at_risk': pct < course.attendance_threshold,
                'session_records': {
                    ssid: session_records.get(ssid, {'status': 'absent', 'marked_at': None, 'verification_method': None})
                    for ssid in [str(s.id) for s in sessions]
                },
            })

        return Response({
            'course': {
                'id': str(course.id),
                'code': course.code,
                'name': course.name,
                'year_level': course.year_level,
                'semester_number': course.semester_number,
                'total_sessions': total_sessions,
                'total_lectures': course.total_lectures,
                'threshold': course.attendance_threshold,
            },
            'sessions': sessions_data,
            'students': students_data,
        })
