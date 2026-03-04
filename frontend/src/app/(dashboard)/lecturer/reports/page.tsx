"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Card,
  CardHeader,
  Button,
  Badge,
  Table,
  TableColumn,
  PageLoading,
  Input,
} from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { Course, StudentAttendanceSummary } from "@/types";
import { FileText, BookOpen, Download, Search } from "lucide-react";
import { getAttendanceBgClass } from "@/lib/utils";

const DEMO_COURSES: Course[] = [
  { id: 1, code: "CS301", name: "Database Systems", description: "", creditUnits: 3, department: "Computer Science", semester: "Semester 1", academicYear: "2025-2026", lecturer: { id: "1", firstName: "John", lastName: "Doe" }, enrolledStudents: 45 },
  { id: 2, code: "CS302", name: "Software Engineering", description: "", creditUnits: 4, department: "Computer Science", semester: "Semester 1", academicYear: "2025-2026", lecturer: { id: "1", firstName: "John", lastName: "Doe" }, enrolledStudents: 52 },
];

const DEMO_REPORT: StudentAttendanceSummary[] = [
  { courseId: 1, courseCode: "CS301", courseName: "Database Systems", totalSessions: 20, attended: 18, absent: 2, late: 0, excused: 0, attendancePercentage: 90 },
  { courseId: 1, courseCode: "CS301", courseName: "Database Systems", totalSessions: 20, attended: 15, absent: 4, late: 1, excused: 0, attendancePercentage: 75 },
  { courseId: 1, courseCode: "CS301", courseName: "Database Systems", totalSessions: 20, attended: 12, absent: 7, late: 1, excused: 0, attendancePercentage: 60 },
];

export default function LecturerReportsPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [reportData, setReportData] = useState<StudentAttendanceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchCourses = async () => {
      if (!user) return;
      try {
        const response = await apiClient.get<Course[]>(API_ENDPOINTS.lecturers.courses(user.id));
        setCourses(response.data);
      } catch {
        setCourses(DEMO_COURSES);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCourses();
  }, [user]);

  const handleSelectCourse = async (course: Course) => {
    setSelectedCourse(course);
    setIsLoadingReport(true);
    setSearchTerm("");
    try {
      const response = await apiClient.get<StudentAttendanceSummary[]>(
        API_ENDPOINTS.reports.course(course.id)
      );
      setReportData(response.data);
    } catch {
      setReportData(
        DEMO_REPORT.map((r) => ({
          ...r,
          courseId: course.id,
          courseCode: course.code,
          courseName: course.name,
        }))
      );
    } finally {
      setIsLoadingReport(false);
    }
  };

  const filteredReport = reportData.filter((r) =>
    `${r.courseCode} ${r.courseName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const reportColumns: TableColumn<StudentAttendanceSummary>[] = [
    {
      key: "sessions",
      header: "Attended / Total",
      align: "center",
      render: (r) => (
        <span className="text-gray-900 dark:text-gray-100">{r.attended}/{r.totalSessions}</span>
      ),
    },
    {
      key: "absent",
      header: "Absent",
      align: "center",
      render: (r) => <span className="text-danger-600 font-medium">{r.absent}</span>,
    },
    {
      key: "late",
      header: "Late",
      align: "center",
      render: (r) => <span className="text-warning-600 font-medium">{r.late}</span>,
    },
    {
      key: "attendance",
      header: "Attendance",
      align: "center",
      render: (r) => (
        <Badge className={getAttendanceBgClass(r.attendancePercentage)}>
          {r.attendancePercentage.toFixed(1)}%
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (r) => (
        <Badge variant={r.attendancePercentage >= 75 ? "success" : "danger"} dot>
          {r.attendancePercentage >= 75 ? "On Track" : "At Risk"}
        </Badge>
      ),
    },
  ];

  if (isLoading) return <PageLoading message="Loading courses..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Attendance reports for your courses
          </p>
        </div>
        {selectedCourse && reportData.length > 0 && (
          <Button variant="outline" leftIcon={<Download className="w-4 h-4" />}>
            Export CSV
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Course</h2>
          {courses.map((course) => (
            <button
              key={course.id}
              onClick={() => handleSelectCourse(course)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-colors ${
                selectedCourse?.id === course.id
                  ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30"
                  : "border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
                <BookOpen className="w-4 h-4 text-primary-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{course.code}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{course.name}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2">
          {!selectedCourse ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  Select a course to view its attendance report
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader
                title={`${selectedCourse.code} — ${selectedCourse.name}`}
                subtitle={`${reportData.filter((r) => r.attendancePercentage >= 75).length} on track, ${reportData.filter((r) => r.attendancePercentage < 75).length} at risk`}
                action={
                  <div className="w-48">
                    <Input
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />}
                    />
                  </div>
                }
              />
              {isLoadingReport ? (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                  Loading report...
                </div>
              ) : (
                <Table
                  columns={reportColumns}
                  data={filteredReport}
                  keyExtractor={(r) => r.studentId ?? `${r.courseId}-${r.attended}-${r.absent}`}
                  emptyMessage="No student data for this course"
                />
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
