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
import { TimetableSlot } from "@/types";
import { Clock, Plus, Trash2, Calendar } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const dayLabel = (d: string) => d.charAt(0).toUpperCase() + d.slice(1);
const dayIndex = (d: string) => DAY_KEYS.indexOf(d.toLowerCase());

const DEMO_SLOTS: TimetableSlot[] = [
  { id: "1", courseId: "1", course: { id: 1, code: "CS301", name: "Database Systems" }, dayOfWeek: "monday", startTime: "09:00", endTime: "11:00", room: "Room 101", isActive: true },
  { id: "2", courseId: "2", course: { id: 2, code: "CS302", name: "Software Engineering" }, dayOfWeek: "tuesday", startTime: "11:00", endTime: "13:00", room: "Lab A", isActive: true },
  { id: "3", courseId: "3", course: { id: 3, code: "ENG201", name: "Engineering Mathematics" }, dayOfWeek: "wednesday", startTime: "08:00", endTime: "10:00", room: "Room 202", isActive: true },
  { id: "4", courseId: "1", course: { id: 1, code: "CS301", name: "Database Systems" }, dayOfWeek: "thursday", startTime: "14:00", endTime: "16:00", room: "Room 101", isActive: true },
  { id: "5", courseId: "4", course: { id: 4, code: "CS303", name: "Computer Networks" }, dayOfWeek: "friday", startTime: "10:00", endTime: "12:00", room: "Lab B", isActive: false },
];

interface SlotFormData {
  courseCode: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  venue: string;
}

const emptyForm: SlotFormData = {
  courseCode: "",
  dayOfWeek: "monday",
  startTime: "08:00",
  endTime: "10:00",
  venue: "",
};

export default function AdminTimetablesPage() {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterDay, setFilterDay] = useState<string>("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimetableSlot | null>(null);
  const [formData, setFormData] = useState<SlotFormData>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchSlots = async () => {
      try {
        const response = await apiClient.get<{ results: TimetableSlot[] } | TimetableSlot[]>(
          API_ENDPOINTS.timetable.list
        );
        const data = response.data as any;
        setSlots(Array.isArray(data) ? data : data.results ?? []);
      } catch {
        setSlots(DEMO_SLOTS);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSlots();
  }, []);

  const filtered = filterDay === "all"
    ? slots
    : slots.filter((s) => s.dayOfWeek === filterDay);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.courseCode.trim() || !formData.venue.trim()) {
      setFormError("Course code and venue are required.");
      return;
    }
    if (formData.startTime >= formData.endTime) {
      setFormError("End time must be after start time.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await apiClient.post<TimetableSlot>(API_ENDPOINTS.timetable.list, {
        course_code: formData.courseCode,
        day_of_week: formData.dayOfWeek,
        start_time: formData.startTime,
        end_time: formData.endTime,
        venue: formData.venue,
      });
      setSlots((prev) => [...prev, response.data]);
      setIsAddModalOpen(false);
      setFormData(emptyForm);
    } catch (err: any) {
      const data = err?.response?.data;
      setFormError(
        typeof data === "object"
          ? Object.values(data).flat().join(" ")
          : "Failed to create timetable slot."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSlot) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(API_ENDPOINTS.timetable.detail(selectedSlot.id));
      setSlots((prev) => prev.filter((s) => s.id !== selectedSlot.id));
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      setDeleteError(err?.response?.data?.detail || "Failed to delete slot.");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: TableColumn<TimetableSlot>[] = [
    {
      key: "course",
      header: "Course",
      render: (s) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">{s.course.code}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{s.course.name}</p>
        </div>
      ),
    },
    {
      key: "day",
      header: "Day",
      render: (s) => <span className="text-gray-700 dark:text-gray-300">{dayLabel(s.dayOfWeek)}</span>,
    },
    {
      key: "time",
      header: "Time",
      render: (s) => (
        <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
          <Clock className="w-4 h-4 text-gray-400" />
          {s.startTime} – {s.endTime}
        </div>
      ),
    },
    {
      key: "room",
      header: "Venue",
      render: (s) => <span className="text-gray-700 dark:text-gray-300">{s.room ?? s.building ?? "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (s) => (
        <Badge variant={s.isActive ? "success" : "default"} dot>
          {s.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (s) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { setSelectedSlot(s); setDeleteError(null); setIsDeleteModalOpen(true); }}
          className="text-danger-600 hover:text-danger-700 hover:bg-danger-50"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  if (isLoading) return <PageLoading message="Loading timetables..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Timetables</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage course schedules and timetable slots
          </p>
        </div>
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => { setFormData(emptyForm); setFormError(null); setIsAddModalOpen(true); }}
        >
          Add Slot
        </Button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
        {DAYS.slice(0, 5).map((day, i) => (
          <Card key={i} className="text-center">
            <p className="text-2xl font-bold text-primary-600">
              {slots.filter((s) => dayIndex(s.dayOfWeek) === i).length}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{day}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="All Timetable Slots"
          subtitle={`${filtered.length} slots`}
          action={
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <select
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Days</option>
                {DAYS.map((d, i) => (
                  <option key={i} value={DAY_KEYS[i]}>{d}</option>
                ))}
              </select>
            </div>
          }
        />
        <Table
          columns={columns}
          data={filtered}
          keyExtractor={(s) => s.id}
          emptyMessage="No timetable slots found"
        />
      </Card>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Timetable Slot"
        description="Schedule a course for a specific day and time"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-danger-50 dark:bg-red-950/30 border border-danger-200 dark:border-red-800 rounded-lg text-sm text-danger-700 dark:text-red-300">
              {formError}
            </div>
          )}
          <Input
            label="Course Code"
            value={formData.courseCode}
            onChange={(e) => setFormData((p) => ({ ...p, courseCode: e.target.value }))}
            placeholder="e.g. CS301"
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Day</label>
            <select
              value={formData.dayOfWeek}
              onChange={(e) => setFormData((p) => ({ ...p, dayOfWeek: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {DAYS.map((d, i) => (
                <option key={i} value={DAY_KEYS[i]}>{d}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Time"
              type="time"
              value={formData.startTime}
              onChange={(e) => setFormData((p) => ({ ...p, startTime: e.target.value }))}
              required
            />
            <Input
              label="End Time"
              type="time"
              value={formData.endTime}
              onChange={(e) => setFormData((p) => ({ ...p, endTime: e.target.value }))}
              required
            />
          </div>
          <Input
            label="Venue"
            value={formData.venue}
            onChange={(e) => setFormData((p) => ({ ...p, venue: e.target.value }))}
            placeholder="e.g. Room 101"
            required
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting} leftIcon={<Clock className="w-4 h-4" />}>
              Add Slot
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Timetable Slot"
        message={deleteError
          ? `${selectedSlot?.course.code}: ${deleteError}`
          : `Delete ${selectedSlot?.course.code} slot on ${selectedSlot ? dayLabel(selectedSlot.dayOfWeek) : ""} at ${selectedSlot?.startTime}?`}
        confirmText="Delete"
        isLoading={isDeleting}
        variant="danger"
      />
    </div>
  );
}
