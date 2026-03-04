"use client";

import React from "react";
import { Fingerprint } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { Sun, Moon } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex dark:bg-gray-950">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 dark:from-primary-800 dark:via-primary-900 dark:to-gray-950">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 border border-white/30 rounded-full" />
          <div className="absolute top-32 left-32 w-72 h-72 border border-white/20 rounded-full" />
          <div className="absolute top-44 left-44 w-72 h-72 border border-white/10 rounded-full" />
          <div className="absolute bottom-20 right-20 w-96 h-96 border border-white/20 rounded-full" />
        </div>

        <div className="relative z-10 flex flex-col justify-center items-center w-full px-12">
          <div className="w-24 h-24 bg-white/10 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-8 shadow-2xl">
            <Fingerprint className="w-14 h-14 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 text-center">
            BioAttend
          </h1>
          <p className="text-lg text-primary-200 text-center max-w-md leading-relaxed">
            Biometric Student Attendance Management System for modern educational institutions
          </p>
          <div className="mt-12 flex gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-white">99.9%</p>
              <p className="text-sm text-primary-300 mt-1">Accuracy</p>
            </div>
            <div className="w-px bg-white/20" />
            <div>
              <p className="text-3xl font-bold text-white">&lt;1s</p>
              <p className="text-sm text-primary-300 mt-1">Verification</p>
            </div>
            <div className="w-px bg-white/20" />
            <div>
              <p className="text-3xl font-bold text-white">24/7</p>
              <p className="text-sm text-primary-300 mt-1">Monitoring</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950">
        {/* Theme toggle */}
        <div className="flex justify-end p-4">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle theme"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="w-5 h-5 text-yellow-500" />
            ) : (
              <Moon className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {/* Mobile Logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg">
              <Fingerprint className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">BioAttend</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Attendance System</p>
            </div>
          </div>

          <div className="w-full max-w-md">
            {children}
          </div>
        </div>

        <footer className="py-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            &copy; 2026 BioAttend - Biometric Student Attendance System
          </p>
        </footer>
      </div>
    </div>
  );
}
