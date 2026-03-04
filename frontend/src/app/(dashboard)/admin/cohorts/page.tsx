"use client";

import React, { useState, useEffect } from "react";
import {
  Card, CardHeader, Button, Badge, Table, TableColumn, PageLoading,
} from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { Cohort, Programme, AcademicYear } from "@/types";
import { PlusCircle, Users } from "lucide-react";

export default function CohortsPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ programme: "", intake_year: "" });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [cohortRes, progRes, yearRes] = await Promise.all([
        apiClient.get<{ results: Cohort[] } | Cohort[]>(API_ENDPOINTS.cohorts.list),
        apiClient.get<{ results: Programme[] } | Programme[]>(API_ENDPOINTS.programmes.list),
        apiClient.get<{ results: AcademicYear[] } | AcademicYear[]>(API_ENDPOINTS.academicYears.list),
      ]);
      setCohorts(
        Array.isArray(cohortRes.data) ? cohortRes.data : (cohortRes.data as any).results ?? []
      );
      setProgrammes(
        Array.isArray(progRes.data) ? progRes.data : (progRes.data as any).results ?? []
      );
      setAcademicYears(
        Array.isArray(yearRes.data) ? yearRes.data : (yearRes.data as any).results ?? []
      );
    } catch {
      setCohorts([
        {
          id: "1", programme: "1", programmeCode: "BIT", programmeName: "Bachelor of IT",
          intakeYear: "3", intakeYearLabel: "2022/2023", name: "BIT 2022/2023",
          currentYearOfStudy: 3, currentSemesterLabel: "3:1",
          studentCount: 4, isActive: true, createdAt: "",
        },
        {
          id: "2", programme: "1", programmeCode: "BIT", programmeName: "Bachelor of IT",
          intakeYear: "2", intakeYearLabel: "2023/2024", name: "BIT 2023/2024",
          currentYearOfStudy: 2, currentSemesterLabel: "2:1",
          studentCount: 5, isActive: true, createdAt: "",
        },
        {
          id: "3", programme: "2", programmeCode: "DIT", programmeName: "Diploma in IT",
          intakeYear: "3", intakeYearLabel: "2024/2025", name: "DIT 2024/2025",
          currentYearOfStudy: 1, currentSemesterLabel: "1:1",
          studentCount: 3, isActive: true, createdAt: "",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.programme || !form.intake_year) return;
    setSaving(true);
    try {
      await apiClient.post(API_ENDPOINTS.cohorts.list, {
        programme: form.programme,
        intake_year: form.intake_year,
      });
      setShowForm(false);
      setForm({ programme: "", intake_year: "" });
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data ? JSON.stringify(err.response.data) : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumn<Cohort>[] = [
    {
      key: "name", header: "Cohort",
      render: (c) => <span className="font-semibold text-gray-900 dark:text-white">{c.name}</span>,
    },
    {
      key: "programmeCode", header: "Programme",
      render: (c) => (
        <div>
          <span className="font-mono text-xs font-bold text-primary-600 dark:text-primary-400">{c.programmeCode}</span>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.programmeName}</p>
        </div>
      ),
    },
    { key: "intakeYearLabel", header: "Intake Year" },
    {
      key: "currentSemesterLabel", header: "Current Semester",
      render: (c) => c.currentSemesterLabel
        ? (
          <span className="font-mono font-bold text-lg text-primary-600 dark:text-primary-400">
            {c.currentSemesterLabel}
          </span>
        )
        : <span className="text-gray-400">—</span>,
    },
    {
      key: "coordinatorName", header: "Coordinator",
      render: (c) => c.coordinatorName || <span className="text-gray-400">Unassigned</span>,
    },
    {
      key: "studentCount", header: "Students",
      render: (c) => <Badge variant="default">{c.studentCount}</Badge>,
    },
    {
      key: "isActive", header: "Status",
      render: (c) => c.isActive
        ? <Badge variant="success">Active</Badge>
        : <Badge variant="danger">Inactive</Badge>,
    },
  ];

  if (isLoading) return <PageLoading message="Loading cohorts..." />;

  const activeCohorts = cohorts.filter(c => c.isActive);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cohorts</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Each cohort is a programme + intake year (e.g. BIT 2023/2024 = Year 2 students)
          </p>
        </div>
        <Button leftIcon={<PlusCircle className="w-4 h-4" />} onClick={() => setShowForm(!showForm)}>
          New Cohort
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{activeCohorts.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Active Cohorts</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-primary-600">
            {activeCohorts.reduce((s, c) => s + c.studentCount, 0)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Students</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-success-600">
            {new Set(activeCohorts.map(c => c.programmeCode)).size}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Programmes</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-gray-700 dark:text-gray-300">
            {new Set(activeCohorts.map(c => c.intakeYearLabel)).size}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Intake Years</p>
        </Card>
      </div>

      {showForm && (
        <Card>
          <CardHeader title="New Cohort" subtitle="Select a programme and intake year" />
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Programme</label>
              <select
                required value={form.programme}
                onChange={e => setForm(f => ({ ...f, programme: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">Select programme…</option>
                {programmes.map(p => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Intake Year</label>
              <select
                required value={form.intake_year}
                onChange={e => setForm(f => ({ ...f, intake_year: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">Select year…</option>
                {academicYears.map(y => (
                  <option key={y.id} value={y.id}>{y.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <Button type="submit" isLoading={saving}>Create Cohort</Button>
              <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Group by programme */}
      {programmes.filter(p => cohorts.some(c => c.programmeCode === p.code)).map(prog => {
        const progCohorts = cohorts.filter(c => c.programmeCode === prog.code);
        return (
          <Card key={prog.id}>
            <CardHeader
              title={`${prog.code} — ${prog.name}`}
              subtitle={`${prog.durationYears}-year programme · ${progCohorts.length} cohort${progCohorts.length !== 1 ? "s" : ""}`}
            />
            <Table data={progCohorts} columns={columns} keyExtractor={(c) => c.id} emptyMessage="No cohorts" />
          </Card>
        );
      })}

      {cohorts.length === 0 && (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">No cohorts yet. Create one above.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
