/**
 * TypeScript type definitions for the Biometric Attendance Management System
 * These types mirror the expected Django REST Framework API responses
 */

// ============================================================================
// USER & AUTHENTICATION TYPES
// ============================================================================

export type UserRole = "student" | "lecturer" | "admin";
export type StudyTime = "day" | "evening" | "weekend";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  studentId?: string; // Only for students
  staffId?: string; // Only for lecturers/admins
  department?: string;
  studyTime?: StudyTime;
  academicYear?: string | null; // FK id to AcademicYear (students)
  academicYearLabel?: string | null;
  program?: string;
  profileImage?: string;
  isActive: boolean;
  fingerprintRegistered?: boolean;
  createdAt: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

// ============================================================================
// COURSE & TIMETABLE TYPES
// ============================================================================

export interface Faculty {
  id: string;
  name: string;
  code: string;
  description?: string;
  deanName?: string;
  isActive: boolean;
  createdAt: string;
}

export interface AcademicPeriod {
  id: string;
  academicYear: string;
  semester: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  createdAt: string;
}

export interface AcademicYear {
  id: string;
  label: string;       // "2023/2024"
  startYear: number;   // 2023
  isCurrent: boolean;
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

export interface Programme {
  id: string;
  code: string;        // "BIT"
  name: string;        // "Bachelor of Information Technology"
  durationYears: number;
  faculty?: string;
  facultyName?: string;
  isActive: boolean;
  cohortCount: number;
  createdAt: string;
}

export interface CohortGroupCoordinator {
  coordinatorId: string | null;
  coordinatorName: string | null;
}

export interface Cohort {
  id: string;
  programme: string;
  programmeCode: string;
  programmeName: string;
  intakeYear: string;
  intakeYearLabel: string;
  coordinator?: string;
  coordinatorName?: string;
  groupCoordinators?: Record<string, CohortGroupCoordinator>;
  name: string;
  currentYearOfStudy?: number;
  currentSemesterLabel?: string;
  studentCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  description?: string;
  creditUnits: number;
  department: string;
  semester: string;
  academicYear: string;
  lecturer: Pick<User, "id" | "firstName" | "lastName">;
  enrolledStudents: number;
  faculty?: Pick<Faculty, "id" | "name" | "code">;
  academicPeriod?: Pick<AcademicPeriod, "id" | "academicYear" | "semester">;
}

export interface TimetableSlot {
  id: string;
  course: string; // FK id
  courseCode: string;
  courseName: string;
  lecturerName?: string;
  cohort?: string;
  cohortName?: string;
  dayOfWeek: string; // "monday", "tuesday", etc.
  startTime: string; // HH:MM or HH:MM:SS
  endTime: string;
  room?: string;
  building?: string;
  studyTime?: StudyTime;
  isActive: boolean;
}

// ============================================================================
// ATTENDANCE TYPES
// ============================================================================

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceSession {
  id: number;
  course: Pick<Course, "id" | "code" | "name">;
  date: string;
  startTime: string;
  endTime?: string;
  isActive: boolean;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  createdBy: Pick<User, "id" | "firstName" | "lastName">;
}

export interface AttendanceRecord {
  id: number;
  sessionId: number;
  student: Pick<User, "id" | "firstName" | "lastName" | "studentId">;
  status: AttendanceStatus;
  checkInTime?: string;
  verificationMethod: "fingerprint" | "manual";
  verificationConfidence?: number;
  remarks?: string;
}

export interface StudentAttendanceSummary {
  courseId: string | number;
  courseCode: string;
  courseName: string;
  studentId?: string;
  studentName?: string;
  totalSessions: number;
  attended: number;
  absent: number;
  late: number;
  excused: number;
  attendancePercentage: number;
}

// ============================================================================
// FINGERPRINT TYPES
// ============================================================================

export interface FingerprintDeviceInfo {
  port: number;
  status: "ready" | "busy" | "not_connected";
  deviceName?: string;
  serialNumber?: string;
}

export interface FingerprintCaptureResult {
  template: string; // Base64 encoded FMR template
  quality: number; // 0-100
  width?: number;
  height?: number;
}

export interface FingerprintVerifyResponse {
  matched: boolean;
  studentId?: string;
  studentName?: string;
  confidence: number;
  message: string;
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface AttendanceTrend {
  period: string; // Week number or month name
  percentage: number;
  sessionsAttended: number;
  totalSessions: number;
}

export interface AttendanceAnalytics {
  overallPercentage: number;
  weeklyTrends: AttendanceTrend[];
  monthlyTrends: AttendanceTrend[];
  courseSummaries: StudentAttendanceSummary[];
  riskLevel: "low" | "medium" | "high"; // Based on 75% threshold
}

// ============================================================================
// ADMIN TYPES
// ============================================================================

export interface AuditLog {
  id: number;
  user?: number;
  userName?: string;
  userEmail?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  description?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  // Legacy fields for compatibility
  resource?: string;
  resourceId?: number;
  details?: string;
  timestamp?: string;
  userId?: number;
}

export interface InstitutionAnalytics {
  totalStudents: number;
  totalLecturers: number;
  totalCourses: number;
  averageAttendance: number;
  studentsAtRisk: number; // Below 75%
  attendanceByDepartment: {
    department: string;
    percentage: number;
    studentCount: number;
  }[];
  recentTrends: AttendanceTrend[];
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  message: string;
  code?: string;
  field?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  success: boolean;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export type NotificationType = "attendance" | "alert" | "system" | "report" | "fingerprint" | "upcoming_lecture" | "missed_lecture";

export interface Notification {
  id: string | number;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
}
