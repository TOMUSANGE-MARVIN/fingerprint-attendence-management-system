"use client";

/**
 * Authentication Context
 * Provides global authentication state and methods
 * Handles login, logout, and session persistence
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User, AuthTokens, LoginCredentials, AuthResponse, UserRole } from "@/types";
import { apiClient, API_ENDPOINTS, setTokens, clearTokens, getTokens, parseApiError } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Check for existing session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const tokens = getTokens();
      if (tokens) {
        try {
          // Validate token by fetching user data
          const response = await apiClient.get<User>(API_ENDPOINTS.auth.me);
          setUser(response.data);
        } catch {
          // Token invalid or expired - clear and redirect
          clearTokens();
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<AuthResponse>(
        API_ENDPOINTS.auth.login,
        credentials
      );

      const { user: userData, tokens } = response.data;
      
      // Store tokens and user data
      setTokens(tokens);
      setUser(userData);

      // Redirect based on user role
      const roleRoutes: Record<UserRole, string> = {
        student: "/student",
        lecturer: "/lecturer",
        admin: "/admin",
      };

      router.push(roleRoutes[userData.role] || "/");
    } catch (err) {
      const apiError = parseApiError(err);
      setError(apiError.message);
      throw new Error(apiError.message);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const logout = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Notify backend of logout (optional - for audit logging)
      await apiClient.post(API_ENDPOINTS.auth.logout);
    } catch {
      // Continue with logout even if backend call fails
      console.warn("Backend logout notification failed");
    } finally {
      clearTokens();
      setUser(null);
      setIsLoading(false);
      router.push("/login");
    }
  }, [router]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    login,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access authentication context
 * Throws error if used outside AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Hook to check if user has specific role(s)
 */
export function useHasRole(allowedRoles: UserRole | UserRole[]): boolean {
  const { user } = useAuth();
  if (!user) return false;
  
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return roles.includes(user.role);
}
