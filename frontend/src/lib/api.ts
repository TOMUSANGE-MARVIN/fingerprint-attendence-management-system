/**
 * API Client Configuration
 * Handles all HTTP requests to the Django REST Framework backend
 * Includes automatic token refresh and error handling
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";
import { AuthTokens, ApiError } from "@/types";

// ============================================================================
// CASE CONVERSION UTILITIES
// ============================================================================

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

function convertKeysToCamelCase(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamelCase);
  }
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([key, value]) => [
        snakeToCamel(key),
        convertKeysToCamelCase(value),
      ])
    );
  }
  return obj;
}

// Base API URL from environment variables
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// Token storage keys
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

/**
 * Creates configured Axios instance with interceptors
 */
function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      "Content-Type": "application/json",
    },
    timeout: 30000, // 30 seconds timeout
  });

  // Request interceptor - adds JWT token to requests
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // Only access localStorage on client side
      if (typeof window !== "undefined") {
        const token = localStorage.getItem(ACCESS_TOKEN_KEY);
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor - converts snake_case keys to camelCase and handles token refresh on 401
  client.interceptors.response.use(
    (response) => {
      response.data = convertKeysToCamelCase(response.data);
      return response;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      // If 401 and not already retrying, attempt token refresh
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
          if (refreshToken) {
            const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.auth.refreshToken}`, {
              refresh: refreshToken,
            });

            const { access } = response.data;
            localStorage.setItem(ACCESS_TOKEN_KEY, access);

            // Retry original request with new token
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${access}`;
            }
            return client(originalRequest);
          }
        } catch (refreshError) {
          // Refresh failed - clear tokens and redirect to login
          clearTokens();
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
}

// Export configured API client
export const apiClient = createApiClient();

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

export function setTokens(tokens: AuthTokens): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
  }
}

export function getTokens(): AuthTokens | null {
  if (typeof window !== "undefined") {
    const access = localStorage.getItem(ACCESS_TOKEN_KEY);
    const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (access && refresh) {
      return { access, refresh };
    }
  }
  return null;
}

export function clearTokens(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function isAuthenticated(): boolean {
  return getTokens() !== null;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export function parseApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string; detail?: string }>;

    if (axiosError.response?.data) {
      const data = axiosError.response.data;
      return {
        message: data.message || data.detail || "An error occurred",
        code: axiosError.response.status.toString(),
      };
    }

    if (axiosError.message === "Network Error") {
      return {
        message: "Unable to connect to server. Please check your internet connection.",
        code: "NETWORK_ERROR",
      };
    }
  }

  return {
    message: "An unexpected error occurred",
    code: "UNKNOWN_ERROR",
  };
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

export const API_ENDPOINTS = {
  // Authentication
  auth: {
    login: "/auth/login/",
    logout: "/auth/logout/",
    refreshToken: "/auth/refresh/",
    me: "/auth/me/",
    changePassword: "/auth/change-password/",
    notifications: "/auth/notifications/",
    notificationRead: (id: string) => `/auth/notifications/${id}/read/`,
    notificationsReadAll: "/auth/notifications/read-all/",
    notificationsCount: "/auth/notifications/count/",
  },

  // Students
  students: {
    list: "/students/",
    detail: (id: string | number) => `/students/${id}/`,
    attendance: (id: string | number) => `/students/${id}/attendance/`,
    analytics: (id: string | number) => `/students/${id}/analytics/`,
    courses: (id: string | number) => `/students/${id}/courses/`,
  },

  // Lecturers
  lecturers: {
    list: "/lecturers/",
    detail: (id: string | number) => `/lecturers/${id}/`,
    courses: (id: string | number) => `/lecturers/${id}/courses/`,
  },

  // Courses
  courses: {
    list: "/courses/",
    detail: (id: number | string) => `/courses/${id}/`,
    students: (id: number | string) => `/courses/${id}/students/`,
    attendance: (id: number | string) => `/courses/${id}/attendance/`,
    timetable: (id: number | string) => `/courses/${id}/timetable/`,
    myCoordinated: "/courses/my-coordinated/",
    setCoordinator: (courseId: string) => `/courses/${courseId}/set_coordinator/`,
  },

  // Attendance
  attendance: {
    sessions: "/attendance/sessions/",
    sessionDetail: (id: number) => `/attendance/sessions/${id}/`,
    startSession: "/attendance/sessions/start/",
    endSession: (id: number) => `/attendance/sessions/${id}/end/`,
    records: (sessionId: number) => `/attendance/sessions/${sessionId}/records/`,
    recordsList: "/attendance/records/",
    markAttendance: "/attendance/mark/",
    fingerprintVerify: "/attendance/fingerprint/verify/",
    adminCourseSummary: (courseId: string | number) => `/attendance/admin/course/${courseId}/`,
    adminStudentAttendance: (studentId: string) => `/attendance/admin/student/${studentId}/`,
    myStudent: "/attendance/my/student/",
  },

  // Fingerprint
  fingerprint: {
    register: (studentId: string) => `/fingerprint/register/${studentId}/`,
    status: (studentId: string) => `/fingerprint/status/${studentId}/`,
  },

  // Timetable
  timetable: {
    list: "/timetable/slots/",
    detail: (id: string | number) => `/timetable/slots/${id}/`,
    today: "/timetable/slots/?today=true",
    studentTimetable: "/timetable/my/student/",
    lecturerTimetable: "/timetable/my/lecturer/",
  },

  // Faculties
  faculties: {
    list: "/courses/faculties/",
    detail: (id: string) => `/courses/faculties/${id}/`,
  },

  // Academic Periods
  academicPeriods: {
    list: "/courses/academic-periods/",
    detail: (id: string) => `/courses/academic-periods/${id}/`,
    current: "/courses/academic-periods/current/",
  },

  // Academic Years
  academicYears: {
    list: "/courses/academic-years/",
    detail: (id: string) => `/courses/academic-years/${id}/`,
    current: "/courses/academic-years/current/",
  },

  // Programmes
  programmes: {
    list: "/courses/programmes/",
    detail: (id: string) => `/courses/programmes/${id}/`,
  },

  // Cohorts
  cohorts: {
    list: "/courses/cohorts/",
    detail: (id: string) => `/courses/cohorts/${id}/`,
    setStudentCoordinator: (id: string) => `/courses/cohorts/${id}/set_student_coordinator/`,
  },

  // Admin
  admin: {
    users: "/admin/users/",
    userDetail: (id: string | number) => `/admin/users/${id}/`,
    auditLogs: "/admin/audit-logs/",
    analytics: "/admin/analytics/",
    departments: "/admin/departments/",
  },

  // Notifications
  notifications: {
    list: "/notifications/",
    markRead: (id: number) => `/notifications/${id}/read/`,
    markAllRead: "/notifications/read-all/",
    count: "/notifications/count/",
  },

  // Reports
  reports: {
    attendance: "/reports/attendance/",
    student: (id: number) => `/reports/student/${id}/`,
    course: (id: number) => `/reports/course/${id}/`,
    generate: "/reports/generate/",
  },

  // Analytics
  analytics: {
    dashboard: "/analytics/dashboard/",
    course: (id: string) => `/analytics/course/${id}/`,
    coursePdf: (id: string) => `/analytics/course/${id}/pdf/`,
    atRisk: "/analytics/at-risk/",
    export: "/analytics/export/",
    thresholdExcel: "/analytics/threshold-excel/",
    reportFilters: "/analytics/report-filters/",
  },
} as const;
