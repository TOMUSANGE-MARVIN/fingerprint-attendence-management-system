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
  Avatar,
  Input,
  Modal,
  ConfirmModal,
} from "@/components/ui";
import { FingerprintCapture } from "@/components/fingerprint/FingerprintCapture";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { User, StudyTime, Faculty as Department, Programme, AcademicYear, Cohort } from "@/types";
import {
  Search,
  Trash2,
  Download,
  UserPlus,
  Fingerprint,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  ArrowLeft,
  Building2,
  GraduationCap,
  BookOpen,
  Calendar,
  Users,
  Filter,
  Pencil,
  BarChart2,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { formatDate, cn } from "@/lib/utils";

interface StudentFormData {
  firstName: string;
  lastName: string;
  email: string;
  studentId: string;
  department: string;
  program: string;
  studyTime: StudyTime | "";
  academicYearId: string;
  cohortId: string;
  password: string;
  passwordConfirm: string;
}
interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  studentId?: string;
  department?: string;
  program?: string;
  studyTime?: string;
  academicYearId?: string;
  cohortId?: string;
  password?: string;
  passwordConfirm?: string;
  submit?: string;
}
const emptyForm: StudentFormData = {
  firstName: "", lastName: "", email: "", studentId: "",
  department: "", program: "", studyTime: "", academicYearId: "",
  cohortId: "",
  password: "", passwordConfirm: "",
};

interface EditStudentFormData {
  firstName: string;
  lastName: string;
  email: string;
  studentId: string;
  department: string;
  program: string;
  studyTime: StudyTime | "";
  academicYearId: string;
}
interface EditFormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  submit?: string;
}
const emptyEditForm: EditStudentFormData = {
  firstName: "", lastName: "", email: "", studentId: "",
  department: "", program: "", studyTime: "", academicYearId: "",
};

type ModalStep   = "form" | "fingerprint";
// "all" = show every student; hierarchy steps drill down to a specific class
type WizardStep  = "all" | "department" | "programme" | "year" | "semester" | "students";

