"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  PageLoading,
  EmptyState,
  Badge,
} from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { Cohort, Course } from "@/types";
import {
  BookOpen,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Users,
  GraduationCap,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn, formatDate, formatTime } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface AttendeeRecord {
  studentId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  status: "present" | "absent";
  markedAt: string | null;
  verificationMethod: string | null;
}

interface Session {
  id: string;
  date: string;
  startTime: string;
  endTime: string | null;
  title: string | null;
  sessionType: string;
  isActive: boolean;
  room: string | null;
  presentCount: number;
  totalEnrolled: number;
}

interface StudentRecord {
  studentId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  sessionRecords: Record<string, { status: string; markedAt: string | null; verificationMethod: string | null }>;
}

interface CourseRegisterData {
  sessions: Session[];
  students: StudentRecord[];
}

type Step = "cohort" | "course" | "sessions";

// ============================================================================
// HELPERS
// ============================================================================

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

// ============================================================================
// SESSION ROW — expands to show present students
// ============================================================================

function SessionRow({ session, students }: { session: Session; students: StudentRecord[] }) {
  const [open, setOpen] = useState(false);

  const attendees: AttendeeRecord[] = students
    .filter((s) => {
      const rec = s.sessionRecords[session.id];
      return rec && rec.status === "present";
    })
    .map((s) => {
      const rec = s.sessionRecords[session.id];
      return {
        studentId: s.studentId,
        studentNumber: s.studentNumber,
        firstName: s.firstName,
        lastName: s.lastName,
        status: "present" as const,
        markedAt: rec.markedAt,
        verificationMethod: rec.verificationMethod,
      };
    })
    .sort((a, b) => {
      if (a.markedAt && b.markedAt) return a.markedAt.localeCompare(b.markedAt);
      return a.studentNumber.localeCompare(b.studentNumber);
    });

  const attended = session.presentCount;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Session header row */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
      >
        {/* Date + time */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {formatDate(session.date)}
            </span>
            {session.title && (
              <span className="text-sm text-gray-500 dark:text-gray-400">· {session.title}</span>
            )}
            <Badge variant="info" size="sm" className="capitalize">{session.sessionType}</Badge>
            {session.isActive && <Badge variant="success" dot size="sm">Active</Badge>}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatTime(session.startTime)}
              {session.endTime ? ` – ${formatTime(session.endTime)}` : ""}
            </span>
            {session.room && <span>{session.room}</span>}
          </div>
        </div>

        {/* Attendance count */}
        <div className="text-right shrink-0">
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {attended} <span className="text-gray-400 font-normal text-sm">/ {session.totalEnrolled}</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">attended</p>
        </div>

        {/* Expand toggle */}
        <div className="shrink-0 text-gray-400 dark:text-gray-500">
          {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {/* Attendees list */}
      {open && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {attendees.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400 italic">
              No attendance recorded for this session.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reg No.</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Method</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {attendees.map((a, idx) => (
                  <tr key={a.studentId} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-5 py-3 text-gray-400 dark:text-gray-500">{idx + 1}</td>
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {a.firstName} {a.lastName}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300 font-mono text-xs">{a.studentNumber}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {formatTimestamp(a.markedAt)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400 capitalize text-xs">
                      {a.verificationMethod ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success-600 dark:text-green-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Present
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function AdminAttendancePage() {
  const [step, setStep] = useState<Step>("cohort");

  // Cohorts
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState<Cohort | null>(null);
  const [cohortSearch, setCohortSearch] = useState("");
  const [isLoadingCohorts, setIsLoadingCohorts] = useState(true);

  // Courses
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseSearch, setCourseSearch] = useState("");
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);

  // Sessions + records
  const [registerData, setRegisterData] = useState<CourseRegisterData | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [pageError, setPageError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // LOAD COHORTS (only those with a student coordinator)
  // -------------------------------------------------------------------------
  useEffect(() => {
    setIsLoadingCohorts(true);
    apiClient
      .get<Cohort[] | { results: Cohort[] }>(API_ENDPOINTS.cohorts.list)
      .then((res) => {
        const data = res.data;
        const all: Cohort[] = Array.isArray(data) ? data : data.results ?? [];
        // Only show cohorts that have at least one group coordinator assigned
        setCohorts(all.filter((c) => Object.keys(c.groupCoordinators ?? {}).length > 0));
      })
      .catch(() => setPageError("Failed to load classes"))
      .finally(() => setIsLoadingCohorts(false));
  }, []);

  // -------------------------------------------------------------------------
  // LOAD COURSES for selected cohort
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedCohort) return;
    setIsLoadingCourses(true);
    setCourses([]);
    apiClient
      .get<Course[] | { results: Course[] }>(
        `${API_ENDPOINTS.courses.list}?cohort=${selectedCohort.id}`
      )
      .then((res) => {
        const data = res.data;
        setCourses(Array.isArray(data) ? data : data.results ?? []);
      })
      .catch(() => setPageError("Failed to load courses"))
      .finally(() => setIsLoadingCourses(false));
  }, [selectedCohort]);

  // -------------------------------------------------------------------------
  // LOAD SESSIONS + RECORDS for selected course
  // -------------------------------------------------------------------------
  const loadSessions = useCallback((courseId: string | number) => {
    setIsLoadingSessions(true);
    setSessionsError(null);
    apiClient
      .get<CourseRegisterData>(`/attendance/course/${courseId}/register/`)
      .then((res) => setRegisterData(res.data))
      .catch(() => setSessionsError("Failed to load attendance data for this course."))
      .finally(() => setIsLoadingSessions(false));
  }, []);

  useEffect(() => {
    if (selectedCourse && step === "sessions") {
      loadSessions(selectedCourse.id);
    }
  }, [selectedCourse, step, loadSessions]);

  // -------------------------------------------------------------------------
  // NAVIGATION
  // -------------------------------------------------------------------------
  function selectCohort(cohort: Cohort) {
    setSelectedCohort(cohort);
    setSelectedCourse(null);
    setRegisterData(null);
    setCourseSearch("");
    setStep("course");
  }

  function selectCourse(course: Course) {
    setSelectedCourse(course);
    setRegisterData(null);
    setStep("sessions");
  }

  function goBack() {
    if (step === "course") {
      setStep("cohort");
      setSelectedCohort(null);
    } else if (step === "sessions") {
      setStep("course");
      setSelectedCourse(null);
      setRegisterData(null);
    }
  }

  // -------------------------------------------------------------------------
  // FILTERED DATA
  // -------------------------------------------------------------------------
  const filteredCohorts = cohorts.filter((c) =>
    c.name.toLowerCase().includes(cohortSearch.toLowerCase()) ||
    c.programmeName.toLowerCase().includes(cohortSearch.toLowerCase()) ||
    c.programmeCode.toLowerCase().includes(cohortSearch.toLowerCase())
  );

  const filteredCourses = courses.filter((c) =>
    c.name.toLowerCase().includes(courseSearch.toLowerCase()) ||
    c.code.toLowerCase().includes(courseSearch.toLowerCase())
  );

  // Sessions sorted newest first
  const sortedSessions = registerData
    ? [...registerData.sessions].sort((a, b) => b.date.localeCompare(a.date))
    : [];

  // -------------------------------------------------------------------------
  // BREADCRUMB
  // -------------------------------------------------------------------------
  function Breadcrumb() {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
        <button
          onClick={() => { setStep("cohort"); setSelectedCohort(null); setSelectedCourse(null); setRegisterData(null); }}
          className="hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors"
        >
          Attendance
        </button>
        {selectedCohort && (
          <>
            <ChevronRight className="w-4 h-4 shrink-0" />
            <button
              onClick={() => { setStep("course"); setSelectedCourse(null); setRegisterData(null); }}
              className={cn(
                "transition-colors",
                step === "sessions"
                  ? "hover:text-primary-600 dark:hover:text-primary-400 font-medium"
                  : "text-gray-900 dark:text-gray-100 font-semibold"
              )}
            >
              {selectedCohort.name}
            </button>
          </>
        )}
        {selectedCourse && (
          <>
            <ChevronRight className="w-4 h-4 shrink-0" />
            <span className="text-gray-900 dark:text-gray-100 font-semibold">
              {selectedCourse.code} — {selectedCourse.name}
            </span>
          </>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // ERROR
  // -------------------------------------------------------------------------
  if (pageError) {
    return (
      <div className="p-8 text-center text-danger-600 dark:text-red-400">{pageError}</div>
    );
  }

  // =========================================================================
  // STEP: COHORT
  // =========================================================================
  if (step === "cohort") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Attendance</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Select a class to view its attendance records
          </p>
        </div>

        <input
          type="text"
          placeholder="Search classes..."
          value={cohortSearch}
          onChange={(e) => setCohortSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
        />

        {isLoadingCohorts ? (
          <PageLoading message="Loading classes..." />
        ) : filteredCohorts.length === 0 ? (
          <EmptyState
            title="No classes found"
            description="No classes with a student coordinator have been set up yet."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCohorts.map((cohort) => (
              <div key={cohort.id} className="cursor-pointer" onClick={() => selectCohort(cohort)}>
                <Card hover>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-lg bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{cohort.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {cohort.programmeCode} · {cohort.programmeName}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          {cohort.currentYearOfStudy && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              Year {cohort.currentYearOfStudy}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {cohort.studentCount} students
                          </span>
                        </div>
                        {Object.keys(cohort.groupCoordinators ?? {}).length > 0 && (
                          <p className="text-xs text-primary-600 dark:text-primary-400 mt-1 font-medium">
                            {Object.entries(cohort.groupCoordinators ?? {}).map(([st, gc]) => gc.coordinatorName ? `${st}: ${gc.coordinatorName}` : null).filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // STEP: COURSE
  // =========================================================================
  if (step === "course") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {selectedCohort?.name}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-0.5">
              {selectedCohort?.programmeCode} · Select a course
            </p>
          </div>
        </div>

        <Breadcrumb />

        <input
          type="text"
          placeholder="Search courses..."
          value={courseSearch}
          onChange={(e) => setCourseSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
        />

        {isLoadingCourses ? (
          <PageLoading message="Loading courses..." />
        ) : filteredCourses.length === 0 ? (
          <EmptyState
            title="No courses found"
            description="No timetable courses found for this class."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCourses.map((course) => (
              <div key={course.id} className="cursor-pointer" onClick={() => selectCourse(course)}>
                <Card hover>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-lg bg-warning-50 dark:bg-yellow-950/50 text-warning-600 dark:text-yellow-400">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{course.code}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{course.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {course.enrolledStudents ?? 0} students
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // STEP: SESSIONS — show each session expandable with who attended
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {selectedCourse?.code} — {selectedCourse?.name}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-0.5">
            {selectedCohort?.name}
          </p>
        </div>
      </div>

      <Breadcrumb />

      {/* Summary stats */}
      {registerData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Sessions</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {registerData.sessions.length}
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success-50 dark:bg-green-950/50 text-success-600 dark:text-green-400">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Students</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {registerData.students.length}
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning-50 dark:bg-yellow-950/50 text-warning-600 dark:text-yellow-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Avg Attendance</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {registerData.sessions.length > 0
                    ? Math.round(
                        registerData.sessions.reduce(
                          (sum, s) => sum + (s.totalEnrolled > 0 ? (s.presentCount / s.totalEnrolled) * 100 : 0),
                          0
                        ) / registerData.sessions.length
                      )
                    : 0}%
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Sessions */}
      {isLoadingSessions ? (
        <PageLoading message="Loading attendance records..." />
      ) : sessionsError ? (
        <div className="p-5 rounded-xl border border-danger-200 dark:border-red-800 bg-danger-50 dark:bg-red-950/30 text-danger-600 dark:text-red-400 text-sm">
          {sessionsError}
        </div>
      ) : !registerData || sortedSessions.length === 0 ? (
        <EmptyState
          title="No sessions recorded"
          description="No attendance sessions have been captured for this course yet."
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {sortedSessions.length} session{sortedSessions.length !== 1 ? "s" : ""} — tap a session to see who attended
          </p>
          {sortedSessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              students={registerData.students}
            />
          ))}
        </div>
      )}
    </div>
  );
}
