"use client";

import React, { useState } from "react";
import {
  Card,
  CardHeader,
  Button,
  Badge,
  Input,
  Avatar,
} from "@/components/ui";
import { FingerprintCapture } from "@/components/fingerprint/FingerprintCapture";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { User } from "@/types";
import {
  Search,
  Fingerprint,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User as UserIcon,
} from "lucide-react";

type RegistrationStatus = "idle" | "submitting" | "success" | "error";

export default function AdminFingerprintPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [capturedTemplate, setCapturedTemplate] = useState<string | null>(null);
  const [captureQuality, setCaptureQuality] = useState<number>(0);
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    setSelectedStudent(null);
    setCapturedTemplate(null);
    setRegistrationStatus("idle");

    try {
      const response = await apiClient.get<{ results: User[] }>(
        `${API_ENDPOINTS.students.list}?search=${encodeURIComponent(searchTerm)}`
      );
      const students = (response.data as any).results ?? response.data as any;
      setSearchResults(Array.isArray(students) ? students : []);
    } catch {
      // Demo fallback
      const demo: User[] = [
        { id: "1", email: "john.doe@university.edu", firstName: "John", lastName: "Doe", role: "student" as const, studentId: "STU001", department: "Computer Science", isActive: true, fingerprintRegistered: false, createdAt: "2025-08-15T10:00:00Z" },
        { id: "2", email: "jane.smith@university.edu", firstName: "Jane", lastName: "Smith", role: "student" as const, studentId: "STU002", department: "Computer Science", isActive: true, fingerprintRegistered: true, createdAt: "2025-08-16T11:00:00Z" },
        { id: "3", email: "mike.johnson@university.edu", firstName: "Mike", lastName: "Johnson", role: "student" as const, studentId: "STU003", department: "Engineering", isActive: true, fingerprintRegistered: false, createdAt: "2025-08-17T09:00:00Z" },
      ].filter(s =>
        `${s.firstName} ${s.lastName} ${s.studentId}`.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setSearchResults(demo);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectStudent = (student: User) => {
    setSelectedStudent(student);
    setCapturedTemplate(null);
    setRegistrationStatus("idle");
    setStatusMessage("");
  };

  const handleCapture = (template: string, quality: number) => {
    setCapturedTemplate(template);
    setCaptureQuality(quality);
    setRegistrationStatus("idle");
    setStatusMessage("");
  };

  const handleRegister = async () => {
    if (!selectedStudent || !capturedTemplate) return;

    setRegistrationStatus("submitting");
    try {
      await apiClient.post(
        API_ENDPOINTS.fingerprint.register(String(selectedStudent.id)),
        { fingerprint_template: capturedTemplate, quality: captureQuality }
      );
      setRegistrationStatus("success");
      setStatusMessage(`Fingerprint successfully registered for ${selectedStudent.firstName} ${selectedStudent.lastName}.`);
      // Update fingerprint status in search results
      setSearchResults((prev) =>
        prev.map((s) => s.id === selectedStudent.id ? { ...s, fingerprintRegistered: true } : s)
      );
      setSelectedStudent((prev) => prev ? { ...prev, fingerprintRegistered: true } : null);
    } catch (err: any) {
      setRegistrationStatus("error");
      setStatusMessage(err?.response?.data?.message ?? "Failed to register fingerprint. Please try again.");
    }
  };

  const handleReset = () => {
    setSelectedStudent(null);
    setCapturedTemplate(null);
    setRegistrationStatus("idle");
    setStatusMessage("");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fingerprint Registration</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Enrol student fingerprints for biometric attendance verification
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Student Search */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Find Student"
              subtitle="Search by name or student ID"
            />
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
              <Button type="submit" isLoading={isSearching} className="flex-shrink-0">
                Search
              </Button>
            </form>

            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {searchResults.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => handleSelectStudent(student)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-colors ${
                      selectedStudent?.id === student.id
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30"
                        : "border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <Avatar
                      firstName={student.firstName}
                      lastName={student.lastName}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {student.firstName} {student.lastName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {student.studentId} · {student.department}
                      </p>
                    </div>
                    <Badge
                      variant={student.fingerprintRegistered ? "success" : "default"}
                      dot
                    >
                      {student.fingerprintRegistered ? "Enrolled" : "Not enrolled"}
                    </Badge>
                  </button>
                ))}
              </div>
            )}

            {!isSearching && searchTerm && searchResults.length === 0 && (
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <UserIcon className="w-4 h-4" />
                No students found for &quot;{searchTerm}&quot;
              </div>
            )}
          </Card>

          {/* Selected Student Info */}
          {selectedStudent && (
            <Card>
              <CardHeader
                title="Selected Student"
                action={
                  <button
                    onClick={handleReset}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    Clear
                  </button>
                }
              />
              <div className="flex items-center gap-4">
                <Avatar
                  firstName={selectedStudent.firstName}
                  lastName={selectedStudent.lastName}
                  size="lg"
                />
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedStudent.firstName} {selectedStudent.lastName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    ID: {selectedStudent.studentId}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedStudent.department}
                  </p>
                  <div className="mt-2">
                    <Badge
                      variant={selectedStudent.fingerprintRegistered ? "success" : "warning"}
                      dot
                    >
                      {selectedStudent.fingerprintRegistered ? "Fingerprint Enrolled" : "Not Yet Enrolled"}
                    </Badge>
                  </div>
                </div>
              </div>

              {selectedStudent.fingerprintRegistered && (
                <div className="mt-4 p-3 bg-warning-50 dark:bg-yellow-950/30 border border-warning-200 dark:border-yellow-800 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-warning-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-warning-700 dark:text-yellow-300">
                    This student already has a fingerprint registered. Submitting a new one will overwrite the existing record.
                  </p>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right: Fingerprint Capture */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Capture Fingerprint"
              subtitle="Use Mantra MFS100 scanner"
            />

            {!selectedStudent ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                  <Fingerprint className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Select a student on the left to begin fingerprint capture
                </p>
              </div>
            ) : (
              <>
                <FingerprintCapture
                  onCapture={handleCapture}
                  autoDiscover
                  className="mb-4"
                />

                {capturedTemplate && registrationStatus !== "success" && (
                  <div className="space-y-3">
                    <div className="p-3 bg-success-50 dark:bg-green-950/30 border border-success-200 dark:border-green-800 rounded-lg flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success-600 dark:text-green-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-success-700 dark:text-green-300">
                          Fingerprint captured
                        </p>
                        <p className="text-xs text-success-600 dark:text-green-400">
                          Quality score: {captureQuality}%
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleRegister}
                      fullWidth
                      isLoading={registrationStatus === "submitting"}
                      leftIcon={<Fingerprint className="w-4 h-4" />}
                    >
                      Register Fingerprint
                    </Button>
                  </div>
                )}

                {registrationStatus === "success" && (
                  <div className="p-4 bg-success-50 dark:bg-green-950/30 border border-success-200 dark:border-green-800 rounded-lg flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-success-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-success-700 dark:text-green-300">Registration Successful</p>
                      <p className="text-sm text-success-600 dark:text-green-400 mt-0.5">{statusMessage}</p>
                    </div>
                  </div>
                )}

                {registrationStatus === "error" && (
                  <div className="p-4 bg-danger-50 dark:bg-red-950/30 border border-danger-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-danger-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-danger-700 dark:text-red-300">Registration Failed</p>
                      <p className="text-sm text-danger-600 dark:text-red-400 mt-0.5">{statusMessage}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader title="Instructions" />
            <ol className="space-y-3">
              {[
                "Search for the student by name or ID and select them from the results.",
                "Ensure the Mantra MFS100 fingerprint scanner is connected and RD Service is running.",
                "Click 'Scan Fingerprint' and have the student place their finger on the scanner.",
                "Verify the quality score is above 50% for a reliable match.",
                "Click 'Register Fingerprint' to save the template to the student's profile.",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{step}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
