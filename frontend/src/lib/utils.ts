/**
 * Utility functions for the application
 * Contains helpers for formatting, validation, and common operations
 */

import { clsx, type ClassValue } from "clsx";

/**
 * Combines class names conditionally using clsx
 * Useful for dynamic Tailwind class application
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/**
 * Formats a date string to a readable format
 */
export function formatDate(dateString: string, options?: Intl.DateTimeFormatOptions): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  });
}

/**
 * Formats time string (HH:MM:SS) to 12-hour format
 */
export function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Returns appropriate color class based on attendance percentage
 * Uses 75% as the critical threshold as per system requirements
 */
export function getAttendanceColorClass(percentage: number): string {
  if (percentage >= 75) return "text-success-600";
  if (percentage >= 60) return "text-warning-600";
  return "text-danger-600";
}

/**
 * Returns background color class for attendance badges
 */
export function getAttendanceBgClass(percentage: number): string {
  if (percentage >= 75) return "bg-success-50 text-success-600";
  if (percentage >= 60) return "bg-warning-50 text-warning-600";
  return "bg-danger-50 text-danger-600";
}

/**
 * Returns status color for attendance status badges
 */
export function getStatusColorClass(status: string): string {
  const colors: Record<string, string> = {
    present: "bg-success-50 text-success-600",
    absent: "bg-danger-50 text-danger-600",
    late: "bg-warning-50 text-warning-600",
    excused: "bg-primary-50 text-primary-600",
  };
  return colors[status] || "bg-gray-50 text-gray-600";
}

/**
 * Returns day name from day number (0 = Monday)
 */
export function getDayName(dayNumber: number): string {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return days[dayNumber] || "";
}

/**
 * Truncates text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * Generates initials from a name
 */
export function getInitials(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.charAt(0) || '';
  const last = lastName?.charAt(0) || '';
  return `${first}${last}`.toUpperCase() || '??';
}

/**
 * Formats large numbers with abbreviations
 */
export function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
  return num.toString();
}

/**
 * Calculates risk level based on attendance percentage
 */
export function calculateRiskLevel(percentage: number): "low" | "medium" | "high" {
  if (percentage >= 75) return "low";
  if (percentage >= 60) return "medium";
  return "high";
}

/**
 * Debounce function for search inputs
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generates a random color for avatars without images
 */
export function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}
