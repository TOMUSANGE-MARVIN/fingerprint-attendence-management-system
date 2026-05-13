"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, Badge, PageLoading, Table, TableColumn } from "@/components/ui";
import { apiClient, API_ENDPOINTS, API_BASE_URL } from "@/lib/api";
import { InstitutionAnalytics, Course } from "@/types";
import { TrendingUp, Users, BookOpen, AlertTriangle, FileText, Download, FileSpreadsheet, Loader2, Filter, X } from "lucide-react";
import { getAttendanceBgClass } from "@/lib/utils";

const ACCESS_TOKEN_KEY = "access_token";

const DEMO: InstitutionAnalytics = {
  totalStudents: 312,
  totalLecturers: 24,
  totalCourses: 18,
  averageAttendance: 78.4,
  studentsAtRisk: 47,
  attendanceByDepartment: [
    { department: "Computer Science", percentage: 81.2, studentCount: 145 },
    { department: "Engineering", percentage: 76.8, studentCount: 98 },
    { department: "Mathematics", percentage: 72.1, studentCount: 69 },
  ],
  recentTrends: [
    { period: "Week 1", percentage: 82, sessionsAttended: 820, totalSessions: 1000 },
    { period: "Week 2", percentage: 79, sessionsAttended: 790, totalSessions: 1000 },
    { period: "Week 3", percentage: 75, sessionsAttended: 750, totalSessions: 1000 },
    { period: "Week 4", percentage: 78, sessionsAttended: 780, totalSessions: 1000 },
    { period: "Week 5", percentage: 80, sessionsAttended: 800, totalSessions: 1000 },
    { period: "Week 6", percentage: 77, sessionsAttended: 770, totalSessions: 1000 },
  ],
};

interface FilterOptions {
  academicYears: { id: string; label: string }[];
  faculties: { id: string; name: string }[];
  yearLevels: number[];
  semesterNumbers: number[];
  courses: { id: string; code: string; name: string }[];
}

interface ExcelFilters {
  academic_year: string;
  faculty: string;
  course: string;
  year_level: string;
  semester_number: string;
}

