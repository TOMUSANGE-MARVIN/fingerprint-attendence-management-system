"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button, Input, Card } from "@/components/ui";
import { Mail, Lock, AlertCircle, Fingerprint } from "lucide-react";
import { isValidEmail } from "@/lib/utils";

export default function LoginPage() {
  const { login, isLoading, error, clearError, isAuthenticated, user } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [formErrors, setFormErrors] = useState({ email: "", password: "" });

  useEffect(() => {
    if (isAuthenticated && user) {
      const routes = { student: "/student", lecturer: "/lecturer", admin: "/admin" };
      router.push(routes[user.role]);
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    if (error) clearError();
  }, [formData]); // eslint-disable-line react-hooks/exhaustive-deps

  const validateForm = (): boolean => {
    const errors = { email: "", password: "" };
    let isValid = true;
    if (!formData.email) { errors.email = "Email is required"; isValid = false; }
    else if (!isValidEmail(formData.email)) { errors.email = "Please enter a valid email"; isValid = false; }
    if (!formData.password) { errors.password = "Password is required"; isValid = false; }
    else if (formData.password.length < 6) { errors.password = "Password must be at least 6 characters"; isValid = false; }
    setFormErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try { await login({ email: formData.email, password: formData.password }); }
    catch { /* handled by AuthContext */ }
  };

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: "" }));
  };

  return (
    <Card className="animate-fade-in dark:bg-gray-900 dark:border-gray-800">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/50 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Fingerprint className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Sign in to access your dashboard</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-danger-50 dark:bg-red-950/30 border border-danger-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-danger-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email Address"
          type="email"
          placeholder="Enter your email"
          value={formData.email}
          onChange={handleInputChange("email")}
          error={formErrors.email}
          leftIcon={<Mail className="w-5 h-5" />}
          autoComplete="email"
          disabled={isLoading}
        />

        <Input
          label="Password"
          type="password"
          placeholder="Enter your password"
          value={formData.password}
          onChange={handleInputChange("password")}
          error={formErrors.password}
          leftIcon={<Lock className="w-5 h-5" />}
          autoComplete="current-password"
          disabled={isLoading}
        />

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 dark:bg-gray-800"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">Remember me</span>
          </label>
          <button
            type="button"
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium"
          >
            Forgot password?
          </button>
        </div>

        <Button type="submit" fullWidth size="lg" isLoading={isLoading}>
          Sign in
        </Button>
      </form>

      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          <strong>Demo:</strong> Use your registered credentials to login.
          <br />
          Contact administrator for account creation.
        </p>
      </div>
    </Card>
  );
}
