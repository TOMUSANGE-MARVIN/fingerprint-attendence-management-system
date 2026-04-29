# AI-Driven Student Attendance Management System

A comprehensive attendance management system with fingerprint biometric verification (future implementation) and AI-powered analytics for educational institutions.

## 🎯 Project Overview

This system provides a comprehensive solution for managing student attendance in educational institutions with:

- **Fingerprint biometric verification** for secure attendance capture (future implementation)
- **AI-driven analytics** for attendance pattern analysis
- **Role-based dashboards** for Students, Lecturers, and Administrators
- **Real-time attendance tracking** and reporting
- **75% Attendance Threshold** System flags students below required attendance

## 🛠 Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **HTTP Client:** Axios
- **Icons:** Lucide React

### Mobile App
- **Framework:** Flutter
- **Language:** Dart
- **Platform:** Android (biometric attendance capture flow)

### Backend
- **Framework:** Django 4.2 with REST Framework
- **Database:** MySQL
- **Authentication:** JWT (SimpleJWT)
- **Language:** Python 3.10+

## 📁 Project Structure

```
final-year-project/
├── frontend/                # Next.js application
│   ├── src/
│   │   ├── app/            # App Router pages
│   │   │   ├── (auth)/     # Authentication routes
│   │   │   └── (dashboard)/ # Protected dashboard routes
│   │   ├── components/     # Reusable UI components
│   │   │   ├── ui/         # Base components (Button, Card, etc.)
│   │   │   ├── charts/     # Recharts visualizations
│   │   │   ├── layout/     # Layout components
│   │   │   └── dashboard/  # Dashboard-specific components
│   │   ├── context/        # React Context (Auth)
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/            # Utilities & API client
│   │   └── types/          # TypeScript definitions
│   └── ...
│
├── backend/                 # Django REST API
│   ├── apps/
│   │   ├── users/          # Authentication & user management
│   │   ├── courses/        # Course & enrollment
│   │   ├── attendance/     # Sessions & records
│   │   └── analytics/      # AI insights & reports
│   ├── attendance_system/  # Django settings
│   ├── manage.py
│   └── requirements.txt
│
├── bioattend_flutter/       # Flutter mobile app
│   ├── lib/
│   │   ├── screens/        # App screens
│   │   ├── services/       # API + local service integrations
│   │   ├── models/         # Data models
│   │   └── widgets/        # Reusable Flutter widgets
│   ├── android/
│   └── pubspec.yaml
│
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- Python 3.10+
- MySQL 8.0+
- Flutter SDK 3.x

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create MySQL database
mysql -u root -p -e "CREATE DATABASE attendance_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Configure environment
cp .env.example .env
# Edit .env with your MySQL credentials

# Run migrations
python manage.py makemigrations
python manage.py migrate

# Seed sample data (optional)
python manage.py seed_data

# Start server
python manage.py runserver
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment (already set up)
# Verify .env.local has: NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Run development server
npm run dev
```

### Mobile App Setup (Flutter)

```bash
cd bioattend_flutter

# Install dependencies
flutter pub get

# Run app on connected device/emulator
flutter run
```

Update API base URL in `lib/services/api_service.dart` as needed for your network/device.

### Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000/api/
- **Django Admin:** http://localhost:8000/admin/
- **Flutter App:** run from `bioattend_flutter/` on emulator/physical device

### Test Credentials (after running seed_data)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@university.edu | admin123 |
| Lecturer | john.smith@university.edu | lecturer123 |
| Student | student01@university.edu | student123 |

## 👥 User Roles

### Student
- View overall attendance percentage (75% threshold highlighted)
- Track attendance across all registered courses
- View AI-generated insights and recommendations
- Access attendance history and trends
- View class timetable

### Lecturer
- Start/end attendance sessions
- Mark student attendance (manual, future biometric)
- View real-time attendance records
- Generate course attendance reports
- Track at-risk students

### Administrator
- Manage all users (students, lecturers)
- Manage courses and timetables
- View institution-wide analytics
- Access system audit logs
- Generate comprehensive reports

## 📊 Key Features

### AI Insights
- Attendance pattern analysis
- Risk prediction (below 75% threshold)
- Personalized recommendations
- Trend analysis and forecasting

### Attendance Management
- Fingerprint biometric verification (future)
- Real-time session tracking
- Manual attendance marking
- Bulk attendance operations

### Analytics Dashboard
- Student attendance reports
- Course-wise analytics
- Department-level statistics
- Weekly/monthly trends

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login/` - Login and get tokens
- `POST /api/auth/refresh/` - Refresh access token
- `POST /api/auth/logout/` - Logout
- `GET /api/auth/me/` - Get current user

### Courses
- `GET /api/courses/` - List courses
- `POST /api/courses/` - Create course
- `GET /api/courses/{id}/students/` - Enrolled students

### Attendance
- `GET /api/attendance/sessions/` - List sessions
- `POST /api/attendance/sessions/` - Create session
- `POST /api/attendance/sessions/{id}/start/` - Start session
- `POST /api/attendance/sessions/{id}/mark_attendance/` - Mark attendance

### Analytics
- `GET /api/analytics/dashboard/` - Dashboard stats
- `GET /api/analytics/insights/` - AI insights
- `GET /api/analytics/course/{id}/` - Course analytics

## 🔐 Authentication

The system uses JWT (JSON Web Token) authentication:
- Access token expires in 60 minutes
- Refresh token valid for 7 days
- Automatic token refresh on 401 responses
- Role-based route protection

## 🏗 Building for Production

### Frontend
```bash
cd frontend
npm run build
npm start
```

### Backend
```bash
cd backend
python manage.py collectstatic
gunicorn attendance_system.wsgi:application
```

## 🎓 Academic Context

This project is developed as a Final Year Project demonstrating:
- Modern full-stack web development
- AI integration in educational systems
- Biometric authentication concepts
- RESTful API design

## 📄 License

This project is developed for academic purposes.

---

**Developed for Final Year Project - 2025**
