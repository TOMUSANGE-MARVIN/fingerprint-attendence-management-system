"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  PageLoading,
  Button,
  Badge,
  Table,
  TableColumn,
  Input,
  Modal,
  ConfirmModal,
} from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { AcademicPeriod } from "@/types";
import { Plus, Trash2, Edit, CalendarDays, Search, Star } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface PeriodFormData {
  academicYear: string;
  semester: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

const emptyForm: PeriodFormData = {
  academicYear: "",
  semester: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
};

export default function AdminAcademicPeriodsPage() {
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<AcademicPeriod | null>(null);
  const [formData, setFormData] = useState<PeriodFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof PeriodFormData, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchPeriods();
  }, []);

  const fetchPeriods = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get<AcademicPeriod[] | { results: AcademicPeriod[] }>(
        API_ENDPOINTS.academicPeriods.list
      );
      const data = response.data;
      setPeriods(Array.isArray(data) ? data : (data as any).results ?? []);
    } catch {
      // Demo data fallback
      setPeriods([
        { id: "ap1", academicYear: "2025-2026", semester: "Semester 1", startDate: "2025-09-01", endDate: "2026-01-31", isCurrent: false, createdAt: "2025-08-01T00:00:00Z" },
        { id: "ap2", academicYear: "2025-2026", semester: "Semester 2", startDate: "2026-02-01", endDate: "2026-06-30", isCurrent: true, createdAt: "2025-08-01T00:00:00Z" },
        { id: "ap3", academicYear: "2024-2025", semester: "Semester 1", startDate: "2024-09-01", endDate: "2025-01-31", isCurrent: false, createdAt: "2024-08-01T00:00:00Z" },
        { id: "ap4", academicYear: "2024-2025", semester: "Semester 2", startDate: "2025-02-01", endDate: "2025-06-30", isCurrent: false, createdAt: "2024-08-01T00:00:00Z" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof PeriodFormData, string>> = {};
    if (!formData.academicYear.trim()) errors.academicYear = "Academic year is required";
    if (!formData.semester.trim()) errors.semester = "Semester is required";
    if (!formData.startDate) errors.startDate = "Start date is required";
    if (!formData.endDate) errors.endDate = "End date is required";
    if (formData.startDate && formData.endDate && formData.startDate >= formData.endDate) {
      errors.endDate = "End date must be after start date";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      const response = await apiClient.post<AcademicPeriod>(
        API_ENDPOINTS.academicPeriods.list,
        formData
      );
      setPeriods((prev) => [response.data, ...prev]);
      setIsAddModalOpen(false);
      setFormData(emptyForm);
    } catch {
      setFormErrors({ academicYear: "Failed to create period. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !selectedPeriod) return;
    setIsSaving(true);
    try {
      const response = await apiClient.patch<AcademicPeriod>(
        API_ENDPOINTS.academicPeriods.detail(selectedPeriod.id),
        formData
      );
      setPeriods((prev) => prev.map((p) => (p.id === selectedPeriod.id ? response.data : p)));
      setIsEditModalOpen(false);
      setSelectedPeriod(null);
    } catch {
      setFormErrors({ academicYear: "Failed to update period. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPeriod) return;
    try {
      await apiClient.delete(API_ENDPOINTS.academicPeriods.detail(selectedPeriod.id));
      setPeriods((prev) => prev.filter((p) => p.id !== selectedPeriod.id));
      setIsDeleteModalOpen(false);
      setSelectedPeriod(null);
    } catch {
      console.error("Failed to delete academic period");
    }
  };

  const openEditModal = (period: AcademicPeriod) => {
    setSelectedPeriod(period);
    setFormData({
      academicYear: period.academicYear,
      semester: period.semester,
      startDate: period.startDate,
      endDate: period.endDate,
      isCurrent: period.isCurrent,
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const filtered = periods.filter((p) =>
    `${p.academicYear} ${p.semester}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: TableColumn<AcademicPeriod>[] = [
    {
      key: "period",
      header: "Academic Period",
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0">
            <CalendarDays className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900 dark:text-gray-100">{p.semester}</p>
              {p.isCurrent && (
                <Badge variant="success" size="sm">Current</Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{p.academicYear}</p>
          </div>
        </div>
      ),
    },
    {
      key: "startDate",
      header: "Start Date",
      render: (p) => <span className="text-gray-600 dark:text-gray-400 text-sm">{formatDate(p.startDate)}</span>,
    },
    {
      key: "endDate",
      header: "End Date",
      render: (p) => <span className="text-gray-600 dark:text-gray-400 text-sm">{formatDate(p.endDate)}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (p) => {
        const now = new Date();
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        let statusLabel = "Upcoming";
        let variant: "default" | "success" | "warning" | "info" = "default";
        if (p.isCurrent) { statusLabel = "Active"; variant = "success"; }
        else if (now > end) { statusLabel = "Completed"; variant = "default"; }
        else if (now < start) { statusLabel = "Upcoming"; variant = "info"; }
        return <Badge variant={variant} dot>{statusLabel}</Badge>;
      },
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (p) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEditModal(p)}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSelectedPeriod(p); setIsDeleteModalOpen(true); }}
            disabled={p.isCurrent}
          >
            <Trash2 className="w-4 h-4 text-danger-600" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) return <PageLoading message="Loading academic periods..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Academic Periods</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage academic years and semesters
          </p>
        </div>
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => { setFormData(emptyForm); setFormErrors({}); setIsAddModalOpen(true); }}
        >
          Add Period
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{periods.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Periods</p>
        </Card>
        <Card className="text-center">
          <div className="flex items-center justify-center gap-2">
            <Star className="w-5 h-5 text-success-600" />
            <p className="text-3xl font-bold text-success-600">
              {periods.filter(p => p.isCurrent).length}
            </p>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Current Period</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-primary-600">
            {new Set(periods.map(p => p.academicYear)).size}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Academic Years</p>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader
          title="All Academic Periods"
          subtitle={`${filtered.length} periods found`}
          action={
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search periods..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-48"
              />
            </div>
          }
        />
        <Table
          columns={columns}
          data={filtered}
          keyExtractor={(p) => p.id}
          emptyMessage="No academic periods found"
        />
      </Card>

      {/* Add Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Academic Period"
        description="Create a new academic semester period"
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Academic Year"
              placeholder="e.g., 2025-2026"
              value={formData.academicYear}
              onChange={(e) => setFormData((p) => ({ ...p, academicYear: e.target.value }))}
              error={formErrors.academicYear}
            />
            <Input
              label="Semester"
              placeholder="e.g., Semester 1"
              value={formData.semester}
              onChange={(e) => setFormData((p) => ({ ...p, semester: e.target.value }))}
              error={formErrors.semester}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
              error={formErrors.startDate}
            />
            <Input
              label="End Date"
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
              error={formErrors.endDate}
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600"
              checked={formData.isCurrent}
              onChange={(e) => setFormData((p) => ({ ...p, isCurrent: e.target.checked }))}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Mark as current period
            </span>
          </label>
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              Add Period
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Academic Period"
        description={selectedPeriod ? `${selectedPeriod.academicYear} — ${selectedPeriod.semester}` : ""}
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Academic Year"
              value={formData.academicYear}
              onChange={(e) => setFormData((p) => ({ ...p, academicYear: e.target.value }))}
              error={formErrors.academicYear}
            />
            <Input
              label="Semester"
              value={formData.semester}
              onChange={(e) => setFormData((p) => ({ ...p, semester: e.target.value }))}
              error={formErrors.semester}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
              error={formErrors.startDate}
            />
            <Input
              label="End Date"
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
              error={formErrors.endDate}
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600"
              checked={formData.isCurrent}
              onChange={(e) => setFormData((p) => ({ ...p, isCurrent: e.target.checked }))}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Mark as current period
            </span>
          </label>
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
        onClose={() => { setIsDeleteModalOpen(false); setSelectedPeriod(null); }}
        onConfirm={handleDelete}
        title="Delete Academic Period"
        message={`Are you sure you want to delete "${selectedPeriod?.academicYear} — ${selectedPeriod?.semester}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