async function downloadBlob(url: string, filename: string) {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const res = await fetch(`${API_BASE_URL}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

const selectClass =
  "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500";

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<InstitutionAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Courses for PDF selector
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);

  // Filter options + state for Excel download
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [excelFilters, setExcelFilters] = useState<ExcelFilters>({
    academic_year: "",
    faculty: "",
    course: "",
    year_level: "",
    semester_number: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  // Load analytics summary
  useEffect(() => {
    apiClient.get<InstitutionAnalytics>(API_ENDPOINTS.analytics.dashboard)
      .then((r) => setAnalytics(r.data))
      .catch(() => setAnalytics(DEMO))
      .finally(() => setIsLoading(false));
  }, []);

  // Load courses for PDF list
  useEffect(() => {
    setIsLoadingCourses(true);
    apiClient.get<any>(`${API_ENDPOINTS.courses.list}?page_size=200`)
      .then((r) => {
        const d = r.data;
        setCourses(Array.isArray(d) ? d : (d.results ?? []));
      })
      .catch(() => {})
      .finally(() => setIsLoadingCourses(false));
  }, []);

  // Load filter options
  useEffect(() => {
    apiClient.get<FilterOptions>(API_ENDPOINTS.analytics.reportFilters)
      .then((r) => setFilterOptions(r.data))
      .catch(() => {});
  }, []);

  const handleFilterChange = (key: keyof ExcelFilters, value: string) => {
    setExcelFilters((prev) => {
      const next = { ...prev, [key]: value };
      // if a specific course is selected, clear other filters (they're redundant)
      if (key === "course" && value) {
        return { academic_year: "", faculty: "", course: value, year_level: "", semester_number: "" };
      }
      // if another filter is changed, clear specific course
      if (key !== "course") {
        next.course = "";
      }
      return next;
    });
  };

  const clearFilters = () =>
    setExcelFilters({ academic_year: "", faculty: "", course: "", year_level: "", semester_number: "" });

  const activeFilterCount = Object.values(excelFilters).filter(Boolean).length;

  const buildExcelUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (excelFilters.academic_year) params.set("academic_year", excelFilters.academic_year);
    if (excelFilters.faculty)       params.set("faculty",        excelFilters.faculty);
    if (excelFilters.course)        params.set("course",         excelFilters.course);
    if (excelFilters.year_level)    params.set("year_level",     excelFilters.year_level);
    if (excelFilters.semester_number) params.set("semester_number", excelFilters.semester_number);
    const qs = params.toString();
    return `${API_ENDPOINTS.analytics.thresholdExcel}${qs ? `?${qs}` : ""}`;
  }, [excelFilters]);

  const handleDownloadPdf = useCallback(async (course: Course) => {
    setDownloadingPdf(String(course.id));
    try {
      await downloadBlob(
        API_ENDPOINTS.analytics.coursePdf(String(course.id)),
        `${course.code}_attendance_report.pdf`
      );
    } catch { /* silent */ }
    finally { setDownloadingPdf(null); }
  }, []);

  const handleDownloadExcel = useCallback(async () => {
    setDownloadingExcel(true);
    const url = buildExcelUrl();
    // build a descriptive filename based on active filters
    const parts: string[] = ["threshold_report"];
    if (excelFilters.academic_year && filterOptions) {
      const ay = filterOptions.academicYears.find((a) => a.id === excelFilters.academic_year);
      if (ay) parts.push(ay.label.replace("/", "-"));
    }
    if (excelFilters.faculty && filterOptions) {
      const fac = filterOptions.faculties.find((f) => f.id === excelFilters.faculty);
      if (fac) parts.push(fac.name.replace(/\s+/g, "_"));
    }
    if (excelFilters.year_level)     parts.push(`yr${excelFilters.year_level}`);
    if (excelFilters.semester_number) parts.push(`sem${excelFilters.semester_number}`);
    if (excelFilters.course && filterOptions) {
      const c = filterOptions.courses.find((c) => c.id === excelFilters.course);
      if (c) parts.push(c.code);
    }
    try {
      await downloadBlob(url, `${parts.join("_")}.xlsx`);
    } catch { /* silent */ }
    finally { setDownloadingExcel(false); }
  }, [buildExcelUrl, excelFilters, filterOptions]);

  if (isLoading) return <PageLoading message="Loading analytics..." />;
  if (!analytics) return null;

  const recentTrends = analytics.recentTrends ?? [];
  const attendanceByDepartment = analytics.attendanceByDepartment ?? [];

  type DeptRow = { department: string; percentage: number; studentCount: number };
  const deptColumns: TableColumn<DeptRow>[] = [
    {
      key: "dept",
      header: "Department",
      render: (d) => (
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary-500" />
          <span className="font-medium text-gray-900 dark:text-gray-100">{d.department}</span>
        </div>
      ),
    },
    {
      key: "students",
      header: "Students",
      align: "center",
      render: (d) => (
        <div className="flex items-center justify-center gap-1 text-gray-700 dark:text-gray-300">
          <Users className="w-4 h-4 text-gray-400" /> {d.studentCount}
        </div>
      ),
    },
    {
      key: "attendance",
      header: "Avg Attendance",
      align: "center",
      render: (d) => (
        <Badge className={getAttendanceBgClass(d.percentage)}>{d.percentage.toFixed(1)}%</Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (d) => (
        <Badge variant={d.percentage >= 75 ? "success" : "danger"} dot>
          {d.percentage >= 75 ? "On Track" : "At Risk"}
        </Badge>
      ),
    },
  ];

  // Group courses by programme for the PDF section
  const coursesByProg: Record<string, Course[]> = {};
  for (const c of courses) {
    const key =
      (c as any).programme_name ||
      (c as any).programmeName ||
      (c as any).programme?.name ||
      "Other";
    if (!coursesByProg[key]) coursesByProg[key] = [];
    coursesByProg[key].push(c);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Institution-wide attendance insights and trends
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Students</p>
              <p className="text-3xl font-bold text-primary-600">{analytics.totalStudents}</p>
            </div>
            <div className="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-full">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Attendance</p>
              <p className="text-3xl font-bold text-success-600">
                {analytics.averageAttendance.toFixed(1)}%
              </p>
            </div>
            <div className="p-3 bg-success-50 dark:bg-green-900/30 rounded-full">
              <TrendingUp className="w-6 h-6 text-success-600" />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">At Risk</p>
              <p className="text-3xl font-bold text-danger-600">{analytics.studentsAtRisk}</p>
            </div>
            <div className="p-3 bg-danger-50 dark:bg-red-900/30 rounded-full">
              <AlertTriangle className="w-6 h-6 text-danger-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Below 75% threshold</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Courses</p>
              <p className="text-3xl font-bold text-primary-600">{analytics.totalCourses}</p>
            </div>
            <div className="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-full">
              <BookOpen className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Weekly trend */}
      <Card>
        <CardHeader title="Weekly Attendance Trend" subtitle="Last 6 weeks" />
        <div className="flex items-end gap-3 h-40 px-2">
          {recentTrends.map((week) => (
            <div key={week.period} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">{week.percentage}%</span>
              <div
                className="w-full rounded-t-md"
                style={{
                  height: `${week.percentage}%`,
                  backgroundColor: week.percentage >= 75 ? "rgb(34,197,94)" : "rgb(239,68,68)",
                  opacity: 0.8,
                }}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400 text-center leading-tight">
                {week.period}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-success-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">≥75% On Track</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-danger-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">&lt;75% At Risk</span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Attendance by Department" subtitle="Current academic period" />
        <Table
          columns={deptColumns}
          data={attendanceByDepartment}
          keyExtractor={(d) => d.department}
          emptyMessage="No department data available"
        />
      </Card>

      {analytics.studentsAtRisk > 0 && (
        <Card className="border-warning-200 dark:border-yellow-800 bg-warning-50 dark:bg-yellow-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-warning-800 dark:text-yellow-200">
                {analytics.studentsAtRisk} students below 75% attendance threshold
              </p>
              <p className="text-sm text-warning-600 dark:text-yellow-300 mt-1">
                These students are at risk of failing their courses.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Reports Section ────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Reports</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Download detailed attendance reports and threshold lists for every course
        </p>

        {/* Excel — threshold report with filters */}
        <Card className="mb-4">
          {/* Header row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-success-50 dark:bg-green-950/50">
                <FileSpreadsheet className="w-5 h-5 text-success-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  Threshold Report — All Courses
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Excel with one sheet per course: students above &amp; below the attendance threshold
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  showFilters || activeFilterCount > 0
                    ? "border-primary-400 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300"
                    : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-primary-600 text-white text-[10px] font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <button
                onClick={handleDownloadExcel}
                disabled={downloadingExcel}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success-600 hover:bg-success-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
              >
                {downloadingExcel
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Download className="w-4 h-4" />}
                {downloadingExcel ? "Generating…" : "Download Excel"}
              </button>
            </div>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" /> Filter report by
                </p>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-xs text-danger-600 dark:text-red-400 hover:underline"
                  >
                    <X className="w-3 h-3" /> Clear all
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* Academic Year */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Academic Year
                  </label>
                  <select
                    value={excelFilters.academic_year}
                    onChange={(e) => handleFilterChange("academic_year", e.target.value)}
                    disabled={!!excelFilters.course}
                    className={selectClass}
                  >
                    <option value="">All years</option>
                    {filterOptions?.academicYears?.map((ay) => (
                      <option key={ay.id} value={ay.id}>{ay.label}</option>
                    ))}
                  </select>
                </div>

                {/* Department / Faculty */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Department
                  </label>
                  <select
                    value={excelFilters.faculty}
                    onChange={(e) => handleFilterChange("faculty", e.target.value)}
                    disabled={!!excelFilters.course}
                    className={selectClass}
                  >
                    <option value="">All departments</option>
                    {filterOptions?.faculties?.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                {/* Year of Study */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Year of Study
                  </label>
                  <select
                    value={excelFilters.year_level}
                    onChange={(e) => handleFilterChange("year_level", e.target.value)}
                    disabled={!!excelFilters.course}
                    className={selectClass}
                  >
                    <option value="">All years</option>
                    {filterOptions?.yearLevels?.map((y) => (
                      <option key={y} value={String(y)}>Year {y}</option>
                    ))}
                  </select>
                </div>

                {/* Semester */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Semester
                  </label>
                  <select
                    value={excelFilters.semester_number}
                    onChange={(e) => handleFilterChange("semester_number", e.target.value)}
                    disabled={!!excelFilters.course}
                    className={selectClass}
                  >
                    <option value="">All semesters</option>
                    {filterOptions?.semesterNumbers?.map((s) => (
                      <option key={s} value={String(s)}>Semester {s}</option>
                    ))}
                  </select>
                </div>

                {/* Specific Course */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Specific Course
                  </label>
                  <select
                    value={excelFilters.course}
                    onChange={(e) => handleFilterChange("course", e.target.value)}
                    className={selectClass}
                  >
                    <option value="">All courses</option>
                    {filterOptions?.courses?.map((c) => (
                      <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Active filter summary */}
              {activeFilterCount > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {excelFilters.academic_year && filterOptions && (
                    <FilterChip
                      label={`Year: ${filterOptions.academicYears.find((a) => a.id === excelFilters.academic_year)?.label ?? ""}`}
                      onRemove={() => handleFilterChange("academic_year", "")}
                    />
                  )}
                  {excelFilters.faculty && filterOptions && (
                    <FilterChip
                      label={`Dept: ${filterOptions.faculties.find((f) => f.id === excelFilters.faculty)?.name ?? ""}`}
                      onRemove={() => handleFilterChange("faculty", "")}
                    />
                  )}
                  {excelFilters.year_level && (
                    <FilterChip
                      label={`Year ${excelFilters.year_level}`}
                      onRemove={() => handleFilterChange("year_level", "")}
                    />
                  )}
                  {excelFilters.semester_number && (
                    <FilterChip
                      label={`Sem ${excelFilters.semester_number}`}
                      onRemove={() => handleFilterChange("semester_number", "")}
                    />
                  )}
                  {excelFilters.course && filterOptions && (
                    <FilterChip
                      label={`Course: ${filterOptions.courses.find((c) => c.id === excelFilters.course)?.code ?? ""}`}
                      onRemove={() => handleFilterChange("course", "")}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* PDF — per course */}
        <Card>
          <CardHeader
            title="Course Attendance PDF Reports"
            subtitle="Detailed per-course report including session log and student records"
          />
          {isLoadingCourses ? (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading courses…
            </div>
          ) : courses.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No courses found.</p>
          ) : (
            <div className="space-y-4 mt-2">
              {Object.entries(coursesByProg).map(([prog, progCourses]) => (
                <div key={prog}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 px-1">
                    {prog}
                  </p>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                    {progCourses.map((course) => (
                      <div
                        key={course.id}
                        className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-950/50 shrink-0">
                            <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                              {course.code} — {course.name}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              Year {(course as any).year_level ?? "—"} ·
                              Sem {(course as any).semester_number ?? "—"} ·
                              Threshold {(course as any).attendance_threshold ?? 75}%
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownloadPdf(course)}
                          disabled={downloadingPdf === String(course.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40 disabled:opacity-60 text-sm font-medium transition-colors shrink-0 ml-3"
                        >
                          {downloadingPdf === String(course.id)
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Download className="w-3.5 h-3.5" />}
                          PDF
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 text-xs font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-primary-900 dark:hover:text-primary-100">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
