"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  Button,
  Badge,
  Table,
  TableColumn,
  Avatar,
  Modal,
  ConfirmModal,
  Input,
  PageLoading,
} from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { User } from "@/types";
import { UserCog, Plus, Search, Trash2, Mail, Building2 } from "lucide-react";

interface LecturerFormData {
  firstName: string;
  lastName: string;
  email: string;
  staffId: string;
  department: string;
  password: string;
  passwordConfirm: string;
}

const emptyForm: LecturerFormData = {
  firstName: "",
  lastName: "",
  email: "",
  staffId: "",
  department: "",
  password: "",
  passwordConfirm: "",
};

const DEMO_LECTURERS: User[] = [
  { id: "1", email: "dr.alice@university.edu", firstName: "Alice", lastName: "Brown", role: "lecturer", staffId: "LEC001", department: "Computer Science", isActive: true, fingerprintRegistered: false, createdAt: "2025-08-10T09:00:00Z" },
  { id: "2", email: "prof.bob@university.edu", firstName: "Bob", lastName: "Wilson", role: "lecturer", staffId: "LEC002", department: "Engineering", isActive: true, fingerprintRegistered: false, createdAt: "2025-08-11T10:00:00Z" },
  { id: "3", email: "dr.carol@university.edu", firstName: "Carol", lastName: "Taylor", role: "lecturer", staffId: "LEC003", department: "Mathematics", isActive: false, fingerprintRegistered: false, createdAt: "2025-08-12T11:00:00Z" },
];

export default function AdminLecturersPage() {
  const [lecturers, setLecturers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedLecturer, setSelectedLecturer] = useState<User | null>(null);
  const [formData, setFormData] = useState<LecturerFormData>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchLecturers = async () => {
      try {
        const response = await apiClient.get<{ results: User[] } | User[]>(
          `${API_ENDPOINTS.admin.users}?role=lecturer`
        );
        const data = response.data as any;
        setLecturers(Array.isArray(data) ? data : data.results ?? []);
      } catch {
        setLecturers(DEMO_LECTURERS);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLecturers();
  }, []);

  const filtered = lecturers.filter((l) =>
    `${l.firstName} ${l.lastName} ${l.email} ${l.staffId ?? ""} ${l.department ?? ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
      setFormError("First name, last name, and email are required.");
      return;
    }
    if (formData.password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (formData.password !== formData.passwordConfirm) {
      setFormError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await apiClient.post<User>(API_ENDPOINTS.admin.users, {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        password: formData.password,
        password_confirm: formData.passwordConfirm,
        role: "lecturer",
        staff_id: formData.staffId || undefined,
        department: formData.department || undefined,
      });
      setLecturers((prev) => [response.data, ...prev]);
      setIsAddModalOpen(false);
      setFormData(emptyForm);
    } catch (err: any) {
      const data = err?.response?.data;
      setFormError(
        typeof data === "object"
          ? Object.values(data).flat().join(" ")
          : "Failed to create lecturer. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedLecturer) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(API_ENDPOINTS.admin.userDetail(selectedLecturer.id));
      setLecturers((prev) => prev.filter((l) => l.id !== selectedLecturer.id));
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      setDeleteError(err?.response?.data?.detail || "Failed to delete lecturer.");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: TableColumn<User>[] = [
    {
      key: "name",
      header: "Lecturer",
      render: (l) => (
        <div className="flex items-center gap-3">
          <Avatar firstName={l.firstName} lastName={l.lastName} size="sm" />
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {l.firstName} {l.lastName}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Mail className="w-3 h-3" /> {l.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "staffId",
      header: "Staff ID",
      render: (l) => <span className="text-gray-700 dark:text-gray-300">{l.staffId || "—"}</span>,
    },
    {
      key: "department",
      header: "Department",
      render: (l) => (
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <Building2 className="w-4 h-4 text-gray-400" />
          {l.department || "—"}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (l) => (
        <Badge variant={l.isActive ? "success" : "default"} dot>
          {l.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (l) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { setSelectedLecturer(l); setDeleteError(null); setIsDeleteModalOpen(true); }}
          className="text-danger-600 hover:text-danger-700 hover:bg-danger-50"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  if (isLoading) return <PageLoading message="Loading lecturers..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lecturers</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage lecturer accounts and assignments
          </p>
        </div>
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => { setFormData(emptyForm); setFormError(null); setIsAddModalOpen(true); }}
        >
          Add Lecturer
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-primary-600">{lecturers.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Lecturers</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-success-600">
            {lecturers.filter((l) => l.isActive).length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-gray-600 dark:text-gray-300">
            {new Set(lecturers.map((l) => l.department).filter(Boolean)).size}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Departments</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="All Lecturers"
          subtitle={`${filtered.length} found`}
          action={
            <div className="w-64">
              <Input
                placeholder="Search lecturers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
          }
        />
        <Table
          columns={columns}
          data={filtered}
          keyExtractor={(l) => l.id}
          emptyMessage="No lecturers found"
        />
      </Card>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Lecturer"
        description="Create a new lecturer account"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-danger-50 dark:bg-red-950/30 border border-danger-200 dark:border-red-800 rounded-lg text-sm text-danger-700 dark:text-red-300">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              value={formData.firstName}
              onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))}
              required
            />
            <Input
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))}
              required
            />
          </div>
          <Input
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Staff ID"
              value={formData.staffId}
              onChange={(e) => setFormData((p) => ({ ...p, staffId: e.target.value }))}
              placeholder="e.g. LEC001"
            />
            <Input
              label="Department"
              value={formData.department}
              onChange={(e) => setFormData((p) => ({ ...p, department: e.target.value }))}
              placeholder="e.g. Computer Science"
            />
          </div>
          <Input
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
            required
          />
          <Input
            label="Confirm Password"
            type="password"
            value={formData.passwordConfirm}
            onChange={(e) => setFormData((p) => ({ ...p, passwordConfirm: e.target.value }))}
            required
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} leftIcon={<UserCog className="w-4 h-4" />}>
              Create Lecturer
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Lecturer"
        message={deleteError
          ? `${selectedLecturer?.firstName} ${selectedLecturer?.lastName}: ${deleteError}`
          : `Are you sure you want to delete ${selectedLecturer?.firstName} ${selectedLecturer?.lastName}? This action cannot be undone.`}
        confirmText="Delete"
        isLoading={isDeleting}
        variant="danger"
      />
    </div>
  );
}
