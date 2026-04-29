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
import { TimetableSlot, Course, StudyTime, Faculty as Department, Programme, AcademicYear } from "@/types";
import {
  Clock,
  Plus,
  Trash2,
  ChevronRight,
  BookOpen,
  Calendar,
  Sun,
  Moon,
  CalendarDays,
  ArrowLeft,
  Building2,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS    = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DAY_KEYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const dayLabel = (d: string) => d.charAt(0).toUpperCase() + d.slice(1);

const STUDY_TIME_OPTIONS: { value: StudyTime; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "day",     label: "Day",     icon: <Sun className="w-5 h-5" />,          desc: "Morning & afternoon classes" },
  { value: "evening", label: "Evening", icon: <Moon className="w-5 h-5" />,         desc: "Evening classes (5pm+)" },
  { value: "weekend", label: "Weekend", icon: <CalendarDays className="w-5 h-5" />, desc: "Saturday & Sunday classes" },
];

interface SlotFormData {
  courseId:   string;
  dayOfWeek:  string;
  startTime:  string;
  endTime:    string;
  room:       string;
}
const emptySlotForm: SlotFormData = { courseId: "", dayOfWeek: "monday", startTime: "08:00", endTime: "10:00", room: "" };

const YEAR_OPTIONS     = [1, 2, 3, 4];
const SEMESTER_OPTIONS = [1, 2];

type Step = "department" | "programme" | "year" | "semester" | "session" | "timetable";

