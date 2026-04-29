"""
URL patterns for course endpoints.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CourseViewSet, EnrollmentViewSet, StudentCoursesView, LecturerCoursesView,
    FacultyViewSet, AcademicPeriodViewSet,
    AcademicYearViewSet, ProgrammeViewSet, CohortViewSet, CoordinatorLecturesView,
    MyCoordinatedCourseView,
)

# Use separate routers so sub-resource patterns are registered
# at explicit prefixes and don't conflict with the CourseViewSet
# catch-all (^(?P<pk>[^/.]+)/).

enrollment_router = DefaultRouter()
enrollment_router.register(r'', EnrollmentViewSet, basename='enrollments')

faculty_router = DefaultRouter()
faculty_router.register(r'', FacultyViewSet, basename='faculties')

period_router = DefaultRouter()
period_router.register(r'', AcademicPeriodViewSet, basename='academic-periods')

year_router = DefaultRouter()
year_router.register(r'', AcademicYearViewSet, basename='academic-years')

programme_router = DefaultRouter()
programme_router.register(r'', ProgrammeViewSet, basename='programmes')

cohort_router = DefaultRouter()
cohort_router.register(r'', CohortViewSet, basename='cohorts')

# CourseViewSet registered at '' must come LAST so its pk catch-all
# does not shadow the explicit sub-resource paths above.
course_router = DefaultRouter()
course_router.register(r'', CourseViewSet, basename='courses')

urlpatterns = [
    path('enrollments/', include(enrollment_router.urls)),
    path('faculties/', include(faculty_router.urls)),
    path('academic-periods/', include(period_router.urls)),
    path('academic-years/', include(year_router.urls)),
    path('programmes/', include(programme_router.urls)),
    path('cohorts/', include(cohort_router.urls)),
    # Explicit paths must come BEFORE the course router catch-all
    path('my/student/', StudentCoursesView.as_view(), name='student_courses'),
    path('my/lecturer/', LecturerCoursesView.as_view(), name='lecturer_courses'),
    path('my/lectures/today/', CoordinatorLecturesView.as_view(), name='coordinator_lectures_today'),
    path('my-coordinated/', MyCoordinatedCourseView.as_view(), name='my-coordinated-course'),
    # Catch-all for courses — must be last
    path('', include(course_router.urls)),
]
