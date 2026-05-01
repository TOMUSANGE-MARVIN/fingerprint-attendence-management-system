"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Card,
  CardHeader,
  Badge,
  Table,
  TableColumn,
  PageLoading,
  ErrorState,
  Input,
} from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { Search, Calendar, Fingerprint, UserCheck, Clock } from "lucide-react";

interface AttendanceHistoryRecord {
  id: string;
  date: string;
  courseCode: string;
  courseName: string;
  status: "present" | "absent";
  checkInTime?: string;
  verificationMethod: "fingerprint" | "manual";
}

interface AttendanceRecordApi {
  id: string;
  status: "present" | "absent";
  verificationMethod?: "fingerprint" | "manual" | "qr_code" | "facial" | null;
  markedAt?: string | null;
  createdAt?: string;
  sessionDate?: string;
  courseCode?: string;
  courseName?: string;
}

const STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "default"> = {
  present: "success",
  absent: "danger",
  excused: "default",
};

export default function StudentAttendancePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "present" | "absent">("all");

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        setError(null);
        const response = await apiClient.get<{ results?: AttendanceRecordApi[] } | AttendanceRecordApi[]>(
          API_ENDPOINTS.attendance.recordsList
        );
        const data = Array.isArray(response.data) ? response.data : response.data.results ?? [];
        const mapped = data.map((record) => ({
          id: record.id,
          date: record.sessionDate || record.createdAt || "",
          courseCode: record.courseCode || "—",
          courseName: record.courseName || "—",
          status: record.status as "present" | "absent",
          checkInTime: record.markedAt
            ? new Date(record.markedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
            : undefined,
          verificationMethod: (record.verificationMethod === "fingerprint" ? "fingerprint" : "manual") as "fingerprint" | "manual",
        }));
        mapped.sort((a, b) => {
          const timeB = new Date(b.date).getTime() || 0;
          const timeA = new Date(a.date).getTime() || 0;
          return timeB - timeA;
        });
        setRecords(mapped);
      } catch (err) {
        console.error("Attendance history fetch error:", err);
        setError("Failed to load attendance history. Please try again.");
        setRecords([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [user]);

  const filtered = records.filter((r) => {
    const matchesSearch =
      r.courseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.courseName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "all" || r.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-GB", { dateStyle: "medium" });
  };

  const columns: TableColumn<AttendanceHistoryRecord>[] = [
    {
      key: "date",
      header: "Date",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-gray-900 dark:text-gray-100">{formatDate(r.date)}</span>
        </div>
      ),
    },
    {
      key: "course",
      header: "Course",
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">{r.courseCode}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{r.courseName}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (r) => (
        <Badge variant={STATUS_VARIANT[r.status]} dot>
          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: "checkIn",
      header: "Check-in",
      align: "center",
      render: (r) => (
        <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400">
          {r.checkInTime ? (
            <>
              <Clock className="w-4 h-4 text-gray-400" />
              {r.checkInTime}
            </>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>
      ),
    },
    {
      key: "method",
      header: "Verification",
      align: "center",
      render: (r) => (
        <div className="flex items-center justify-center gap-1">
          {r.verificationMethod === "fingerprint" ? (
            <>
              <Fingerprint className="w-4 h-4 text-success-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Biometric</span>
            </>
          ) : (
            <>
              <UserCheck className="w-4 h-4 text-primary-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Manual</span>
            </>
          )}
        </div>
      ),
    },
  ];

  if (isLoading) return <PageLoading message="Loading attendance history..." />;

  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  const presentCount = records.filter((r) => r.status === "present").length;
  const absentCount = records.filter((r) => r.status === "absent").length;
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance History</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Your complete attendance record across all courses
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-success-600">{presentCount}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Present</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-danger-600">{absentCount}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Absent</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Attendance Records"
          subtitle={`${filtered.length} records`}
          action={
            <div className="flex items-center gap-3">
              <div className="w-48">
                <Input
                  placeholder="Search courses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
              </select>
            </div>
          }
        />
        <Table
          columns={columns}
          data={filtered}
          keyExtractor={(r) => r.id}
          emptyMessage="No attendance records found"
        />
      </Card>
    </div>
  );
}
