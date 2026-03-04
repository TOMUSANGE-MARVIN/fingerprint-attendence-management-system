"""
Seed the database with sample data for development.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import date, time, timedelta
from apps.courses.models import Course, Enrollment, TimetableSlot, Faculty, AcademicPeriod
from apps.attendance.models import AttendanceSession, AttendanceRecord

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed the database with sample data'

    def handle(self, *args, **options):
        self.stdout.write("Seeding database...")
        
        # Create faculties
        fac_computing, _ = Faculty.objects.get_or_create(
            code='FoC',
            defaults={'name': 'Faculty of Computing and Informatics', 'description': 'Computing, IT, and Information Systems'}
        )
        fac_engineering, _ = Faculty.objects.get_or_create(
            code='FoE',
            defaults={'name': 'Faculty of Engineering', 'description': 'Electrical, Mechanical, and Civil Engineering'}
        )
        fac_science, _ = Faculty.objects.get_or_create(
            code='FoS',
            defaults={'name': 'Faculty of Science', 'description': 'Mathematics, Physics, Chemistry, and Biology'}
        )
        self.stdout.write("  Created faculties")
        
        # Create academic periods
        period, _ = AcademicPeriod.objects.get_or_create(
            academic_year='2025-2026',
            semester='Semester 1',
            defaults={
                'start_date': date(2025, 8, 1),
                'end_date': date(2025, 12, 15),
                'is_current': False,
            }
        )
        current_period, _ = AcademicPeriod.objects.get_or_create(
            academic_year='2025-2026',
            semester='Semester 2',
            defaults={
                'start_date': date(2026, 1, 15),
                'end_date': date(2026, 6, 30),
                'is_current': True,
            }
        )
        self.stdout.write("  Created academic periods")
        
        # Create admin
        admin, _ = User.objects.get_or_create(
            email='admin@university.edu',
            defaults={
                'first_name': 'System',
                'last_name': 'Administrator',
                'role': 'admin',
                'is_staff': True,
                'is_superuser': True,
                'department': 'Administration',
            }
        )
        if not admin.has_usable_password():
            admin.set_password('admin123')
            admin.save()
        
        # Create lecturers
        lecturers = []
        lecturer_data = [
            ('john.smith@university.edu', 'John', 'Smith', 'STF001', 'Faculty of Computing and Informatics', 'Software Engineering'),
            ('jane.doe@university.edu', 'Jane', 'Doe', 'STF002', 'Faculty of Engineering', 'Data Science'),
            ('robert.wilson@university.edu', 'Robert', 'Wilson', 'STF003', 'Faculty of Science', 'Mathematics'),
        ]
        for email, first, last, staff_id, faculty_name, spec in lecturer_data:
            lec, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': first,
                    'last_name': last,
                    'role': 'lecturer',
                    'staff_id': staff_id,
                    'faculty': faculty_name,
                    'specialization': spec,
                }
            )
            if not lec.has_usable_password():
                lec.set_password('lecturer123')
                lec.save()
            lecturers.append(lec)
        self.stdout.write("  Created lecturers")
        
        # Create students
        students = []
        for i in range(1, 16):
            student, _ = User.objects.get_or_create(
                email=f'student{i:02d}@university.edu',
                defaults={
                    'first_name': f'Student',
                    'last_name': f'{i:02d}',
                    'role': 'student',
                    'student_id': f'STU{2024000 + i}',
                    'department': 'Computer Science' if i <= 8 else 'Information Technology',
                    'program': 'BSc Computer Science' if i <= 8 else 'BSc Information Technology',
                    'year_of_study': (i % 4) + 1,
                }
            )
            if not student.has_usable_password():
                student.set_password('student123')
                student.save()
            students.append(student)
        self.stdout.write("  Created 15 students")
        
        # Create courses
        courses_data = [
            ('CS101', 'Introduction to Programming', 'Computer Science', lecturers[0], fac_computing),
            ('CS201', 'Data Structures & Algorithms', 'Computer Science', lecturers[0], fac_computing),
            ('CS301', 'Software Engineering', 'Computer Science', lecturers[0], fac_computing),
            ('IT201', 'Database Management Systems', 'Information Technology', lecturers[1], fac_computing),
            ('MT101', 'Calculus I', 'Mathematics', lecturers[2], fac_science),
        ]
        courses = []
        for code, name, dept, lecturer, faculty in courses_data:
            course, _ = Course.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'department': dept,
                    'semester': 'Semester 2',
                    'academic_year': '2025-2026',
                    'lecturer': lecturer,
                    'credits': 3,
                    'attendance_threshold': 75,
                    'faculty': faculty,
                    'academic_period': current_period,
                }
            )
            courses.append(course)
        self.stdout.write("  Created courses")
        
        # Enroll students
        for i, student in enumerate(students):
            # Each student in 3-4 courses
            student_courses = courses[:3] if i < 8 else courses[2:]
            for course in student_courses:
                Enrollment.objects.get_or_create(
                    student=student,
                    course=course,
                )
        self.stdout.write("  Created enrollments")
        
        # Create timetable slots
        timetable_data = [
            (courses[0], 'monday', time(8, 0), time(10, 0), 'LH1', 'Main Building'),
            (courses[0], 'wednesday', time(8, 0), time(10, 0), 'LH1', 'Main Building'),
            (courses[1], 'tuesday', time(10, 0), time(12, 0), 'LH2', 'Main Building'),
            (courses[1], 'thursday', time(10, 0), time(12, 0), 'LH2', 'Main Building'),
            (courses[2], 'monday', time(14, 0), time(16, 0), 'LH3', 'Block B'),
            (courses[2], 'friday', time(10, 0), time(12, 0), 'LH3', 'Block B'),
            (courses[3], 'wednesday', time(14, 0), time(16, 0), 'Lab1', 'IT Block'),
            (courses[3], 'friday', time(14, 0), time(16, 0), 'Lab1', 'IT Block'),
            (courses[4], 'tuesday', time(8, 0), time(10, 0), 'LH4', 'Science Block'),
            (courses[4], 'thursday', time(8, 0), time(10, 0), 'LH4', 'Science Block'),
        ]
        for course, day, start, end, room, building in timetable_data:
            TimetableSlot.objects.get_or_create(
                course=course,
                day_of_week=day,
                start_time=start,
                defaults={
                    'end_time': end,
                    'room': room,
                    'building': building,
                }
            )
        self.stdout.write("  Created timetable slots")
        
        # Create some attendance sessions and records
        today = timezone.now().date()
        for days_ago in range(14, 0, -1):
            session_date = today - timedelta(days=days_ago)
            day_name = session_date.strftime('%A').lower()
            
            slots = TimetableSlot.objects.filter(day_of_week=day_name, is_active=True)
            for slot in slots:
                session, created = AttendanceSession.objects.get_or_create(
                    course=slot.course,
                    date=session_date,
                    start_time=slot.start_time,
                    defaults={
                        'end_time': slot.end_time,
                        'lecturer': slot.course.lecturer,
                        'room': slot.room,
                        'building': slot.building,
                        'session_type': 'lecture',
                        'title': f"{slot.course.code} - {slot.course.name}",
                        'is_active': False,
                        'started_at': timezone.now(),
                        'ended_at': timezone.now(),
                    }
                )
                
                if created:
                    # Create attendance records
                    import random
                    enrollments = Enrollment.objects.filter(course=slot.course, is_active=True)
                    for enrollment in enrollments:
                        status_choices = ['present'] * 7 + ['late'] * 1 + ['absent'] * 2
                        att_status = random.choice(status_choices)
                        AttendanceRecord.objects.get_or_create(
                            session=session,
                            student=enrollment.student,
                            defaults={
                                'status': att_status,
                                'verification_method': 'manual',
                                'marked_at': timezone.now(),
                            }
                        )
                    
                    # Update enrollment stats
                    for enrollment in enrollments:
                        enrollment.update_attendance_stats()
        
        self.stdout.write("  Created attendance history")
        
        self.stdout.write(self.style.SUCCESS("\nDatabase seeded successfully!"))
        self.stdout.write(f"\nTest credentials:")
        self.stdout.write(f"  Admin:    admin@university.edu / admin123")
        self.stdout.write(f"  Lecturer: john.smith@university.edu / lecturer123")
        self.stdout.write(f"  Student:  student01@university.edu / student123")
