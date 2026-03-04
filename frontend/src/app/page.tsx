"use client";

/**
 * Home Page
 * Redirects authenticated users to their dashboard
 * Shows landing page or redirects to login for unauthenticated users
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { PageLoading } from "@/components/ui";
import { UserRole } from "@/types";

export default function HomePage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && user) {
        // Redirect to role-specific dashboard
        const roleRoutes: Record<UserRole, string> = {
          student: "/student",
          lecturer: "/lecturer",
          admin: "/admin",
        };
        router.push(roleRoutes[user.role]);
      } else {
        // Redirect to login
        router.push("/login");
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  // Show loading while checking auth state
  return (
    <div className="min-h-screen flex items-center justify-center">
      <PageLoading message="Loading..." />
    </div>
  );
}
