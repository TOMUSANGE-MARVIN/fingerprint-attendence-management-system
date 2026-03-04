"""
Management command to seed the database with sample data.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta, time, date
import random

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed the database with sample data for testing'

    def handle(self, *args, **options):
        self.stdout.write('Seeding database...')

        # Import models early to avoid repeated imports
        from apps.courses.models import (
            Course, Enrollment, TimetableSlot,
            Faculty, AcademicPeriod, AcademicYear, Programme, Cohort
        )
        from apps.attendance.models import AttendanceSession, AttendanceRecord

        # ------------------------------------------------------------------ #
        # Admin
        # ------------------------------------------------------------------ #
        admin, created = User.objects.get_or_create(
            email='admin@university.edu',
            defaults={
                'first_name': 'System',
                'last_name': 'Administrator',
                'role': 'admin',
                'is_staff': True,
                'is_superuser': True,
            }
        )
        if created:
            admin.set_password('admin123')
            admin.save()
            self.stdout.write(self.style.SUCCESS(f'Created admin: {admin.email}'))

        # ------------------------------------------------------------------ #
        # Faculty
        # ------------------------------------------------------------------ #
        faculty_cs, _ = Faculty.objects.get_or_create(
            code='FCS',
            defaults={'name': 'Faculty of Computing & Informatics', 'is_active': True}
        )

        # ------------------------------------------------------------------ #
        # Academic Years
        # ------------------------------------------------------------------ #
        ay2022, _ = AcademicYear.objects.get_or_create(
            label='2022/2023',
            defaults={'start_year': 2022, 'is_current': False}
        )
        ay2023, _ = AcademicYear.objects.get_or_create(
            label='2023/2024',
            defaults={'start_year': 2023, 'is_current': False}
        )
        ay2024, _ = AcademicYear.objects.get_or_create(
            label='2024/2025',
            defaults={'start_year': 2024, 'is_current': True}
        )
        # Ensure only 2024/2025 is current
        AcademicYear.objects.exclude(pk=ay2024.pk).update(is_current=False)
        ay2024.is_current = True
        ay2024.save()
        self.stdout.write('Created academic years')

        # ------------------------------------------------------------------ #
        # Academic Period (current semester)
        # ------------------------------------------------------------------ #
        period, _ = AcademicPeriod.objects.get_or_create(
            academic_year='2024-2025',
            semester='Semester 1',
            defaults={
                'start_date': date(2024, 9, 1),
                'end_date': date(2025, 1, 31),
                'is_current': True,
            }
        )
        AcademicPeriod.objects.exclude(pk=period.pk).update(is_current=False)
        period.is_current = True
        period.save()

        # ------------------------------------------------------------------ #
        # Programmes
        # ------------------------------------------------------------------ #
        bit, _ = Programme.objects.get_or_create(
            code='BIT',
            defaults={
                'name': 'Bachelor of Information Technology',
                'duration_years': 3,
                'faculty': faculty_cs,
                'is_active': True,
            }
        )
        dit, _ = Programme.objects.get_or_create(
            code='DIT',
            defaults={
                'name': 'Diploma in Information Technology',
                'duration_years': 2,
                'faculty': faculty_cs,
                'is_active': True,
            }
        )
        self.stdout.write('Created programmes')

        # ------------------------------------------------------------------ #
        # Lecturers
        # ------------------------------------------------------------------ #
        lecturers = []
        lecturer_data = [
            {
                'email': 'john.smith@university.edu',
                'first_name': 'John', 'last_name': 'Smith',
                'staff_id': 'LEC001', 'faculty': 'Computer Science',
                'specialization': 'Software Engineering',
            },
            {
                'email': 'jane.doe@university.edu',
                'first_name': 'Jane', 'last_name': 'Doe',
                'staff_id': 'LEC002', 'faculty': 'Computer Science',
                'specialization': 'Data Science',
            },
            {
                'email': 'robert.wilson@university.edu',
                'first_name': 'Robert', 'last_name': 'Wilson',
                'staff_id': 'LEC003', 'faculty': 'Mathematics',
                'specialization': 'Applied Mathematics',
            },
        ]
        for data in lecturer_data:
            lecturer, created = User.objects.get_or_create(
                email=data['email'],
                defaults={**data, 'role': 'lecturer'}
            )
            if created:
                lecturer.set_password('lecturer123')
                lecturer.save()
                self.stdout.write(self.style.SUCCESS(f'Created lecturer: {lecturer.email}'))
            lecturers.append(lecturer)

        # ------------------------------------------------------------------ #
        # Cohorts
        # ------------------------------------------------------------------ #
        # BIT cohorts: 2022, 2023, 2024 intake
        bit_2022, _ = Cohort.objects.get_or_create(
            programme=bit, intake_year=ay2022,
            defaults={'coordinator': lecturers[0], 'is_active': True}
        )
        bit_2023, _ = Cohort.objects.get_or_create(
            programme=bit, intake_year=ay2023,
            defaults={'coordinator': lecturers[1], 'is_active': True}
        )
        bit_2024, _ = Cohort.objects.get_or_create(
            programme=bit, intake_year=ay2024,
            defaults={'coordinator': lecturers[0], 'is_active': True}
        )
        # DIT cohorts: 2023, 2024 intake
        dit_2023, _ = Cohort.objects.get_or_create(
            programme=dit, intake_year=ay2023,
            defaults={'coordinator': lecturers[2], 'is_active': True}
        )
        dit_2024, _ = Cohort.objects.get_or_create(
            programme=dit, intake_year=ay2024,
            defaults={'coordinator': lecturers[2], 'is_active': True}
        )
        all_cohorts = [bit_2022, bit_2023, bit_2024, dit_2023, dit_2024]
        self.stdout.write('Created cohorts')

        # ------------------------------------------------------------------ #
        # Students (assign to cohorts)
        # ------------------------------------------------------------------ #
        students = []
        # Distribute 20 students across cohorts
        cohort_assignments = (
            [bit_2022] * 4 + [bit_2023] * 5 + [bit_2024] * 5 +
            [dit_2023] * 3 + [dit_2024] * 3
        )
        for i in range(1, 21):
            cohort = cohort_assignments[i - 1]
            student, created = User.objects.get_or_create(
                email=f'student{i:02d}@university.edu',
                defaults={
                    'first_name': 'Student',
                    'last_name': f'{i:02d}',
                    'role': 'student',
                    'student_id': f'STU{2024000 + i}',
                    'department': 'Computing',
                    'program': cohort.programme.code,
                    'year_of_study': cohort.current_year_of_study or 1,
                    'cohort': cohort,
                }
            )
            if created:
                student.set_password('student123')
                student.save()
                self.stdout.write(self.style.SUCCESS(f'Created student: {student.email}'))
            elif student.cohort is None:
                student.cohort = cohort
                student.save(update_fields=['cohort'])
            students.append(student)

        # ------------------------------------------------------------------ #
        # Courses (linked to programmes + year_level + semester_number)
        # ------------------------------------------------------------------ #
        courses_data = [
            # BIT Year 1 Semester 1
            {
                'code': 'BIT101', 'name': 'Introduction to Programming',
                'department': 'Computing', 'credits': 3,
                'lecturer': lecturers[0], 'programme': bit,
                'year_level': 1, 'semester_number': 1,
            },
            # BIT Year 1 Semester 2
            {
                'code': 'BIT102', 'name': 'Computer Architecture',
                'department': 'Computing', 'credits': 3,
                'lecturer': lecturers[2], 'programme': bit,
                'year_level': 1, 'semester_number': 2,
            },
            # BIT Year 2 Semester 1
            {
                'code': 'BIT201', 'name': 'Data Structures & Algorithms',
                'department': 'Computing', 'credits': 4,
                'lecturer': lecturers[0], 'programme': bit,
                'year_level': 2, 'semester_number': 1,
            },
            # BIT Year 2 Semester 2
            {
                'code': 'BIT202', 'name': 'Database Systems',
                'department': 'Computing', 'credits': 3,
                'lecturer': lecturers[1], 'programme': bit,
                'year_level': 2, 'semester_number': 2,
            },
            # BIT Year 3 Semester 1
            {
                'code': 'BIT301', 'name': 'Software Engineering',
                'department': 'Computing', 'credits': 4,
                'lecturer': lecturers[0], 'programme': bit,
                'year_level': 3, 'semester_number': 1,
            },
            # DIT Year 1 Semester 1
            {
                'code': 'DIT101', 'name': 'Fundamentals of IT',
                'department': 'Computing', 'credits': 3,
                'lecturer': lecturers[2], 'programme': dit,
                'year_level': 1, 'semester_number': 1,
            },
            # DIT Year 2 Semester 1
            {
                'code': 'DIT201', 'name': 'Web Technologies',
                'department': 'Computing', 'credits': 3,
                'lecturer': lecturers[1], 'programme': dit,
                'year_level': 2, 'semester_number': 1,
            },
        ]

        courses = []
        for data in courses_data:
            course, created = Course.objects.get_or_create(
                code=data['code'],
                defaults={
                    **data,
                    'semester': 'Semester 1',
                    'academic_year': '2024-2025',
                    'academic_period': period,
                    'faculty': faculty_cs,
                    'attendance_threshold': 75,
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created course: {course.code}'))
            courses.append(course)

        # ------------------------------------------------------------------ #
        # Timetable Slots (linked to cohort)
        # ------------------------------------------------------------------ #
        days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        times = [(8, 0), (10, 0), (13, 0), (15, 0)]

        # Map: (programme, year_level) → cohort with that intake
        # Courses in BIT Y1 → bit_2024, BIT Y2 → bit_2023, BIT Y3 → bit_2022
        # Courses in DIT Y1 → dit_2024, DIT Y2 → dit_2023
        cohort_for_course = {
            'BIT101': bit_2024, 'BIT102': bit_2024,
            'BIT201': bit_2023, 'BIT202': bit_2023,
            'BIT301': bit_2022,
            'DIT101': dit_2024,
            'DIT201': dit_2023,
        }

        for course in courses:
            if not course.timetable_slots.exists():
                day = random.choice(days)
                sh, sm = random.choice(times)
                cohort = cohort_for_course.get(course.code)
                TimetableSlot.objects.create(
                    course=course,
                    cohort=cohort,
                    day_of_week=day,
                    start_time=time(sh, sm),
                    end_time=time(sh + 2, sm),
                    room=f'Room {random.randint(100, 500)}',
                    building='Main Building',
                )
                self.stdout.write(f'Created timetable for {course.code}')

        # ------------------------------------------------------------------ #
        # Enroll students in courses matching their cohort's programme/year
        # ------------------------------------------------------------------ #
        for student in students:
            cohort = student.cohort
            if not cohort:
                continue
            prog = cohort.programme
            yr = cohort.current_year_of_study or 1
            # Enroll in courses that match programme + year_level <= current year
            matching = [c for c in courses
                        if c.programme == prog and (c.year_level or 0) <= yr]
            if not matching:
                matching = random.sample(courses, min(3, len(courses)))
            for course in matching:
                Enrollment.objects.get_or_create(student=student, course=course)

        self.stdout.write('Created enrollments')

        # ------------------------------------------------------------------ #
        # Attendance sessions & records
        # ------------------------------------------------------------------ #
        for course in courses:
            for i in range(10):
                session_date = timezone.now().date() - timedelta(days=(10 - i) * 3)
                session, created = AttendanceSession.objects.get_or_create(
                    course=course,
                    date=session_date,
                    defaults={
                        'lecturer': course.lecturer,
                        'title': f'{course.name} - Week {i + 1}',
                        'session_type': 'lecture',
                        'start_time': time(9, 0),
                        'end_time': time(11, 0),
                        'is_active': False,
                        'started_at': timezone.make_aware(
                            timezone.datetime.combine(session_date, time(9, 0))
                        ),
                        'ended_at': timezone.make_aware(
                            timezone.datetime.combine(session_date, time(11, 0))
                        ),
                    }
                )
                if created:
                    enrollments = Enrollment.objects.filter(course=course, is_active=True)
                    for enrollment in enrollments:
                        rand = random.random()
                        status = 'present' if rand < 0.75 else ('late' if rand < 0.85 else 'absent')
                        AttendanceRecord.objects.create(
                            session=session,
                            student=enrollment.student,
                            status=status,
                            marked_at=session.started_at if status != 'absent' else None,
                            marked_by=course.lecturer,
                            verification_method='manual',
                        )

        self.stdout.write('Created attendance sessions and records')

        # Update enrollment stats
        for enrollment in Enrollment.objects.all():
            enrollment.update_attendance_stats()

        self.stdout.write(self.style.SUCCESS('\nDatabase seeding completed!'))
        self.stdout.write('')
        self.stdout.write('Test Credentials:')
        self.stdout.write('  Admin:    admin@university.edu / admin123')
        self.stdout.write('  Lecturer: john.smith@university.edu / lecturer123')
        self.stdout.write('  Student:  student01@university.edu / student123')
        self.stdout.write('')
        self.stdout.write('Programmes: BIT (3 yr), DIT (2 yr)')
        self.stdout.write('Cohorts:    BIT 2022/2023, BIT 2023/2024, BIT 2024/2025')
        self.stdout.write('            DIT 2023/2024, DIT 2024/2025')
        self.stdout.write('Courses:    BIT101-BIT301, DIT101, DIT201')
