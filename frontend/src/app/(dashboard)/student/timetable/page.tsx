"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, PageLoading, Badge } from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { TimetableSlot } from "@/types";
import { Clock, MapPin, BookOpen, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_TO_NUM: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
  friday: 4, saturday: 5, sunday: 6,
};

const SLOT_COLORS = [
  "bg-primary-100 border-primary-300 text-primary-800 dark:bg-primary-950/50 dark:border-primary-700 dark:text-primary-300",
  "bg-success-50 border-success-300 text-success-800 dark:bg-green-950/50 dark:border-green-700 dark:text-green-300",
  "bg-warning-50 border-warning-300 text-warning-800 dark:bg-yellow-950/50 dark:border-yellow-700 dark:text-yellow-300",
  "bg-purple-50 border-purple-300 text-purple-800 dark:bg-purple-950/50 dark:border-purple-700 dark:text-purple-300",
  "bg-pink-50 border-pink-300 text-pink-800 dark:bg-pink-950/50 dark:border-pink-700 dark:text-pink-300",
];

function slotColor(courseId: string | undefined) {
  const id = courseId ?? "default";
  const n = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return SLOT_COLORS[n % SLOT_COLORS.length];
}

function slotDayIndex(slot: TimetableSlot): number {
  return DAY_TO_NUM[slot.dayOfWeek] ?? 0;
}

function isNowInSlot(slot: TimetableSlot, dayIndex: number): boolean {
  const now = new Date();
  const todayIndex = (now.getDay() + 6) % 7;
  if (slotDayIndex(slot) !== todayIndex || dayIndex !== todayIndex) return false;
  const [sh, sm] = slot.startTime.split(":").map(Number);
  const [eh, em] = slot.endTime.split(":").map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return nowMins >= sh * 60 + sm && nowMins <= eh * 60 + em;
}

