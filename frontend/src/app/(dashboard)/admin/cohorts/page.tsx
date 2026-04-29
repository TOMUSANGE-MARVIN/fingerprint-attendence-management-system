"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, Button, Badge, PageLoading, Modal } from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { Cohort, CohortGroupCoordinator, Programme, AcademicYear } from "@/types";
import { PlusCircle, Users, Crown, X, Sun, Moon, Calendar } from "lucide-react";

const STUDY_TIMES = ["day", "evening", "weekend"] as const;
type StudyTime = typeof STUDY_TIMES[number];

const GROUP_META: Record<StudyTime, { label: string; icon: React.ReactNode; color: string }> = {
  day:     { label: "Day",     icon: <Sun className="w-4 h-4" />,      color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800" },
  evening: { label: "Evening", icon: <Moon className="w-4 h-4" />,     color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800" },
  weekend: { label: "Weekend", icon: <Calendar className="w-4 h-4" />, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800" },
};

interface CohortStudent {
  id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  email: string;
  studyTime: string;
}

// ── per-group coordinator picker ─────────────────────────────────────────────
interface GroupPickerModal {
  cohort: Cohort;
  studyTime: StudyTime;
}

export default function CohortsPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ programme: "", intake_year: "" });

  // Coordinator modal (one group at a time)
  const [pickerModal, setPickerModal] = useState<GroupPickerModal | null>(null);
  const [groupStudents, setGroupStudents] = useState<CohortStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [settingCoordinator, setSettingCoordinator] = useState(false);
  const [coordinatorError, setCoordinatorError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [cohortRes, progRes, yearRes] = await Promise.all([
        apiClient.get<{ results: Cohort[] } | Cohort[]>(API_ENDPOINTS.cohorts.list),
        apiClient.get<{ results: Programme[] } | Programme[]>(API_ENDPOINTS.programmes.list),
        apiClient.get<{ results: AcademicYear[] } | AcademicYear[]>(API_ENDPOINTS.academicYears.list),
      ]);
      setCohorts(Array.isArray(cohortRes.data) ? cohortRes.data : (cohortRes.data as any).results ?? []);
      setProgrammes(Array.isArray(progRes.data) ? progRes.data : (progRes.data as any).results ?? []);
      setAcademicYears(Array.isArray(yearRes.data) ? yearRes.data : (yearRes.data as any).results ?? []);
    } catch {
      setCohorts([]);
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
      await apiClient.post(API_ENDPOINTS.cohorts.list, { programme: form.programme, intake_year: form.intake_year });
      setShowForm(false);
      setForm({ programme: "", intake_year: "" });
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data ? JSON.stringify(err.response.data) : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const openPicker = async (cohort: Cohort, studyTime: StudyTime) => {
    setPickerModal({ cohort, studyTime });
    setCoordinatorError(null);
    setGroupStudents([]);
    setLoadingStudents(true);
    try {
      const res = await apiClient.get<{ results: CohortStudent[] } | CohortStudent[]>(
        `${API_ENDPOINTS.admin.users}?role=student&cohort=${cohort.id}&study_time=${studyTime}&page_size=200`
      );
      const data = res.data;
      setGroupStudents(Array.isArray(data) ? data : (data as any).results ?? []);
    } catch {
      setGroupStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleSetCoordinator = async (studentId: string | null) => {
    if (!pickerModal) return;
    setSettingCoordinator(true);
    setCoordinatorError(null);
    const { cohort, studyTime } = pickerModal;
    try {
      const res = await apiClient.post<{ coordinatorId: string; coordinatorName: string }>(
        API_ENDPOINTS.cohorts.setStudentCoordinator(cohort.id),
        { student_id: studentId, study_time: studyTime }
      );
      setCohorts((prev) =>
        prev.map((c) => {
          if (c.id !== cohort.id) return c;
          const updated: Record<string, CohortGroupCoordinator> = { ...(c.groupCoordinators ?? {}) };
          if (studentId === null) {
            delete updated[studyTime];
          } else {
            updated[studyTime] = { coordinatorId: res.data.coordinatorId ?? null, coordinatorName: res.data.coordinatorName ?? null };
          }
          return { ...c, groupCoordinators: updated };
        })
      );
      setPickerModal(null);
    } catch (err: any) {
      setCoordinatorError(err?.response?.data?.error || "Failed to set coordinator.");
    } finally {
      setSettingCoordinator(false);
    }
  };

  if (isLoading) return <PageLoading message="Loading cohorts..." />;

  const activeCohorts = cohorts.filter((c) => c.isActive);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cohorts</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Set a class coordinator for each study-time group (Day, Evening, Weekend).
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
          <p className="text-sm text-gray-500 mt-1">Active Cohorts</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-primary-600">{activeCohorts.reduce((s, c) => s + c.studentCount, 0)}</p>
          <p className="text-sm text-gray-500 mt-1">Total Students</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-success-600">{new Set(activeCohorts.map((c) => c.programmeCode)).size}</p>
          <p className="text-sm text-gray-500 mt-1">Programmes</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-yellow-600">
            {activeCohorts.reduce((sum, c) => sum + Object.keys(c.groupCoordinators ?? {}).length, 0)}
          </p>
          <p className="text-sm text-gray-500 mt-1">Groups with Coordinators</p>
        </Card>
      </div>

      {/* New cohort form */}
      {showForm && (
        <Card>
          <CardHeader title="New Cohort" subtitle="Select a programme and intake year" />
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Programme</label>
              <select
                required value={form.programme}
                onChange={(e) => setForm((f) => ({ ...f, programme: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">Select programme…</option>
                {programmes.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Intake Year</label>
              <select
                required value={form.intake_year}
                onChange={(e) => setForm((f) => ({ ...f, intake_year: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">Select year…</option>
                {academicYears.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <Button type="submit" isLoading={saving}>Create Cohort</Button>
              <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Cohort list grouped by programme */}
      {programmes.filter((p) => cohorts.some((c) => c.programmeCode === p.code)).map((prog) => (
        <Card key={prog.id}>
          <CardHeader
            title={`${prog.code} — ${prog.name}`}
            subtitle={`${prog.durationYears}-year programme`}
          />
          <div className="space-y-4">
            {cohorts.filter((c) => c.programmeCode === prog.code).map((cohort) => (
              <div key={cohort.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                {/* Cohort header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900 dark:text-white">{cohort.name}</span>
                    {cohort.currentSemesterLabel && (
                      <span className="font-mono text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40 px-2 py-0.5 rounded">
                        Sem {cohort.currentSemesterLabel}
                      </span>
                    )}
                    <Badge variant="default">
                      <Users className="w-3 h-3 mr-1 inline" />
                      {cohort.studentCount} students
                    </Badge>
                  </div>
                  <Badge variant={cohort.isActive ? "success" : "danger"}>
                    {cohort.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                {/* Study-time groups */}
                <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {STUDY_TIMES.map((st) => {
                    const meta = GROUP_META[st];
                    const gc = cohort.groupCoordinators?.[st];
                    return (
                      <div key={st} className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900">
                        {/* Group label */}
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold shrink-0 ${meta.color}`}>
                            {meta.icon}
                            {meta.label}
                          </span>

                          {/* Coordinator name or placeholder */}
                          {gc?.coordinatorName ? (
                            <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800 dark:text-gray-200">
                              <Crown className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                              {gc.coordinatorName}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400 dark:text-gray-500 italic">No coordinator set</span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {gc?.coordinatorName && (
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<X className="w-3.5 h-3.5" />}
                              onClick={async () => {
                                setPickerModal({ cohort, studyTime: st });
                                setSettingCoordinator(true);
                                setCoordinatorError(null);
                                try {
                                  await apiClient.post(
                                    API_ENDPOINTS.cohorts.setStudentCoordinator(cohort.id),
                                    { student_id: null, study_time: st }
                                  );
                                  setCohorts((prev) => prev.map((c) => {
                                    if (c.id !== cohort.id) return c;
                                    const updated = { ...(c.groupCoordinators ?? {}) };
                                    delete updated[st];
                                    return { ...c, groupCoordinators: updated };
                                  }));
                                } catch (err: any) {
                                  setCoordinatorError(err?.response?.data?.error || "Failed to remove coordinator.");
                                } finally {
                                  setSettingCoordinator(false);
                                  setPickerModal(null);
                                }
                              }}
                            >
                              Remove
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Crown className="w-3.5 h-3.5" />}
                            onClick={() => openPicker(cohort, st)}
                          >
                            {gc?.coordinatorName ? "Change" : "Set Coordinator"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}

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

      {/* Student picker modal */}
      <Modal
        isOpen={!!pickerModal}
        onClose={() => { if (!settingCoordinator) setPickerModal(null); }}
        title={`Set ${pickerModal ? GROUP_META[pickerModal.studyTime].label : ""} Coordinator`}
        description={pickerModal ? `Choose a ${pickerModal.studyTime} student from ${pickerModal.cohort.name}` : ""}
        size="md"
      >
        {coordinatorError && (
          <div className="mb-4 p-3 bg-danger-50 dark:bg-red-950/30 border border-danger-200 dark:border-red-800 rounded-lg text-sm text-danger-700 dark:text-red-300">
            {coordinatorError}
          </div>
        )}

        {loadingStudents ? (
          <div className="py-8 text-center text-gray-400">Loading students…</div>
        ) : groupStudents.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            No {pickerModal?.studyTime} students in this cohort.
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {groupStudents.map((s) => {
              const isCurrent = pickerModal?.cohort.groupCoordinators?.[pickerModal.studyTime]?.coordinatorId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => handleSetCoordinator(s.id)}
                  disabled={settingCoordinator}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/20 transition-all text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold text-sm flex-shrink-0">
                    {s.firstName[0]}{s.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{s.firstName} {s.lastName}</p>
                    <p className="text-xs text-gray-500 truncate">{s.studentId} · {s.email}</p>
                  </div>
                  {isCurrent && <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 pt-4 border-t dark:border-gray-700 flex justify-end">
          <Button variant="outline" onClick={() => setPickerModal(null)} disabled={settingCoordinator}>Close</Button>
        </div>
      </Modal>
    </div>
  );
}
