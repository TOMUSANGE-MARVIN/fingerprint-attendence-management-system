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
import { FingerprintCapture } from "@/components/fingerprint/FingerprintCapture";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import {
  Users,
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Calendar,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CoordinatorStudent {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  studyTime: string | null;
  fingerprintRegistered: boolean;
}

interface CohortInfo {
  id: string;
  name: string;
  programmeCode: string;
  programmeName: string;
  intakeYear: string;
  currentYearOfStudy: number | null;
  currentSemesterLabel: string | null;
  totalStudents: number;
}

interface CoordinatorResponse {
  isCoordinator: boolean;
  cohort: CohortInfo | null;
  students: CoordinatorStudent[];
  courses: unknown[];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoordinatorClassPage() {
  const [cohort, setCohort] = useState<CohortInfo | null>(null);
  const [students, setStudents] = useState<CoordinatorStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fingerprint enrollment modal
  const [fpModalOpen, setFpModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<CoordinatorStudent | null>(null);
  const [capturedTemplate, setCapturedTemplate] = useState<string | null>(null);
  const [isRegisteringFp, setIsRegisteringFp] = useState(false);
  const [fpRegistered, setFpRegistered] = useState(false);
  const [fpError, setFpError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<CoordinatorResponse>(
        API_ENDPOINTS.courses.myCoordinated
      );
      if (!res.data.isCoordinator) {
        setError("You are not assigned as coordinator for any class.");
        return;
      }
      setCohort(res.data.cohort);
      setStudents(res.data.students);
    } catch {
      setError("Failed to load class information. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openFpModal = (student: CoordinatorStudent) => {
    setSelectedStudent(student);
    setCapturedTemplate(null);
    setFpRegistered(false);
    setFpError(null);
    setFpModalOpen(true);
  };

  const closeFpModal = () => {
    setFpModalOpen(false);
    setSelectedStudent(null);
    setCapturedTemplate(null);
    setFpRegistered(false);
    setFpError(null);
  };

  const handleRegisterFingerprint = async () => {
    if (!selectedStudent || !capturedTemplate) return;
    setIsRegisteringFp(true);
    setFpError(null);
    try {
      await apiClient.post(
        API_ENDPOINTS.fingerprint.register(selectedStudent.id),
        { fingerprint_template: capturedTemplate }
      );
      setFpRegistered(true);
      setStudents((prev) =>
        prev.map((s) =>
          s.id === selectedStudent.id ? { ...s, fingerprintRegistered: true } : s
        )
      );
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setFpError(
        apiErr?.response?.data?.error || "Failed to register fingerprint. Please try again."
      );
    } finally {
      setIsRegisteringFp(false);
    }
  };

  if (isLoading) return <PageLoading message="Loading class information..." />;
  if (error && !cohort)
    return <ErrorState message={error} onRetry={fetchData} />;
  if (!cohort) return null;

  const fpEnrolled = students.filter((s) => s.fingerprintRegistered).length;
  const fpNotEnrolled = students.length - fpEnrolled;

  const columns: TableColumn<CoordinatorStudent>[] = [
    {
      key: "student",
      header: "Student",
      render: (s) => (
        <div className="flex items-center gap-3">
          <Avatar firstName={s.firstName} lastName={s.lastName} size="md" />
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {s.firstName} {s.lastName}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{s.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "studentNumber",
      header: "Student ID",
      render: (s) => (
        <span className="font-mono text-gray-700 dark:text-gray-300">
          {s.studentNumber || <span className="text-gray-400 italic">—</span>}
        </span>
      ),
    },
    {
      key: "studyTime",
      header: "Study Session",
      align: "center",
      render: (s) =>
        s.studyTime ? (
          <Badge variant="default" className="capitalize">{s.studyTime}</Badge>
        ) : (
          <span className="text-gray-400 text-xs italic">—</span>
        ),
    },
    {
      key: "fingerprintRegistered",
      header: "Fingerprint",
      align: "center",
      render: (s) =>
        s.fingerprintRegistered ? (
          <Badge variant="success" dot>Enrolled</Badge>
        ) : (
          <Badge variant="default">Not enrolled</Badge>
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
          leftIcon={<Fingerprint className="w-4 h-4" />}
          onClick={() => openFpModal(s)}
          disabled={s.fingerprintRegistered}
        >
          {s.fingerprintRegistered ? "Enrolled" : "Enroll Fingerprint"}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Class</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage students and fingerprint enrollment for your cohort
        </p>
      </div>

      {/* Cohort Info Banner */}
      <Card className="bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-950/30 dark:to-primary-900/20 border-primary-200 dark:border-primary-800">
        <div className="flex flex-wrap items-center gap-4">
          <div className="p-3 bg-primary-100 dark:bg-primary-900/40 rounded-xl">
            <GraduationCap className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{cohort.name}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                <GraduationCap className="w-4 h-4" />
                {cohort.programmeCode} — {cohort.programmeName}
              </span>
              <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                <Calendar className="w-4 h-4" />
                Intake {cohort.intakeYear}
                {cohort.currentYearOfStudy ? ` · Year ${cohort.currentYearOfStudy}` : ""}
                {cohort.currentSemesterLabel ? ` · Sem ${cohort.currentSemesterLabel.split(":")[1]}` : ""}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="text-center">
          <div className="flex flex-col items-center gap-1">
            <Users className="w-8 h-8 text-primary-600 dark:text-primary-400 mb-1" />
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{students.length}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Students</p>
          </div>
        </Card>
        <Card className="text-center">
          <div className="flex flex-col items-center gap-1">
            <CheckCircle2 className="w-8 h-8 text-success-600 dark:text-green-400 mb-1" />
            <p className="text-3xl font-bold text-success-600">{fpEnrolled}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Fingerprint Enrolled</p>
          </div>
        </Card>
        <Card className="text-center">
          <div className="flex flex-col items-center gap-1">
            <AlertCircle className="w-8 h-8 text-warning-600 dark:text-yellow-400 mb-1" />
            <p className="text-3xl font-bold text-warning-600">{fpNotEnrolled}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Not Enrolled</p>
          </div>
        </Card>
      </div>

      {/* Students Table */}
      <Card>
        <CardHeader
          title="Class Students"
          subtitle={`${students.length} student${students.length !== 1 ? "s" : ""} in this cohort`}
        />
        <Table
          columns={columns}
          data={students}
          keyExtractor={(s) => s.id}
          emptyMessage="No students found in this cohort."
        />
      </Card>

      {/* Fingerprint Enrollment Modal */}
      <Modal
        isOpen={fpModalOpen}
        onClose={closeFpModal}
        title="Enroll Fingerprint"
        description={
          selectedStudent
            ? `Register fingerprint for ${selectedStudent.firstName} ${selectedStudent.lastName}`
            : ""
        }
        size="md"
      >
        {fpRegistered ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-16 h-16 rounded-full bg-success-100 dark:bg-green-900/40 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-success-600 dark:text-green-400" />
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              Fingerprint Registered!
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {selectedStudent?.firstName} {selectedStudent?.lastName} is now enrolled.
            </p>
            <Button className="mt-6" onClick={closeFpModal}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {fpError && (
              <div className="flex items-start gap-2 p-3 bg-danger-50 dark:bg-red-950/30 border border-danger-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="w-4 h-4 text-danger-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-danger-700 dark:text-red-300">{fpError}</p>
              </div>
            )}
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Ask{" "}
              <strong>
                {selectedStudent?.firstName} {selectedStudent?.lastName}
              </strong>{" "}
              to place their finger on the sensor, then click Capture.
            </p>
            <FingerprintCapture
              onCapture={(template) => {
                setCapturedTemplate(template);
                setFpError(null);
              }}
              onError={(err) => setFpError(err)}
              autoDiscover
            />
            <div className="flex justify-between gap-3 pt-4 border-t dark:border-gray-700">
              <Button variant="outline" onClick={closeFpModal} disabled={isRegisteringFp}>
                Cancel
              </Button>
              <Button
                onClick={handleRegisterFingerprint}
                disabled={!capturedTemplate}
                isLoading={isRegisteringFp}
                leftIcon={<Fingerprint className="w-4 h-4" />}
              >
                Register Fingerprint
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
