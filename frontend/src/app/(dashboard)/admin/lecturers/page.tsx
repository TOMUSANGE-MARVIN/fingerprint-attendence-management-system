"use client";

import React, { useState, useEffect } from "react";
import {
  Card, CardHeader, Button, Badge, Table, TableColumn,
  Avatar, Modal, ConfirmModal, Input, PageLoading,
} from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { User, Course } from "@/types";
import { UserCog, Plus, Search, Trash2, Mail, Building2, BookOpen, X } from "lucide-react";

interface Department { id: string; name: string; code: string; }

interface LecturerFormData {
  firstName: string;
  lastName: string;
  email: string;
  staffId: string;
  department: string;
  password: string;
  passwordConfirm: string;
  courseIds: string[];
}

const emptyForm = (): LecturerFormData => ({
  firstName: "",
  lastName: "",
  email: "",
  staffId: "",
  department: "",
  password: "",
  passwordConfirm: "",
  courseIds: [],
});

export default function AdminLecturersPage() {
  const [lecturers, setLecturers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedLecturer, setSelectedLecturer] = useState<User | null>(null);
  const [formData, setFormData] = useState<LecturerFormData>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [courseSearch, setCourseSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [lecRes, facRes, courseRes] = await Promise.all([
          apiClient.get<{ results: User[] } | User[]>(`${API_ENDPOINTS.admin.users}?role=lecturer`),
          apiClient.get<{ results: Department[] } | Department[]>(API_ENDPOINTS.faculties.list),
          apiClient.get<{ results: Course[] } | Course[]>(`${API_ENDPOINTS.courses.list}?page_size=200`),
        ]);
        const toArr = (d: any) => Array.isArray(d) ? d : d.results ?? [];
        setLecturers(toArr(lecRes.data));
        setDepartments(toArr(facRes.data));
        setCourses(toArr(courseRes.data));
      } catch {
        setLecturers([]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const filtered = lecturers.filter((l) =>
    `${l.firstName} ${l.lastName} ${l.email} ${l.staffId ?? ""}`
      .toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleCourse = (id: string) => {
    setFormData((f) => ({
      ...f,
      courseIds: f.courseIds.includes(id)
        ? f.courseIds.filter((c) => c !== id)
        : [...f.courseIds, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
      setFormError("First name, last name, and email are required.");
      return;
    }
    if (!formData.department) {
      setFormError("Please select a department.");
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
      const res = await apiClient.post<User>(API_ENDPOINTS.admin.users, {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        password: formData.password,
        password_confirm: formData.passwordConfirm,
        role: "lecturer",
        staff_id: formData.staffId || undefined,
        department: formData.department,
      });

      // Assign selected courses to this lecturer
      if (formData.courseIds.length > 0) {
        await Promise.all(
          formData.courseIds.map((courseId) =>
            apiClient.patch(API_ENDPOINTS.courses.detail(courseId), { lecturer: res.data.id })
          )
        );
      }

      setLecturers((prev) => [res.data, ...prev]);
      setIsAddModalOpen(false);
      setFormData(emptyForm());
      setCourseSearch("");
    } catch (err: any) {
      const data = err?.response?.data;
      setFormError(
        typeof data === "object"
          ? Object.values(data).flat().join(" ")
          : "Failed to create lecturer."
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

  const filteredCoursesForPicker = courses.filter((c) =>
    `${c.code} ${c.name}`.toLowerCase().includes(courseSearch.toLowerCase())
  );

  const selectedCourseObjects = courses.filter((c) => formData.courseIds.includes(String(c.id)));

  const departmentName = (l: User) => {
    const f = departments.find((f) => f.id === String((l as any).department));
    return f ? `${f.code} — ${f.name}` : (l as any).departmentName ?? l.department ?? "—";
  };

  const columns: TableColumn<User>[] = [
    {
      key: "name", header: "Lecturer",
      render: (l) => (
        <div className="flex items-center gap-3">
          <Avatar firstName={l.firstName} lastName={l.lastName} size="sm" />
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">{l.firstName} {l.lastName}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Mail className="w-3 h-3" /> {l.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "staffId", header: "Staff ID",
      render: (l) => <span className="text-gray-700 dark:text-gray-300">{l.staffId || "—"}</span>,
    },
    {
      key: "department", header: "Department",
      render: (l) => (
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
          {departmentName(l)}
        </div>
      ),
    },
    {
      key: "status", header: "Status", align: "center",
      render: (l) => <Badge variant={l.isActive ? "success" : "default"} dot>{l.isActive ? "Active" : "Inactive"}</Badge>,
    },
    {
      key: "actions", header: "Actions", align: "right",
      render: (l) => (
        <Button
          size="sm" variant="ghost"
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
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage lecturer accounts and course assignments</p>
        </div>
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => { setFormData(emptyForm()); setFormError(null); setCourseSearch(""); setIsAddModalOpen(true); }}
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
          <p className="text-3xl font-bold text-success-600">{lecturers.filter((l) => l.isActive).length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-gray-600 dark:text-gray-300">{departments.length}</p>
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
        <Table columns={columns} data={filtered} keyExtractor={(l) => l.id} emptyMessage="No lecturers found" />
      </Card>

      {/* Add Lecturer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Lecturer"
        description="Create a lecturer account and assign their courses"
        size="md"
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
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Department <span className="text-danger-500">*</span>
              </label>
              <select
                required
                value={formData.department}
                onChange={(e) => setFormData((p) => ({ ...p, department: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select department…</option>
                {departments.map((f) => (
                  <option key={f.id} value={f.id}>{f.code} — {f.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Course assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Assign Courses <span className="text-gray-400 font-normal">(optional)</span>
            </label>

            {/* Selected courses chips */}
            {selectedCourseObjects.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedCourseObjects.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 text-xs font-medium"
                  >
                    <BookOpen className="w-3 h-3" />
                    {c.code}
                    <button type="button" onClick={() => toggleCourse(String(c.id))}>
                      <X className="w-3 h-3 hover:text-danger-500" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Course search + list */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search courses…"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-0 dark:text-gray-200"
                />
              </div>
              <div className="max-h-40 overflow-y-auto">
                {filteredCoursesForPicker.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-400">No courses found</p>
                ) : (
                  filteredCoursesForPicker.map((c) => {
                    const checked = formData.courseIds.includes(String(c.id));
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCourse(String(c.id))}
                          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="font-mono text-xs text-primary-600 dark:text-primary-400 w-16 shrink-0">{c.code}</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{c.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
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
