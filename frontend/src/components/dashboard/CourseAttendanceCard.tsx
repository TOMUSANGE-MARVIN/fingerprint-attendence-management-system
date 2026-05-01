/**
 * Course Attendance Card Component
 * Displays individual course attendance status with progress indicator
 */

import React from "react";
import { cn, getAttendanceBgClass } from "@/lib/utils";
import { Card, Badge } from "@/components/ui";
import { StudentAttendanceSummary } from "@/types";
import { BookOpen } from "lucide-react";

interface CourseAttendanceCardProps {
  course: StudentAttendanceSummary;
  onClick?: () => void;
}

export function CourseAttendanceCard({ course, onClick }: CourseAttendanceCardProps) {
  const isAtRisk = course.attendancePercentage < 75;
  const progressColor = course.attendancePercentage >= 75 
    ? "bg-success-500" 
    : course.attendancePercentage >= 60 
      ? "bg-warning-500" 
      : "bg-danger-500";

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md card-hover",
        isAtRisk && "border-l-4 border-l-danger-500"
      )}
    >
      <div onClick={onClick} role="button" tabIndex={0}>
        {/* Course Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 rounded-lg">
              <BookOpen className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{course.courseCode}</h3>
              <p className="text-sm text-gray-500 truncate max-w-[200px]">
                {course.courseName}
              </p>
            </div>
          </div>
          <Badge className={getAttendanceBgClass(course.attendancePercentage)}>
            {course.attendancePercentage.toFixed(1)}%
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-500">Attendance Progress</span>
            <span className="font-medium text-gray-900">
              {course.attended}/{course.totalSessions} sessions
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-300", progressColor)}
              style={{ width: `${Math.min(course.attendancePercentage, 100)}%` }}
            />
          </div>
          {/* 75% threshold marker */}
          <div className="relative h-0">
            <div
              className="absolute top-[-8px] w-0.5 h-2 bg-gray-400"
              style={{ left: "75%" }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-2 bg-success-50 rounded-lg">
            <p className="text-lg font-bold text-success-600">{course.attended}</p>
            <p className="text-xs text-gray-500">Present</p>
          </div>
          <div className="p-2 bg-danger-50 rounded-lg">
            <p className="text-lg font-bold text-danger-600">{course.absent}</p>
            <p className="text-xs text-gray-500">Absent</p>
          </div>
        </div>

        {/* Risk Warning */}
        {isAtRisk && (
          <div className="mt-4 p-3 bg-danger-50 rounded-lg">
            <p className="text-sm text-danger-700">
              ⚠️ Attendance below 75% threshold. Attend {Math.ceil((0.75 * course.totalSessions) - course.attended)} more sessions to meet requirement.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

// Course List Component
interface CourseListProps {
  courses: StudentAttendanceSummary[];
}

export function CourseList({ courses }: CourseListProps) {
  if (courses.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>No courses registered</p>
        <p className="text-sm">Contact your administrator to enroll in courses</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {courses.map((course) => (
        <CourseAttendanceCard key={course.courseId} course={course} />
      ))}
    </div>
  );
}
