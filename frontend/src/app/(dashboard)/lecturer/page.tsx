"use client";

/**
 * Lecturer Dashboard Page
 * Main dashboard for lecturer users
 * Displays course overview, attendance sessions, and reporting tools
 */

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Card,
  CardHeader,
  StatCard,
  PageLoading,
  ErrorState,
  Button,
  Badge,
  Table,
  TableColumn,
  Modal,
} from "@/components/ui";
import { AttendanceLineChart } from "@/components/charts";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import {
  Course,
  AttendanceSession,
  AttendanceTrend,
} from "@/types";
import {
  BookOpen,
  Users,
  Clock,
  Play,
  Square,
  FileText,
  CheckCircle,
  XCircle,
  TrendingUp,
} from "lucide-react";
import { formatDate, formatTime } from "@/lib/utils";

interface LecturerCourse extends Course {
  totalStudents?: number;
  averageAttendance?: number;
}

export default function LecturerDashboardPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<LecturerCourse[]>([]);
  const [activeSessions, setActiveSessions] = useState<AttendanceSession[]>([]);
  const [recentSessions, setRecentSessions] = useState<AttendanceSession[]>([]);
  const [trends, setTrends] = useState<AttendanceTrend[]>([]);
  const [isStartSessionModalOpen, setIsStartSessionModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        setIsLoading(true);

        // Fetch lecturer's courses with per-course stats
        const coursesRes = await apiClient.get<LecturerCourse[]>("/courses/my/lecturer/");
        const fetchedCourses = Array.isArray(coursesRes.data)
          ? coursesRes.data
          : (coursesRes.data as any).results ?? [];
        setCourses(fetchedCourses);

        // Fetch sessions (all, ordered by date descending)
        const sessionsRes = await apiClient.get<{ results?: any[]; count?: number } | any[]>(
          `${API_ENDPOINTS.attendance.sessions}?ordering=-date,-start_time&page_size=20`
        );
        const sessionsData = sessionsRes.data;
        const rawSessions: any[] = Array.isArray(sessionsData)
          ? sessionsData
          : (sessionsData as any).results ?? [];

        // Normalise backend fields to match AttendanceSession shape
        const allSessions: AttendanceSession[] = rawSessions.map((s: any) => ({
          ...s,
          course: { id: s.course, code: s.courseCode ?? s.course_code, name: s.courseName ?? s.course_name },
          totalPresent: s.presentCount ?? s.totalPresent ?? 0,
          totalAbsent: (s.totalEnrolled ?? 0) - (s.presentCount ?? 0),
          totalLate: 0,
          startTime: s.startTime ?? s.start_time,
          isActive: s.isActive ?? s.is_active ?? false,
        }));

        const active = allSessions.filter((s) => s.isActive);
        const recent = allSessions.filter((s) => !s.isActive);
        setActiveSessions(active);
        setRecentSessions(recent);

        // Compute weekly attendance trend from session data
        if (allSessions.length > 0) {
          const computed = computeWeeklyTrends(allSessions);
          setTrends(computed);
        }
      } catch (err) {
        setError("Failed to load dashboard data. Please try again.");
        console.error("Dashboard fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  /** Group sessions into weekly buckets and compute average attendance rate. */
  function computeWeeklyTrends(sessions: AttendanceSession[]): AttendanceTrend[] {
    const byWeek: Record<string, { present: number; total: number }> = {};
    sessions.forEach((s) => {
      const d = new Date(s.date);
      // ISO week key: year + week number
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(
        ((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
      );
      const key = `${d.getFullYear()}-W${weekNum}`;
      if (!byWeek[key]) byWeek[key] = { present: 0, total: 0 };
      byWeek[key].present += (s.totalPresent ?? 0) + (s.totalLate ?? 0);
      byWeek[key].total += (s.totalPresent ?? 0) + (s.totalAbsent ?? 0) + (s.totalLate ?? 0);
    });

    return Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, { present, total }]) => ({
        period: key.replace(/^\d{4}-/, ""),
        percentage: total > 0 ? Math.round((present / total) * 100) : 0,
        sessionsAttended: present,
        totalSessions: total,
      }));
  }

  const totalStudents = courses.reduce(
    (sum, c) => sum + ((c as any).totalStudents ?? c.enrolledStudents ?? 0),
    0
  );

  const averageAttendance =
    courses.length > 0
      ? courses.reduce((sum, c) => sum + ((c as any).averageAttendance ?? 0), 0) /
        courses.length
      : 0;

  const handleStartSession = async () => {
    if (!selectedCourse) return;

    setIsStartingSession(true);
    try {
      await apiClient.post(API_ENDPOINTS.attendance.startSession, {
        courseId: selectedCourse.id,
      });
      setIsStartSessionModalOpen(false);
      window.location.reload();
    } catch (err) {
      console.error("Failed to start session:", err);
    } finally {
      setIsStartingSession(false);
    }
  };

  const handleEndSession = async (sessionId: number) => {
    try {
      await apiClient.post(API_ENDPOINTS.attendance.endSession(sessionId));
      window.location.reload();
    } catch (err) {
      console.error("Failed to end session:", err);
    }
  };

  const sessionColumns: TableColumn<AttendanceSession>[] = [
    {
      key: "course",
      header: "Course",
      render: (session) => (
        <div>
          <p className="font-medium text-gray-900">{session.course.code}</p>
          <p className="text-sm text-gray-500">{session.course.name}</p>
        </div>
      ),
    },
    {
      key: "date",
      header: "Date & Time",
      render: (session) => (
        <div>
          <p className="text-gray-900">{formatDate(session.date)}</p>
          <p className="text-sm text-gray-500">{formatTime(session.startTime)}</p>
        </div>
      ),
    },
    {
      key: "attendance",
      header: "Attendance",
      align: "center",
      render: (session) => (
        <div className="flex items-center justify-center gap-3">
          <span className="flex items-center gap-1 text-success-600">
            <CheckCircle className="w-4 h-4" />
            {session.totalPresent}
          </span>
          <span className="flex items-center gap-1 text-danger-600">
            <XCircle className="w-4 h-4" />
            {session.totalAbsent}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (session) => (
        <Badge variant={session.isActive ? "success" : "default"} dot>
          {session.isActive ? "Active" : "Completed"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (session) =>
        session.isActive ? (
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleEndSession(session.id)}
            leftIcon={<Square className="w-4 h-4" />}
          >
            End Session
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            leftIcon={<FileText className="w-4 h-4" />}
          >
            View Report
          </Button>
        ),
    },
  ];

  if (isLoading) {
    return <PageLoading message="Loading your dashboard..." />;
  }

  if (error) {
    return (
      <ErrorState message={error} onRetry={() => window.location.reload()} />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Lecturer Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage attendance for your courses
          </p>
        </div>
        <Button
          leftIcon={<Play className="w-4 h-4" />}
          onClick={() => setIsStartSessionModalOpen(true)}
        >
          Start Attendance Session
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="My Courses"
          value={courses.length}
          subtitle="This semester"
          icon={<BookOpen className="w-6 h-6" />}
          variant="default"
        />
        <StatCard
          title="Total Students"
          value={totalStudents}
          subtitle="Across all courses"
          icon={<Users className="w-6 h-6" />}
          variant="default"
        />
        <StatCard
          title="Active Sessions"
          value={activeSessions.length}
          subtitle="Currently running"
          icon={<Clock className="w-6 h-6" />}
          variant={activeSessions.length > 0 ? "success" : "default"}
        />
        <StatCard
          title="Avg. Attendance"
          value={`${averageAttendance.toFixed(1)}%`}
          subtitle="This semester"
          icon={<TrendingUp className="w-6 h-6" />}
          variant={averageAttendance >= 75 ? "success" : "warning"}
        />
      </div>

      {/* Active Sessions Alert */}
      {activeSessions.length > 0 && (
        <Card className="border-l-4 border-l-success-500 bg-success-50 dark:bg-green-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success-100 rounded-full">
                <Clock className="w-6 h-6 text-success-600 animate-pulse" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Active Attendance Session</h3>
                <p className="text-gray-600">
                  {activeSessions[0].course.code} - {activeSessions[0].course.name} |{" "}
                  Started at {formatTime(activeSessions[0].startTime)} |{" "}
                  {activeSessions[0].totalPresent} students present
                </p>
              </div>
            </div>
            <Button
              variant="danger"
              onClick={() => handleEndSession(activeSessions[0].id)}
              leftIcon={<Square className="w-4 h-4" />}
            >
              End Session
            </Button>
          </div>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Trend - 2 columns */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Attendance Trends"
              subtitle="Weekly attendance across all courses"
            />
            {trends.length > 0 ? (
              <AttendanceLineChart data={trends} height={300} />
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
                No session data available yet
              </div>
            )}
          </Card>
        </div>

        {/* My Courses - 1 column */}
        <div>
          <Card>
            <CardHeader title="My Courses" />
            {courses.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                No courses assigned yet
              </div>
            ) : (
              <div className="space-y-3">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary-50 rounded-lg">
                        <BookOpen className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{course.code}</p>
                        <p className="text-sm text-gray-500">{course.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {(course as any).totalStudents ?? course.enrolledStudents ?? 0}
                      </p>
                      <p className="text-xs text-gray-500">students</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Recent Sessions Table */}
      <Card>
        <CardHeader
          title="Recent Attendance Sessions"
          subtitle="Your latest attendance sessions"
        />
        <Table
          columns={sessionColumns}
          data={[...activeSessions, ...recentSessions]}
          keyExtractor={(session) => session.id}
          emptyMessage="No attendance sessions yet"
        />
      </Card>

      {/* Start Session Modal */}
      <Modal
        isOpen={isStartSessionModalOpen}
        onClose={() => setIsStartSessionModalOpen(false)}
        title="Start Attendance Session"
        description="Select a course to start a new attendance session"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            {courses.map((course) => (
              <button
                key={course.id}
                onClick={() => setSelectedCourse(course)}
                className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${
                  selectedCourse?.id === course.id
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-gray-400" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{course.code}</p>
                    <p className="text-sm text-gray-500">{course.name}</p>
                  </div>
                </div>
                <Badge variant="default">
                  {(course as any).totalStudents ?? course.enrolledStudents ?? 0} students
                </Badge>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setIsStartSessionModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartSession}
              disabled={!selectedCourse}
              isLoading={isStartingSession}
              leftIcon={<Play className="w-4 h-4" />}
            >
              Start Session
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
