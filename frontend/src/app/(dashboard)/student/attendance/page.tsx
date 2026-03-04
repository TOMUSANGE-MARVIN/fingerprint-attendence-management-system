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
  Input,
} from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { Search, Calendar, Fingerprint, UserCheck, Clock } from "lucide-react";

interface AttendanceHistoryRecord {
  id: number;
  date: string;
  courseCode: string;
  courseName: string;
  status: "present" | "absent" | "late" | "excused";
  checkInTime?: string;
  verificationMethod: "fingerprint" | "manual";
}

const DEMO_HISTORY: AttendanceHistoryRecord[] = [
  { id: 1, date: "2026-02-21", courseCode: "CS301", courseName: "Database Systems", status: "present", checkInTime: "09:02", verificationMethod: "fingerprint" },
  { id: 2, date: "2026-02-21", courseCode: "CS302", courseName: "Software Engineering", status: "late", checkInTime: "11:15", verificationMethod: "fingerprint" },
  { id: 3, date: "2026-02-20", courseCode: "CS303", courseName: "Computer Networks", status: "absent", verificationMethod: "manual" },
  { id: 4, date: "2026-02-20", courseCode: "CS304", courseName: "Artificial Intelligence", status: "present", checkInTime: "14:00", verificationMethod: "fingerprint" },
  { id: 5, date: "2026-02-19", courseCode: "CS301", courseName: "Database Systems", status: "present", checkInTime: "09:01", verificationMethod: "fingerprint" },
  { id: 6, date: "2026-02-19", courseCode: "CS305", courseName: "Operating Systems", status: "present", checkInTime: "08:00", verificationMethod: "fingerprint" },
  { id: 7, date: "2026-02-18", courseCode: "CS302", courseName: "Software Engineering", status: "present", checkInTime: "11:02", verificationMethod: "fingerprint" },
  { id: 8, date: "2026-02-18", courseCode: "CS303", courseName: "Computer Networks", status: "absent", verificationMethod: "manual" },
  { id: 9, date: "2026-02-17", courseCode: "CS304", courseName: "Artificial Intelligence", status: "present", checkInTime: "14:03", verificationMethod: "fingerprint" },
  { id: 10, date: "2026-02-17", courseCode: "CS306", courseName: "Web Development", status: "late", checkInTime: "16:20", verificationMethod: "manual" },
];

const STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "default"> = {
  present: "success",
  absent: "danger",
  late: "warning",
  excused: "default",
};

export default function StudentAttendancePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "present" | "absent" | "late">("all");

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      try {
        const response = await apiClient.get<AttendanceHistoryRecord[]>(
          API_ENDPOINTS.students.attendance(user.id)
        );
        setRecords(response.data);
      } catch {
        setRecords(DEMO_HISTORY);
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

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-GB", { dateStyle: "medium" });

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

  const presentCount = records.filter((r) => r.status === "present").length;
  const absentCount = records.filter((r) => r.status === "absent").length;
  const lateCount = records.filter((r) => r.status === "late").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance History</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Your complete attendance record across all courses
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-success-600">{presentCount}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Present</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-danger-600">{absentCount}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Absent</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-warning-600">{lateCount}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Late</p>
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
                <option value="late">Late</option>
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
