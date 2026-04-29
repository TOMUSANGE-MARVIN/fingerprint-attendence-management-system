"use client";

/**
 * Lecturer Attendance Page
 * Shows attendance records for each of the lecturer's courses
 */

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Card,
  CardHeader,
  PageLoading,
  ErrorState,
  Button,
  Badge,
  Table,
  TableColumn,
  Avatar,
  EmptyState,
} from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { Course, AttendanceRecord } from "@/types";
import {
  Users,
  BookOpen,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface CourseWithAttendance extends Course {
  attendanceRecords?: AttendanceRecord[];
  attendanceSummary?: {
    totalSessions: number;
    averageAttendance: number;
  };
}

export default function LecturerAttendancePage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseWithAttendance[]>([]);
  const [expandedCourse, setExpandedCourse] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingRecords, setLoadingRecords] = useState<number | null>(null);

  useEffect(() => {
    fetchCourses();
  }, [user]);

  const fetchCourses = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch lecturer's courses
      const response = await apiClient.get<Course[] | { results: Course[] }>(
        API_ENDPOINTS.courses.myCoordinated
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

  const fetchAttendanceForCourse = async (courseId: number) => {
    setLoadingRecords(courseId);
    try {
      const response = await apiClient.get<AttendanceRecord[] | { results: AttendanceRecord[] }>(
        API_ENDPOINTS.courses.attendance(courseId)
      );
      const data = response.data;
      const records = Array.isArray(data) ? data : (data as any).results ?? [];

      setCourses((prev) =>
        prev.map((course) =>
          course.id === courseId ? { ...course, attendanceRecords: records } : course
        )
      );
    } catch (err) {
      console.error("Failed to fetch attendance records:", err);
    } finally {
      setLoadingRecords(null);
    }
  };

  const handleToggleCourse = (courseId: number) => {
    if (expandedCourse === courseId) {
      setExpandedCourse(null);
    } else {
      setExpandedCourse(courseId);
      const course = courses.find((c) => c.id === courseId);
      if (course && !course.attendanceRecords) {
        fetchAttendanceForCourse(courseId);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <Badge variant="success" dot>Present</Badge>;
      case "late":
        return <Badge variant="warning" dot>Late</Badge>;
      case "absent":
        return <Badge variant="danger" dot>Absent</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const recordColumns: TableColumn<AttendanceRecord>[] = [
    {
      key: "student",
      header: "Student",
      render: (record) => (
        <div className="flex items-center gap-3">
          <Avatar
            firstName={record.student?.firstName || ""}
            lastName={record.student?.lastName || ""}
            size="sm"
          />
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {record.student?.firstName} {record.student?.lastName}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {record.student?.studentId || "N/A"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "date",
      header: "Date",
      render: (record) => (
        <span className="text-gray-600 dark:text-gray-400">
          {record.checkInTime ? formatDate(record.checkInTime) : "-"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (record) => getStatusBadge(record.status),
    },
    {
      key: "checkInTime",
      header: "Check-in Time",
      align: "center",
      render: (record) => (
        <span className="text-gray-600 dark:text-gray-400">
          {record.checkInTime || "-"}
        </span>
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
            View student attendance records for your courses
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
          {filteredCourses.map((course) => (
            <Card key={course.id} className="overflow-hidden">
              {/* Course Header - Clickable */}
              <button
                onClick={() => handleToggleCourse(course.id as number)}
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
                      <Badge variant="default">{course.enrolledStudents || 0} students</Badge>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">{course.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {course.attendanceSummary && (
                    <div className="text-right mr-4">
                      <p className="text-sm text-gray-500">Avg. Attendance</p>
                      <p className={`text-lg font-bold ${
                        (course.attendanceSummary.averageAttendance || 0) >= 75 
                          ? "text-success-600" 
                          : "text-danger-600"
                      }`}>
                        {course.attendanceSummary.averageAttendance?.toFixed(1) || 0}%
                      </p>
                    </div>
                  )}
                  {expandedCourse === course.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded Attendance Records */}
              {expandedCourse === course.id && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                  {loadingRecords === course.id ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                      <p className="mt-2 text-gray-500">Loading attendance records...</p>
                    </div>
                  ) : course.attendanceRecords && course.attendanceRecords.length > 0 ? (
                    <div className="p-4">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center p-3 bg-success-50 dark:bg-green-950/30 rounded-lg">
                          <CheckCircle className="w-5 h-5 text-success-600 mx-auto mb-1" />
                          <p className="text-2xl font-bold text-success-600">
                            {course.attendanceRecords.filter((r) => r.status === "present").length}
                          </p>
                          <p className="text-xs text-gray-500">Present</p>
                        </div>
                        <div className="text-center p-3 bg-warning-50 dark:bg-yellow-950/30 rounded-lg">
                          <Clock className="w-5 h-5 text-warning-600 mx-auto mb-1" />
                          <p className="text-2xl font-bold text-warning-600">
                            {course.attendanceRecords.filter((r) => r.status === "late").length}
                          </p>
                          <p className="text-xs text-gray-500">Late</p>
                        </div>
                        <div className="text-center p-3 bg-danger-50 dark:bg-red-950/30 rounded-lg">
                          <XCircle className="w-5 h-5 text-danger-600 mx-auto mb-1" />
                          <p className="text-2xl font-bold text-danger-600">
                            {course.attendanceRecords.filter((r) => r.status === "absent").length}
                          </p>
                          <p className="text-xs text-gray-500">Absent</p>
                        </div>
                      </div>

                      {/* Records Table */}
                      <Table
                        columns={recordColumns}
                        data={course.attendanceRecords}
                        keyExtractor={(record) => record.id}
                      />
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500">No attendance records yet for this course.</p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
