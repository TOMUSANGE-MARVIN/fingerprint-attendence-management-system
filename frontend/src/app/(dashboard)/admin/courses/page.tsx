"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  Button,
  Badge,
  Table,
  TableColumn,
  Modal,
  ConfirmModal,
  Input,
  PageLoading,
} from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { Course } from "@/types";
import { BookOpen, Plus, Search, Trash2, Users } from "lucide-react";

const DEMO_COURSES: Course[] = [
  { id: 1, code: "CS301", name: "Database Systems", description: "", creditUnits: 3, department: "Computer Science", semester: "Semester 1", academicYear: "2025-2026", lecturer: { id: "1", firstName: "Alice", lastName: "Brown" }, enrolledStudents: 45 },
  { id: 2, code: "CS302", name: "Software Engineering", description: "", creditUnits: 4, department: "Computer Science", semester: "Semester 1", academicYear: "2025-2026", lecturer: { id: "2", firstName: "Bob", lastName: "Wilson" }, enrolledStudents: 52 },
  { id: 3, code: "ENG201", name: "Engineering Mathematics", description: "", creditUnits: 3, department: "Engineering", semester: "Semester 1", academicYear: "2025-2026", lecturer: { id: "2", firstName: "Bob", lastName: "Wilson" }, enrolledStudents: 38 },
  { id: 4, code: "CS303", name: "Computer Networks", description: "", creditUnits: 3, department: "Computer Science", semester: "Semester 2", academicYear: "2025-2026", lecturer: { id: "1", firstName: "Alice", lastName: "Brown" }, enrolledStudents: 41 },
  { id: 5, code: "MTH301", name: "Linear Algebra", description: "", creditUnits: 3, department: "Mathematics", semester: "Semester 1", academicYear: "2025-2026", lecturer: { id: "3", firstName: "Carol", lastName: "Taylor" }, enrolledStudents: 29 },
];

interface CourseFormData {
  code: string;
  name: string;
  department: string;
  creditUnits: string;
  semester: string;
  academicYear: string;
}

const emptyForm: CourseFormData = {
  code: "",
  name: "",
  department: "",
  creditUnits: "3",
  semester: "Semester 1",
  academicYear: "2025-2026",
};

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState<CourseFormData>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await apiClient.get<{ results: Course[] } | Course[]>(
          API_ENDPOINTS.courses.list
        );
        const data = response.data as any;
        setCourses(Array.isArray(data) ? data : data.results ?? []);
      } catch {
        setCourses(DEMO_COURSES);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCourses();
  }, []);

  const filtered = courses.filter((c) =>
    `${c.code} ${c.name} ${c.department}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.code.trim() || !formData.name.trim()) {
      setFormError("Course code and name are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await apiClient.post<Course>(API_ENDPOINTS.courses.list, {
        code: formData.code,
        name: formData.name,
        department: formData.department,
        credit_units: parseInt(formData.creditUnits, 10),
        semester: formData.semester,
        academic_year: formData.academicYear,
      });
      setCourses((prev) => [response.data, ...prev]);
      setIsAddModalOpen(false);
      setFormData(emptyForm);
    } catch (err: any) {
      const data = err?.response?.data;
      setFormError(
        typeof data === "object"
          ? Object.values(data).flat().join(" ")
          : "Failed to create course."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCourse) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(API_ENDPOINTS.courses.detail(selectedCourse.id));
      setCourses((prev) => prev.filter((c) => c.id !== selectedCourse.id));
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      setDeleteError(err?.response?.data?.detail || "Failed to delete course.");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: TableColumn<Course>[] = [
    {
      key: "course",
      header: "Course",
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
            <BookOpen className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">{c.code}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{c.name}</p>
          </div>
        </div>
      ),
    },
    {
      key: "department",
      header: "Department",
      render: (c) => <span className="text-gray-700 dark:text-gray-300">{c.department}</span>,
    },
    {
      key: "lecturer",
      header: "Lecturer",
      render: (c) => (
        <span className="text-gray-700 dark:text-gray-300">
          {c.lecturer ? `${c.lecturer.firstName} ${c.lecturer.lastName}` : "—"}
        </span>
      ),
    },
    {
      key: "enrolled",
      header: "Students",
      align: "center",
      render: (c) => (
        <div className="flex items-center justify-center gap-1 text-gray-700 dark:text-gray-300">
          <Users className="w-4 h-4 text-gray-400" />
          {c.enrolledStudents ?? 0}
        </div>
      ),
    },
    {
      key: "credits",
      header: "Credits",
      align: "center",
      render: (c) => <Badge variant="default">{c.creditUnits} CU</Badge>,
    },
    {
      key: "semester",
      header: "Semester",
      render: (c) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">{c.semester}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (c) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { setSelectedCourse(c); setDeleteError(null); setIsDeleteModalOpen(true); }}
          className="text-danger-600 hover:text-danger-700 hover:bg-danger-50"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  if (isLoading) return <PageLoading message="Loading courses..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Courses</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage all registered courses</p>
        </div>
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => { setFormData(emptyForm); setFormError(null); setIsAddModalOpen(true); }}
        >
          Add Course
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-primary-600">{courses.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Courses</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-success-600">
            {new Set(courses.map((c) => c.department)).size}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Departments</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-primary-600">
            {courses.reduce((sum, c) => sum + (c.enrolledStudents ?? 0), 0)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Enrolments</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="All Courses"
          subtitle={`${filtered.length} courses`}
          action={
            <div className="w-64">
              <Input
                placeholder="Search courses..."
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
          keyExtractor={(c) => c.id}
          emptyMessage="No courses found"
        />
      </Card>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Course"
        description="Register a new course in the system"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-danger-50 dark:bg-red-950/30 border border-danger-200 dark:border-red-800 rounded-lg text-sm text-danger-700 dark:text-red-300">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Course Code"
              value={formData.code}
              onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))}
              placeholder="e.g. CS301"
              required
            />
            <Input
              label="Credit Units"
              type="number"
              min="1"
              max="6"
              value={formData.creditUnits}
              onChange={(e) => setFormData((p) => ({ ...p, creditUnits: e.target.value }))}
            />
          </div>
          <Input
            label="Course Name"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Database Systems"
            required
          />
          <Input
            label="Department"
            value={formData.department}
            onChange={(e) => setFormData((p) => ({ ...p, department: e.target.value }))}
            placeholder="e.g. Computer Science"
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Semester
              </label>
              <select
                value={formData.semester}
                onChange={(e) => setFormData((p) => ({ ...p, semester: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option>Semester 1</option>
                <option>Semester 2</option>
              </select>
            </div>
            <Input
              label="Academic Year"
              value={formData.academicYear}
              onChange={(e) => setFormData((p) => ({ ...p, academicYear: e.target.value }))}
              placeholder="e.g. 2025-2026"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} leftIcon={<BookOpen className="w-4 h-4" />}>
              Create Course
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Course"
        message={deleteError
          ? `${selectedCourse?.code} — ${selectedCourse?.name}: ${deleteError}`
          : `Are you sure you want to delete ${selectedCourse?.code} — ${selectedCourse?.name}? This will remove all associated timetable slots.`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