export default function AdminTimetablesPage() {

  // ── Wizard ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("department");

  const [departments,        setDepartments]        = useState<Department[]>([]);
  const [selectedDepartment,  setSelectedDepartment]  = useState<Department | null>(null);
  const [departmentSearch,    setDepartmentSearch]    = useState("");
  const [isLoadingInit,    setIsLoadingInit]    = useState(true);

  const [programmes,         setProgrammes]         = useState<Programme[]>([]);
  const [selectedProgramme,  setSelectedProgramme]  = useState<Programme | null>(null);
  const [programmeSearch,    setProgrammeSearch]    = useState("");
  const [isLoadingProgrammes,setIsLoadingProgrammes]= useState(false);

  const [academicYears,        setAcademicYears]        = useState<AcademicYear[]>([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<AcademicYear | null>(null);
  const [isLoadingYears,       setIsLoadingYears]       = useState(false);

  const [selectedYear,      setSelectedYear]      = useState<number>(1);
  const [selectedSemester,  setSelectedSemester]  = useState<number>(1);
  const [selectedStudyTime, setSelectedStudyTime] = useState<StudyTime>("day");

  // ── Timetable data ──────────────────────────────────────────────────────────
  const [slots,         setSlots]         = useState<TimetableSlot[]>([]);
  const [isLoadingSlots,setIsLoadingSlots]= useState(false);

  // Courses for the add-slot dropdown (filtered by programme + year + semester)
  const [courses,         setCourses]         = useState<Course[]>([]);
  const [isLoadingCourses,setIsLoadingCourses]= useState(false);


  // ── Add slot modal ──────────────────────────────────────────────────────────
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [slotForm,       setSlotForm]       = useState<SlotFormData>(emptySlotForm);
  const [slotFormError,  setSlotFormError]  = useState<string | null>(null);
  const [isSubmitting,   setIsSubmitting]   = useState(false);

  // ── Delete modal ────────────────────────────────────────────────────────────
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedSlot,      setSelectedSlot]      = useState<TimetableSlot | null>(null);
  const [isDeleting,        setIsDeleting]        = useState(false);
  const [deleteError,       setDeleteError]       = useState<string | null>(null);

  // ── Boot: load departments ────────────────────────────────────────────────────
  useEffect(() => {
    apiClient.get<any>(API_ENDPOINTS.faculties.list)
      .then((r) => { const d = r.data; setDepartments(Array.isArray(d) ? d : d.results ?? []); })
      .catch(() => setDepartments([]))
      .finally(() => setIsLoadingInit(false));
  }, []);

  // ── Wizard handlers ─────────────────────────────────────────────────────────
  const handleSelectDepartment = async (f: Department) => {
    setSelectedDepartment(f);
    setSelectedProgramme(null);
    setSelectedAcademicYear(null);
    setProgrammeSearch("");
    setStep("programme");
    setIsLoadingProgrammes(true);
    try {
      const res = await apiClient.get<any>(`${API_ENDPOINTS.programmes.list}?department=${f.id}`);
      const d   = res.data;
      setProgrammes(Array.isArray(d) ? d : d.results ?? []);
    } catch { setProgrammes([]); }
    finally { setIsLoadingProgrammes(false); }
  };

  const handleSelectProgramme = async (p: Programme) => {
    setSelectedProgramme(p);
    setSelectedAcademicYear(null);
    setStep("year");
    setIsLoadingYears(true);
    try {
      const res = await apiClient.get<any>(API_ENDPOINTS.academicYears.list);
      const d   = res.data;
      setAcademicYears(Array.isArray(d) ? d : d.results ?? []);
    } catch { setAcademicYears([]); }
    finally { setIsLoadingYears(false); }
  };

  const handleSelectYear = (y: AcademicYear) => {
    setSelectedAcademicYear(y);
    setStep("semester");
  };

  const handleViewTimetable = async () => {
    if (!selectedProgramme) return;
    setStep("timetable");
    setIsLoadingSlots(true);
    setIsLoadingCourses(true);
    try {
      const [slotsRes, coursesRes] = await Promise.all([
        apiClient.get<any>(
          `${API_ENDPOINTS.timetable.list}?programme=${selectedProgramme.id}&study_time=${selectedStudyTime}&year_level=${selectedYear}&semester_number=${selectedSemester}`
        ),
        apiClient.get<any>(`${API_ENDPOINTS.courses.list}?programme=${selectedProgramme.id}&year_level=${selectedYear}&semester_number=${selectedSemester}`),
      ]);
      const sd = slotsRes.data;
      setSlots(Array.isArray(sd) ? sd : sd.results ?? []);
      const cd = coursesRes.data;
      setCourses(Array.isArray(cd) ? cd : cd.results ?? []);
    } catch {
      setSlots([]);
      setCourses([]);
    } finally {
      setIsLoadingSlots(false);
      setIsLoadingCourses(false);
    }
  };

  // ── Add slot ────────────────────────────────────────────────────────────────
  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSlotFormError(null);
    if (!slotForm.courseId)          { setSlotFormError("Please select a course."); return; }
    if (!slotForm.room.trim())       { setSlotFormError("Venue is required."); return; }
    if (slotForm.startTime >= slotForm.endTime) { setSlotFormError("End time must be after start time."); return; }
    setIsSubmitting(true);
    try {
      const res = await apiClient.post<TimetableSlot>(API_ENDPOINTS.timetable.list, {
        course:       slotForm.courseId,

        day_of_week:  slotForm.dayOfWeek,
        start_time:   slotForm.startTime,
        end_time:     slotForm.endTime,
        room:         slotForm.room,
        study_time:   selectedStudyTime,
      });
      setSlots((p) => [...p, res.data]);
      setIsAddModalOpen(false);
      setSlotForm(emptySlotForm);
    } catch (err: any) {
      const d = err?.response?.data;
      setSlotFormError(typeof d === "object" ? Object.values(d).flat().join(" ") : "Failed to create slot.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete slot ─────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!selectedSlot) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(API_ENDPOINTS.timetable.detail(selectedSlot.id));
      setSlots((p) => p.filter((s) => s.id !== selectedSlot.id));
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      setDeleteError(err?.response?.data?.detail || "Failed to delete slot.");
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Table columns ───────────────────────────────────────────────────────────
  const columns: TableColumn<TimetableSlot>[] = [
    {
      key: "course", header: "Course",
      render: (s) => (
        <div>
          <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{(s as any).courseCode ?? "—"}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{(s as any).courseName ?? ""}</p>
        </div>
      ),
    },
    {
      key: "lecturer", header: "Lecturer",
      render: (s) => (
        <span className="text-gray-700 dark:text-gray-300 text-sm">
          {(s as any).lecturerName ?? <span className="text-gray-400 italic text-xs">Unassigned</span>}
        </span>
      ),
    },
    {
      key: "day", header: "Day",
      render: (s) => <span className="font-medium text-gray-800 dark:text-gray-200">{dayLabel(s.dayOfWeek)}</span>,
    },
    {
      key: "time", header: "Time",
      render: (s) => (
        <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
          <Clock className="w-4 h-4 text-gray-400" />
          {s.startTime} – {s.endTime}
        </div>
      ),
    },
    {
      key: "room", header: "Venue",
      render: (s) => <span className="text-gray-600 dark:text-gray-400">{s.room ?? (s as any).building ?? "—"}</span>,
    },
    {
      key: "studyTime", header: "Session", align: "center",
      render: (s) => <Badge variant="default" className="capitalize">{s.studyTime ?? "day"}</Badge>,
    },
    {
      key: "status", header: "Status", align: "center",
      render: (s) => <Badge variant={s.isActive ? "success" : "default"} dot>{s.isActive ? "Active" : "Inactive"}</Badge>,
    },
    {
      key: "actions", header: "", align: "right",
      render: (s) => (
        <Button size="sm" variant="ghost"
          onClick={() => { setSelectedSlot(s); setDeleteError(null); setIsDeleteModalOpen(true); }}
          className="text-danger-600 hover:text-danger-700 hover:bg-danger-50"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  const filteredDepartments  = departments.filter((f) => `${f.code} ${f.name}`.toLowerCase().includes(departmentSearch.toLowerCase()));
  const filteredProgrammes = programmes.filter((p) => `${p.code} ${p.name}`.toLowerCase().includes(programmeSearch.toLowerCase()));

  if (isLoadingInit) return <PageLoading message="Loading timetables..." />;

  // ── Breadcrumb ──────────────────────────────────────────────────────────────
  const breadcrumb = (
    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6 flex-wrap">
      <button onClick={() => { setStep("department"); setSelectedDepartment(null); setSelectedProgramme(null); setSelectedAcademicYear(null); }}
        className={cn("hover:text-primary-600 transition-colors", step === "department" ? "text-primary-600 font-medium" : "")}>
        Departments
      </button>
      {selectedDepartment && (
        <>
          <ChevronRight className="w-3.5 h-3.5" />
          <button onClick={() => { setStep("programme"); setSelectedProgramme(null); setSelectedAcademicYear(null); }}
            className={cn("hover:text-primary-600 transition-colors", step === "programme" ? "text-primary-600 font-medium" : "")}>
            {selectedDepartment.code}
          </button>
        </>
      )}
      {selectedProgramme && (
        <>
          <ChevronRight className="w-3.5 h-3.5" />
          <button onClick={() => { setStep("year"); setSelectedAcademicYear(null); }}
            className={cn("hover:text-primary-600 transition-colors", step === "year" ? "text-primary-600 font-medium" : "")}>
            {selectedProgramme.code}
          </button>
        </>
      )}
      {selectedAcademicYear && (
        <>
          <ChevronRight className="w-3.5 h-3.5" />
          <button onClick={() => { setStep("year"); }}
            className={cn("hover:text-primary-600 transition-colors", step === "year" ? "text-primary-600 font-medium" : "")}>
            {selectedAcademicYear.label}
          </button>
        </>
      )}
      {selectedAcademicYear && step !== "year" && (
        <>
          <ChevronRight className="w-3.5 h-3.5" />
          <button onClick={() => setStep("semester")}
            className={cn("hover:text-primary-600 transition-colors", step === "semester" ? "text-primary-600 font-medium" : "")}>
            {selectedYear}:{selectedSemester}
          </button>
        </>
      )}
      {(step === "session" || step === "timetable") && (
        <>
          <ChevronRight className="w-3.5 h-3.5" />
          <button onClick={() => setStep("session")}
            className={cn("hover:text-primary-600 transition-colors", step === "session" ? "text-primary-600 font-medium" : "")}>
            {selectedStudyTime.charAt(0).toUpperCase() + selectedStudyTime.slice(1)}
          </button>
        </>
      )}
      {step === "timetable" && (
        <>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-primary-600 font-medium">Timetable</span>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Timetables</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage course schedules</p>
        </div>
        {step === "timetable" && (
          <Button leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => { setSlotForm(emptySlotForm); setSlotFormError(null); setIsAddModalOpen(true); }}>
            Add Slot
          </Button>
        )}
      </div>

      {breadcrumb}

      {/* ── Step 1: Department ──────────────────────────────────────────────────── */}
      {step === "department" && (
        <Card>
          <CardHeader title="Select a Department" subtitle="Start by choosing the department"
            action={
              <input type="text" placeholder="Search departments..." value={departmentSearch}
                onChange={(e) => setDepartmentSearch(e.target.value)}
                className="w-48 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredDepartments.length === 0
              ? <p className="col-span-3 text-center text-gray-400 py-10">No departments found.</p>
              : filteredDepartments.map((f) => (
                <button key={f.id} onClick={() => handleSelectDepartment(f)}
                  className="flex items-center gap-3 p-4 rounded-xl border-2 border-gray-100 dark:border-gray-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/20 text-left transition-all group">
                  <div className="p-2.5 bg-primary-50 dark:bg-primary-900/30 rounded-lg group-hover:bg-primary-100 transition-colors">
                    <Building2 className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{f.code}</p>
                    <p className="text-xs text-gray-500 truncate">{f.name}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 flex-shrink-0" />
                </button>
              ))
            }
          </div>
        </Card>
      )}

      {/* ── Step 2: Programme ────────────────────────────────────────────────── */}
      {step === "programme" && selectedDepartment && (
        <div className="space-y-4">
          <button onClick={() => setStep("department")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to departments
          </button>
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg w-fit">
            <Building2 className="w-4 h-4 text-primary-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{selectedDepartment.code} — {selectedDepartment.name}</span>
          </div>
          <Card>
            <CardHeader title="Select a Programme"
              action={
                <input type="text" placeholder="Search..." value={programmeSearch}
                  onChange={(e) => setProgrammeSearch(e.target.value)}
                  className="w-48 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
              }
            />
            {isLoadingProgrammes ? (
              <div className="py-10 text-center text-gray-400">Loading programmes...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredProgrammes.length === 0
                  ? <p className="col-span-3 text-center text-gray-400 py-10">No programmes found.</p>
                  : filteredProgrammes.map((p) => (
                    <button key={p.id} onClick={() => handleSelectProgramme(p)}
                      className="flex items-center gap-3 p-4 rounded-xl border-2 border-gray-100 dark:border-gray-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/20 text-left transition-all group">
                      <div className="p-2.5 bg-primary-50 dark:bg-primary-900/30 rounded-lg group-hover:bg-primary-100 transition-colors">
                        <GraduationCap className="w-5 h-5 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{p.code}</p>
                        <p className="text-xs text-gray-500 truncate">{p.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{p.durationYears} years</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 flex-shrink-0" />
                    </button>
                  ))
                }
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Step 3: Academic Year ────────────────────────────────────────────── */}
      {step === "year" && selectedProgramme && (
        <div className="space-y-4">
          <button onClick={() => setStep("programme")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to programmes
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Building2 className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{selectedDepartment?.code}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <GraduationCap className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{selectedProgramme.code} — {selectedProgramme.name}</span>
            </div>
          </div>
          <Card>
            <CardHeader title="Select an Academic Year" subtitle="Choose the academic year for this timetable" />
            {isLoadingYears ? (
              <div className="py-10 text-center text-gray-400">Loading academic years...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {academicYears.length === 0
                  ? <p className="col-span-3 text-center text-gray-400 py-10">No academic years found.</p>
                  : academicYears.map((y) => (
                    <button key={y.id} onClick={() => handleSelectYear(y)}
                      className="flex items-center gap-3 p-4 rounded-xl border-2 border-gray-100 dark:border-gray-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/20 text-left transition-all group">
                      <div className="p-2.5 bg-primary-50 dark:bg-primary-900/30 rounded-lg group-hover:bg-primary-100 transition-colors">
                        <Calendar className="w-5 h-5 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{y.label}</p>
                        {y.isCurrent && <Badge variant="success" className="text-xs mt-1">Current</Badge>}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 flex-shrink-0" />
                    </button>
                  ))
                }
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Step 4: Year & Semester ──────────────────────────────────────────── */}
      {step === "semester" && selectedAcademicYear && (
        <div className="space-y-5">
          <button onClick={() => setStep("year")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to academic years
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { icon: <Building2 className="w-4 h-4 text-primary-500" />,    label: selectedDepartment?.code },
              { icon: <GraduationCap className="w-4 h-4 text-primary-500" />, label: selectedProgramme?.code },
              { icon: <Calendar className="w-4 h-4 text-primary-500" />,      label: selectedAcademicYear.label },
            ].map((item, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  {item.icon}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          <Card>
            <CardHeader title="Year & Semester" subtitle='Select the year of study and semester, e.g. "3:1" = Year 3, Semester 1' />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Year of study */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Year of Study</p>
                <div className="grid grid-cols-4 gap-2">
                  {YEAR_OPTIONS.map((y) => (
                    <button key={y} onClick={() => setSelectedYear(y)}
                      className={cn(
                        "py-3 rounded-lg border-2 text-sm font-bold transition-all",
                        selectedYear === y
                          ? "border-primary-500 bg-primary-500 text-white"
                          : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-300"
                      )}>
                      {y}
                    </button>
                  ))}
                </div>
              </div>
              {/* Semester */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Semester</p>
                <div className="grid grid-cols-2 gap-2">
                  {SEMESTER_OPTIONS.map((s) => (
                    <button key={s} onClick={() => setSelectedSemester(s)}
                      className={cn(
                        "py-3 rounded-lg border-2 text-sm font-bold transition-all",
                        selectedSemester === s
                          ? "border-primary-500 bg-primary-500 text-white"
                          : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-300"
                      )}>
                      Semester {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Summary badge */}
            <div className="mt-5 flex justify-center">
              <div className="px-6 py-3 bg-primary-50 dark:bg-primary-950/30 rounded-xl border border-primary-200 dark:border-primary-800 text-center">
                <span className="text-3xl font-bold text-primary-600">{selectedYear}:{selectedSemester}</span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Year {selectedYear}, Semester {selectedSemester}</p>
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => setStep("session")} leftIcon={<ChevronRight className="w-4 h-4" />}>
              Next: Study Session
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 5: Study Session ────────────────────────────────────────────── */}
      {step === "session" && selectedAcademicYear && (
        <div className="space-y-5">
          <button onClick={() => setStep("semester")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to year & semester
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { icon: <Building2 className="w-4 h-4 text-primary-500" />,    label: selectedDepartment?.code },
              { icon: <GraduationCap className="w-4 h-4 text-primary-500" />, label: selectedProgramme?.code },
              { icon: <Calendar className="w-4 h-4 text-primary-500" />,      label: selectedAcademicYear.label },
              { icon: <span className="text-xs font-bold text-primary-500">{selectedYear}:{selectedSemester}</span>, label: `Year ${selectedYear}, Sem ${selectedSemester}` },
            ].map((item, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  {item.icon}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          <Card>
            <CardHeader title="Select Study Session" subtitle="Choose the study time category for this timetable" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {STUDY_TIME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedStudyTime(opt.value)}
                  className={cn(
                    "flex flex-col items-center gap-3 p-6 rounded-xl border-2 text-center transition-all",
                    selectedStudyTime === opt.value
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30"
                      : "border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
                  )}
                >
                  <span className={cn(
                    "p-3 rounded-xl",
                    selectedStudyTime === opt.value
                      ? "bg-primary-100 dark:bg-primary-900/50 text-primary-600"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                  )}>
                    {opt.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{opt.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleViewTimetable} leftIcon={<Calendar className="w-4 h-4" />}>
              View Timetable
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 5: Timetable ────────────────────────────────────────────────── */}
      {step === "timetable" && (
        <>
          <button onClick={() => setStep("session")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Change filters
          </button>

          {/* Context strip */}
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Department",       value: selectedDepartment?.code ?? "—" },
              { label: "Programme",     value: `${selectedProgramme?.code} — ${selectedProgramme?.name}` },
              { label: "Academic Year", value: selectedAcademicYear?.label ?? "—" },
              { label: "Year:Sem",      value: `${selectedYear}:${selectedSemester}` },
              { label: "Session",       value: selectedStudyTime.charAt(0).toUpperCase() + selectedStudyTime.slice(1) },
              { label: "Slots",         value: String(slots.length) },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}:</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{item.value}</span>
              </div>
            ))}
          </div>

          {isLoadingSlots ? (
            <Card><div className="py-12 text-center text-gray-400">Loading timetable slots...</div></Card>
          ) : (
            <Card>
              <CardHeader
                title={`${selectedProgramme?.code} Timetable`}
                subtitle={`${slots.length} slot${slots.length !== 1 ? "s" : ""} · Year ${selectedYear}:${selectedSemester} · ${selectedStudyTime} · ${selectedAcademicYear?.label}`}
              />
              <Table
                columns={columns}
                data={slots}
                keyExtractor={(s) => s.id}
                emptyMessage="No slots yet. Click 'Add Slot' to schedule a course."
              />
            </Card>
          )}
        </>
      )}

      {/* ── Add Slot Modal ───────────────────────────────────────────────────── */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Timetable Slot"
        description={`${selectedProgramme?.code} · Year ${selectedYear}:${selectedSemester} · ${selectedStudyTime} · ${selectedAcademicYear?.label}`}
      >
        <form onSubmit={handleAddSlot} className="space-y-4">
          {slotFormError && (
            <div className="p-3 bg-danger-50 dark:bg-red-950/30 border border-danger-200 dark:border-red-800 rounded-lg text-sm text-danger-700 dark:text-red-300">
              {slotFormError}
            </div>
          )}

          {/* Course selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Course <span className="text-danger-500">*</span>
            </label>
            {isLoadingCourses ? (
              <div className="text-sm text-gray-400 py-2">Loading courses...</div>
            ) : (
              <select
                value={slotForm.courseId}
                onChange={(e) => setSlotForm((p) => ({ ...p, courseId: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">— Select a course —</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            )}
            {slotForm.courseId && (() => {
              const course = courses.find((c) => String(c.id) === slotForm.courseId);
              return course?.lecturer ? (
                <p className="text-xs text-gray-400 mt-1">
                  Lecturer: {course.lecturer.firstName} {course.lecturer.lastName}
                </p>
              ) : null;
            })()}
          </div>

          {/* Day */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Day</label>
            <select
              value={slotForm.dayOfWeek}
              onChange={(e) => setSlotForm((p) => ({ ...p, dayOfWeek: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {DAYS.map((d, i) => <option key={i} value={DAY_KEYS[i]}>{d}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Time" type="time" value={slotForm.startTime}
              onChange={(e) => setSlotForm((p) => ({ ...p, startTime: e.target.value }))} required />
            <Input label="End Time"   type="time" value={slotForm.endTime}
              onChange={(e) => setSlotForm((p) => ({ ...p, endTime: e.target.value }))}   required />
          </div>

          <Input label="Venue" value={slotForm.room}
            onChange={(e) => setSlotForm((p) => ({ ...p, room: e.target.value }))}
            placeholder="e.g. Room 101" required />

          {/* Session (read-only, inherited from wizard) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Session</label>
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 capitalize">
              {selectedStudyTime}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting} leftIcon={<Clock className="w-4 h-4" />}>Add Slot</Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Modal ─────────────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Timetable Slot"
        message={deleteError
          ? deleteError
          : `Delete ${(selectedSlot as any)?.courseCode ?? ""} slot on ${selectedSlot ? dayLabel(selectedSlot.dayOfWeek) : ""} at ${selectedSlot?.startTime}?`}
        confirmText="Delete"
        isLoading={isDeleting}
        variant="danger"
      />
    </div>
  );
}
