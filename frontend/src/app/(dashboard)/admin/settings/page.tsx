"use client";

import React, { useState } from "react";
import { Card, CardHeader, Button, Input, Badge } from "@/components/ui";
import { Fingerprint, Save, CheckCircle2 } from "lucide-react";

export default function AdminSettingsPage() {
  const [fingerprintThreshold, setFingerprintThreshold] = useState("60");
  const [qualityThreshold, setQualityThreshold] = useState("50");
  const [maxAttempts, setMaxAttempts] = useState("3");
  const [attendanceThreshold, setAttendanceThreshold] = useState("75");
  const [reminderMinutes, setReminderMinutes] = useState("15");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Configure system-wide settings and thresholds
        </p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 p-3 bg-success-50 dark:bg-green-950/30 border border-success-200 dark:border-green-800 rounded-lg text-success-700 dark:text-green-300">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">Settings saved successfully.</span>
        </div>
      )}

      <Card>
        <CardHeader
          title="Fingerprint Configuration"
          subtitle="Mantra MFS100 matching parameters"
        />
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800 rounded-lg">
            <Fingerprint className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-primary-700 dark:text-primary-300">
              Ensure the Mantra MFS100 RD Service is running on the client machine. The browser must
              accept the self-signed certificate at{" "}
              <code className="text-xs bg-primary-100 dark:bg-primary-900 px-1 rounded">
                https://localhost:11100
              </code>{" "}
              once before use.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Match Threshold (0–100)"
              type="number"
              min="0"
              max="100"
              value={fingerprintThreshold}
              onChange={(e) => setFingerprintThreshold(e.target.value)}
              hint="Minimum similarity score for a match"
            />
            <Input
              label="Quality Threshold (%)"
              type="number"
              min="0"
              max="100"
              value={qualityThreshold}
              onChange={(e) => setQualityThreshold(e.target.value)}
              hint="Minimum capture quality to accept"
            />
            <Input
              label="Max Capture Attempts"
              type="number"
              min="1"
              max="10"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(e.target.value)}
              hint="Retries before failing capture"
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Attendance Rules" subtitle="Thresholds and notification timing" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="At-Risk Threshold (%)"
            type="number"
            min="0"
            max="100"
            value={attendanceThreshold}
            onChange={(e) => setAttendanceThreshold(e.target.value)}
            hint="Students below this are flagged as at-risk"
          />
          <Input
            label="Lecture Reminder (minutes before)"
            type="number"
            min="1"
            max="60"
            value={reminderMinutes}
            onChange={(e) => setReminderMinutes(e.target.value)}
            hint="How early to send upcoming lecture alerts"
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="System Information" />
        <div className="space-y-3">
          {[
            { label: "Backend", value: "Django 4.2 + DRF" },
            { label: "Frontend", value: "Next.js 14" },
            { label: "Fingerprint SDK", value: "Mantra MFS100 RD Service" },
            { label: "Matching Library", value: "SourceAFIS" },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
            >
              <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
              <Badge variant="default">{value}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />}>
          Save Settings
        </Button>
      </div>
    </div>
  );
}