export default function AdminStudentsPage() {
  // ── Wizard ─────────────────────────────────────────────────────────────────
  const [wizardStep, setWizardStep] = useState<WizardStep>("all");

  // Departments
  const [departments, setDepartments]           = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [departmentSearch, setDepartmentSearch]   = useState("");

  // All programmes (for form dropdowns)
  const [allProgrammes, setAllProgrammes]       = useState<Programme[]>([]);

  // Programmes
  const [programmes, setProgrammes]             = useState<Programme[]>([]);
  const [selectedProgramme, setSelectedProgramme] = useState<Programme | null>(null);
  const [programmeSearch, setProgrammeSearch]   = useState("");
  const [isLoadingProgrammes, setIsLoadingProgrammes] = useState(false);

  // Academic Years (for Add/Edit form)
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<AcademicYear | null>(null);

  // Class hierarchy: year + semester
  const [selectedYearLevel, setSelectedYearLevel] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);

  // Cohorts (used for assigning class during student creation)
  const [cohorts, setCohorts] = useState<Cohort[]>([]);

  // ── Students list ──────────────────────────────────────────────────────────
  const [students, setStudents]           = useState<User[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm]       = useState("");
  const [filterStudyTime, setFilterStudyTime] = useState<StudyTime | "all">("all");
  const [isLoadingInit, setIsLoadingInit] = useState(true);

  // ── Add modal ──────────────────────────────────────────────────────────────
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalStep, setModalStep]           = useState<ModalStep>("form");
  const [formData, setFormData]             = useState<StudentFormData>(emptyForm);
  const [formErrors, setFormErrors]         = useState<FormErrors>({});
  const [isSaving, setIsSaving]             = useState(false);
  const [createdStudent, setCreatedStudent] = useState<User | null>(null);
  const [capturedTemplate, setCapturedTemplate] = useState<string | null>(null);
  const [captureQuality, setCaptureQuality]     = useState(0);
  const [isRegisteringFp, setIsRegisteringFp]   = useState(false);
  const [fpRegistered, setFpRegistered]         = useState(false);

  // ── Delete modal ───────────────────────────────────────────────────────────
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent]     = useState<User | null>(null);
  const [isDeleting, setIsDeleting]               = useState(false);
  const [deleteError, setDeleteError]             = useState<string | null>(null);

  // ── Edit modal ─────────────────────────────────────────────────────────────
  const [isEditModalOpen, setIsEditModalOpen]   = useState(false);
  const [editingStudent, setEditingStudent]     = useState<User | null>(null);
  const [editFormData, setEditFormData]         = useState<EditStudentFormData>(emptyEditForm);
  const [editFormErrors, setEditFormErrors]     = useState<EditFormErrors>({});
  const [isUpdating, setIsUpdating]             = useState(false);

  // ── Attendance modal ────────────────────────────────────────────────────────
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [attendanceStudent, setAttendanceStudent]         = useState<User | null>(null);
  const [attendanceData, setAttendanceData]               = useState<any | null>(null);
  const [isLoadingAttendance, setIsLoadingAttendance]     = useState(false);
  const [attendanceError, setAttendanceError]             = useState<string | null>(null);

  // ── Boot: load all students + departments + programmes + academic years ──────
  useEffect(() => {
    Promise.all([
      fetchStudents("all"),
      apiClient.get<any>(API_ENDPOINTS.faculties.list).then((r) => {
        const d = r.data;
        setDepartments(Array.isArray(d) ? d : d.results ?? []);
      }),
      apiClient.get<any>(API_ENDPOINTS.programmes.list).then((r) => {
        const d = r.data;
        setAllProgrammes(Array.isArray(d) ? d : d.results ?? []);
      }),
      apiClient.get<any>(API_ENDPOINTS.academicYears.list).then((r) => {
        const d = r.data;
        setAcademicYears(Array.isArray(d) ? d : d.results ?? []);
      }),
      apiClient.get<any>(API_ENDPOINTS.cohorts.list).then((r) => {
        const d = r.data;
        setCohorts(Array.isArray(d) ? d : d.results ?? []);
      }),
    ]).finally(() => setIsLoadingInit(false));
  }, []);

  // ── Data fetchers ──────────────────────────────────────────────────────────
  const fetchStudents = async (
    mode: "all" | "class",
    params?: { programmeId?: string; yearLevel?: number; semesterNumber?: number; academicYearId?: string }
  ) => {
    setIsLoadingStudents(true);
    setStudentsError(null);
    try {
      const url = mode === "class"
        ? `${API_ENDPOINTS.admin.users}?role=student&programme=${params?.programmeId}&year_level=${params?.yearLevel}&semester_number=${params?.semesterNumber}&academic_year=${params?.academicYearId}`
        : `${API_ENDPOINTS.admin.users}?role=student`;
      const res  = await apiClient.get<any>(url);
      const data = res.data;
      setStudents(Array.isArray(data) ? data : data.results ?? []);
    } catch {
      setStudentsError("Failed to load students.");
    } finally {
      setIsLoadingStudents(false);
    }
  };

  // ── Wizard handlers ────────────────────────────────────────────────────────
  const handleSelectDepartment = async (department: Department) => {
    setSelectedDepartment(department);
    setSelectedProgramme(null);
    setSelectedAcademicYear(null);
    setSelectedYearLevel(null);
    setSelectedSemester(null);
    setProgrammeSearch("");
    setWizardStep("programme");
    setIsLoadingProgrammes(true);
    try {
      const res = await apiClient.get<any>(`${API_ENDPOINTS.programmes.list}?department=${department.id}`);
      const d   = res.data;
      setProgrammes(Array.isArray(d) ? d : d.results ?? []);
    } catch { setProgrammes([]); }
    finally { setIsLoadingProgrammes(false); }
  };

  const handleSelectProgramme = async (programme: Programme) => {
    setSelectedProgramme(programme);
    setSelectedAcademicYear(null);
    setSelectedYearLevel(null);
    setSelectedSemester(null);
    setWizardStep("year");
  };

  const handleSelectYear = (yearLevel: number) => {
    if (!selectedAcademicYear) return;
    setSelectedYearLevel(yearLevel);
    setSelectedSemester(null);
    setWizardStep("semester");
  };

  const handleSelectSemester = async (semesterNumber: number) => {
    if (!selectedProgramme || !selectedYearLevel || !selectedAcademicYear) return;
    setSelectedSemester(semesterNumber);
    setSearchTerm("");
    setFilterStudyTime("all");
    setWizardStep("students");
    await fetchStudents("class", {
      programmeId: selectedProgramme.id,
      yearLevel: selectedYearLevel,
      semesterNumber,
      academicYearId: selectedAcademicYear.id,
    });
  };

  // ── "View all" shortcut ────────────────────────────────────────────────────
  const handleViewAll = () => {
    setWizardStep("all");
    setSelectedDepartment(null);
    setSelectedProgramme(null);
    setSelectedAcademicYear(null);
    setSelectedYearLevel(null);
    setSelectedSemester(null);
    fetchStudents("all");
  };

  // ── Add student ────────────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!formData.firstName.trim())  errors.firstName   = "First name is required";
    if (!formData.lastName.trim())   errors.lastName    = "Last name is required";
    if (!formData.email.trim())      errors.email       = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errors.email = "Enter a valid email address";
    if (!formData.studentId.trim())  errors.studentId   = "Student ID is required";
    if (!formData.department.trim()) errors.department  = "Department is required";
    if (!formData.program.trim())    errors.program     = "Programme is required";
    if (!formData.studyTime)         errors.studyTime   = "Study session is required";
    if (!formData.academicYearId)    errors.academicYearId = "Academic year is required";
    if (!formData.password)               errors.password = "Password is required";
    else if (formData.password.length < 8) errors.password = "Password must be at least 8 characters";
    if (!formData.passwordConfirm)
      errors.passwordConfirm = "Please confirm the password";
    else if (formData.password !== formData.passwordConfirm)
      errors.passwordConfirm = "Passwords do not match";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSaving(true);
    setFormErrors({});
    try {
      const response = await apiClient.post<User>(API_ENDPOINTS.admin.users, {
        first_name:       formData.firstName,
        last_name:        formData.lastName,
        email:            formData.email,
        password:         formData.password,
        password_confirm: formData.passwordConfirm,
        role:             "student",
        student_id:       formData.studentId,
        department:       formData.department,
        program:          formData.program,
        study_time:       formData.studyTime,
        academic_year:    formData.academicYearId,
        cohort:           formData.cohortId || undefined,
      });
      const newStudent = response.data;
      setStudents((p) => [newStudent, ...p]);
      setCreatedStudent(newStudent);
      setModalStep("fingerprint");
      // Refresh cohort list so any newly-created cohort appears immediately
      apiClient.get<any>(API_ENDPOINTS.cohorts.list).then((r) => {
        const d = r.data;
        setCohorts(Array.isArray(d) ? d : d.results ?? []);
      }).catch(() => {});
    } catch (err: any) {
      const data = err?.response?.data;
      if (data && typeof data === "object") {
        const mapped: FormErrors = {};
        if (data.email)      mapped.email      = Array.isArray(data.email)      ? data.email[0]      : data.email;
        if (data.password)   mapped.password   = Array.isArray(data.password)   ? data.password[0]   : data.password;
        if (data.student_id) mapped.studentId  = Array.isArray(data.student_id) ? data.student_id[0] : data.student_id;
        if (data.cohort)     mapped.cohortId   = Array.isArray(data.cohort)     ? data.cohort[0]     : data.cohort;
        if (data.non_field_errors || data.detail)
          mapped.submit = data.non_field_errors?.[0] || data.detail;
        if (Object.keys(mapped).length > 0) { setFormErrors(mapped); return; }
      }
      setFormErrors({ submit: "Failed to create student. Please try again." });
    } finally { setIsSaving(false); }
  };

  const handleRegisterFingerprint = async () => {
    if (!createdStudent || !capturedTemplate) return;
    setIsRegisteringFp(true);
    try {
      await apiClient.post(
        API_ENDPOINTS.fingerprint.register(String(createdStudent.id)),
        { fingerprint_template: capturedTemplate, quality: captureQuality }
      );
      setFpRegistered(true);
      setStudents((p) => p.map((s) => s.id === createdStudent.id ? { ...s, fingerprintRegistered: true } : s));
    } catch { /* non-blocking */ }
    finally { setIsRegisteringFp(false); }
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setModalStep("form");
    setFormData(emptyForm);
    setFormErrors({});
    setCreatedStudent(null);
    setCapturedTemplate(null);
    setFpRegistered(false);
  };

  const handleDeleteStudent = async () => {
    if (!selectedStudent) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(API_ENDPOINTS.admin.userDetail(selectedStudent.id));
      setStudents((p) => p.filter((s) => s.id !== selectedStudent.id));
      setIsDeleteModalOpen(false);
      setSelectedStudent(null);
    } catch (err: any) {
      setDeleteError(err?.response?.data?.detail || "Failed to delete student.");
    } finally { setIsDeleting(false); }
  };

  const handleOpenEdit = (student: User) => {
    setEditingStudent(student);
    setEditFormData({
      firstName:      student.firstName,
      lastName:       student.lastName,
      email:          student.email,
      studentId:      student.studentId ?? "",
      department:     student.department ?? "",
      program:        student.program ?? "",
      studyTime:      (student.studyTime as StudyTime | "") ?? "",
      academicYearId: student.academicYear ? String(student.academicYear) : "",
    });
    setEditFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    const errors: EditFormErrors = {};
    if (!editFormData.firstName.trim()) errors.firstName = "First name is required";
    if (!editFormData.lastName.trim())  errors.lastName  = "Last name is required";
    if (!editFormData.email.trim())     errors.email     = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editFormData.email))
      errors.email = "Enter a valid email address";
    setEditFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsUpdating(true);
    try {
      const res = await apiClient.patch<User>(
        API_ENDPOINTS.admin.userDetail(editingStudent.id),
        {
          first_name:    editFormData.firstName,
          last_name:     editFormData.lastName,
          email:         editFormData.email,
          student_id:    editFormData.studentId    || undefined,
          department:    editFormData.department   || undefined,
          program:       editFormData.program      || undefined,
          study_time:    editFormData.studyTime    || undefined,
          academic_year: editFormData.academicYearId || undefined,
        }
      );
      setStudents((p) => p.map((s) => s.id === editingStudent.id ? res.data : s));
      setIsEditModalOpen(false);
      setEditingStudent(null);
    } catch (err: any) {
      const data = err?.response?.data;
      const msg = data?.email?.[0] || data?.detail || data?.non_field_errors?.[0] || "Failed to update student.";
      setEditFormErrors({ submit: msg });
    } finally { setIsUpdating(false); }
  };

  const openAttendanceModal = async (student: User) => {
    setAttendanceStudent(student);
    setAttendanceData(null);
    setAttendanceError(null);
    setIsAttendanceModalOpen(true);
    setIsLoadingAttendance(true);
    try {
      const res = await apiClient.get<any>(API_ENDPOINTS.attendance.adminStudentAttendance(student.id));
      setAttendanceData(res.data);
    } catch {
      setAttendanceError("Failed to load attendance data.");
    } finally {
      setIsLoadingAttendance(false);
    }
  };

  const field = (key: keyof StudentFormData) => ({
    value: formData[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((p) => ({ ...p, [key]: e.target.value }));
      if (formErrors[key as keyof FormErrors])
        setFormErrors((p) => ({ ...p, [key]: undefined }));
    },
  });

  const filteredStudents = students.filter((s) => {
    const q = `${s.firstName} ${s.lastName} ${s.studentId ?? ""} ${s.email} ${s.department ?? ""}`.toLowerCase();
    return q.includes(searchTerm.toLowerCase()) &&
      (filterStudyTime === "all" || s.studyTime === filterStudyTime);
  });

  const filteredDepartments  = departments.filter((f) => `${f.code} ${f.name}`.toLowerCase().includes(departmentSearch.toLowerCase()));
  const filteredProgrammes = programmes.filter((p) => `${p.code} ${p.name}`.toLowerCase().includes(programmeSearch.toLowerCase()));
  const filteredCohorts = selectedProgramme
    ? cohorts.filter((c) => c.programmeCode === selectedProgramme.code)
    : cohorts;

  // ── Table columns ──────────────────────────────────────────────────────────
  const baseColumns: TableColumn<User>[] = [
    {
      key: "student", header: "Student",
      render: (s) => (
        <div className="flex items-center gap-3">
          <Avatar firstName={s.firstName} lastName={s.lastName} size="md" />
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              {s.firstName} {s.lastName}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{s.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "studentId", header: "Student ID",
      render: (s) => (
        <span className="font-mono text-gray-700 dark:text-gray-300">
          {s.studentId || <span className="text-gray-400 italic">Not set</span>}
        </span>
      ),
    },
    {
      key: "department", header: "Department",
      render: (s) => <span className="text-gray-600 dark:text-gray-400">{s.department || "—"}</span>,
    },
    {
      key: "studyTime", header: "Session", align: "center",
      render: (s) => s.studyTime
        ? <Badge variant="default" className="capitalize">{s.studyTime}</Badge>
        : <span className="text-gray-400 text-xs italic">—</span>,
    },
    {
      key: "fingerprint", header: "Fingerprint", align: "center",
      render: (s) => s.fingerprintRegistered
        ? <Badge variant="success" dot>Enrolled</Badge>
        : <Badge variant="default">Not enrolled</Badge>,
    },
    {
      key: "status", header: "Status", align: "center",
      render: (s) => <Badge variant={s.isActive ? "success" : "default"} dot>{s.isActive ? "Active" : "Inactive"}</Badge>,
    },
    {
      key: "createdAt", header: "Joined",
      render: (s) => <span className="text-gray-500 dark:text-gray-400 text-sm">{formatDate(s.createdAt)}</span>,
    },
    {
      key: "actions", header: "", align: "right",
      render: (s) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="sm" onClick={() => openAttendanceModal(s)} title="View Attendance">
            <BarChart2 className="w-4 h-4 text-primary-500" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(s)}>
            <Pencil className="w-4 h-4 text-gray-500" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setSelectedStudent(s); setIsDeleteModalOpen(true); }}>
            <Trash2 className="w-4 h-4 text-danger-600" />
          </Button>
        </div>
      ),
    },
  ];

  const columns = baseColumns;

  if (isLoadingInit) return <PageLoading message="Loading students..." />;

  // ── Breadcrumb ─────────────────────────────────────────────────────────────
  const breadcrumb = (
    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6 flex-wrap">
      <button
        onClick={handleViewAll}
        className={cn("hover:text-primary-600 transition-colors", wizardStep === "all" ? "text-primary-600 font-medium" : "")}
      >
        All Students
      </button>
      {selectedDepartment && (
        <>
          <ChevronRight className="w-3.5 h-3.5" />
          <button
            onClick={() => { setWizardStep("department"); setSelectedProgramme(null); setSelectedAcademicYear(null); setSelectedYearLevel(null); setSelectedSemester(null); }}
            className={cn("hover:text-primary-600 transition-colors", wizardStep === "department" ? "text-primary-600 font-medium" : "")}
          >
            {selectedDepartment.code}
          </button>
        </>
      )}
      {selectedProgramme && (
        <>
          <ChevronRight className="w-3.5 h-3.5" />
          <button
            onClick={() => { setWizardStep("programme"); setSelectedAcademicYear(null); setSelectedYearLevel(null); setSelectedSemester(null); }}
            className={cn("hover:text-primary-600 transition-colors", wizardStep === "programme" ? "text-primary-600 font-medium" : "")}
          >
            {selectedProgramme.code}
          </button>
        </>
      )}
      {selectedAcademicYear && (
        <>
          <ChevronRight className="w-3.5 h-3.5" />
          <button
            onClick={() => { setWizardStep("year"); setSelectedYearLevel(null); setSelectedSemester(null); }}
            className={cn("hover:text-primary-600 transition-colors", wizardStep === "year" ? "text-primary-600 font-medium" : "")}
          >
            {selectedAcademicYear.label}
          </button>
        </>
      )}
      {selectedYearLevel && (
        <>
          <ChevronRight className="w-3.5 h-3.5" />
          <button
            onClick={() => { setWizardStep("year"); setSelectedSemester(null); }}
            className={cn("hover:text-primary-600 transition-colors", wizardStep === "year" ? "text-primary-600 font-medium" : "")}
          >
            Year {selectedYearLevel}
          </button>
        </>
      )}
      {selectedSemester && (
        <>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className={cn("transition-colors", wizardStep === "students" ? "text-primary-600 font-medium" : "")}>
            Semester {selectedSemester}
          </span>
        </>
      )}
    </div>
  );

  // ── Shared stats + table block ─────────────────────────────────────────────
  const StudentsView = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{students.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-success-600">{students.filter((s) => s.isActive).length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Active</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-primary-600">{students.filter((s) => s.fingerprintRegistered).length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Fingerprint Enrolled</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-warning-600">{students.filter((s) => !s.fingerprintRegistered).length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Not Enrolled</p>
        </Card>
      </div>

      {isLoadingStudents ? (
        <Card><div className="py-16 text-center text-gray-400">Loading students...</div></Card>
      ) : studentsError ? (
        <ErrorState message={studentsError} onRetry={() => wizardStep === "students" && selectedProgramme && selectedYearLevel && selectedSemester
          ? fetchStudents("class", {
              programmeId: selectedProgramme.id,
              yearLevel: selectedYearLevel,
              semesterNumber: selectedSemester,
              academicYearId: selectedAcademicYear?.id,
            })
          : fetchStudents("all")} />
      ) : (
        <Card>
          <CardHeader
            title={title}
            subtitle={subtitle ?? `${filteredStudents.length} student${filteredStudents.length !== 1 ? "s" : ""}`}
            action={
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={filterStudyTime}
                  onChange={(e) => setFilterStudyTime(e.target.value as StudyTime | "all")}
                  className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Sessions</option>
                  <option value="day">Day</option>
                  <option value="evening">Evening</option>
                  <option value="weekend">Weekend</option>
                </select>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-48"
                  />
                </div>
              </div>
            }
          />
          <Table
            columns={columns}
            data={filteredStudents}
            keyExtractor={(s) => s.id}
            emptyMessage="No students found."
          />
        </Card>
      )}
    </>
  );

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Students</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            View all students or drill down by department, programme, year and semester
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={<Download className="w-4 h-4" />}>Export</Button>
          <Button
            leftIcon={<UserPlus className="w-4 h-4" />}
            onClick={() => { setFormData(emptyForm); setFormErrors({}); setModalStep("form"); setCreatedStudent(null); setCapturedTemplate(null); setFpRegistered(false); setIsAddModalOpen(true); }}
          >
            Add Student
          </Button>
        </div>
      </div>

      {breadcrumb}

      {/* ── Browse-by-class shortcut row (always visible except on "all") ───── */}
      {wizardStep === "all" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: <Building2 className="w-5 h-5" />,    label: "Browse by Department",   sub: "Select a department first" },
            { icon: <GraduationCap className="w-5 h-5" />, label: "Then Programme",      sub: "Narrow to a programme" },
            { icon: <Calendar className="w-5 h-5" />,      label: "Then Year",           sub: "Pick year of study" },
            { icon: <BookOpen className="w-5 h-5" />,      label: "Then Semester",       sub: "View that class group" },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
            >
              <span className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg text-primary-600">{item.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.label}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{item.sub}</p>
              </div>
              {i < 3 && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 ml-auto" />}
            </div>
          ))}
        </div>
      )}

      {/* ── "Browse by class" trigger card (when on "all" step) ─────────────── */}
      {wizardStep === "all" && (
        <Card>
          <CardHeader
            title="Browse by Class"
            subtitle="Drill down to a specific department, programme, year and semester"
            action={
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Filter className="w-4 h-4" />}
                onClick={() => setWizardStep("department")}
              >
                Select Class
              </Button>
            }
          />
          {/* Department cards preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {departments.map((department) => (
              <button
                key={department.id}
                onClick={() => handleSelectDepartment(department)}
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-gray-100 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/20 text-left transition-all group"
              >
                <div className="p-2.5 bg-primary-50 dark:bg-primary-900/30 rounded-lg group-hover:bg-primary-100 transition-colors">
                  <Building2 className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{department.code}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{department.name}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* All Students view */}
      {wizardStep === "all" && (
        <StudentsView title="All Students" />
      )}

      {/* ── Step: Department (drill-down mode) ────────────────────────────────── */}
      {wizardStep === "department" && (
        <div className="space-y-4">
          <button onClick={handleViewAll} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to all students
          </button>
          <Card>
            <CardHeader
              title="Select a Department"
              action={
                <input type="text" placeholder="Search..." value={departmentSearch} onChange={(e) => setDepartmentSearch(e.target.value)}
                  className="w-44 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
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
        </div>
      )}

      {/* ── Step: Programme ─────────────────────────────────────────────────── */}
      {wizardStep === "programme" && selectedDepartment && (
        <div className="space-y-4">
          <button onClick={() => setWizardStep("department")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to departments
          </button>
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg w-fit">
            <Building2 className="w-4 h-4 text-primary-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{selectedDepartment.code} — {selectedDepartment.name}</span>
          </div>
          <Card>
            <CardHeader
              title="Select a Programme"
              action={
                <input type="text" placeholder="Search..." value={programmeSearch} onChange={(e) => setProgrammeSearch(e.target.value)}
                  className="w-44 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
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

      {/* ── Step: Year of Study ──────────────────────────────────────────────── */}
      {wizardStep === "year" && selectedProgramme && (
        <div className="space-y-4">
          <button onClick={() => setWizardStep("programme")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors">
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
            <CardHeader title="Select Academic Year & Year of Study" subtitle="Choose academic year first, then year level" />
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Academic Year
              </label>
              <select
                value={selectedAcademicYear?.id ?? ""}
                onChange={(e) => {
                  const y = academicYears.find((ay) => ay.id === e.target.value) ?? null;
                  setSelectedAcademicYear(y);
                  setSelectedYearLevel(null);
                  setSelectedSemester(null);
                }}
                className="w-full sm:w-72 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select academic year...</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}{y.isCurrent ? " (Current)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: selectedProgramme.durationYears }, (_, i) => i + 1).map((yearLevel) => (
                <button key={yearLevel} onClick={() => handleSelectYear(yearLevel)}
                  disabled={!selectedAcademicYear}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all group",
                    selectedAcademicYear
                      ? "border-gray-100 dark:border-gray-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/20"
                      : "border-gray-100 dark:border-gray-700 opacity-50 cursor-not-allowed"
                  )}>
                  <div className="p-2.5 bg-primary-50 dark:bg-primary-900/30 rounded-lg group-hover:bg-primary-100 transition-colors">
                    <Calendar className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">Year {yearLevel}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Step: Semester ───────────────────────────────────────────────────── */}
      {wizardStep === "semester" && selectedYearLevel && selectedAcademicYear && (
        <div className="space-y-4">
          <button onClick={() => setWizardStep("year")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to years
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Building2 className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{selectedDepartment?.code}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <GraduationCap className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{selectedProgramme?.code}</span>
            </div>
            {selectedAcademicYear && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Calendar className="w-4 h-4 text-primary-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{selectedAcademicYear.label}</span>
                </div>
              </>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Calendar className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Year {selectedYearLevel}</span>
            </div>
          </div>
          <Card>
            <CardHeader title="Select Semester" subtitle="Session filter will remain optional in the students list" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2].map((sem) => (
                <button key={sem} onClick={() => handleSelectSemester(sem)}
                  className="flex items-center gap-3 p-4 rounded-xl border-2 border-gray-100 dark:border-gray-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/20 text-left transition-all group">
                  <div className="p-2.5 bg-primary-50 dark:bg-primary-900/30 rounded-lg group-hover:bg-primary-100 transition-colors">
                    <BookOpen className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">Semester {sem}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Step: Students for selected programme/year/semester ─────────────── */}
      {wizardStep === "students" && selectedSemester && selectedYearLevel && selectedProgramme && selectedAcademicYear && (
        <>
          <button onClick={() => setWizardStep("semester")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Change semester
          </button>

          {/* Context strip */}
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Department",       value: selectedDepartment?.code ?? "—" },
              { label: "Programme",     value: selectedProgramme?.code ?? "—" },
              { label: "Academic Year", value: selectedAcademicYear.label },
              { label: "Year",          value: `Year ${selectedYearLevel}` },
              { label: "Semester",      value: `Semester ${selectedSemester}` },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}:</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{item.value}</span>
              </div>
            ))}
          </div>

          <StudentsView title={`${selectedProgramme.code} · ${selectedAcademicYear.label} · Year ${selectedYearLevel} · Semester ${selectedSemester} — Students`} />
        </>
      )}

      {/* ── Add Student Modal ──────────────────────────────────────────────── */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        title={modalStep === "form" ? "Add New Student" : "Register Fingerprint"}
        description={
          modalStep === "form"
            ? "Create a student account"
            : `Student "${createdStudent?.firstName} ${createdStudent?.lastName}" created successfully`
        }
        size="lg"
      >
        <div className="flex items-center gap-2 mb-6">
          {(["form", "fingerprint"] as ModalStep[]).map((step, i) => (
            <React.Fragment key={step}>
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                  modalStep === step || (step === "form" && modalStep === "fingerprint")
                    ? "bg-primary-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                )}>
                  {step === "form" && modalStep === "fingerprint" ? <CheckCircle2 className="w-4 h-4" /> : (i + 1)}
                </div>
                <span className={cn("text-sm font-medium", modalStep === step ? "text-primary-600 dark:text-primary-400" : "text-gray-500 dark:text-gray-400")}>
                  {step === "form" ? "Account Details" : "Fingerprint"}
                </span>
              </div>
              {i < 1 && <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />}
            </React.Fragment>
          ))}
          <span className="ml-auto text-xs text-gray-400">{modalStep === "fingerprint" ? "Optional" : "Required"}</span>
        </div>

        {modalStep === "form" && (
          <form onSubmit={handleAddStudent} className="space-y-4">
            {formErrors.submit && (
              <div className="flex items-start gap-2 p-3 bg-danger-50 dark:bg-red-950/30 border border-danger-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="w-4 h-4 text-danger-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-danger-700 dark:text-red-300">{formErrors.submit}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Input label="First Name" placeholder="e.g., John" {...field("firstName")} error={formErrors.firstName} />
              <Input label="Last Name"  placeholder="e.g., Doe"  {...field("lastName")}  error={formErrors.lastName} />
            </div>
            <Input label="Email Address" type="email" placeholder="student@university.edu" {...field("email")} error={formErrors.email} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Student ID"  placeholder="e.g., STU001" {...field("studentId")} error={formErrors.studentId} />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
                <select value={formData.department} onChange={(e) => setFormData((p) => ({ ...p, department: e.target.value }))}
                  className={cn(
                    "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-200",
                    formErrors.department ? "border-danger-500" : "border-gray-200 dark:border-gray-700"
                  )}>
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
                {formErrors.department && <p className="text-xs text-danger-600 mt-1">{formErrors.department}</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Programme</label>
              <select value={formData.program} onChange={(e) => setFormData((p) => ({ ...p, program: e.target.value }))}
                className={cn(
                  "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-200",
                  formErrors.program ? "border-danger-500" : "border-gray-200 dark:border-gray-700"
                )}>
                <option value="">Select programme</option>
                {allProgrammes.map((p) => (
                  <option key={p.id} value={p.code}>{p.code} — {p.name}</option>
                ))}
              </select>
              {formErrors.program && <p className="text-xs text-danger-600 mt-1">{formErrors.program}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Study Session</label>
                <select value={formData.studyTime} onChange={(e) => setFormData((p) => ({ ...p, studyTime: e.target.value as StudyTime | "" }))}
                  className={cn(
                    "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-200",
                    formErrors.studyTime ? "border-danger-500" : "border-gray-200 dark:border-gray-700"
                  )}>
                  <option value="">Select session</option>
                  <option value="day">Day</option>
                  <option value="evening">Evening</option>
                  <option value="weekend">Weekend</option>
                </select>
                {formErrors.studyTime && <p className="text-xs text-danger-600 mt-1">{formErrors.studyTime}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Academic Year</label>
                <select value={formData.academicYearId} onChange={(e) => setFormData((p) => ({ ...p, academicYearId: e.target.value }))}
                  className={cn(
                    "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-200",
                    formErrors.academicYearId ? "border-danger-500" : "border-gray-200 dark:border-gray-700"
                  )}>
                  <option value="">Select year</option>
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>{y.label}{y.isCurrent ? " (Current)" : ""}</option>
                  ))}
                </select>
                {formErrors.academicYearId && <p className="text-xs text-danger-600 mt-1">{formErrors.academicYearId}</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Class (Cohort)</label>
              <select value={formData.cohortId} onChange={(e) => setFormData((p) => ({ ...p, cohortId: e.target.value }))}
                className={cn(
                  "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-200",
                  formErrors.cohortId ? "border-danger-500" : "border-gray-200 dark:border-gray-700"
                )}>
                <option value="">Select class (optional)</option>
                {filteredCohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.programmeCode}{c.currentSemesterLabel ? ` · ${c.currentSemesterLabel}` : ""}
                  </option>
                ))}
              </select>
              {formErrors.cohortId && <p className="text-xs text-danger-600 mt-1">{formErrors.cohortId}</p>}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Pick the same cohort as Irene (e.g., BIT … 3:1) to place students in her class.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Password"         type="password" placeholder="Min. 8 characters" {...field("password")}        error={formErrors.password} />
              <Input label="Confirm Password" type="password" placeholder="Re-enter password" {...field("passwordConfirm")} error={formErrors.passwordConfirm} />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
              <Button variant="outline" type="button" onClick={handleCloseAddModal}>Cancel</Button>
              <Button type="submit" isLoading={isSaving}>Create Student</Button>
            </div>
          </form>
        )}

        {modalStep === "fingerprint" && (
          <div className="space-y-4">
            {fpRegistered ? (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="w-16 h-16 rounded-full bg-success-100 dark:bg-green-900/40 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-success-600 dark:text-green-400" />
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">Fingerprint Registered!</p>
                <p className="text-sm text-gray-500 mt-1">{createdStudent?.firstName} {createdStudent?.lastName} is fully enrolled.</p>
                <Button className="mt-6" onClick={handleCloseAddModal}>Done</Button>
              </div>
            ) : (
              <>
                <div className="p-3 bg-success-50 dark:bg-green-950/30 border border-success-200 dark:border-green-800 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success-600 flex-shrink-0" />
                  <p className="text-sm text-success-700 dark:text-green-300">
                    Account created for <strong>{createdStudent?.firstName} {createdStudent?.lastName}</strong>. Optionally enrol their fingerprint.
                  </p>
                </div>
                <FingerprintCapture
                  onCapture={(template, quality) => { setCapturedTemplate(template); setCaptureQuality(quality); }}
                  autoDiscover
                />
                <div className="flex justify-between gap-3 pt-4 border-t dark:border-gray-700">
                  <Button variant="outline" onClick={handleCloseAddModal} disabled={isRegisteringFp}>Skip for now</Button>
                  <Button onClick={handleRegisterFingerprint} disabled={!capturedTemplate} isLoading={isRegisteringFp} leftIcon={<Fingerprint className="w-4 h-4" />}>
                    Register Fingerprint
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ── Edit Student Modal ─────────────────────────────────────────────── */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => { if (isUpdating) return; setIsEditModalOpen(false); setEditingStudent(null); }}
        title="Edit Student"
        description={editingStudent ? `Editing ${editingStudent.firstName} ${editingStudent.lastName}` : ""}
        size="lg"
      >
        <form onSubmit={handleUpdateStudent} className="space-y-4">
          {editFormErrors.submit && (
            <div className="flex items-start gap-2 p-3 bg-danger-50 dark:bg-red-950/30 border border-danger-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-danger-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-danger-700 dark:text-red-300">{editFormErrors.submit}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" placeholder="e.g., John" value={editFormData.firstName}
              onChange={(e) => setEditFormData((p) => ({ ...p, firstName: e.target.value }))}
              error={editFormErrors.firstName} />
            <Input label="Last Name" placeholder="e.g., Doe" value={editFormData.lastName}
              onChange={(e) => setEditFormData((p) => ({ ...p, lastName: e.target.value }))}
              error={editFormErrors.lastName} />
          </div>
          <Input label="Email Address" type="email" placeholder="student@university.edu"
            value={editFormData.email}
            onChange={(e) => setEditFormData((p) => ({ ...p, email: e.target.value }))}
            error={editFormErrors.email} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Student ID" placeholder="e.g., STU001" value={editFormData.studentId}
              onChange={(e) => setEditFormData((p) => ({ ...p, studentId: e.target.value }))} />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
              <select value={editFormData.department}
                onChange={(e) => setEditFormData((p) => ({ ...p, department: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Programme</label>
            <select value={editFormData.program}
              onChange={(e) => setEditFormData((p) => ({ ...p, program: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">Select programme</option>
              {allProgrammes.map((p) => (
                <option key={p.id} value={p.code}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Study Session</label>
              <select value={editFormData.studyTime}
                onChange={(e) => setEditFormData((p) => ({ ...p, studyTime: e.target.value as StudyTime | "" }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">No session</option>
                <option value="day">Day</option>
                <option value="evening">Evening</option>
                <option value="weekend">Weekend</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Academic Year</label>
              <select value={editFormData.academicYearId}
                onChange={(e) => setEditFormData((p) => ({ ...p, academicYearId: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">No year</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>{y.label}{y.isCurrent ? " (Current)" : ""}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button variant="outline" type="button" onClick={() => { setIsEditModalOpen(false); setEditingStudent(null); }} disabled={isUpdating}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isUpdating}>Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Modal ───────────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => { if (isDeleting) return; setIsDeleteModalOpen(false); setSelectedStudent(null); setDeleteError(null); }}
        onConfirm={handleDeleteStudent}
        title="Delete Student"
        message={deleteError
          ? deleteError
          : `Are you sure you want to delete ${selectedStudent?.firstName} ${selectedStudent?.lastName}? This will permanently remove their account and attendance records.`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* ── Student Attendance Modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={isAttendanceModalOpen}
        onClose={() => { setIsAttendanceModalOpen(false); setAttendanceStudent(null); setAttendanceData(null); }}
        title={attendanceStudent ? `${attendanceStudent.firstName} ${attendanceStudent.lastName} — Attendance` : "Attendance"}
        description={attendanceStudent ? `${attendanceStudent.studentId ?? ""} · ${attendanceStudent.studyTime ?? ""}` : ""}
        size="xl"
      >
        {isLoadingAttendance && (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <svg className="animate-spin w-6 h-6 mr-3 text-primary-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Loading attendance data…
          </div>
        )}
        {attendanceError && (
          <div className="flex items-center gap-2 p-4 bg-danger-50 dark:bg-red-950/30 rounded-lg text-danger-700 dark:text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {attendanceError}
          </div>
        )}
        {attendanceData && !isLoadingAttendance && (
          <div className="flex flex-col" style={{ maxHeight: "65vh" }}>
            {/* Summary row — sticky, not scrolled */}
            <div className="flex-shrink-0 mb-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl text-sm">
                <div className="flex-1">
                  <span className="text-gray-500">Cohort:</span>{" "}
                  <span className="font-medium text-gray-800 dark:text-gray-200">{attendanceData.student.cohort ?? "—"}</span>
                </div>
                <div className="flex-1">
                  <span className="text-gray-500">Overall avg:</span>{" "}
                  <span className={cn("font-semibold", attendanceData.overallPercentage >= 75 ? "text-success-600" : "text-danger-600")}>
                    {attendanceData.overallPercentage}%
                  </span>
                </div>
                <div className="flex-1">
                  <span className="text-gray-500">Courses:</span>{" "}
                  <span className="font-medium text-gray-800 dark:text-gray-200">{attendanceData.courses.length}</span>
                </div>
              </div>
            </div>

            {/* Scrollable course cards */}
            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
            {attendanceData.courses.length === 0 && (
              <p className="text-center text-gray-400 py-10">No attendance records found for this student.</p>
            )}

            {/* Per-course cards */}
            {attendanceData.courses.map((course: any) => {
              const pct: number = course.attendancePercentage;
              const safe = pct >= course.threshold;
              const barColor = safe ? "bg-success-500" : "bg-danger-500";
              const textColor = safe ? "text-success-600 dark:text-success-400" : "text-danger-600 dark:text-danger-400";

              return (
                <div key={course.courseId} className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                  {/* Course header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                    <div>
                      <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{course.courseCode}</span>
                      <span className="mx-2 text-gray-300">·</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{course.courseName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={safe ? "success" : "danger"} dot>
                        {safe ? "On track" : "At risk"}
                      </Badge>
                      <span className={cn("text-sm font-bold tabular-nums", textColor)}>{pct}%</span>
                    </div>
                  </div>

                  <div className="px-4 py-3 space-y-3">
                    {/* Attendance bar */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{course.attended} attended / {course.totalLectures} total lectures</span>
                        <span>{course.absent} absent</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      {/* Threshold marker */}
                      <div className="relative h-1 mt-0.5">
                        <div className="absolute h-2 w-0.5 bg-gray-400 dark:bg-gray-500 rounded top-0" style={{ left: `${course.threshold}%` }} />
                        <span className="absolute text-[10px] text-gray-400 -translate-x-1/2 top-2" style={{ left: `${course.threshold}%` }}>{course.threshold}%</span>
                      </div>
                    </div>

                    {/* Session trend — mini bar chart */}
                    {course.trend.length > 0 && (
                      <div className="mt-5">
                        <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" /> Cumulative attendance trend (session by session)
                        </p>
                        <div className="flex items-end gap-0.5 h-14">
                          {course.trend.map((t: any, idx: number) => {
                            const present = t.status === "present" || t.status === "late";
                            return (
                              <div key={`${course.courseId}-${idx}`} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                                {/* bar = cumulative % */}
                                <div
                                  className={cn("w-full rounded-sm transition-all", present ? "bg-primary-400" : "bg-gray-200 dark:bg-gray-600")}
                                  style={{ height: `${Math.max((t.cumulativePct / 100) * 48, 2)}px` }}
                                />
                                {/* tooltip */}
                                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                                  <div className="bg-gray-900 text-white text-[10px] rounded px-1.5 py-1 whitespace-nowrap shadow-lg">
                                    {t.date}<br/>{present ? "✓ Present" : "✗ Absent"}<br/>{t.cumulativePct}%
                                  </div>
                                  <div className="w-1.5 h-1.5 bg-gray-900 rotate-45 -mt-0.5" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                          <span>Session 1</span>
                          <span>Session {course.trend.length}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>{/* end scrollable */}
          </div>
        )}
      </Modal>
    </div>
  );
}
