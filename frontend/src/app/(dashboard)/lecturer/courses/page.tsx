"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Card,
  CardHeader,
  Badge,
  Table,
  TableColumn,
  PageLoading,
  Input,
} from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { Course } from "@/types";
import { BookOpen, Users, Search } from "lucide-react";

interface LecturerCourse extends Course {
  attendanceRate?: number;
  totalSessions?: number;
}

const DEMO_COURSES: LecturerCourse[] = [
  { id: 1, code: "CS301", name: "Database Systems", description: "", creditUnits: 3, department: "Computer Science", semester: "Semester 1", academicYear: "2025-2026", lecturer: { id: "1", firstName: "John", lastName: "Doe" }, enrolledStudents: 45, attendanceRate: 81.2, totalSessions: 20 },
  { id: 2, code: "CS302", name: "Software Engineering", description: "", creditUnits: 4, department: "Computer Science", semester: "Semester 1", academicYear: "2025-2026", lecturer: { id: "1", firstName: "John", lastName: "Doe" }, enrolledStudents: 52, attendanceRate: 74.8, totalSessions: 18 },
  { id: 3, code: "CS401", name: "Advanced Algorithms", description: "", creditUnits: 3, department: "Computer Science", semester: "Semester 1", academicYear: "2025-2026", lecturer: { id: "1", firstName: "John", lastName: "Doe" }, enrolledStudents: 28, attendanceRate: 88.5, totalSessions: 22 },
];

export default function LecturerCoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<LecturerCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchCourses = async () => {
      if (!user) return;
      try {
        const response = await apiClient.get<LecturerCourse[]>(
          API_ENDPOINTS.lecturers.courses(user.id)
        );
        setCourses(response.data);
      } catch {
        setCourses(DEMO_COURSES);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCourses();
  }, [user]);

  const filtered = courses.filter((c) =>
    `${c.code} ${c.name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const avgAttendance = courses.length
    ? courses.reduce((sum, c) => sum + (c.attendanceRate ?? 0), 0) / courses.length
    : 0;

  const columns: TableColumn<LecturerCourse>[] = [
    {
      key: "course",
      header: "Course",
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
            <BookOpen className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">{c.code}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{c.name}</p>
          </div>
        </div>
      ),
    },
    {
      key: "enrolled",
      header: "Enrolled",
      align: "center",
      render: (c) => (
        <div className="flex items-center justify-center gap-1 text-gray-700 dark:text-gray-300">
          <Users className="w-4 h-4 text-gray-400" />
          {c.enrolledStudents ?? 0}
        </div>
      ),
    },
    {
      key: "sessions",
      header: "Sessions",
      align: "center",
      render: (c) => (
        <span className="text-gray-700 dark:text-gray-300">{c.totalSessions ?? 0}</span>
      ),
    },
    {
      key: "attendance",
      header: "Avg Attendance",
      align: "center",
      render: (c) => {
        const rate = c.attendanceRate ?? 0;
        return (
          <div className="flex items-center justify-center gap-2">
            <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${rate >= 75 ? "bg-success-500" : "bg-danger-500"}`}
                style={{ width: `${Math.min(rate, 100)}%` }}
              />
            </div>
            <span className={`text-sm font-medium ${rate >= 75 ? "text-success-600" : "text-danger-600"}`}>
              {rate.toFixed(1)}%
            </span>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (c) => {
        const rate = c.attendanceRate ?? 0;
        return (
          <Badge variant={rate >= 75 ? "success" : "danger"} dot>
            {rate >= 75 ? "On Track" : "At Risk"}
          </Badge>
        );
      },
    },
    {
      key: "semester",
      header: "Semester",
      render: (c) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">{c.semester}</span>
      ),
    },
  ];

  if (isLoading) return <PageLoading message="Loading your courses..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Courses</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Courses you teach and their attendance overview
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-primary-600">{courses.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Courses Teaching</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-success-600">
            {courses.reduce((sum, c) => sum + (c.enrolledStudents ?? 0), 0)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Students</p>
        </Card>
        <Card className="text-center">
          <p className={`text-3xl font-bold ${avgAttendance >= 75 ? "text-success-600" : "text-danger-600"}`}>
            {avgAttendance.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Avg Attendance</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Course List"
          subtitle={`${filtered.length} courses`}
          action={
            <div className="w-56">
              <Input
                placeholder="Search courses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
          }
        />
        <Table
          columns={columns}
          data={filtered}
          keyExtractor={(c) => c.id}
          emptyMessage="No courses found"
        />
      </Card>
    </div>
  );
}
