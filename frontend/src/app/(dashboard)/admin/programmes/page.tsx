"use client";

import React, { useState, useEffect } from "react";
import {
  Card, CardHeader, Button, Badge, Table, TableColumn, PageLoading,
} from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { Programme } from "@/types";
import { PlusCircle } from "lucide-react";

export default function ProgrammesPage() {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", duration_years: "3" });

  const fetchProgrammes = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get<{ results: Programme[] } | Programme[]>(
        API_ENDPOINTS.programmes.list
      );
      const data = res.data;
      setProgrammes(Array.isArray(data) ? data : data.results ?? []);
    } catch {
      setProgrammes([
        { id: "1", code: "BIT", name: "Bachelor of Information Technology", durationYears: 3, isActive: true, cohortCount: 3, createdAt: "" },
        { id: "2", code: "DIT", name: "Diploma in Information Technology", durationYears: 2, isActive: true, cohortCount: 2, createdAt: "" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchProgrammes(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post(API_ENDPOINTS.programmes.list, {
        code: form.code,
        name: form.name,
        duration_years: parseInt(form.duration_years),
      });
      setShowForm(false);
      setForm({ code: "", name: "", duration_years: "3" });
      fetchProgrammes();
    } catch (err: any) {
      alert(err?.response?.data ? JSON.stringify(err.response.data) : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Programme) => {
    try {
      await apiClient.patch(API_ENDPOINTS.programmes.detail(p.id), { is_active: !p.isActive });
      fetchProgrammes();
    } catch { alert("Failed to update"); }
  };

  const columns: TableColumn<Programme>[] = [
    {
      key: "code", header: "Code",
      render: (p) => (
        <span className="font-mono font-bold text-primary-600 dark:text-primary-400 px-2 py-0.5 bg-primary-50 dark:bg-primary-950/30 rounded">
          {p.code}
        </span>
      ),
    },
    { key: "name", header: "Programme Name", render: (p) => <span className="font-medium">{p.name}</span> },
    {
      key: "durationYears", header: "Duration",
      render: (p) => `${p.durationYears} year${p.durationYears !== 1 ? "s" : ""}`,
    },
    { key: "cohortCount", header: "Cohorts", render: (p) => <Badge variant="default">{p.cohortCount}</Badge> },
    {
      key: "isActive", header: "Status",
      render: (p) => p.isActive
        ? <Badge variant="success">Active</Badge>
        : <Badge variant="danger">Inactive</Badge>,
    },
    {
      key: "id", header: "Actions",
      render: (p) => (
        <Button size="sm" variant="outline" onClick={() => toggleActive(p)}>
          {p.isActive ? "Deactivate" : "Activate"}
        </Button>
      ),
    },
  ];

  if (isLoading) return <PageLoading message="Loading programmes..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Programmes</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage degree programmes (BIT, DIT, etc.)
          </p>
        </div>
        <Button leftIcon={<PlusCircle className="w-4 h-4" />} onClick={() => setShowForm(!showForm)}>
          Add Programme
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{programmes.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Programmes</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-success-600">{programmes.filter(p => p.isActive).length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Active</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-primary-600">
            {programmes.reduce((sum, p) => sum + p.cohortCount, 0)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Cohorts</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-gray-700 dark:text-gray-300">
            {programmes.filter(p => p.durationYears >= 3).length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Degree Programmes</p>
        </Card>
      </div>

      {showForm && (
        <Card>
          <CardHeader title="New Programme" />
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Code</label>
              <input
                required placeholder="e.g. BSc.CS"
                value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (years)</label>
              <select
                value={form.duration_years} onChange={e => setForm(f => ({ ...f, duration_years: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              >
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} year{n > 1 ? "s" : ""}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
              <input
                required placeholder="e.g. Bachelor of Information Technology"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <Button type="submit" isLoading={saving}>Save</Button>
              <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <Table data={programmes} columns={columns} keyExtractor={(p) => p.id} emptyMessage="No programmes found" />
      </Card>
    </div>
  );
}
