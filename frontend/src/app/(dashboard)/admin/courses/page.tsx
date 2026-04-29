"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, Button, Badge, PageLoading, Modal, Input } from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { Course, Programme } from "@/types";
import {
  BookOpen, Plus, ArrowLeft, ChevronRight, GraduationCap,
  Users, Trash2, Search, Pencil,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Lecturer { id: string; firstName: string; lastName: string; }

interface CourseForm {
  code: string;
  name: string;
  department: string;
  credits: string;
  lecturer: string;
}

const emptyForm = (): CourseForm => ({
  code: "", name: "", department: "", credits: "3", lecturer: "",
});

type Step = "programme" | "period" | "courses";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminCoursesPage() {
  const [step, setStep] = useState<Step>("programme");

  // Step 1 — programmes
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [selectedProgramme, setSelectedProgramme] = useState<Programme | null>(null);
  const [progSearch, setProgSearch] = useState("");
  const [isLoadingProgs, setIsLoadingProgs] = useState(true);

  // Step 2 — year + semester selection
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);

  // Step 3 — courses
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseSearch, setCourseSearch] = useState("");
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);

  // Add course modal
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [form, setForm] = useState<CourseForm>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  // ── Load programmes ──────────────────────────────────────────────────────────
  useEffect(() => {
    setIsLoadingProgs(true);
    apiClient
      .get<Programme[] | { results: Programme[] }>(API_ENDPOINTS.programmes.list)
      .then((res) => {
        const data = res.data;
        setProgrammes(Array.isArray(data) ? data : (data as any).results ?? []);
      })
      .finally(() => setIsLoadingProgs(false));
  }, []);

  // ── Load lecturers for form ──────────────────────────────────────────────────
  useEffect(() => {
    apiClient
      .get<{ results: Lecturer[] } | Lecturer[]>(`${API_ENDPOINTS.admin.users}?role=lecturer&page_size=200`)
      .then((res) => {
        const data = res.data;
        setLecturers(Array.isArray(data) ? data : (data as any).results ?? []);
      })
      .catch(() => {});
  }, []);

  // ── Load courses for selected programme + year + semester ────────────────────
  const loadCourses = useCallback((prog: Programme, year: number, sem: number) => {
    setIsLoadingCourses(true);
    setCourses([]);
    apiClient
      .get<Course[] | { results: Course[] }>(
        `${API_ENDPOINTS.courses.list}?programme=${prog.id}&year_level=${year}&semester_number=${sem}&page_size=200`
      )
      .then((res) => {
        const data = res.data;
        setCourses(Array.isArray(data) ? data : (data as any).results ?? []);
      })
      .finally(() => setIsLoadingCourses(false));
  }, []);

  const selectProgramme = (prog: Programme) => {
    setSelectedProgramme(prog);
    setSelectedYear(null);
    setSelectedSemester(null);
    setStep("period");
  };

  const selectPeriod = (year: number, sem: number) => {
    setSelectedYear(year);
    setSelectedSemester(sem);
    setCourseSearch("");
    setStep("courses");
    loadCourses(selectedProgramme!, year, sem);
  };

  const goToStep = (s: Step) => {
    setStep(s);
    if (s === "programme") { setSelectedProgramme(null); setSelectedYear(null); setSelectedSemester(null); }
    if (s === "period") { setSelectedYear(null); setSelectedSemester(null); }
  };

  const openCreateModal = () => {
    setEditingCourse(null);
    setForm(emptyForm());
    setFormError(null);
    setShowAddModal(true);
  };

  const openEditModal = (course: Course) => {
    const courseLecturer: unknown = (course as any).lecturer;
    const lecturerId =
      typeof courseLecturer === "string" || typeof courseLecturer === "number"
        ? String(courseLecturer)
        : String((courseLecturer as any)?.id ?? "");

    setEditingCourse(course);
    setForm({
      code: course.code ?? "",
      name: course.name ?? "",
      department: course.department ?? "",
      credits: String((course as any).credits ?? course.creditUnits ?? 3),
      lecturer: lecturerId,
    });
    setFormError(null);
    setShowAddModal(true);
  };

  // ── Save course (create/edit) ────────────────────────────────────────────────
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) { setFormError("Code and name are required."); return; }
    if (!selectedProgramme || selectedYear === null || selectedSemester === null) {
      setFormError("Select programme, year and semester first.");
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      department: form.department.trim() || undefined,
      credits: parseInt(form.credits, 10),
      programme: selectedProgramme.id,
      year_level: selectedYear,
      semester_number: selectedSemester,
      semester: `Semester ${selectedSemester}`,
      lecturer: form.lecturer || null,
    };

    try {
      const res = editingCourse
        ? await apiClient.patch<Course>(API_ENDPOINTS.courses.detail(editingCourse.id), payload)
        : await apiClient.post<Course>(API_ENDPOINTS.courses.list, payload);

      if (editingCourse) {
        setCourses((prev) => prev.map((c) => (c.id === editingCourse.id ? res.data : c)));
      } else {
        setCourses((prev) => [res.data, ...prev]);
      }

      setShowAddModal(false);
      setEditingCourse(null);
    } catch (err: any) {
      const data = err?.response?.data;
      setFormError(typeof data === "object" ? Object.values(data).flat().join(" ") : "Failed to save course.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete course ────────────────────────────────────────────────────────────
  const handleDelete = async (course: Course) => {
    if (!confirm(`Delete ${course.code} — ${course.name}?`)) return;
    setDeletingId(course.id);
    try {
      await apiClient.delete(API_ENDPOINTS.courses.detail(course.id));
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
    } catch { alert("Failed to delete course."); }
    finally { setDeletingId(null); }
  };

  // ── Breadcrumb ───────────────────────────────────────────────────────────────
  const Breadcrumb = () => (
    <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
      <button onClick={() => goToStep("programme")} className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
        Courses
      </button>
      {selectedProgramme && (
        <>
          <ChevronRight className="w-3.5 h-3.5" />
          <button
            onClick={() => goToStep("period")}
            className={step === "period" ? "text-gray-900 dark:text-gray-100 font-medium" : "hover:text-primary-600 dark:hover:text-primary-400 transition-colors"}
          >
            {selectedProgramme.code}
          </button>
        </>
      )}
      {selectedYear !== null && selectedSemester !== null && (
        <>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-900 dark:text-gray-100 font-medium">
            Year {selectedYear} · Semester {selectedSemester}
          </span>
        </>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1 — Programme list
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === "programme") {
    const filtered = programmes.filter((p) =>
      `${p.code} ${p.name}`.toLowerCase().includes(progSearch.toLowerCase())
    );
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Courses</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Select a programme to manage its courses</p>
        </div>

        <input
          type="text"
          placeholder="Search programmes…"
          value={progSearch}
          onChange={(e) => setProgSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
        />

        {isLoadingProgs ? (
          <PageLoading message="Loading programmes…" />
        ) : filtered.length === 0 ? (
          <Card><div className="py-12 text-center text-gray-400">No programmes found.</div></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((prog) => (
              <div key={prog.id} className="cursor-pointer" onClick={() => selectProgramme(prog)}>
                <Card hover>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-lg bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{prog.code}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{prog.name}</p>
                        <p className="text-xs text-gray-400 mt-1">{prog.durationYears} year{prog.durationYears !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2 — Year + Semester picker
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === "period") {
    const years = Array.from({ length: selectedProgramme!.durationYears }, (_, i) => i + 1);
    const semesters = [1, 2];
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => goToStep("programme")}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <Breadcrumb />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
              {selectedProgramme!.code} — {selectedProgramme!.name}
            </h1>
          </div>
        </div>

        <p className="text-gray-500 dark:text-gray-400">Select a year and semester to view its courses</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {years.flatMap((year) =>
            semesters.map((sem) => (
              <div
                key={`${year}:${sem}`}
                className="cursor-pointer"
                onClick={() => selectPeriod(year, sem)}
              >
                <Card hover>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-primary-50 dark:bg-primary-950/40 flex flex-col items-center justify-center shrink-0">
                        <span className="text-xl font-bold text-primary-600 dark:text-primary-400 leading-none">{year}</span>
                        <span className="text-[10px] text-primary-500 dark:text-primary-500 mt-0.5">Year</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          Year {year}, Semester {sem}
                        </p>
                        <p className="text-sm text-gray-400 font-mono">{year}:{sem}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                  </div>
                </Card>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3 — Course list
  // ═══════════════════════════════════════════════════════════════════════════
  const filteredCourses = courses.filter((c) =>
    `${c.code} ${c.name} ${c.department ?? ""}`.toLowerCase().includes(courseSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => goToStep("period")}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <Breadcrumb />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
            {selectedProgramme!.code} — Year {selectedYear}, Semester {selectedSemester}
          </h1>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={openCreateModal}>
          Add Course
        </Button>
      </div>

      {/* Search + count */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search courses…"
            value={courseSearch}
            onChange={(e) => setCourseSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          />
        </div>
        <Badge variant="default">{courses.length} course{courses.length !== 1 ? "s" : ""}</Badge>
      </div>

      {/* Course cards */}
      {isLoadingCourses ? (
        <PageLoading message="Loading courses…" />
      ) : filteredCourses.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
            <BookOpen className="w-10 h-10 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400">
              No courses for {selectedProgramme!.code} Year {selectedYear}:{selectedSemester} yet.
            </p>
            <Button leftIcon={<Plus className="w-4 h-4" />} size="sm" onClick={openCreateModal}>
              Add First Course
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map((course) => (
            <Card key={course.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2.5 rounded-lg bg-warning-50 dark:bg-yellow-950/50 text-warning-600 dark:text-yellow-400 shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{course.code}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{course.name}</p>
                    {course.lecturer && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {course.lecturer.firstName} {course.lecturer.lastName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(course)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-colors"
                    title="Edit course"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(course)}
                    disabled={deletingId === course.id}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950/30 transition-colors"
                    title="Delete course"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="default">{course.creditUnits ?? (course as any).credits} CU</Badge>
                {course.department && <Badge variant="info">{course.department}</Badge>}
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-gray-400">
                <Users className="w-3 h-3" />
                {(course as any).totalStudents ?? course.enrolledStudents ?? 0} enrolled
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Course Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setEditingCourse(null); }}
        title={editingCourse ? "Edit Course" : "Add Course"}
        description={`${selectedProgramme!.code} · Year ${selectedYear} · Semester ${selectedSemester}`}
        size="md"
      >
        <form onSubmit={handleSaveCourse} className="space-y-4">
          {formError && (
            <div className="p-3 bg-danger-50 dark:bg-red-950/30 border border-danger-200 dark:border-red-800 rounded-lg text-sm text-danger-700 dark:text-red-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Course Code *"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="e.g. BIT2101"
              required
            />
            <Input
              label="Credits"
              type="number" min="1" max="6"
              value={form.credits}
              onChange={(e) => setForm((f) => ({ ...f, credits: e.target.value }))}
            />
          </div>

          <Input
            label="Course Name *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Data Structures & Algorithms"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lecturer</label>
            <select
              value={form.lecturer}
              onChange={(e) => setForm((f) => ({ ...f, lecturer: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Unassigned</option>
              {lecturers.map((l) => (
                <option key={l.id} value={l.id}>{l.firstName} {l.lastName}</option>
              ))}
            </select>
          </div>

          {/* Context summary */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-500 dark:text-gray-400 space-y-0.5">
            <div><span className="font-medium text-gray-700 dark:text-gray-300">Programme:</span> {selectedProgramme!.code} — {selectedProgramme!.name}</div>
            <div><span className="font-medium text-gray-700 dark:text-gray-300">Period:</span> Year {selectedYear}, Semester {selectedSemester}</div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => { setShowAddModal(false); setEditingCourse(null); }}>Cancel</Button>
            <Button type="submit" isLoading={saving} leftIcon={<BookOpen className="w-4 h-4" />}>
              {editingCourse ? "Update Course" : "Create Course"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
