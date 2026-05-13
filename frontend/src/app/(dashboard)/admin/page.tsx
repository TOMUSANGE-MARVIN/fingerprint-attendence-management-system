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
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "logs">("overview");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem("access_token");
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
      const res = await fetch(`${baseUrl}${API_ENDPOINTS.analytics.export}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      a.download = match ? match[1] : "attendance_report.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch all data in parallel
        const [analyticsRes, usersRes, logsRes] = await Promise.all([
          apiClient.get<InstitutionAnalytics>(API_ENDPOINTS.analytics.dashboard),
          apiClient.get<{ results?: User[] } | User[]>(API_ENDPOINTS.admin.users),
          apiClient.get<{ results?: AuditLog[] } | AuditLog[]>(API_ENDPOINTS.admin.auditLogs),
        ]);
        
        setAnalytics(analyticsRes.data);
        
        // Handle paginated or non-paginated response
        const usersData = usersRes.data;
        setRecentUsers(
          Array.isArray(usersData) ? usersData.slice(0, 10) : 
          (usersData.results || []).slice(0, 10)
        );
        
        const logsData = logsRes.data;
        setAuditLogs(
          Array.isArray(logsData) ? logsData.slice(0, 10) : 
          (logsData.results || []).slice(0, 10)
        );
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setError("Failed to load some dashboard data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Demo data for visualization (fallback when API fails or returns empty)
  const demoAnalytics: InstitutionAnalytics = analytics || {
    totalStudents: 0,
    totalLecturers: 0,
    totalCourses: 0,
    averageAttendance: 0,
    studentsAtRisk: 0,
    attendanceByDepartment: [],
    recentTrends: [],
  };

  // Use live data, fallback to empty if not available
  const displayUsers: User[] = recentUsers.length > 0 ? recentUsers : [];
  const displayLogs: AuditLog[] = auditLogs.length > 0 ? auditLogs : [];

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
      render: (log) => {
        const timestamp = log.createdAt || log.timestamp || "";
        return (
          <div>
            <p className="text-gray-900">{formatDate(timestamp)}</p>
            <p className="text-sm text-gray-500">
              {timestamp ? formatTime(timestamp.split("T")[1]?.substring(0, 5) || "") : "-"}
            </p>
          </div>
        );
      },
    },
    {
      key: "user",
      header: "User",
      render: (log) => <span className="font-medium text-gray-900">{log.userName || log.userEmail || "Unknown"}</span>,
    },
    {
      key: "action",
      header: "Action",
      render: (log) => (
        <Badge
          variant={
            log.action.includes("CREATE") || log.action.includes("START") || log.action.includes("LOGIN")
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
      render: (log) => <span className="text-gray-600">{log.entityType || log.resource || "-"}</span>,
    },
    {
      key: "details",
      header: "Details",
      render: (log) => (
        <span className="text-gray-500 text-sm">{log.description || log.details || "-"}</span>
      ),
    },
    {
      key: "ipAddress",
      header: "IP Address",
      render: (log) => (
        <span className="font-mono text-sm text-gray-500">{log.ipAddress || "-"}</span>
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
          <Button variant="outline" leftIcon={<Download className="w-4 h-4" />} onClick={handleExport} isLoading={isExporting}>
            {isExporting ? "Exporting…" : "Export Report"}
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
              subtitle="Compare performance across departments"
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
            data={displayUsers}
            keyExtractor={(user) => user.id}
            emptyMessage="No users found"
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
                <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />} onClick={handleExport} isLoading={isExporting}>
                  Export
                </Button>
              </div>
            }
          />
          <Table
            columns={auditColumns}
            data={displayLogs}
            keyExtractor={(log) => log.id}
            emptyMessage="No audit logs found"
          />
        </Card>
      )}
    </div>
  );
}
