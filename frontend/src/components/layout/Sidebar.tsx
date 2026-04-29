"use client";

/**
 * Sidebar Navigation Component
 * Responsive sidebar with role-based navigation items
 */

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { UserRole } from "@/types";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import {
  LayoutDashboard,
  Users,
  Users2,
  BookOpen,
  Calendar,
  BarChart3,
  Settings,
  FileText,
  ClipboardList,
  GraduationCap,
  UserCog,
  Shield,
  Clock,
  X,
  Fingerprint,
  Building2,
  CalendarDays,
  ClipboardCheck,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
  coordinatorOnly?: boolean;
}

// Navigation items configuration
const navigationItems: NavItem[] = [
  // Student Navigation
  {
    label: "Dashboard",
    href: "/student",
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ["student"],
  },
  {
    label: "My Courses",
    href: "/student/courses",
    icon: <BookOpen className="w-5 h-5" />,
    roles: ["student"],
  },
  {
    label: "Attendance History",
    href: "/student/attendance",
    icon: <ClipboardList className="w-5 h-5" />,
    roles: ["student"],
  },
  {
    label: "Timetable",
    href: "/student/timetable",
    icon: <Calendar className="w-5 h-5" />,
    roles: ["student"],
  },
  // Coordinator-only items (shown only when the student is a coordinator)
  {
    label: "My Class",
    href: "/student/coordinator/class",
    icon: <Users2 className="w-5 h-5" />,
    roles: ["student"],
    coordinatorOnly: true,
  },
  {
    label: "Attendance",
    href: "/student/coordinator/attendance",
    icon: <ClipboardCheck className="w-5 h-5" />,
    roles: ["student"],
    coordinatorOnly: true,
  },

  // Lecturer Navigation
  {
    label: "Dashboard",
    href: "/lecturer",
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ["lecturer"],
  },
  {
    label: "My Courses",
    href: "/lecturer/courses",
    icon: <BookOpen className="w-5 h-5" />,
    roles: ["lecturer"],
  },
  {
    label: "Attendance",
    href: "/lecturer/attendance",
    icon: <ClipboardList className="w-5 h-5" />,
    roles: ["lecturer"],
  },
  {
    label: "Reports",
    href: "/lecturer/reports",
    icon: <FileText className="w-5 h-5" />,
    roles: ["lecturer"],
  },
  {
    label: "Timetable",
    href: "/lecturer/timetable",
    icon: <Calendar className="w-5 h-5" />,
    roles: ["lecturer"],
  },

  // Admin Navigation
  {
    label: "Dashboard",
    href: "/admin",
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ["admin"],
  },
  {
    label: "Students",
    href: "/admin/students",
    icon: <GraduationCap className="w-5 h-5" />,
    roles: ["admin"],
  },
  {
    label: "Lecturers",
    href: "/admin/lecturers",
    icon: <UserCog className="w-5 h-5" />,
    roles: ["admin"],
  },
  {
    label: "Courses",
    href: "/admin/courses",
    icon: <BookOpen className="w-5 h-5" />,
    roles: ["admin"],
  },
  {
    label: "Departments",
    href: "/admin/faculties",
    icon: <Building2 className="w-5 h-5" />,
    roles: ["admin"],
  },
  {
    label: "Academic Periods",
    href: "/admin/academic-periods",
    icon: <CalendarDays className="w-5 h-5" />,
    roles: ["admin"],
  },
  {
    label: "Academic Years",
    href: "/admin/academic-years",
    icon: <CalendarDays className="w-5 h-5" />,
    roles: ["admin"],
  },
  {
    label: "Programmes",
    href: "/admin/programmes",
    icon: <GraduationCap className="w-5 h-5" />,
    roles: ["admin"],
  },
  {
    label: "Cohorts",
    href: "/admin/cohorts",
    icon: <Users className="w-5 h-5" />,
    roles: ["admin"],
  },
  {
    label: "Timetables",
    href: "/admin/timetables",
    icon: <Clock className="w-5 h-5" />,
    roles: ["admin"],
  },
  {
    label: "Attendance",
    href: "/admin/attendance",
    icon: <ClipboardList className="w-5 h-5" />,
    roles: ["admin"],
  },
  {
    label: "Analytics",
    href: "/admin/analytics",
    icon: <BarChart3 className="w-5 h-5" />,
    roles: ["admin"],
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: <Settings className="w-5 h-5" />,
    roles: ["admin"],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [isCoordinator, setIsCoordinator] = useState(false);

  useEffect(() => {
    if (user?.role === "student") {
      apiClient
        .get<{ isCoordinator: boolean }>(API_ENDPOINTS.courses.myCoordinated)
        .then((res) => {
          setIsCoordinator(!!res.data.isCoordinator);
        })
        .catch(() => {
          setIsCoordinator(false);
        });
    }
  }, [user]);

  // Filter navigation items based on user role and coordinator status
  const filteredNavItems = navigationItems.filter((item) => {
    if (!user || !item.roles.includes(user.role)) return false;
    if (item.coordinatorOnly && !isCoordinator) return false;
    return true;
  });

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800",
          "transform transition-transform duration-200 ease-in-out flex flex-col",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo and Brand */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Fingerprint className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">BioAttend</span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
                )}
              >
                <span
                  className={cn(
                    isActive ? "text-primary-600 dark:text-primary-400" : "text-gray-400 dark:text-gray-500"
                  )}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Role Badge */}
        {user && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
            <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                  {user.role}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Portal Access</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
