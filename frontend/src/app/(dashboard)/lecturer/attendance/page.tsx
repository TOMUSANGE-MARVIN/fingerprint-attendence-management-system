"use client";

/**
 * Lecturer Take Attendance Page
 * Allows lecturers to manage active attendance sessions
 * Displays real-time attendance records during a session
 */

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
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
  EmptyState,
  Modal,
  Input,
} from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import {
  Course,
  AttendanceSession,
  AttendanceRecord,
} from "@/types";
import {
  Play,
  Square,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  UserCheck,
  Search,
  RefreshCw,
  Fingerprint,
} from "lucide-react";
import { formatTime } from "@/lib/utils";

export default function LecturerAttendancePage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        // In a real app, fetch lecturer's courses and any active session
        // const response = await apiClient.get(API_ENDPOINTS.lecturers.courses(user.id));
        
        // Demo data
        setCourses([
          { id: 1, code: "CS301", name: "Database Systems", description: "", creditUnits: 3, department: "Computer Science", semester: "Fall", academicYear: "2025/2026", lecturer: { id: "1", firstName: "John", lastName: "Doe" }, enrolledStudents: 45 },
          { id: 2, code: "CS302", name: "Software Engineering", description: "", creditUnits: 4, department: "Computer Science", semester: "Fall", academicYear: "2025/2026", lecturer: { id: "1", firstName: "John", lastName: "Doe" }, enrolledStudents: 52 },
        ]);

        // Demo active session
        setActiveSession({
          id: 1,
          course: { id: 1, code: "CS301", name: "Database Systems" },
          date: "2026-02-08",
          startTime: "09:00",
          isActive: true,
          totalPresent: 32,
          totalAbsent: 13,
          totalLate: 2,
          createdBy: { id: "1", firstName: "John", lastName: "Doe" },
        });

        // Demo attendance records
        setAttendanceRecords([
          { id: 1, sessionId: 1, student: { id: "1", firstName: "Alice", lastName: "Johnson", studentId: "STU001" }, status: "present", checkInTime: "09:02", verificationMethod: "fingerprint" },
          { id: 2, sessionId: 1, student: { id: "2", firstName: "Bob", lastName: "Smith", studentId: "STU002" }, status: "present", checkInTime: "09:05", verificationMethod: "fingerprint" },
          { id: 3, sessionId: 1, student: { id: "3", firstName: "Carol", lastName: "Williams", studentId: "STU003" }, status: "late", checkInTime: "09:15", verificationMethod: "fingerprint" },
          { id: 4, sessionId: 1, student: { id: "4", firstName: "David", lastName: "Brown", studentId: "STU004" }, status: "present", checkInTime: "09:01", verificationMethod: "fingerprint" },
          { id: 5, sessionId: 1, student: { id: "5", firstName: "Emma", lastName: "Davis", studentId: "STU005" }, status: "absent", verificationMethod: "manual" },
        ]);
      } catch (err) {
        setError("Failed to load attendance data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleStartSession = async () => {
    if (!selectedCourse) return;

    setIsProcessing(true);
    try {
      const response = await apiClient.post<AttendanceSession>(
        API_ENDPOINTS.attendance.startSession,
        { courseId: selectedCourse.id }
      );
      setActiveSession(response.data);
      setIsStartModalOpen(false);
    } catch (err) {
      console.error("Failed to start session:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;

    setIsProcessing(true);
    try {
      await apiClient.post(API_ENDPOINTS.attendance.endSession(activeSession.id));
      setActiveSession(null);
      setAttendanceRecords([]);
    } catch (err) {
      console.error("Failed to end session:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualMark = async (studentId: string, status: "present" | "absent" | "late") => {
    setIsProcessing(true);
    try {
      await apiClient.post(API_ENDPOINTS.attendance.markAttendance, {
        sessionId: activeSession?.id,
        studentId,
        status,
        verificationMethod: "manual",
      });
      // Refresh records
      // In real app, refetch attendance records
    } catch (err) {
      console.error("Failed to mark attendance:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter records based on search
  const filteredRecords = attendanceRecords.filter((record) =>
    `${record.student.firstName} ${record.student.lastName} ${record.student.studentId}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  // Table columns for attendance records
  const recordColumns: TableColumn<AttendanceRecord>[] = [
    {
      key: "student",
      header: "Student",
      render: (record) => (
        <div className="flex items-center gap-3">
          <Avatar
            firstName={record.student.firstName}
            lastName={record.student.lastName}
            size="sm"
          />
          <div>
            <p className="font-medium text-gray-900">
              {record.student.firstName} {record.student.lastName}
            </p>
            <p className="text-sm text-gray-500">{record.student.studentId}</p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (record) => (
        <Badge
          variant={
            record.status === "present"
              ? "success"
              : record.status === "late"
              ? "warning"
              : "danger"
          }
          dot
        >
          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: "checkInTime",
      header: "Check-in Time",
      align: "center",
      render: (record) => (
        <span className="text-gray-600">
          {record.checkInTime ? formatTime(record.checkInTime) : "-"}
        </span>
      ),
    },
    {
      key: "verification",
      header: "Verification",
      align: "center",
      render: (record) => (
        <div className="flex items-center justify-center gap-2">
          {record.verificationMethod === "fingerprint" ? (
            <>
              <Fingerprint className="w-4 h-4 text-success-600" />
              <span className="text-sm text-gray-600">Biometric</span>
            </>
          ) : (
            <>
              <UserCheck className="w-4 h-4 text-primary-600" />
              <span className="text-sm text-gray-600">Manual</span>
            </>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (record) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant={record.status === "present" ? "primary" : "outline"}
            onClick={() => handleManualMark(record.student.id, "present")}
            disabled={isProcessing}
          >
            <CheckCircle className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant={record.status === "absent" ? "danger" : "outline"}
            onClick={() => handleManualMark(record.student.id, "absent")}
            disabled={isProcessing}
          >
            <XCircle className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return <PageLoading message="Loading attendance..." />;
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Take Attendance</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Start a session and track student attendance in real-time
          </p>
        </div>
        {!activeSession ? (
          <Button
            leftIcon={<Play className="w-4 h-4" />}
            onClick={() => setIsStartModalOpen(true)}
          >
            Start New Session
          </Button>
        ) : (
          <Button
            variant="danger"
            leftIcon={<Square className="w-4 h-4" />}
            onClick={handleEndSession}
            isLoading={isProcessing}
          >
            End Session
          </Button>
        )}
      </div>

      {/* Active Session Card */}
      {activeSession ? (
        <>
          <Card className="border-l-4 border-l-success-500 bg-gradient-to-r from-success-50 to-white dark:from-green-950/30 dark:to-transparent">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-success-100 rounded-full">
                  <Clock className="w-8 h-8 text-success-600 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900">
                      {activeSession.course.code}
                    </h2>
                    <Badge variant="success" dot>Live</Badge>
                  </div>
                  <p className="text-gray-600">{activeSession.course.name}</p>
                  <p className="text-sm text-gray-500">
                    Started at {formatTime(activeSession.startTime)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-success-600">
                    {activeSession.totalPresent}
                  </p>
                  <p className="text-sm text-gray-500">Present</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-warning-600">
                    {activeSession.totalLate}
                  </p>
                  <p className="text-sm text-gray-500">Late</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-danger-600">
                    {activeSession.totalAbsent}
                  </p>
                  <p className="text-sm text-gray-500">Absent</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Fingerprint Scanner Status */}
          <Card className="bg-primary-50 dark:bg-primary-950/30 border-primary-200 dark:border-primary-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Fingerprint className="w-8 h-8 text-primary-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Fingerprint Scanner Ready</h3>
                  <p className="text-sm text-gray-600">
                    Students can verify attendance using biometric authentication
                  </p>
                </div>
              </div>
              <Badge variant="success" dot>Connected</Badge>
            </div>
          </Card>

          {/* Attendance Records */}
          <Card>
            <CardHeader
              title="Attendance Records"
              subtitle={`${filteredRecords.length} students`}
              action={
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<RefreshCw className="w-4 h-4" />}
                  >
                    Refresh
                  </Button>
                </div>
              }
            />
            <Table
              columns={recordColumns}
              data={filteredRecords}
              keyExtractor={(record) => record.id}
            />
          </Card>
        </>
      ) : (
        <Card>
          <EmptyState
            icon={<Users className="w-16 h-16 text-gray-300" />}
            title="No Active Session"
            description="Start a new attendance session to begin tracking student attendance"
            action={
              <Button
                leftIcon={<Play className="w-4 h-4" />}
                onClick={() => setIsStartModalOpen(true)}
              >
                Start Session
              </Button>
            }
          />
        </Card>
      )}

      {/* Start Session Modal */}
      <Modal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        title="Start Attendance Session"
        description="Select a course to begin attendance tracking"
      >
        <div className="space-y-4">
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
                <div className="p-2 bg-primary-50 rounded-lg">
                  <Users className="w-5 h-5 text-primary-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">{course.code}</p>
                  <p className="text-sm text-gray-500">{course.name}</p>
                </div>
              </div>
              <Badge variant="default">{course.enrolledStudents} students</Badge>
            </button>
          ))}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setIsStartModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartSession}
              disabled={!selectedCourse}
              isLoading={isProcessing}
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
