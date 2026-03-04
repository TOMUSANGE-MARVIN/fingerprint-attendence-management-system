"use client";

import React, { useState, useEffect } from "react";
import {
  Card, CardHeader, Button, Badge, Table, TableColumn, PageLoading,
} from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { AcademicYear } from "@/types";
import { PlusCircle, CalendarDays, CheckCircle } from "lucide-react";

export default function AcademicYearsPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ label: "", start_year: "", is_current: false, start_date: "", end_date: "" });

  const fetchYears = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get<{ results: AcademicYear[] } | AcademicYear[]>(
        API_ENDPOINTS.academicYears.list
      );
      const data = res.data;
      setYears(Array.isArray(data) ? data : data.results ?? []);
    } catch {
      setYears([
        { id: "1", label: "2022/2023", startYear: 2022, isCurrent: false, createdAt: "" },
        { id: "2", label: "2023/2024", startYear: 2023, isCurrent: false, createdAt: "" },
        { id: "3", label: "2024/2025", startYear: 2024, isCurrent: true, createdAt: "" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchYears(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post(API_ENDPOINTS.academicYears.list, {
        label: form.label,
        start_year: parseInt(form.start_year),
        is_current: form.is_current,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      });
      setShowForm(false);
      setForm({ label: "", start_year: "", is_current: false, start_date: "", end_date: "" });
      fetchYears();
    } catch (err: any) {
      alert(err?.response?.data ? JSON.stringify(err.response.data) : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const setCurrentYear = async (id: string) => {
    try {
      await apiClient.patch(API_ENDPOINTS.academicYears.detail(id), { is_current: true });
      fetchYears();
    } catch {
      alert("Failed to update");
    }
  };

  const columns: TableColumn<AcademicYear>[] = [
    { key: "label", header: "Academic Year", render: (y) => <span className="font-semibold">{y.label}</span> },
    { key: "startYear", header: "Start Year" },
    {
      key: "isCurrent", header: "Status",
      render: (y) => y.isCurrent
        ? <Badge variant="success" dot>Current</Badge>
        : <Badge variant="default">Past</Badge>,
    },
    { key: "startDate", header: "Start Date", render: (y) => y.startDate || "—" },
    { key: "endDate", header: "End Date", render: (y) => y.endDate || "—" },
    {
      key: "id", header: "Actions",
      render: (y) => !y.isCurrent ? (
        <Button size="sm" variant="outline" onClick={() => setCurrentYear(y.id)}
          leftIcon={<CheckCircle className="w-3.5 h-3.5" />}>
          Set Current
        </Button>
      ) : null,
    },
  ];

  if (isLoading) return <PageLoading message="Loading academic years..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Academic Years</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage academic years (e.g. 2024/2025)</p>
        </div>
        <Button leftIcon={<PlusCircle className="w-4 h-4" />} onClick={() => setShowForm(!showForm)}>
          Add Academic Year
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader title="New Academic Year" />
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Label</label>
              <input
                required placeholder="e.g. 2025/2026"
                value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Year</label>
              <input
                required type="number" placeholder="e.g. 2025"
                value={form.start_year} onChange={e => setForm(f => ({ ...f, start_year: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
              <input type="date"
                value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
              <input type="date"
                value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input type="checkbox" id="isCurrent"
                checked={form.is_current} onChange={e => setForm(f => ({ ...f, is_current: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300"
              />
              <label htmlFor="isCurrent" className="text-sm text-gray-700 dark:text-gray-300">Mark as current academic year</label>
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <Button type="submit" isLoading={saving}>Save</Button>
              <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <Table data={years} columns={columns} keyExtractor={(y) => y.id} emptyMessage="No academic years found" />
      </Card>
    </div>
  );
}
