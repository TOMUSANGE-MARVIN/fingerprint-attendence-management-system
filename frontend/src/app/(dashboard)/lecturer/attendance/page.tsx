"use client";

/**
 * Lecturer Attendance Page
 * Shows attendance sessions for each of the lecturer's courses
 */

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Card,
  CardHeader,
  PageLoading,
  ErrorState,
  Badge,
  Table,
  TableColumn,
  EmptyState,
} from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { Course } from "@/types";
import {
  Users,
  BookOpen,
  CheckCircle,
  XCircle,
  Search,
  ChevronDown,
  ChevronUp,
  Calendar,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface SessionRow {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  room?: string;
  totalEnrolled: number;
  presentCount: number;
  attendanceRate: number;
  isActive: boolean;
}

interface CourseWithSessions extends Course {
  sessions?: SessionRow[];
}

export default function LecturerAttendancePage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseWithSessions[]>([]);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingSessions, setLoadingSessions] = useState<string | null>(null);

  useEffect(() => {
    fetchCourses();
  }, [user]);

  const fetchCourses = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get<Course[] | { results: Course[] }>(
        "/courses/my/lecturer/"
      );
      const data = response.data;
      const courseList = Array.isArray(data) ? data : (data as any).results ?? [];
      setCourses(courseList);
    } catch (err) {
      console.error("Failed to fetch courses:", err);
      setError("Failed to load courses. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSessionsForCourse = async (courseId: string) => {
    setLoadingSessions(courseId);
    try {
      const response = await apiClient.get<any>(
        `${API_ENDPOINTS.attendance.sessions}?course=${courseId}&ordering=-date,-start_time&page_size=50`
      );
      const raw: any[] = Array.isArray(response.data)
        ? response.data
        : (response.data as any).results ?? [];

      const sessions: SessionRow[] = raw.map((s: any) => ({
        id: s.id,
        date: s.date,
        startTime: s.startTime ?? s.start_time ?? "",
        endTime: s.endTime ?? s.end_time,
        room: s.room,
        totalEnrolled: s.totalEnrolled ?? s.total_enrolled ?? 0,
        presentCount: s.presentCount ?? s.present_count ?? 0,
        attendanceRate: s.attendanceRate ?? s.attendance_rate ?? 0,
        isActive: s.isActive ?? s.is_active ?? false,
      }));

      setCourses((prev) =>
        prev.map((c) => (c.id === courseId ? { ...c, sessions } : c))
      );
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setLoadingSessions(null);
    }
  };

  const handleToggleCourse = (courseId: string) => {
    if (expandedCourse === courseId) {
      setExpandedCourse(null);
    } else {
      setExpandedCourse(courseId);
      const course = courses.find((c) => c.id === courseId);
      if (course && !course.sessions) {
        fetchSessionsForCourse(courseId);
      }
    }
  };

  const sessionColumns: TableColumn<SessionRow>[] = [
    {
      key: "date",
      header: "Date",
      render: (s) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-gray-900 dark:text-gray-100">{formatDate(s.date)}</span>
        </div>
      ),
    },
    {
      key: "time",
      header: "Time",
      render: (s) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {s.startTime?.slice(0, 5)}{s.endTime ? ` – ${s.endTime.slice(0, 5)}` : ""}
        </span>
      ),
    },
    {
      key: "room",
      header: "Room",
      render: (s) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">{s.room ?? "—"}</span>
      ),
    },
    {
      key: "attendance",
      header: "Attendance",
      align: "center",
      render: (s) => (
        <div className="flex items-center justify-center gap-3">
          <span className="flex items-center gap-1 text-success-600 font-medium">
            <CheckCircle className="w-4 h-4" />
            {s.presentCount}
          </span>
          <span className="flex items-center gap-1 text-danger-600 font-medium">
            <XCircle className="w-4 h-4" />
            {s.totalEnrolled - s.presentCount}
          </span>
        </div>
      ),
    },
    {
      key: "rate",
      header: "Rate",
      align: "center",
      render: (s) => (
        <span
          className={`font-semibold ${
            s.attendanceRate >= 75 ? "text-success-600" : "text-danger-600"
          }`}
        >
          {s.attendanceRate.toFixed(1)}%
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (s) => (
        <Badge variant={s.isActive ? "success" : "default"} dot>
          {s.isActive ? "Active" : "Completed"}
        </Badge>
      ),
    },
  ];

  const filteredCourses = courses.filter((course) =>
    `${course.code} ${course.name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <PageLoading message="Loading attendance data..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchCourses} />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            View attendance sessions for your courses
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-64"
          />
        </div>
      </div>

      {/* Courses List */}
      {filteredCourses.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen className="w-16 h-16 text-gray-300" />}
            title="No Courses Found"
            description="You don't have any courses assigned yet."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCourses.map((course) => {
            const avgRate =
              course.sessions && course.sessions.length > 0
                ? course.sessions.reduce((sum, s) => sum + s.attendanceRate, 0) /
                  course.sessions.length
                : (course as any).averageAttendance ?? 0;

            return (
              <Card key={course.id} className="overflow-hidden">
                {/* Course Header - Clickable */}
                <button
                  onClick={() => handleToggleCourse(course.id as string)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary-100 dark:bg-primary-900/40 rounded-xl">
                      <BookOpen className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {course.code}
                        </h3>
                        <Badge variant="default">
                          {(course as any).totalStudents ?? course.enrolledStudents ?? 0} students
                        </Badge>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400">{course.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right mr-4">
                      <p className="text-sm text-gray-500">Avg. Attendance</p>
                      <p
                        className={`text-lg font-bold ${
                          avgRate >= 75 ? "text-success-600" : "text-danger-600"
                        }`}
                      >
                        {avgRate.toFixed(1)}%
                      </p>
                    </div>
                    {expandedCourse === course.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Sessions */}
                {expandedCourse === course.id && (
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    {loadingSessions === course.id ? (
                      <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                        <p className="mt-2 text-gray-500">Loading sessions...</p>
                      </div>
                    ) : course.sessions && course.sessions.length > 0 ? (
                      <div className="p-4">
                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-gray-700 dark:text-gray-200">
                              {course.sessions.length}
                            </p>
                            <p className="text-xs text-gray-500">Sessions</p>
                          </div>
                          <div className="text-center p-3 bg-success-50 dark:bg-green-950/30 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-success-600 mx-auto mb-1" />
                            <p className="text-2xl font-bold text-success-600">
                              {course.sessions.reduce((s, r) => s + r.presentCount, 0)}
                            </p>
                            <p className="text-xs text-gray-500">Total Present</p>
                          </div>
                          <div className="text-center p-3 bg-danger-50 dark:bg-red-950/30 rounded-lg">
                            <XCircle className="w-5 h-5 text-danger-600 mx-auto mb-1" />
                            <p className="text-2xl font-bold text-danger-600">
                              {course.sessions.reduce(
                                (s, r) => s + (r.totalEnrolled - r.presentCount),
                                0
                              )}
                            </p>
                            <p className="text-xs text-gray-500">Total Absent</p>
                          </div>
                        </div>
                        <Table
                          columns={sessionColumns}
                          data={course.sessions}
                          keyExtractor={(s) => s.id}
                        />
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500">No attendance sessions yet for this course.</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
