"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, Badge, Table, TableColumn, PageLoading, Input } from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { Course } from "@/types";
import { BookOpen, Users, Search, ArrowLeft, ChevronRight, GraduationCap } from "lucide-react";

interface LecturerCourse extends Course {
  attendanceRate?: number;
  totalSessions?: number;
}

interface EnrolledStudent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  studentId?: string;
  studyTime?: string;
  attendancePercentage?: number;
}

type Step = "courses" | "students";

export default function LecturerCoursesPage() {
  const { user } = useAuth();

  const [courses, setCourses] = useState<LecturerCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [step, setStep] = useState<Step>("courses");
  const [selectedCourse, setSelectedCourse] = useState<LecturerCourse | null>(null);
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    apiClient
      .get<{ results: LecturerCourse[] } | LecturerCourse[]>(API_ENDPOINTS.courses.list)
      .then((res) => {
        const data = res.data;
        setCourses(Array.isArray(data) ? data : (data as any).results ?? []);
      })
      .catch(() => setCourses([]))
      .finally(() => setIsLoading(false));
  }, [user]);

  const viewStudents = async (course: LecturerCourse) => {
    setSelectedCourse(course);
    setStudentSearch("");
    setStep("students");
    setIsLoadingStudents(true);
    try {
      const res = await apiClient.get<{ results: EnrolledStudent[] } | EnrolledStudent[]>(
        `${API_ENDPOINTS.admin.users}?role=student&course=${course.id}&page_size=200`
      );
      const data = res.data;
      setStudents(Array.isArray(data) ? data : (data as any).results ?? []);
    } catch {
      setStudents([]);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const filtered = courses.filter((c) =>
    `${c.code} ${c.name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredStudents = students.filter((s) =>
    `${s.firstName} ${s.lastName} ${s.studentId ?? ""} ${s.email}`.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const totalStudents = courses.reduce((sum, c) => sum + ((c as any).totalStudents ?? c.enrolledStudents ?? 0), 0);

  const courseColumns: TableColumn<LecturerCourse>[] = [
    {
      key: "course", header: "Course",
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
      key: "enrolled", header: "Students", align: "center",
      render: (c) => (
        <div className="flex items-center justify-center gap-1 text-gray-700 dark:text-gray-300">
          <Users className="w-4 h-4 text-gray-400" />
          {(c as any).totalStudents ?? c.enrolledStudents ?? 0}
        </div>
      ),
    },
    {
      key: "semester", header: "Semester",
      render: (c) => <span className="text-sm text-gray-500 dark:text-gray-400">{c.semester || "—"}</span>,
    },
    {
      key: "actions", header: "", align: "right",
      render: (c) => (
        <button
          onClick={() => viewStudents(c)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-colors"
        >
          <Users className="w-3.5 h-3.5" />
          View Students
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  const studentColumns: TableColumn<EnrolledStudent>[] = [
    {
      key: "name", header: "Student",
      render: (s) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-700 dark:text-primary-300 text-sm font-bold shrink-0">
            {s.firstName[0]}{s.lastName[0]}
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">{s.firstName} {s.lastName}</p>
            <p className="text-xs text-gray-500">{s.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "studentId", header: "Student ID",
      render: (s) => <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{s.studentId || "—"}</span>,
    },
    {
      key: "studyTime", header: "Session",
      render: (s) => s.studyTime
        ? <Badge variant="default" className="capitalize">{s.studyTime}</Badge>
        : <span className="text-gray-400">—</span>,
    },
  ];

  if (isLoading) return <PageLoading message="Loading your courses..." />;

  // ── Student view ────────────────────────────────────────────────────────────
  if (step === "students" && selectedCourse) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setStep("courses"); setStudents([]); }}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-0.5">
              <button
                onClick={() => { setStep("courses"); setStudents([]); }}
                className="hover:text-primary-600 transition-colors"
              >
                My Courses
              </button>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-gray-900 dark:text-gray-100 font-medium">{selectedCourse.code}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {selectedCourse.code} — {selectedCourse.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search students…"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
          <Badge variant="default">
            <Users className="w-3 h-3 mr-1 inline" />
            {students.length} student{students.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {isLoadingStudents ? (
          <PageLoading message="Loading students…" />
        ) : (
          <Card>
            <CardHeader
              title="Enrolled Students"
              subtitle={`${filteredStudents.length} of ${students.length} shown`}
            />
            <Table
              columns={studentColumns}
              data={filteredStudents}
              keyExtractor={(s) => s.id}
              emptyMessage="No students enrolled in this course"
            />
          </Card>
        )}
      </div>
    );
  }

  // ── Course list ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Courses</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Click a course to view its enrolled students</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-primary-600">{courses.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Courses Teaching</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-success-600">{totalStudents}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Students</p>
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
        {courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <GraduationCap className="w-10 h-10 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400">No courses assigned yet.</p>
          </div>
        ) : (
          <Table
            columns={courseColumns}
            data={filtered}
            keyExtractor={(c) => c.id}
            emptyMessage="No courses found"
          />
        )}
      </Card>
    </div>
  );
}
