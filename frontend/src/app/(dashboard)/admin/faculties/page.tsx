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
  Input,
  Modal,
  ConfirmModal,
} from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { Faculty } from "@/types";
import { Plus, Trash2, Edit, Building2, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface FacultyFormData {
  name: string;
  code: string;
  description: string;
}

const emptyForm: FacultyFormData = { name: "", code: "", description: "" };

export default function AdminFacultiesPage() {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null);
  const [formData, setFormData] = useState<FacultyFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<FacultyFormData>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchFaculties();
  }, []);

  const fetchFaculties = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get<Faculty[] | { results: Faculty[] }>(
        API_ENDPOINTS.faculties.list
      );
      const data = response.data;
      setFaculties(Array.isArray(data) ? data : (data as any).results ?? []);
    } catch {
      // Demo data fallback
      setFaculties([
        { id: "f1", name: "Faculty of Computing & Information Technology", code: "FCIT", description: "Covers all computing disciplines", deanName: "Prof. Ada Lovelace", isActive: true, createdAt: "2025-08-01T00:00:00Z" },
        { id: "f2", name: "Faculty of Engineering", code: "FENG", description: "Engineering disciplines", deanName: "Prof. James Watt", isActive: true, createdAt: "2025-08-01T00:00:00Z" },
        { id: "f3", name: "Faculty of Business Administration", code: "FBA", description: "Business and management programmes", isActive: true, createdAt: "2025-08-01T00:00:00Z" },
        { id: "f4", name: "Faculty of Medicine", code: "FMED", description: "Medical and health sciences", deanName: "Prof. Marie Curie", isActive: false, createdAt: "2025-08-01T00:00:00Z" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<FacultyFormData> = {};
    if (!formData.name.trim()) errors.name = "Faculty name is required";
    if (!formData.code.trim()) errors.code = "Faculty code is required";
    else if (formData.code.length > 20) errors.code = "Code must be 20 characters or less";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      const response = await apiClient.post<Faculty>(API_ENDPOINTS.faculties.list, formData);
      setFaculties((prev) => [response.data, ...prev]);
      setIsAddModalOpen(false);
      setFormData(emptyForm);
    } catch {
      setFormErrors({ name: "Failed to create faculty. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !selectedFaculty) return;
    setIsSaving(true);
    try {
      const response = await apiClient.patch<Faculty>(
        API_ENDPOINTS.faculties.detail(selectedFaculty.id),
        formData
      );
      setFaculties((prev) => prev.map((f) => (f.id === selectedFaculty.id ? response.data : f)));
      setIsEditModalOpen(false);
      setSelectedFaculty(null);
    } catch {
      setFormErrors({ name: "Failed to update faculty. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFaculty) return;
    try {
      await apiClient.delete(API_ENDPOINTS.faculties.detail(selectedFaculty.id));
      setFaculties((prev) => prev.filter((f) => f.id !== selectedFaculty.id));
      setIsDeleteModalOpen(false);
      setSelectedFaculty(null);
    } catch {
      console.error("Failed to delete faculty");
    }
  };

  const openEditModal = (faculty: Faculty) => {
    setSelectedFaculty(faculty);
    setFormData({ name: faculty.name, code: faculty.code, description: faculty.description ?? "" });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const openAddModal = () => {
    setFormData(emptyForm);
    setFormErrors({});
    setIsAddModalOpen(true);
  };

  const filtered = faculties.filter((f) =>
    `${f.name} ${f.code} ${f.deanName ?? ""}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: TableColumn<Faculty>[] = [
    {
      key: "faculty",
      header: "Faculty",
      render: (f) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">{f.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{f.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (f) => (
        <span className="text-gray-600 dark:text-gray-400 text-sm">
          {f.description || <span className="text-gray-400 italic">No description</span>}
        </span>
      ),
    },
    {
      key: "dean",
      header: "Dean",
      render: (f) => (
        <span className="text-gray-600 dark:text-gray-400 text-sm">
          {f.deanName || <span className="text-gray-400 italic">Unassigned</span>}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (f) => (
        <Badge variant={f.isActive ? "success" : "default"} dot>
          {f.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (f) => <span className="text-gray-500 dark:text-gray-400 text-sm">{formatDate(f.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (f) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEditModal(f)}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSelectedFaculty(f); setIsDeleteModalOpen(true); }}
          >
            <Trash2 className="w-4 h-4 text-danger-600" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) return <PageLoading message="Loading faculties..." />;
  if (error) return <ErrorState message={error} onRetry={fetchFaculties} />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Faculties</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage university faculties and their details
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={openAddModal}>
          Add Faculty
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{faculties.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Faculties</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-success-600">{faculties.filter(f => f.isActive).length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Active</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-gray-400">{faculties.filter(f => !f.isActive).length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Inactive</p>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader
          title="All Faculties"
          subtitle={`${filtered.length} faculties found`}
          action={
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search faculties..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-56"
              />
            </div>
          }
        />
        <Table
          columns={columns}
          data={filtered}
          keyExtractor={(f) => f.id}
          emptyMessage="No faculties found"
        />
      </Card>

      {/* Add Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Faculty"
        description="Register a new faculty in the system"
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <Input
            label="Faculty Name"
            placeholder="e.g., Faculty of Computing & IT"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            error={formErrors.name}
          />
          <Input
            label="Faculty Code"
            placeholder="e.g., FCIT"
            value={formData.code}
            onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
            error={formErrors.code}
          />
          <Input
            label="Description (optional)"
            placeholder="Brief description of the faculty"
            value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
          />
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              Add Faculty
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Faculty"
        description={`Editing: ${selectedFaculty?.name}`}
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <Input
            label="Faculty Name"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            error={formErrors.name}
          />
          <Input
            label="Faculty Code"
            value={formData.code}
            onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
            error={formErrors.code}
          />
          <Input
            label="Description (optional)"
            value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
          />
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button variant="outline" type="button" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setSelectedFaculty(null); }}
        onConfirm={handleDelete}
        title="Delete Faculty"
        message={`Are you sure you want to delete "${selectedFaculty?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
