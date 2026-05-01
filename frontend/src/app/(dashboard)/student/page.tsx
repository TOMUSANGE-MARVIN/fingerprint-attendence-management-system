"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Card,
  CardHeader,
  StatCard,
  PageLoading,
  ErrorState,
  Badge,
} from "@/components/ui";
import { CourseList } from "@/components/dashboard";
import {
  AttendanceLineChart,
  AttendanceBarChart,
  AttendancePieChart,
} from "@/components/charts";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { AttendanceAnalytics, Notification } from "@/types";
import {
  GraduationCap,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  BookOpen,
  Bell,
  Fingerprint,
  Clock,
  ChevronRight,
} from "lucide-react";
import { cn, calculateRiskLevel } from "@/lib/utils";
import Link from "next/link";

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  upcoming_lecture: <Clock className="w-4 h-4 text-primary-600 dark:text-primary-400" />,
  missed_lecture: <AlertTriangle className="w-4 h-4 text-danger-600 dark:text-danger-400" />,
  attendance: <CheckCircle className="w-4 h-4 text-success-600 dark:text-success-400" />,
  alert: <AlertTriangle className="w-4 h-4 text-warning-600 dark:text-warning-400" />,
  fingerprint: <Fingerprint className="w-4 h-4 text-primary-600 dark:text-primary-400" />,
  system: <Bell className="w-4 h-4 text-gray-500 dark:text-gray-400" />,
};

type AttendanceStatus = "present" | "absent";

interface StudentAttendanceApi {
  courseId: string;
  courseCode: string;
  courseName: string;
  totalSessions: number;
  attended: number;
  absent: number;
  attendancePercentage: number;
}

interface AttendanceRecordApi {
  id: string;
  status: AttendanceStatus;
  verificationMethod: "fingerprint" | "manual" | "qr_code" | "facial" | null;
  markedAt?: string | null;
  createdAt?: string;
  sessionDate?: string;
  courseCode?: string;
  courseName?: string;
}

interface NotificationApi {
  id: string | number;
  title: string;
  message: string;
  notificationType?: string;
  isRead: boolean;
  createdAt: string;
  link?: string | null;
}

function normalizeList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

function mapNotificationType(type?: string): Notification["type"] {
  switch (type) {
    case "warning":
    case "error":
      return "alert";
    case "success":
      return "attendance";
    case "info":
      return "system";
    default:
      return "system";
  }
}