export default function StudentTimetablePage() {
  const { user } = useAuth();
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number>(() => (new Date().getDay() + 6) % 7);

  useEffect(() => {
    const fetchTimetable = async () => {
      try {
        setIsLoading(true);
        const response = await apiClient.get<TimetableSlot[] | { results: TimetableSlot[] }>(
          API_ENDPOINTS.timetable.studentTimetable
        );
        const data = response.data;
        setSlots(Array.isArray(data) ? data : (data as any).results ?? []);
      } catch {
        // Demo data
        setSlots([
          { id: "1", course: "1", courseCode: "BIT201", courseName: "Data Structures", dayOfWeek: "saturday", startTime: "08:00", endTime: "11:00", room: "W-LT3", isActive: true },
          { id: "2", course: "2", courseCode: "DIT201", courseName: "Web Technologies", dayOfWeek: "saturday", startTime: "11:00", endTime: "14:00", room: "W-LT7", isActive: true },
          { id: "3", course: "3", courseCode: "DIT201", courseName: "Web Technologies", dayOfWeek: "sunday", startTime: "11:00", endTime: "14:00", room: "W-LT7", isActive: true },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTimetable();
  }, [user]);

  if (isLoading) return <PageLoading message="Loading your timetable..." />;

  const todayIndex = (new Date().getDay() + 6) % 7;
  const slotsForDay = slots
    .filter((s) => slotDayIndex(s) === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const upcomingToday = slots
    .filter((s) => {
      if (slotDayIndex(s) !== todayIndex) return false;
      const [h, m] = s.startTime.split(":").map(Number);
      const now = new Date();
      return h * 60 + m >= now.getHours() * 60 + now.getMinutes();
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Timetable</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Your class schedule for this semester
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Calendar className="w-4 h-4" />
          <span>Today: {DAYS[todayIndex]}</span>
        </div>
      </div>

      {/* Upcoming Today */}
      {upcomingToday.length > 0 && (
        <Card className="border-l-4 border-l-primary-500">
          <CardHeader
            title="Next Class Today"
            subtitle={`${upcomingToday.length} upcoming ${upcomingToday.length === 1 ? "class" : "classes"}`}
          />
          <div className="space-y-3">
            {upcomingToday.slice(0, 2).map((slot) => {
              const isNow = isNowInSlot(slot, todayIndex);
              return (
                <div
                  key={slot.id}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg border",
                    isNow
                      ? "bg-primary-50 dark:bg-primary-950/30 border-primary-200 dark:border-primary-800"
                      : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
                  )}
                >
                  <div className={cn("w-1.5 h-12 rounded-full flex-shrink-0", isNow ? "bg-primary-500" : "bg-gray-300 dark:bg-gray-600")} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {slot.courseCode}
                      </p>
                      {isNow && <Badge variant="success" dot>Now</Badge>}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{slot.courseName}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {slot.startTime} – {slot.endTime}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{slot.room ?? slot.building ?? "TBA"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Day Selector */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {DAYS.map((day, i) => (
          <button
            key={i}
            onClick={() => setSelectedDay(i)}
            className={cn(
              "flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-xl font-medium text-sm transition-all",
              selectedDay === i
                ? "bg-primary-600 text-white shadow-md"
                : i === todayIndex
                ? "bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
          >
            <span className="text-xs">{SHORT_DAYS[i]}</span>
            <span>{slots.filter(s => slotDayIndex(s) === i).length}</span>
          </button>
        ))}
      </div>

      {/* Daily Schedule */}
      <Card>
        <CardHeader
          title={DAYS[selectedDay]}
          subtitle={selectedDay === todayIndex ? "Today" : ""}
        />
        {slotsForDay.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">No classes scheduled for {DAYS[selectedDay]}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {slotsForDay.map((slot) => {
              const isNow = isNowInSlot(slot, selectedDay);
              return (
                <div
                  key={slot.id}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border-2 transition-all",
                    isNow
                      ? "border-primary-400 dark:border-primary-600 bg-primary-50 dark:bg-primary-950/30 shadow-sm"
                      : `border ${slotColor(slot.courseCode ?? slot.course).split(" ").slice(2).join(" ")} ${slotColor(slot.courseCode ?? slot.course).split(" ").slice(0, 2).join(" ")}`
                  )}
                >
                  {/* Time column */}
                  <div className="flex-shrink-0 w-20 text-center">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{slot.startTime}</p>
                    <p className="text-xs text-gray-400">to</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{slot.endTime}</p>
                  </div>

                  <div className="w-px h-12 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />

                  {/* Course info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                        {slot.courseCode}
                      </span>
                      {isNow && <Badge variant="success" dot>In Progress</Badge>}
                    </div>
                    <p className="mt-1 font-medium text-gray-900 dark:text-gray-100">{slot.courseName}</p>
                    <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {slot.room ?? slot.building ?? "TBA"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {(() => {
                          const [sh, sm] = slot.startTime.split(":").map(Number);
                          const [eh, em] = slot.endTime.split(":").map(Number);
                          const diff = (eh * 60 + em) - (sh * 60 + sm);
                          return `${diff} min`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Weekly Overview Grid */}
      <Card>
        <CardHeader title="Weekly Overview" subtitle="All scheduled classes at a glance" />
        <div className="grid grid-cols-5 gap-2 overflow-x-auto">
          {DAYS.slice(0, 5).map((day, i) => {
            const daySlots = slots
              .filter((s) => slotDayIndex(s) === i)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(i)}
                className={cn(
                  "rounded-xl p-2 text-left transition-all hover:shadow-sm",
                  i === todayIndex ? "bg-primary-50 dark:bg-primary-950/30" : "bg-gray-50 dark:bg-gray-800/50"
                )}
              >
                <p className={cn(
                  "text-xs font-bold mb-2 text-center",
                  i === todayIndex ? "text-primary-600 dark:text-primary-400" : "text-gray-500 dark:text-gray-400"
                )}>
                  {SHORT_DAYS[i]}
                </p>
                {daySlots.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-2">Free</p>
                ) : (
                  <div className="space-y-1">
                    {daySlots.map((slot) => (
                      <div
                        key={slot.id}
                        className={cn("rounded-lg p-1.5 border text-xs", slotColor(slot.courseCode ?? slot.course))}
                      >
                        <p className="font-bold">{slot.courseCode}</p>
                        <p className="opacity-75">{slot.startTime}</p>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
