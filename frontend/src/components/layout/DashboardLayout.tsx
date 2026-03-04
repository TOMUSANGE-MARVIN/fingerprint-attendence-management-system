"use client";

import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="lg:ml-64 flex flex-col min-h-screen">
        <Header
          onMenuClick={() => setIsSidebarOpen(true)}
          title={title}
        />

        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>

        <footer className="py-4 px-6 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            &copy; 2026 BioAttend - Biometric Student Attendance System
          </p>
        </footer>
      </div>
    </div>
  );
}
