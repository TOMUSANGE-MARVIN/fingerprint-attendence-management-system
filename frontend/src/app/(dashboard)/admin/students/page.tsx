"use client";

import React, { useState, useEffect } from "react";
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
  Input,
  Modal,
  ConfirmModal,
} from "@/components/ui";
import { FingerprintCapture } from "@/components/fingerprint/FingerprintCapture";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { User } from "@/types";
import {
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Download,
  UserPlus,
  Fingerprint,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface StudentFormData {
  firstName: string;
  lastName: string;
  email: string;
  studentId: string;
  department: string;
  program: string;
  password: string;
  passwordConfirm: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  studentId?: string;
  department?: string;
  password?: string;
  passwordConfirm?: string;
  submit?: string;
}

const emptyForm: StudentFormData = {
  firstName: "",
  lastName: "",
  email: "",
  studentId: "",
  department: "",
  program: "",
  password: "",
  passwordConfirm: "",
};

type ModalStep = "form" | "fingerprint";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Add modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>("form");
  const [formData, setFormData] = useState<StudentFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [createdStudent, setCreatedStudent] = useState<User | null>(null);

  // Fingerprint registration state
  const [capturedTemplate, setCapturedTemplate] = useState<string | null>(null);
  const [captureQuality, setCaptureQuality] = useState(0);
  const [isRegisteringFp, setIsRegisteringFp] = useState(false);
  const [fpRegistered, setFpRegistered] = useState(false);

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get<{ results: User[] } | User[]>(
        `${API_ENDPOINTS.admin.users}?role=student`
      );
      const data = response.data;
      setStudents(Array.isArray(data) ? data : (data as any).results ?? []);
    } catch {
      setError("Failed to load students. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Add student form validation ---
  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!formData.firstName.trim()) errors.firstName = "First name is required";
    if (!formData.lastName.trim()) errors.lastName = "Last name is required";
    if (!formData.email.trim()) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errors.email = "Enter a valid email address";
    if (!formData.password) errors.password = "Password is required";
    else if (formData.password.length < 8)
      errors.password = "Password must be at least 8 characters";
    if (!formData.passwordConfirm)
      errors.passwordConfirm = "Please confirm the password";
    else if (formData.password !== formData.passwordConfirm)
      errors.passwordConfirm = "Passwords do not match";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSaving(true);
    setFormErrors({});

    try {
      const response = await apiClient.post<User>(API_ENDPOINTS.admin.users, {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        password: formData.password,
        password_confirm: formData.passwordConfirm,
        role: "student",
        student_id: formData.studentId || undefined,
        department: formData.department || undefined,
        program: formData.program || undefined,
      });

      const newStudent = response.data;
      setStudents((prev) => [newStudent, ...prev]);
      setCreatedStudent(newStudent);
      setModalStep("fingerprint");
    } catch (err: any) {
      const data = err?.response?.data;
      if (data && typeof data === "object") {
        const mapped: FormErrors = {};
        if (data.email) mapped.email = Array.isArray(data.email) ? data.email[0] : data.email;
        if (data.password) mapped.password = Array.isArray(data.password) ? data.password[0] : data.password;
        if (data.student_id) mapped.studentId = Array.isArray(data.student_id) ? data.student_id[0] : data.student_id;
        if (data.non_field_errors || data.detail)
          mapped.submit = data.non_field_errors?.[0] || data.detail;
        if (Object.keys(mapped).length > 0) {
          setFormErrors(mapped);
          return;
        }
      }
      setFormErrors({ submit: "Failed to create student. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegisterFingerprint = async () => {
    if (!createdStudent || !capturedTemplate) return;
    setIsRegisteringFp(true);
    try {
      await apiClient.post(
        API_ENDPOINTS.fingerprint.register(String(createdStudent.id)),
        { fingerprint_template: capturedTemplate, quality: captureQuality }
      );
      setFpRegistered(true);
      setStudents((prev) =>
        prev.map((s) =>
          s.id === createdStudent.id ? { ...s, fingerprintRegistered: true } : s
        )
      );
    } catch {
      // Non-blocking - student is already created
    } finally {
      setIsRegisteringFp(false);
    }
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setModalStep("form");
    setFormData(emptyForm);
    setFormErrors({});
    setCreatedStudent(null);
    setCapturedTemplate(null);
    setFpRegistered(false);
  };

  // --- Delete ---
  const handleDeleteStudent = async () => {
    if (!selectedStudent) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(API_ENDPOINTS.admin.userDetail(selectedStudent.id));
      setStudents((prev) => prev.filter((s) => s.id !== selectedStudent.id));
      setIsDeleteModalOpen(false);
      setSelectedStudent(null);
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.detail || "Failed to delete student. Please try again."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const field = (key: keyof StudentFormData) => ({
    value: formData[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((p) => ({ ...p, [key]: e.target.value }));
      if (formErrors[key as keyof FormErrors])
        setFormErrors((p) => ({ ...p, [key]: undefined }));
    },
  });

  const filteredStudents = students.filter((s) =>
    `${s.firstName} ${s.lastName} ${s.studentId ?? ""} ${s.email} ${s.department ?? ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const columns: TableColumn<User>[] = [
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
      key: "studentId",
      header: "Student ID",
      render: (s) => (
        <span className="font-mono text-gray-700 dark:text-gray-300">
          {s.studentId || <span className="text-gray-400 italic">Not set</span>}
        </span>
      ),
    },
    {
      key: "department",
      header: "Department",
      render: (s) => (
        <span className="text-gray-600 dark:text-gray-400">{s.department || "-"}</span>
      ),
    },
    {
      key: "fingerprint",
      header: "Fingerprint",
      align: "center",
      render: (s) => (
        s.fingerprintRegistered ? (
          <Badge variant="success" dot>Enrolled</Badge>
        ) : (
          <Badge variant="default">Not enrolled</Badge>
        )
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (s) => (
        <Badge variant={s.isActive ? "success" : "default"} dot>
          {s.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Joined",
      render: (s) => (
        <span className="text-gray-500 dark:text-gray-400 text-sm">{formatDate(s.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (s) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedStudent(s);
              setIsDeleteModalOpen(true);
            }}
          >
            <Trash2 className="w-4 h-4 text-danger-600" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) return <PageLoading message="Loading students..." />;
  if (error) return <ErrorState message={error} onRetry={fetchStudents} />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Students</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage student accounts and fingerprint enrolments
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={<Download className="w-4 h-4" />}>
            Export
          </Button>
          <Button
            leftIcon={<UserPlus className="w-4 h-4" />}
            onClick={() => {
              setFormData(emptyForm);
              setFormErrors({});
              setModalStep("form");
              setCreatedStudent(null);
              setCapturedTemplate(null);
              setFpRegistered(false);
              setIsAddModalOpen(true);
            }}
          >
            Add Student
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{students.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-success-600">
            {students.filter((s) => s.isActive).length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Active</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-primary-600">
            {students.filter((s) => s.fingerprintRegistered).length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Fingerprint Enrolled</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-warning-600">
            {students.filter((s) => !s.fingerprintRegistered).length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Not Enrolled</p>
        </Card>
      </div>

      {/* Students Table */}
      <Card>
        <CardHeader
          title="All Students"
          subtitle={`${filteredStudents.length} student${filteredStudents.length !== 1 ? "s" : ""}`}
          action={
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-56"
                />
              </div>
            </div>
          }
        />
        <Table
          columns={columns}
          data={filteredStudents}
          keyExtractor={(s) => s.id}
          emptyMessage="No students found. Click 'Add Student' to register one."
        />
      </Card>

      {/* ── Add Student Modal ─────────────────────────── */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        title={modalStep === "form" ? "Add New Student" : "Register Fingerprint"}
        description={
          modalStep === "form"
            ? "Create a student account"
            : `Student "${createdStudent?.firstName} ${createdStudent?.lastName}" created successfully`
        }
        size="lg"
      >
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {(["form", "fingerprint"] as ModalStep[]).map((step, i) => (
            <React.Fragment key={step}>
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    modalStep === step || (step === "form" && modalStep === "fingerprint")
                      ? "bg-primary-600 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  )}
                >
                  {step === "form" && modalStep === "fingerprint" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={cn(
                    "text-sm font-medium",
                    modalStep === step
                      ? "text-primary-600 dark:text-primary-400"
                      : "text-gray-500 dark:text-gray-400"
                  )}
                >
                  {step === "form" ? "Account Details" : "Fingerprint"}
                </span>
              </div>
              {i < 1 && (
                <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
            {modalStep === "fingerprint" ? "Optional" : "Required"}
          </span>
        </div>

        {/* Step 1: Account form */}
        {modalStep === "form" && (
          <form onSubmit={handleAddStudent} className="space-y-4">
            {formErrors.submit && (
              <div className="flex items-start gap-2 p-3 bg-danger-50 dark:bg-red-950/30 border border-danger-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="w-4 h-4 text-danger-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-danger-700 dark:text-red-300">{formErrors.submit}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                placeholder="e.g., John"
                {...field("firstName")}
                error={formErrors.firstName}
              />
              <Input
                label="Last Name"
                placeholder="e.g., Doe"
                {...field("lastName")}
                error={formErrors.lastName}
              />
            </div>
            <Input
              label="Email Address"
              type="email"
              placeholder="student@university.edu"
              {...field("email")}
              error={formErrors.email}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Student ID"
                placeholder="e.g., STU001"
                {...field("studentId")}
                error={formErrors.studentId}
                hint="Leave blank to auto-assign"
              />
              <Input
                label="Department"
                placeholder="e.g., Computer Science"
                {...field("department")}
              />
            </div>
            <Input
              label="Programme"
              placeholder="e.g., BSc Computer Science"
              {...field("program")}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Password"
                type="password"
                placeholder="Min. 8 characters"
                {...field("password")}
                error={formErrors.password}
              />
              <Input
                label="Confirm Password"
                type="password"
                placeholder="Re-enter password"
                {...field("passwordConfirm")}
                error={formErrors.passwordConfirm}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
              <Button variant="outline" type="button" onClick={handleCloseAddModal}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSaving}>
                Create Student
              </Button>
            </div>
          </form>
        )}

        {/* Step 2: Fingerprint registration */}
        {modalStep === "fingerprint" && (
          <div className="space-y-4">
            {fpRegistered ? (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="w-16 h-16 rounded-full bg-success-100 dark:bg-green-900/40 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-success-600 dark:text-green-400" />
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  Fingerprint Registered!
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {createdStudent?.firstName} {createdStudent?.lastName} is fully enrolled.
                </p>
                <Button className="mt-6" onClick={handleCloseAddModal}>
                  Done
                </Button>
              </div>
            ) : (
              <>
                <div className="p-3 bg-success-50 dark:bg-green-950/30 border border-success-200 dark:border-green-800 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success-600 dark:text-green-400 flex-shrink-0" />
                  <p className="text-sm text-success-700 dark:text-green-300">
                    Account created for{" "}
                    <strong>
                      {createdStudent?.firstName} {createdStudent?.lastName}
                    </strong>
                    . Now optionally enrol their fingerprint.
                  </p>
                </div>

                <FingerprintCapture
                  onCapture={(template, quality) => {
                    setCapturedTemplate(template);
                    setCaptureQuality(quality);
                  }}
                  autoDiscover
                />

                <div className="flex justify-between gap-3 pt-4 border-t dark:border-gray-700">
                  <Button
                    variant="outline"
                    onClick={handleCloseAddModal}
                    disabled={isRegisteringFp}
                  >
                    Skip for now
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
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (isDeleting) return;
          setIsDeleteModalOpen(false);
          setSelectedStudent(null);
          setDeleteError(null);
        }}
        onConfirm={handleDeleteStudent}
        title="Delete Student"
        message={
          deleteError
            ? deleteError
            : `Are you sure you want to delete ${selectedStudent?.firstName} ${selectedStudent?.lastName}? This will permanently remove their account and attendance records.`
        }
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
