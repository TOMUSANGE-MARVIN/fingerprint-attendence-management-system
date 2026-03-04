"use client";

/**
 * Administrator Dashboard Page
 * Main dashboard for admin users
 * Displays institution-wide analytics, user management, and system overview
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
  Avatar,
} from "@/components/ui";
import { AttendanceLineChart, InstitutionChart } from "@/components/charts";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import {
  InstitutionAnalytics,
  AuditLog,
  User,
} from "@/types";
import {
  Users,
  GraduationCap,
  UserCog,
  BookOpen,
  AlertTriangle,
  TrendingUp,
  Shield,
  Plus,
  Download,
  Filter,
  Search,
  Activity,
} from "lucide-react";
import { formatDate, formatTime, getAttendanceBgClass } from "@/lib/utils";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<InstitutionAnalytics | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "logs">("overview");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await apiClient.get<InstitutionAnalytics>(
          API_ENDPOINTS.admin.analytics
        );
        setAnalytics(response.data);
      } catch (err) {
        // Fall through to demo data — backend may not be running
        console.warn("Dashboard fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Demo data for visualization
  const demoAnalytics: InstitutionAnalytics = analytics || {
    totalStudents: 1245,
    totalLecturers: 48,
    totalCourses: 86,
    averageAttendance: 81.5,
    studentsAtRisk: 156,
    attendanceByDepartment: [
      { department: "Computer Science", percentage: 85.2, studentCount: 320 },
      { department: "Engineering", percentage: 78.5, studentCount: 280 },
      { department: "Business", percentage: 82.1, studentCount: 245 },
      { department: "Medicine", percentage: 91.3, studentCount: 180 },
      { department: "Law", percentage: 79.8, studentCount: 120 },
      { department: "Arts", percentage: 76.4, studentCount: 100 },
    ],
    recentTrends: [
      { period: "Week 1", percentage: 84, sessionsAttended: 4200, totalSessions: 5000 },
      { period: "Week 2", percentage: 81, sessionsAttended: 4050, totalSessions: 5000 },
      { period: "Week 3", percentage: 83, sessionsAttended: 4150, totalSessions: 5000 },
      { period: "Week 4", percentage: 79, sessionsAttended: 3950, totalSessions: 5000 },
      { period: "Week 5", percentage: 82, sessionsAttended: 4100, totalSessions: 5000 },
      { period: "Week 6", percentage: 80, sessionsAttended: 4000, totalSessions: 5000 },
    ],
  };

  const demoRecentUsers: User[] = [
    { id: "1", email: "john.student@university.edu", firstName: "John", lastName: "Doe", role: "student" as const, studentId: "STU001", isActive: true, createdAt: "2026-02-08T10:30:00Z" },
    { id: "2", email: "jane.lecturer@university.edu", firstName: "Jane", lastName: "Smith", role: "lecturer" as const, staffId: "LEC001", department: "Computer Science", isActive: true, createdAt: "2026-02-07T14:20:00Z" },
    { id: "3", email: "mike.student@university.edu", firstName: "Mike", lastName: "Johnson", role: "student" as const, studentId: "STU002", isActive: true, createdAt: "2026-02-06T09:15:00Z" },
    { id: "4", email: "sarah.admin@university.edu", firstName: "Sarah", lastName: "Williams", role: "admin" as const, staffId: "ADM001", isActive: true, createdAt: "2026-02-05T11:45:00Z" },
  ];

  const demoAuditLogs: AuditLog[] = [
    { id: 1, userId: 1, userName: "John Doe", action: "LOGIN", resource: "Auth", timestamp: "2026-02-08T10:30:00Z", ipAddress: "192.168.1.100" },
    { id: 2, userId: 2, userName: "Jane Smith", action: "START_SESSION", resource: "Attendance", resourceId: 45, details: "CS301 - Database Systems", timestamp: "2026-02-08T09:00:00Z", ipAddress: "192.168.1.101" },
    { id: 3, userId: 3, userName: "Admin User", action: "CREATE", resource: "User", resourceId: 156, details: "Created new student account", timestamp: "2026-02-08T08:30:00Z", ipAddress: "192.168.1.1" },
    { id: 4, userId: 2, userName: "Jane Smith", action: "END_SESSION", resource: "Attendance", resourceId: 45, details: "45 students marked present", timestamp: "2026-02-08T10:30:00Z", ipAddress: "192.168.1.101" },
    { id: 5, userId: 4, userName: "System", action: "GENERATE_REPORT", resource: "Reports", details: "Monthly attendance report generated", timestamp: "2026-02-08T06:00:00Z", ipAddress: "127.0.0.1" },
  ];

  // Department chart data
  const departmentChartData = (demoAnalytics.attendanceByDepartment ?? []).map(d => ({
    name: d.department,
    attendance: d.percentage,
    studentCount: d.studentCount,
  }));

  // User table columns
  const userColumns: TableColumn<User>[] = [
    {
      key: "user",
      header: "User",
      render: (user) => (
        <div className="flex items-center gap-3">
          <Avatar
            firstName={user.firstName}
            lastName={user.lastName}
            size="sm"
          />
          <div>
            <p className="font-medium text-gray-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (user) => (
        <Badge
          variant={
            user.role === "admin"
              ? "danger"
              : user.role === "lecturer"
              ? "info"
              : "default"
          }
        >
          {user.role}
        </Badge>
      ),
    },
    {
      key: "id",
      header: "ID",
      render: (user) => (
        <span className="text-gray-600">
          {user.studentId || user.staffId || "-"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (user) => (
        <Badge variant={user.isActive ? "success" : "default"} dot>
          {user.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Joined",
      render: (user) => (
        <span className="text-gray-600">{formatDate(user.createdAt)}</span>
      ),
    },
  ];

  // Audit log table columns
  const auditColumns: TableColumn<AuditLog>[] = [
    {
      key: "timestamp",
      header: "Time",
      render: (log) => (
        <div>
          <p className="text-gray-900">{formatDate(log.timestamp)}</p>
          <p className="text-sm text-gray-500">
            {formatTime(log.timestamp.split("T")[1].substring(0, 5))}
          </p>
        </div>
      ),
    },
    {
      key: "user",
      header: "User",
      render: (log) => <span className="font-medium text-gray-900">{log.userName}</span>,
    },
    {
      key: "action",
      header: "Action",
      render: (log) => (
        <Badge
          variant={
            log.action.includes("CREATE") || log.action.includes("START")
              ? "success"
              : log.action.includes("DELETE")
              ? "danger"
              : "default"
          }
        >
          {log.action}
        </Badge>
      ),
    },
    {
      key: "resource",
      header: "Resource",
      render: (log) => <span className="text-gray-600">{log.resource}</span>,
    },
    {
      key: "details",
      header: "Details",
      render: (log) => (
        <span className="text-gray-500 text-sm">{log.details || "-"}</span>
      ),
    },
    {
      key: "ipAddress",
      header: "IP Address",
      render: (log) => (
        <span className="font-mono text-sm text-gray-500">{log.ipAddress}</span>
      ),
    },
  ];

  if (isLoading) {
    return <PageLoading message="Loading admin dashboard..." />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Administrator Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Institution-wide attendance overview and management
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={<Download className="w-4 h-4" />}>
            Export Report
          </Button>
          <Button leftIcon={<Plus className="w-4 h-4" />}>
            Add User
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Students"
          value={demoAnalytics.totalStudents.toLocaleString()}
          subtitle="Registered"
          icon={<GraduationCap className="w-6 h-6" />}
          variant="default"
        />
        <StatCard
          title="Total Lecturers"
          value={demoAnalytics.totalLecturers}
          subtitle="Active staff"
          icon={<UserCog className="w-6 h-6" />}
          variant="default"
        />
        <StatCard
          title="Total Courses"
          value={demoAnalytics.totalCourses}
          subtitle="This semester"
          icon={<BookOpen className="w-6 h-6" />}
          variant="default"
        />
        <StatCard
          title="Avg. Attendance"
          value={`${demoAnalytics.averageAttendance.toFixed(1)}%`}
          subtitle="Institution-wide"
          icon={<TrendingUp className="w-6 h-6" />}
          variant={demoAnalytics.averageAttendance >= 75 ? "success" : "warning"}
        />
        <StatCard
          title="Students at Risk"
          value={demoAnalytics.studentsAtRisk}
          subtitle="Below 75%"
          icon={<AlertTriangle className="w-6 h-6" />}
          variant="danger"
        />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-8">
          {[
            { id: "overview", label: "Overview", icon: Activity },
            { id: "users", label: "Recent Users", icon: Users },
            { id: "logs", label: "Audit Logs", icon: Shield },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? "border-primary-600 text-primary-600 dark:text-primary-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekly Trends */}
          <Card>
            <CardHeader
              title="Weekly Attendance Trends"
              subtitle="Institution-wide attendance over time"
            />
            <AttendanceLineChart data={demoAnalytics.recentTrends ?? []} height={300} />
          </Card>

          {/* Department Comparison */}
          <Card>
            <CardHeader
              title="Attendance by Department"
              subtitle="Compare performance across faculties"
            />
            <InstitutionChart data={departmentChartData} height={300} />
          </Card>

          {/* Department Table */}
          <Card className="lg:col-span-2">
            <CardHeader
              title="Department Performance"
              subtitle="Detailed breakdown by department"
            />
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                      Department
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                      Students
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                      Attendance
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                      Progress
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(demoAnalytics.attendanceByDepartment ?? []).map((dept, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-4 py-4">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{dept.department}</p>
                      </td>
                      <td className="px-4 py-4 text-center text-gray-600 dark:text-gray-400">
                        {dept.studentCount}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`font-semibold ${
                          dept.percentage >= 75 ? "text-success-600 dark:text-green-400" : "text-danger-600 dark:text-red-400"
                        }`}>
                          {dept.percentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              dept.percentage >= 75 ? "bg-success-500" : "bg-danger-500"
                            }`}
                            style={{ width: `${dept.percentage}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge
                          variant={dept.percentage >= 75 ? "success" : "danger"}
                          size="sm"
                        >
                          {dept.percentage >= 75 ? "On Track" : "At Risk"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "users" && (
        <Card>
          <CardHeader
            title="Recent Users"
            subtitle="Latest registered users in the system"
            action={
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    className="pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <Button variant="outline" size="sm" leftIcon={<Filter className="w-4 h-4" />}>
                  Filter
                </Button>
              </div>
            }
          />
          <Table
            columns={userColumns}
            data={demoRecentUsers}
            keyExtractor={(user) => user.id}
          />
        </Card>
      )}

      {activeTab === "logs" && (
        <Card>
          <CardHeader
            title="System Audit Logs"
            subtitle="Track all system activities for accountability"
            action={
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" leftIcon={<Filter className="w-4 h-4" />}>
                  Filter
                </Button>
                <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />}>
                  Export
                </Button>
              </div>
            }
          />
          <Table
            columns={auditColumns}
            data={demoAuditLogs}
            keyExtractor={(log) => log.id}
          />
        </Card>
      )}
    </div>
  );
}
