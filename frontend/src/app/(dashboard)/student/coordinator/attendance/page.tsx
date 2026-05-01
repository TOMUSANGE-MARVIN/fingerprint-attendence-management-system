"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Modal,
} from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import {
  ClipboardCheck,
  Plus,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";
import { formatDate, cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AttendanceStatus = "present" | "absent";

interface CoordinatorStudent {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  studyTime: string | null;
  fingerprintRegistered: boolean;
}

interface CoordinatorCourse {
  courseId: string;
  courseCode: string;
  courseName: string;
  yearLevel: number | null;
  semesterNumber: number | null;
  programmeCode: string | null;
  programmeName: string | null;
  lecturerName: string | null;
}

interface AttendanceSessionItem {
  id: string;
  course: string;
  courseCode: string;
  courseName: string;
  title: string | null;
  sessionType: string;
  date: string;
  startTime: string;
  endTime: string | null;
  isActive: boolean;
  isExpired: boolean;
  room: string | null;
  totalEnrolled: number;
  presentCount: number;
  lateCount?: number;
  absentCount: number;
  attendanceRate: number;
  createdAt: string;
  attendanceRecords: AttendanceRecord[];
}

interface AttendanceRecord {
  id: string;
  session: string;
  student: string;
  studentName: string;
  studentId: string;
  status: AttendanceStatus;
  verificationMethod: string | null;
  markedAt: string | null;
}

interface NewSessionForm {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  sessionType: string;
}

interface CoordinatorResponse {
  isCoordinator: boolean;
  students: CoordinatorStudent[];
  courses: CoordinatorCourse[];
}

const emptyForm: NewSessionForm = {
  title: "",
  date: new Date().toISOString().split("T")[0],
  startTime: "",
  endTime: "",
  room: "",
  sessionType: "lecture",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoordinatorAttendancePage() {
  const [students, setStudents] = useState<CoordinatorStudent[]>([]);
  const [courses, setCourses] = useState<CoordinatorCourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CoordinatorCourse | null>(null);
  const [sessions, setSessions] = useState<AttendanceSessionItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Session detail view
  const [selectedSession, setSelectedSession] = useState<AttendanceSessionItem | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // New session modal
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
  const [newSessionForm, setNewSessionForm] = useState<NewSessionForm>(emptyForm);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Bulk mark state
  const [pendingStatuses, setPendingStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [isSavingBulk, setIsSavingBulk] = useState(false);
  const [bulkSaveError, setBulkSaveError] = useState<string | null>(null);
  const [bulkSaveSuccess, setBulkSaveSuccess] = useState(false);

  // ── Load coordinator data ──────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setIsLoadingData(true);
    setDataError(null);
    try {
      const res = await apiClient.get<CoordinatorResponse>(API_ENDPOINTS.courses.myCoordinated);
      if (!res.data.isCoordinator) {
        setDataError("You are not assigned as coordinator for any class.");
        return;
      }
      setStudents(res.data.students);
      setCourses(res.data.courses);
    } catch {
      setDataError("Failed to load class information.");
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  const fetchSessions = useCallback(async (courseId: string) => {
    setIsLoadingSessions(true);
    try {
      const res = await apiClient.get<AttendanceSessionItem[] | { results: AttendanceSessionItem[] }>(
        `${API_ENDPOINTS.attendance.sessions}?course=${courseId}`
      );
      const data = res.data;
      setSessions(Array.isArray(data) ? data : data.results ?? []);
    } catch {
      setSessions([]);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedCourse) {
      setSessions([]);
      setSelectedSession(null);
      fetchSessions(selectedCourse.courseId);
    }
  }, [selectedCourse, fetchSessions]);

  // ── Session detail ─────────────────────────────────────────────────────────

  const openSessionDetail = async (session: AttendanceSessionItem) => {
    setIsLoadingDetail(true);
    setSelectedSession(null);
    setBulkSaveSuccess(false);
    setBulkSaveError(null);
    try {
      const res = await apiClient.get<AttendanceSessionItem>(
        `${API_ENDPOINTS.attendance.sessions}${session.id}/`
      );
      const detail = res.data;
      setSelectedSession(detail);
      const initial: Record<string, AttendanceStatus> = {};
      students.forEach((s) => {
        const rec = (detail.attendanceRecords || []).find((r) => r.student === s.id);
        initial[s.id] = rec ? rec.status : "absent";
      });
      setPendingStatuses(initial);
    } catch {
      setBulkSaveError("Failed to load session details.");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setPendingStatuses((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleBulkSave = async () => {
    if (!selectedSession || !selectedCourse) return;
    setIsSavingBulk(true);
    setBulkSaveError(null);
    setBulkSaveSuccess(false);
    try {
      const records = Object.entries(pendingStatuses).map(([studentId, status]) => ({
        student_id: studentId,
        status,
      }));
      await apiClient.post(
        `${API_ENDPOINTS.attendance.sessions}${selectedSession.id}/bulk_mark/`,
        { records }
      );
      setBulkSaveSuccess(true);
      await fetchSessions(selectedCourse.courseId);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setBulkSaveError(
        apiErr?.response?.data?.error || "Failed to save attendance. Please try again."
      );
    } finally {
      setIsSavingBulk(false);
    }
  };

  // ── Create session ─────────────────────────────────────────────────────────

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      await apiClient.post(API_ENDPOINTS.attendance.sessions, {
        course: selectedCourse.courseId,
        title: newSessionForm.title || undefined,
        date: newSessionForm.date,
        start_time: newSessionForm.startTime,
        end_time: newSessionForm.endTime || undefined,
        room: newSessionForm.room || undefined,
        session_type: newSessionForm.sessionType,
      });
      setIsNewSessionOpen(false);
      setNewSessionForm(emptyForm);
      await fetchSessions(selectedCourse.courseId);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { detail?: string; error?: string } } };
      setCreateError(
        apiErr?.response?.data?.detail ||
          apiErr?.response?.data?.error ||
          "Failed to create session."
      );
    } finally {
      setIsCreating(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoadingData) return <PageLoading message="Loading class information..." />;
  if (dataError && courses.length === 0)
    return <ErrorState message={dataError} onRetry={fetchData} />;

  const statusBadge = (status: AttendanceStatus) => {
    const map: Record<AttendanceStatus, { variant: "success" | "danger" | "default"; label: string }> = {
      present: { variant: "success", label: "Present" },
      absent: { variant: "danger", label: "Absent" },
    };
    const { variant, label } = map[status] ?? { variant: "default", label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const sessionColumns: TableColumn<AttendanceSessionItem>[] = [
    {
      key: "date",
      header: "Date",
      render: (s) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(s.date)}</p>
          {s.title && <p className="text-xs text-gray-500">{s.title}</p>}
        </div>
      ),
    },
    {
      key: "time",
      header: "Time",
      render: (s) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {s.startTime}{s.endTime ? ` – ${s.endTime}` : ""}
        </span>
      ),
    },
    {
      key: "room",
      header: "Room",
      render: (s) => <span className="text-sm text-gray-600 dark:text-gray-400">{s.room || "—"}</span>,
    },
    {
      key: "attendance",
      header: "Attendance",
      align: "center",
      render: (s) => (
        <div className="text-center">
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {s.presentCount}/{s.totalEnrolled}
          </p>
          <p className="text-xs text-gray-500">{(s.attendanceRate ?? 0).toFixed(0)}%</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (s) =>
        s.isActive ? (
          <Badge variant="success" dot>Active</Badge>
        ) : (
          <Badge variant="default">Closed</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (s) => (
        <Button
          variant="outline"
          size="sm"
          rightIcon={<ChevronRight className="w-4 h-4" />}
          onClick={() => openSessionDetail(s)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Take Attendance</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage attendance for your class across all subjects
          </p>
        </div>
        {selectedCourse && !selectedSession && (
          <Button
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setNewSessionForm(emptyForm);
              setCreateError(null);
              setIsNewSessionOpen(true);
            }}
          >
            New Session
          </Button>
        )}
      </div>

      {/* Course Picker */}
      {!selectedSession && (
        <Card>
          <CardHeader title="Select Course Subject" subtitle="Choose a course to manage attendance" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {courses.map((c) => (
              <button
                key={c.courseId}
                onClick={() => setSelectedCourse(c)}
                className={cn(
                  "text-left p-4 rounded-xl border-2 transition-all",
                  selectedCourse?.courseId === c.courseId
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30"
                    : "border-gray-100 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-800 bg-gray-50 dark:bg-gray-800/50"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                    <BookOpen className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{c.courseCode}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{c.courseName}</p>
                    {c.lecturerName && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{c.lecturerName}</p>
                    )}
                  </div>
                  {selectedCourse?.courseId === c.courseId && (
                    <CheckCircle2 className="w-5 h-5 text-primary-600 flex-shrink-0" />
                  )}
                </div>
              </button>
            ))}
            {courses.length === 0 && (
              <p className="col-span-full text-center text-gray-400 py-8">
                No courses found for your cohort.
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Sessions or Session Detail */}
      {selectedCourse && (
        <>
          {selectedSession ? (
            <div className="space-y-6">
              <button
                onClick={() => setSelectedSession(null)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to sessions
              </button>

              <Card>
                <CardHeader
                  title={selectedSession.title || `Session — ${formatDate(selectedSession.date)}`}
                  subtitle={`${formatDate(selectedSession.date)} · ${selectedSession.startTime}${selectedSession.endTime ? ` – ${selectedSession.endTime}` : ""}${selectedSession.room ? ` · Room ${selectedSession.room}` : ""}`}
                  action={
                    selectedSession.isActive ? (
                      <Badge variant="success" dot>Active</Badge>
                    ) : (
                      <Badge variant="default">Closed</Badge>
                    )
                  }
                />
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-success-50 dark:bg-green-900/20 rounded-xl">
                    <p className="text-2xl font-bold text-success-600">{selectedSession.presentCount}</p>
                    <p className="text-xs text-gray-500 mt-1">Present</p>
                  </div>
                  <div className="text-center p-3 bg-danger-50 dark:bg-red-900/20 rounded-xl">
                    <p className="text-2xl font-bold text-danger-600">{selectedSession.absentCount}</p>
                    <p className="text-xs text-gray-500 mt-1">Absent</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{selectedSession.totalEnrolled}</p>
                    <p className="text-xs text-gray-500 mt-1">Enrolled</p>
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader title="Mark Attendance" subtitle="Update each student's status then save" />
                {bulkSaveError && (
                  <div className="mb-4 flex items-start gap-2 p-3 bg-danger-50 dark:bg-red-950/30 border border-danger-200 dark:border-red-800 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-danger-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-danger-700 dark:text-red-300">{bulkSaveError}</p>
                  </div>
                )}
                {bulkSaveSuccess && (
                  <div className="mb-4 flex items-start gap-2 p-3 bg-success-50 dark:bg-green-950/30 border border-success-200 dark:border-green-800 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-success-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-success-700 dark:text-green-300">Attendance saved successfully.</p>
                  </div>
                )}
                <div className="space-y-2">
                  {students.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <Avatar firstName={student.firstName} lastName={student.lastName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{student.studentNumber}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusBadge(pendingStatuses[student.id] ?? "absent")}
                        <div className="relative">
                          <select
                            value={pendingStatuses[student.id] ?? "absent"}
                            onChange={(e) => handleStatusChange(student.id, e.target.value as AttendanceStatus)}
                            className="appearance-none border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg pl-3 pr-7 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                          </select>
                          <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                  {students.length === 0 && (
                    <p className="text-center text-gray-400 py-8">No students in this cohort.</p>
                  )}
                </div>
                {students.length > 0 && (
                  <div className="flex justify-end mt-4 pt-4 border-t dark:border-gray-700">
                    <Button
                      onClick={handleBulkSave}
                      isLoading={isSavingBulk}
                      leftIcon={<ClipboardCheck className="w-4 h-4" />}
                    >
                      Save Attendance
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <Card>
              <CardHeader
                title={`${selectedCourse.courseCode} — Sessions`}
                subtitle={`${selectedCourse.courseName} · ${sessions.length} session${sessions.length !== 1 ? "s" : ""}`}
              />
              {isLoadingDetail ? (
                <div className="py-12 text-center text-gray-400">Loading session...</div>
              ) : isLoadingSessions ? (
                <div className="py-12 text-center text-gray-400">Loading sessions...</div>
              ) : sessions.length === 0 ? (
                <div className="py-12 text-center">
                  <Clock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No sessions yet</p>
                  <p className="text-sm text-gray-400 mt-1">Create a session using the button above.</p>
                </div>
              ) : (
                <Table
                  columns={sessionColumns}
                  data={sessions}
                  keyExtractor={(s) => s.id}
                  emptyMessage="No sessions found."
                />
              )}
            </Card>
          )}
        </>
      )}

      {/* New Session Modal */}
      <Modal
        isOpen={isNewSessionOpen}
        onClose={() => { if (!isCreating) setIsNewSessionOpen(false); }}
        title="New Attendance Session"
        description={selectedCourse ? `Create a session for ${selectedCourse.courseCode} — ${selectedCourse.courseName}` : ""}
        size="md"
      >
        <form onSubmit={handleCreateSession} className="space-y-4">
          {createError && (
            <div className="flex items-start gap-2 p-3 bg-danger-50 dark:bg-red-950/30 border border-danger-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-danger-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-danger-700 dark:text-red-300">{createError}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Session Title <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Week 5 Lecture"
              value={newSessionForm.title}
              onChange={(e) => setNewSessionForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date <span className="text-danger-500">*</span>
              </label>
              <input
                type="date"
                required
                value={newSessionForm.date}
                onChange={(e) => setNewSessionForm((p) => ({ ...p, date: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Session Type</label>
              <select
                value={newSessionForm.sessionType}
                onChange={(e) => setNewSessionForm((p) => ({ ...p, sessionType: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="lecture">Lecture</option>
                <option value="lab">Lab</option>
                <option value="tutorial">Tutorial</option>
                <option value="seminar">Seminar</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Time <span className="text-danger-500">*</span>
              </label>
              <input
                type="time"
                required
                value={newSessionForm.startTime}
                onChange={(e) => setNewSessionForm((p) => ({ ...p, startTime: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Time</label>
              <input
                type="time"
                value={newSessionForm.endTime}
                onChange={(e) => setNewSessionForm((p) => ({ ...p, endTime: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Room <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g., LH 101"
              value={newSessionForm.room}
              onChange={(e) => setNewSessionForm((p) => ({ ...p, room: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button variant="outline" type="button" onClick={() => setIsNewSessionOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isCreating} leftIcon={<Plus className="w-4 h-4" />}>
              Create Session
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
