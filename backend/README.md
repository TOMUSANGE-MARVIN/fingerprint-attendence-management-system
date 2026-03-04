# AI-Driven Student Attendance Management System - Backend

Django REST API backend for the attendance management system.

## Tech Stack

- Django 4.2
- Django REST Framework
- MySQL Database
- JWT Authentication (SimpleJWT)
- Python 3.10+

## Setup Instructions

### 1. Create Virtual Environment

```bash
cd backend
python -m venv venv

# On Linux/Mac
source venv/bin/activate

# On Windows
venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

Copy the example environment file and update with your settings:

```bash
cp .env.example .env
```

Edit `.env` with your MySQL credentials:
- `DB_NAME`: Your database name (default: `attendance_db`)
- `DB_USER`: MySQL username
- `DB_PASSWORD`: MySQL password
- `DB_HOST`: Database host (default: `localhost`)
- `SECRET_KEY`: Generate a secure random string

### 4. Create MySQL Database

```sql
CREATE DATABASE attendance_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 5. Run Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### 6. Create Superuser

```bash
python manage.py createsuperuser
```

### 7. Run Development Server

```bash
python manage.py runserver
```

The API will be available at `http://localhost:8000/api/`

## API Endpoints

### Authentication
- `POST /api/auth/login/` - Login and get tokens
- `POST /api/auth/refresh/` - Refresh access token
- `POST /api/auth/logout/` - Logout
- `GET /api/auth/me/` - Get current user
- `PUT /api/auth/profile/` - Update profile
- `POST /api/auth/password/change/` - Change password

### Students
- `GET /api/students/` - List all students
- `GET /api/students/{id}/` - Get student details

### Lecturers
- `GET /api/lecturers/` - List all lecturers
- `GET /api/lecturers/{id}/` - Get lecturer details

### Courses
- `GET /api/courses/` - List courses
- `POST /api/courses/` - Create course
- `GET /api/courses/{id}/` - Get course details
- `GET /api/courses/{id}/students/` - Get enrolled students
- `POST /api/courses/{id}/enroll/` - Enroll student
- `POST /api/courses/{id}/unenroll/` - Remove student

### Attendance
- `GET /api/attendance/sessions/` - List sessions
- `POST /api/attendance/sessions/` - Create session
- `POST /api/attendance/sessions/{id}/start/` - Start session
- `POST /api/attendance/sessions/{id}/end/` - End session
- `POST /api/attendance/sessions/{id}/mark_attendance/` - Mark single attendance
- `POST /api/attendance/sessions/{id}/bulk_mark/` - Mark bulk attendance
- `GET /api/attendance/my/student/` - Student's attendance overview
- `GET /api/attendance/my/lecturer/` - Lecturer's course attendance

### Analytics
- `GET /api/analytics/dashboard/` - Dashboard stats
- `GET /api/analytics/insights/` - AI insights
- `POST /api/analytics/insights/generate/` - Generate new insights
- `GET /api/analytics/course/{id}/` - Course analytics

### Admin
- `GET /api/admin/users/` - List all users
- `POST /api/admin/users/` - Create user
- `GET /api/admin/dashboard/stats/` - Dashboard statistics
- `GET /api/admin/audit-logs/` - View audit logs

## Project Structure

```
backend/
├── apps/
│   ├── users/          # User authentication & management
│   ├── courses/        # Course & enrollment management
│   ├── attendance/     # Attendance sessions & records
│   └── analytics/      # AI insights & reporting
├── attendance_system/  # Django project settings
├── manage.py
├── requirements.txt
└── .env.example
```

## User Roles

1. **Student** - View own attendance, courses, AI insights
2. **Lecturer** - Manage courses, take attendance, view reports
3. **Admin** - Full system access, user management, analytics

## Attendance Threshold

Default attendance threshold is 75%. Students below this are marked "at risk".
