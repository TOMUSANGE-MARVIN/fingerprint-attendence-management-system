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
from datetime import datetime, timedelta
from .models import AttendanceSession, AttendanceRecord, AttendanceSummary
from .serializers import (
    AttendanceSessionListSerializer, AttendanceSessionDetailSerializer,
    AttendanceSessionCreateSerializer, AttendanceRecordSerializer,
    AttendanceRecordCreateSerializer, BulkAttendanceSerializer,
    AttendanceSummarySerializer, StudentAttendanceSerializer
)
from apps.users.permissions import IsAdmin, IsLecturer, IsStudent, IsLecturerOrAdmin
from .fingerprint_utils import decode_template, find_matching_student
from apps.users.models import AuditLog
from apps.courses.models import Course, Enrollment

User = get_user_model()


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
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'create':
            return AttendanceSessionCreateSerializer
        elif self.action == 'retrieve':
            return AttendanceSessionDetailSerializer
        return AttendanceSessionListSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'start', 'end']:
            return [permissions.IsAuthenticated(), IsLecturerOrAdmin()]
        return super().get_permissions()
    
    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Start an attendance session."""
        session = self.get_object()
        
        if session.is_active:
            return Response(
                {"error": "Session is already active"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        session.start_session()
        
        # Create absent records for all enrolled students
        enrollments = Enrollment.objects.filter(course=session.course, is_active=True)
        for enrollment in enrollments:
            AttendanceRecord.objects.get_or_create(
                session=session,
                student=enrollment.student,
                defaults={'status': 'absent'}
            )
        
        # Log the action
        AuditLog.objects.create(
            user=request.user,
            action='SESSION_STARTED',
            entity_type='AttendanceSession',
            entity_id=str(session.id),
            description=f"Started attendance session for {session.course.code}"
        )
        
        serializer = AttendanceSessionDetailSerializer(session)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def end(self, request, pk=None):
        """End an attendance session."""
        session = self.get_object()
        
        if not session.is_active:
            return Response(
                {"error": "Session is not active"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        session.end_session()
        
        # Log the action
        AuditLog.objects.create(
            user=request.user,
            action='SESSION_ENDED',
            entity_type='AttendanceSession',
            entity_id=str(session.id),
            description=f"Ended attendance session for {session.course.code}"
        )
        
        serializer = AttendanceSessionDetailSerializer(session)
        return Response(serializer.data)
    
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
        enrolled_courses = Course.objects.filter(
            enrollments__student=student,
            enrollments__is_active=True
        )
        
        result = []
        for course in enrolled_courses:
            records = AttendanceRecord.objects.filter(
                student=student,
                session__course=course
            )
            
            total = records.count()
            present = records.filter(status='present').count()
            late = records.filter(status='late').count()
            absent = records.filter(status='absent').count()
            
            attendance_pct = round((present + late) / total * 100, 1) if total > 0 else 0
            
            recent_records = records.order_by('-session__date')[:5]
            
            result.append({
                'course_id': str(course.id),
                'course_code': course.code,
                'course_name': course.name,
                'total_sessions': total,
                'attended': present,
                'late': late,
                'absent': absent,
                'attendance_percentage': attendance_pct,
                'threshold': course.attendance_threshold,
                'is_at_risk': attendance_pct < course.attendance_threshold,
                'recent_records': AttendanceRecordSerializer(recent_records, many=True).data
            })
        
        return Response(result)


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
        late = records.filter(status='late').count()
        
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
                'late': late,
                'absent': total - present - late,
                'attendance_percentage': round((present + late) / total * 100, 1) if total > 0 else 0
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
                total_present = sum(s.present_count + s.late_count for s in sessions)
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
        queryset = AttendanceSession.objects.filter(is_active=True)
        
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
    permission_classes = [permissions.IsAuthenticated, IsLecturerOrAdmin]
    
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
        
        if not session.is_active:
            return Response(
                {"error": "Session is not active"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if session.is_expired:
            return Response(
                {"error": "Session has expired — attendance is now locked"},
                status=status.HTTP_400_BAD_REQUEST
            )

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


class EnrolledTemplatesView(APIView):
    """Return fingerprint templates for all enrolled students in a session's course.
    Used by the Android app for device-side matching via Mantra MatchISO()."""
    permission_classes = [permissions.IsAuthenticated, IsLecturerOrAdmin]

    def get(self, request, session_id):
        try:
            session = AttendanceSession.objects.select_related('course').get(id=session_id)
        except AttendanceSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        import base64
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
    permission_classes = [permissions.IsAuthenticated, IsLecturerOrAdmin]

    def post(self, request, session_id):
        student_id = request.data.get('student_id')
        if not student_id:
            return Response({"error": "student_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = AttendanceSession.objects.select_related('course').get(id=session_id)
        except AttendanceSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        if not session.is_active:
            return Response({"error": "Session is not active"}, status=status.HTTP_400_BAD_REQUEST)

        if session.is_expired:
            return Response({"error": "Session has expired — attendance is now locked"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            student = User.objects.get(id=student_id, role='student')
        except User.DoesNotExist:
            return Response({"error": "Student not found"}, status=status.HTTP_404_NOT_FOUND)

        record, _ = AttendanceRecord.objects.get_or_create(
            session=session,
            student=student,
            defaults={'status': 'absent'}
        )
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
            "student_id": str(student.id),
            "student_name": student.full_name,
            "student_number": student.student_id,
            "status": record.status,
            "message": f"{student.full_name} marked as present"
        })
