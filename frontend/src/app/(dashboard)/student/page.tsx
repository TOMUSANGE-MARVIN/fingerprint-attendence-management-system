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
import { cn, getAttendanceBgClass } from "@/lib/utils";
import Link from "next/link";

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  upcoming_lecture: <Clock className="w-4 h-4 text-primary-600 dark:text-primary-400" />,
  missed_lecture: <AlertTriangle className="w-4 h-4 text-danger-600 dark:text-danger-400" />,
  attendance: <CheckCircle className="w-4 h-4 text-success-600 dark:text-success-400" />,
  alert: <AlertTriangle className="w-4 h-4 text-warning-600 dark:text-warning-400" />,
  fingerprint: <Fingerprint className="w-4 h-4 text-primary-600 dark:text-primary-400" />,
  system: <Bell className="w-4 h-4 text-gray-500 dark:text-gray-400" />,
};

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
        const [analyticsRes, notifRes] = await Promise.allSettled([
          apiClient.get<AttendanceAnalytics>(API_ENDPOINTS.students.analytics(user.id)),
          apiClient.get<{ results: Notification[] }>(API_ENDPOINTS.auth.notifications),
        ]);

        if (analyticsRes.status === "fulfilled") {
          setAnalytics(analyticsRes.value.data);
        }
        if (notifRes.status === "fulfilled") {
          setNotifications((notifRes.value.data as any).results ?? notifRes.value.data as any);
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

  // Demo data for visualization
  const demoAnalytics: AttendanceAnalytics = analytics || {
    overallPercentage: 82.5,
    riskLevel: "low",
    weeklyTrends: [
      { period: "Week 1", percentage: 85, sessionsAttended: 17, totalSessions: 20 },
      { period: "Week 2", percentage: 80, sessionsAttended: 16, totalSessions: 20 },
      { period: "Week 3", percentage: 90, sessionsAttended: 18, totalSessions: 20 },
      { period: "Week 4", percentage: 75, sessionsAttended: 15, totalSessions: 20 },
      { period: "Week 5", percentage: 85, sessionsAttended: 17, totalSessions: 20 },
      { period: "Week 6", percentage: 80, sessionsAttended: 16, totalSessions: 20 },
    ],
    monthlyTrends: [
      { period: "Sep", percentage: 88, sessionsAttended: 44, totalSessions: 50 },
      { period: "Oct", percentage: 82, sessionsAttended: 41, totalSessions: 50 },
      { period: "Nov", percentage: 79, sessionsAttended: 39, totalSessions: 50 },
      { period: "Dec", percentage: 85, sessionsAttended: 34, totalSessions: 40 },
    ],
    courseSummaries: [
      { courseId: 1, courseCode: "CS301", courseName: "Database Systems", totalSessions: 24, attended: 22, absent: 2, late: 0, excused: 0, attendancePercentage: 91.7 },
      { courseId: 2, courseCode: "CS302", courseName: "Software Engineering", totalSessions: 24, attended: 20, absent: 3, late: 1, excused: 0, attendancePercentage: 83.3 },
      { courseId: 3, courseCode: "CS303", courseName: "Computer Networks", totalSessions: 24, attended: 16, absent: 6, late: 2, excused: 0, attendancePercentage: 66.7 },
      { courseId: 4, courseCode: "CS304", courseName: "Artificial Intelligence", totalSessions: 24, attended: 21, absent: 2, late: 1, excused: 0, attendancePercentage: 87.5 },
    ],
  };

  const demoNotifications: Notification[] = notifications.length > 0 ? notifications : [
    { id: 1, type: "alert", title: "CS303 Attendance Warning", message: "Your attendance in Computer Networks is 66.7%, below the 75% requirement.", isRead: false, createdAt: "2026-02-21T10:00:00Z" },
    { id: 2, type: "attendance", title: "Attendance Confirmed", message: "Your attendance for CS301 Database Systems (09:00 session) was recorded.", isRead: false, createdAt: "2026-02-21T09:05:00Z" },
    { id: 3, type: "upcoming_lecture", title: "Upcoming Lecture", message: "CS302 Software Engineering starts in 15 minutes in Lab A.", isRead: true, createdAt: "2026-02-21T08:45:00Z" },
    { id: 4, type: "missed_lecture", title: "Missed Lecture", message: "You were marked absent for CS303 Computer Networks on 20 Feb.", isRead: true, createdAt: "2026-02-20T12:00:00Z" },
  ];

  // Calculate aggregate stats
  const totalSessions = demoAnalytics.courseSummaries.reduce((sum, c) => sum + c.totalSessions, 0);
  const totalAttended = demoAnalytics.courseSummaries.reduce((sum, c) => sum + c.attended, 0);
  const totalAbsent = demoAnalytics.courseSummaries.reduce((sum, c) => sum + c.absent, 0);
  const totalLate = demoAnalytics.courseSummaries.reduce((sum, c) => sum + c.late, 0);
  const coursesAtRisk = demoAnalytics.courseSummaries.filter(c => c.attendancePercentage < 75).length;
  const unreadCount = demoNotifications.filter(n => !n.isRead).length;

  const barChartData = demoAnalytics.courseSummaries.map(c => ({
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
            variant={demoAnalytics.riskLevel === "low" ? "success" : demoAnalytics.riskLevel === "medium" ? "warning" : "danger"}
            dot
          >
            {demoAnalytics.riskLevel === "low" ? "On Track" : demoAnalytics.riskLevel === "medium" ? "At Risk" : "Critical"}
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Overall Attendance"
          value={`${demoAnalytics.overallPercentage.toFixed(1)}%`}
          subtitle={demoAnalytics.overallPercentage >= 75 ? "Above target" : "Below 75% target"}
          icon={<GraduationCap className="w-6 h-6" />}
          variant={demoAnalytics.overallPercentage >= 75 ? "success" : "danger"}
          trend={demoAnalytics.overallPercentage >= 75 ? { value: 5, isPositive: true } : undefined}
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
          value={demoAnalytics.courseSummaries.length}
          subtitle={coursesAtRisk > 0 ? `${coursesAtRisk} at risk` : "All on track"}
          icon={<BookOpen className="w-6 h-6" />}
          variant={coursesAtRisk > 0 ? "warning" : "default"}
        />
        <StatCard
          title="Absences"
          value={totalAbsent}
          subtitle={`${totalLate} late arrivals`}
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
            <AttendanceLineChart data={demoAnalytics.weeklyTrends} />
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
            <CourseList courses={demoAnalytics.courseSummaries} />
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
              late={totalLate}
              excused={0}
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
              {demoNotifications.slice(0, 4).map((notif) => (
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
