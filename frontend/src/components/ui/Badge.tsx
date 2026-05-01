/**
 * Badge Component
 * Used for status indicators, tags, and labels
 */

import React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-gray-100 text-gray-700",
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
  info: "bg-primary-50 text-primary-600",
};

const dotStyles: Record<BadgeVariant, string> = {
  default: "bg-gray-400",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
  info: "bg-primary-500",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
};

export function Badge({
  children,
  variant = "default",
  size = "md",
  dot = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full mr-1.5",
            dotStyles[variant]
          )}
        />
      )}
      {children}
    </span>
  );
}

// Attendance Status Badge - specialized for attendance statuses
interface AttendanceStatusBadgeProps {
  status: "present" | "absent";
}

export function AttendanceStatusBadge({ status }: AttendanceStatusBadgeProps) {
  const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
    present: { label: "Present", variant: "success" },
    absent: { label: "Absent", variant: "danger" },
    excused: { label: "Excused", variant: "info" },
  };

  const config = statusConfig[status];
  return (
    <Badge variant={config.variant} dot>
      {config.label}
    </Badge>
  );
}

// Attendance Percentage Badge - shows color based on 75% threshold
interface AttendancePercentageBadgeProps {
  percentage: number;
}

export function AttendancePercentageBadge({ percentage }: AttendancePercentageBadgeProps) {
  const getVariant = (): BadgeVariant => {
    if (percentage >= 75) return "success";
    if (percentage >= 60) return "warning";
    return "danger";
  };

  return (
    <Badge variant={getVariant()}>
      {percentage.toFixed(1)}%
    </Badge>
  );
}
