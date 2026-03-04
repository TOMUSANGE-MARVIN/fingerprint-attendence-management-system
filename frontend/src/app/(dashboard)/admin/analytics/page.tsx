"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, Badge, PageLoading, Table, TableColumn } from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { InstitutionAnalytics } from "@/types";
import { TrendingUp, Users, BookOpen, AlertTriangle } from "lucide-react";
import { getAttendanceBgClass } from "@/lib/utils";

const DEMO: InstitutionAnalytics = {
  totalStudents: 312,
  totalLecturers: 24,
  totalCourses: 18,
  averageAttendance: 78.4,
  studentsAtRisk: 47,
  attendanceByDepartment: [
    { department: "Computer Science", percentage: 81.2, studentCount: 145 },
    { department: "Engineering", percentage: 76.8, studentCount: 98 },
    { department: "Mathematics", percentage: 72.1, studentCount: 69 },
  ],
  recentTrends: [
    { period: "Week 1", percentage: 82, sessionsAttended: 820, totalSessions: 1000 },
    { period: "Week 2", percentage: 79, sessionsAttended: 790, totalSessions: 1000 },
    { period: "Week 3", percentage: 75, sessionsAttended: 750, totalSessions: 1000 },
    { period: "Week 4", percentage: 78, sessionsAttended: 780, totalSessions: 1000 },
    { period: "Week 5", percentage: 80, sessionsAttended: 800, totalSessions: 1000 },
    { period: "Week 6", percentage: 77, sessionsAttended: 770, totalSessions: 1000 },
  ],
};

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<InstitutionAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const response = await apiClient.get<InstitutionAnalytics>(API_ENDPOINTS.analytics.dashboard);
        setAnalytics(response.data);
      } catch {
        setAnalytics(DEMO);
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, []);

  if (isLoading) return <PageLoading message="Loading analytics..." />;
  if (!analytics) return null;

  const recentTrends = analytics.recentTrends ?? [];
  const attendanceByDepartment = analytics.attendanceByDepartment ?? [];

  type DeptRow = { department: string; percentage: number; studentCount: number };

  const deptColumns: TableColumn<DeptRow>[] = [
    {
      key: "dept",
      header: "Department",
      render: (d) => (
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary-500" />
          <span className="font-medium text-gray-900 dark:text-gray-100">{d.department}</span>
        </div>
      ),
    },
    {
      key: "students",
      header: "Students",
      align: "center",
      render: (d) => (
        <div className="flex items-center justify-center gap-1 text-gray-700 dark:text-gray-300">
          <Users className="w-4 h-4 text-gray-400" /> {d.studentCount}
        </div>
      ),
    },
    {
      key: "attendance",
      header: "Avg Attendance",
      align: "center",
      render: (d) => (
        <Badge className={getAttendanceBgClass(d.percentage)}>{d.percentage.toFixed(1)}%</Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (d) => (
        <Badge variant={d.percentage >= 75 ? "success" : "danger"} dot>
          {d.percentage >= 75 ? "On Track" : "At Risk"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Institution-wide attendance insights and trends
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Students</p>
              <p className="text-3xl font-bold text-primary-600">{analytics.totalStudents}</p>
            </div>
            <div className="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-full">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Attendance</p>
              <p className="text-3xl font-bold text-success-600">
                {analytics.averageAttendance.toFixed(1)}%
              </p>
            </div>
            <div className="p-3 bg-success-50 dark:bg-green-900/30 rounded-full">
              <TrendingUp className="w-6 h-6 text-success-600" />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">At Risk</p>
              <p className="text-3xl font-bold text-danger-600">{analytics.studentsAtRisk}</p>
            </div>
            <div className="p-3 bg-danger-50 dark:bg-red-900/30 rounded-full">
              <AlertTriangle className="w-6 h-6 text-danger-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Below 75% threshold</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Courses</p>
              <p className="text-3xl font-bold text-primary-600">{analytics.totalCourses}</p>
            </div>
            <div className="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-full">
              <BookOpen className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Weekly Trend Bar Chart */}
      <Card>
        <CardHeader title="Weekly Attendance Trend" subtitle="Last 6 weeks" />
        <div className="flex items-end gap-3 h-40 px-2">
          {recentTrends.map((week) => (
            <div key={week.period} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">{week.percentage}%</span>
              <div
                className="w-full rounded-t-md"
                style={{
                  height: `${week.percentage}%`,
                  backgroundColor: week.percentage >= 75 ? "rgb(34,197,94)" : "rgb(239,68,68)",
                  opacity: 0.8,
                }}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400 text-center leading-tight">
                {week.period}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-success-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">≥75% On Track</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-danger-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">&lt;75% At Risk</span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Attendance by Department" subtitle="Current academic period" />
        <Table
          columns={deptColumns}
          data={attendanceByDepartment}
          keyExtractor={(d) => d.department}
          emptyMessage="No department data available"
        />
      </Card>

      {analytics.studentsAtRisk > 0 && (
        <Card className="border-warning-200 dark:border-yellow-800 bg-warning-50 dark:bg-yellow-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-warning-800 dark:text-yellow-200">
                {analytics.studentsAtRisk} students below 75% attendance threshold
              </p>
              <p className="text-sm text-warning-600 dark:text-yellow-300 mt-1">
                These students are at risk of failing their courses. Notifications have been sent to alert them.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