function getRecordDate(record: AttendanceRecordApi): Date | null {
  const dateStr = record.sessionDate || record.markedAt || record.createdAt;
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getWeekBucket(date: Date): { key: string; label: string; bucketDate: Date } {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const key = `${utcDate.getUTCFullYear()}-W${weekNum}`;
  return { key, label: `Week ${weekNum}`, bucketDate: utcDate };
}

function getMonthBucket(date: Date): { key: string; label: string; bucketDate: Date } {
  const key = `${date.getFullYear()}-${date.getMonth()}`;
  const label = date.toLocaleString("en-US", { month: "short" });
  return { key, label, bucketDate: new Date(date.getFullYear(), date.getMonth(), 1) };
}

function buildTrends(records: AttendanceRecordApi[], granularity: "week" | "month") {
  const buckets = new Map<string, { label: string; date: Date; attended: number; total: number }>();
  records.forEach((record) => {
    const date = getRecordDate(record);
    if (!date) return;
    const bucket = granularity === "week" ? getWeekBucket(date) : getMonthBucket(date);
    if (!buckets.has(bucket.key)) {
      buckets.set(bucket.key, { label: bucket.label, date: bucket.bucketDate, attended: 0, total: 0 });
    }
    const entry = buckets.get(bucket.key)!;
    entry.total += 1;
    if (record.status === "present") {
      entry.attended += 1;
    }
  });

  return Array.from(buckets.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((entry) => ({
      period: entry.label,
      percentage: entry.total > 0 ? Math.round((entry.attended / entry.total) * 100) : 0,
      sessionsAttended: entry.attended,
      totalSessions: entry.total,
    }));
}

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AttendanceAnalytics | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);

        const [summaryRes, recordsRes, notifRes] = await Promise.all([
          apiClient.get<StudentAttendanceApi[]>(API_ENDPOINTS.attendance.myStudent),
          apiClient.get<{ results?: AttendanceRecordApi[] } | AttendanceRecordApi[]>(API_ENDPOINTS.attendance.recordsList),
          apiClient.get<{ results?: NotificationApi[] } | NotificationApi[]>(API_ENDPOINTS.auth.notifications),
        ]);

        const summaries = normalizeList(summaryRes.data).map((course) => ({
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

        const records = normalizeList(recordsRes.data);
        const weeklyTrends = buildTrends(records, "week").slice(-6);
        const monthlyTrends = buildTrends(records, "month").slice(-4);

        const totalSessions = summaries.reduce((sum, c) => sum + c.totalSessions, 0);
        const totalAttended = summaries.reduce((sum, c) => sum + c.attended, 0);
        const overallPercentage = totalSessions > 0
          ? Math.round((totalAttended / totalSessions) * 1000) / 10
          : 0;

        setAnalytics({
          overallPercentage,
          weeklyTrends,
          monthlyTrends,
          courseSummaries: summaries,
          riskLevel: calculateRiskLevel(overallPercentage),
        });

        const normalizedNotifications = normalizeList(notifRes.data).map((notif) => ({
          id: notif.id,
          type: mapNotificationType(notif.notificationType),
          title: notif.title,
          message: notif.message,
          isRead: notif.isRead,
          createdAt: notif.createdAt,
          actionUrl: notif.link ?? undefined,
        }));
        setNotifications(normalizedNotifications);
      } catch (err) {
        setError("Failed to load dashboard data. Please try again.");
        console.error("Dashboard fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (isLoading) {
    return <PageLoading message="Loading your dashboard..." />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!analytics) {
    return (
      <ErrorState
        message="No attendance analytics available yet."
        onRetry={() => window.location.reload()}
      />
    );
  }

  // Calculate aggregate stats
  const totalSessions = analytics.courseSummaries.reduce((sum, c) => sum + c.totalSessions, 0);
  const totalAttended = analytics.courseSummaries.reduce((sum, c) => sum + c.attended, 0);
  const totalAbsent = analytics.courseSummaries.reduce((sum, c) => sum + c.absent, 0);
  const coursesAtRisk = analytics.courseSummaries.filter(c => c.attendancePercentage < 75).length;
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const barChartData = analytics.courseSummaries.map(c => ({
    courseCode: c.courseCode,
    courseName: c.courseName,
    percentage: c.attendancePercentage,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.firstName}!
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Here&apos;s your attendance overview for this semester
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Status:</span>
          <Badge
            variant={analytics.riskLevel === "low" ? "success" : analytics.riskLevel === "medium" ? "warning" : "danger"}
            dot
          >
            {analytics.riskLevel === "low" ? "On Track" : analytics.riskLevel === "medium" ? "At Risk" : "Critical"}
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Overall Attendance"
          value={`${analytics.overallPercentage.toFixed(1)}%`}
          subtitle={analytics.overallPercentage >= 75 ? "Above target" : "Below 75% target"}
          icon={<GraduationCap className="w-6 h-6" />}
          variant={analytics.overallPercentage >= 75 ? "success" : "danger"}
          trend={analytics.overallPercentage >= 75 ? { value: 5, isPositive: true } : undefined}
        />
        <StatCard
          title="Sessions Attended"
          value={totalAttended}
          subtitle={`of ${totalSessions} total sessions`}
          icon={<CheckCircle className="w-6 h-6" />}
          variant="success"
        />
        <StatCard
          title="Registered Courses"
          value={analytics.courseSummaries.length}
          subtitle={coursesAtRisk > 0 ? `${coursesAtRisk} at risk` : "All on track"}
          icon={<BookOpen className="w-6 h-6" />}
          variant={coursesAtRisk > 0 ? "warning" : "default"}
        />
        <StatCard
          title="Absences"
          value={totalAbsent}
          icon={<AlertTriangle className="w-6 h-6" />}
          variant={totalAbsent > 5 ? "danger" : "warning"}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts Section - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Attendance Trend Chart */}
          <Card>
            <CardHeader
              title="Attendance Trends"
              subtitle="Your weekly attendance performance"
              action={
                <select className="text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              }
            />
            <AttendanceLineChart data={analytics.weeklyTrends} />
          </Card>

          {/* Course Attendance Bar Chart */}
          <Card>
            <CardHeader
              title="Attendance by Course"
              subtitle="Performance across all registered courses"
            />
            <AttendanceBarChart data={barChartData} height={250} />
          </Card>

          {/* Course Cards */}
          <Card>
            <CardHeader
              title="My Courses"
              subtitle="Detailed attendance for each course"
              action={
                <Link href="/student/courses" className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium">
                  View All
                </Link>
              }
            />
            <CourseList courses={analytics.courseSummaries} />
          </Card>
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-6">
          {/* Attendance Distribution */}
          <Card>
            <CardHeader
              title="Attendance Distribution"
              subtitle="Overall breakdown"
            />
            <AttendancePieChart
              present={totalAttended}
              absent={totalAbsent}
              height={280}
            />
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader
              title="Notifications"
              subtitle="Recent alerts and updates"
              action={
                unreadCount > 0 ? (
                  <Badge variant="danger" size="sm">
                    {unreadCount} new
                  </Badge>
                ) : undefined
              }
            />
            <div className="space-y-2">
              {notifications.slice(0, 4).map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg transition-colors",
                    notif.isRead
                      ? "bg-gray-50 dark:bg-gray-800/50"
                      : "bg-primary-50 dark:bg-primary-950/30 border border-primary-100 dark:border-primary-900"
                  )}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {NOTIFICATION_ICONS[notif.type] ?? NOTIFICATION_ICONS.system}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium truncate",
                      notif.isRead ? "text-gray-700 dark:text-gray-300" : "text-gray-900 dark:text-white"
                    )}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                      {notif.message}
                    </p>
                  </div>
                  {!notif.isRead && (
                    <span className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-primary-500" />
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader title="Quick Actions" />
            <div className="space-y-1">
              <Link
                href="/student/timetable"
                className="w-full flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">View Timetable</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </Link>
              <button className="w-full flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Download Report</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
