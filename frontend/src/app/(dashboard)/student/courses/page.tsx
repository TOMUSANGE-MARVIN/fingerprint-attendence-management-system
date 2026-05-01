"use client";

/**
 * Student Courses Page
 * Displays all registered courses with detailed attendance information
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
  Input,
} from "@/components/ui";
import { CourseList } from "@/components/dashboard";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { StudentAttendanceSummary } from "@/types";
import { Search, Filter, BookOpen } from "lucide-react";
import { getAttendanceBgClass } from "@/lib/utils";

interface StudentAttendanceApi {
  courseId: string;
  courseCode: string;
  courseName: string;
  totalSessions: number;
  attended: number;
  absent: number;
  attendancePercentage: number;
}

export default function StudentCoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<StudentAttendanceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "at-risk" | "on-track">("all");

  useEffect(() => {
    const fetchCourses = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);
        const response = await apiClient.get<{ results?: StudentAttendanceApi[] } | StudentAttendanceApi[]>(
          API_ENDPOINTS.attendance.myStudent
        );
        const data = Array.isArray(response.data) ? response.data : response.data.results ?? [];
        const mapped = data.map((course) => ({
          courseId: course.courseId,
          courseCode: course.courseCode,
          courseName: course.courseName,
          totalSessions: course.totalSessions,
          attended: course.attended,
          absent: course.absent,
          late: 0,
          excused: 0,
          attendancePercentage: course.attendancePercentage,
        }));
        setCourses(mapped);
      } catch (err) {
        console.error("Courses fetch error:", err);
        setError("Failed to load courses. Please try again.");
        setCourses([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourses();
  }, [user]);

  // Filter courses based on search and filter status
  const filteredCourses = courses.filter((course) => {
    const matchesSearch =
      course.courseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.courseName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterStatus === "all" ||
      (filterStatus === "at-risk" && course.attendancePercentage < 75) ||
      (filterStatus === "on-track" && course.attendancePercentage >= 75);

    return matchesSearch && matchesFilter;
  });

  // Table columns
  const courseColumns: TableColumn<StudentAttendanceSummary>[] = [
    {
      key: "course",
      header: "Course",
      render: (course) => (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-50 rounded-lg">
            <BookOpen className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{course.courseCode}</p>
            <p className="text-sm text-gray-500">{course.courseName}</p>
          </div>
        </div>
      ),
    },
    {
      key: "sessions",
      header: "Sessions",
      align: "center",
      render: (course) => (
        <span className="text-gray-900">
          {course.attended}/{course.totalSessions}
        </span>
      ),
    },
    {
      key: "present",
      header: "Present",
      align: "center",
      render: (course) => (
        <span className="text-success-600 font-medium">{course.attended}</span>
      ),
    },
    {
      key: "absent",
      header: "Absent",
      align: "center",
      render: (course) => (
        <span className="text-danger-600 font-medium">{course.absent}</span>
      ),
    },
    {
      key: "percentage",
      header: "Attendance",
      align: "center",
      render: (course) => (
        <Badge className={getAttendanceBgClass(course.attendancePercentage)}>
          {course.attendancePercentage.toFixed(1)}%
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (course) => (
        <Badge
          variant={course.attendancePercentage >= 75 ? "success" : "danger"}
          dot
        >
          {course.attendancePercentage >= 75 ? "On Track" : "At Risk"}
        </Badge>
      ),
    },
  ];

  if (isLoading) {
    return <PageLoading message="Loading your courses..." />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const coursesAtRisk = courses.filter((c) => c.attendancePercentage < 75).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Courses</h1>
        <p className="text-gray-500 mt-1">
          View attendance details for all your registered courses
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-primary-600">{courses.length}</p>
          <p className="text-sm text-gray-500">Registered Courses</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-success-600">
            {courses.length - coursesAtRisk}
          </p>
          <p className="text-sm text-gray-500">On Track</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-danger-600">{coursesAtRisk}</p>
          <p className="text-sm text-gray-500">At Risk (&lt;75%)</p>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-5 h-5" />}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as typeof filterStatus)
              }
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Courses</option>
              <option value="on-track">On Track (≥75%)</option>
              <option value="at-risk">At Risk (&lt;75%)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Courses Table */}
      <Card>
        <CardHeader
          title="Course Attendance Details"
          subtitle={`${filteredCourses.length} courses found`}
        />
        <Table
          columns={courseColumns}
          data={filteredCourses}
          keyExtractor={(course) => course.courseId}
          emptyMessage="No courses match your search criteria"
        />
      </Card>

      {/* Course Cards Grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Course Cards</h2>
        <CourseList courses={filteredCourses} />
      </div>
    </div>
  );
}
