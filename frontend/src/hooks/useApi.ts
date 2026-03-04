"use client";

/**
 * Custom hook for API calls with loading and error states
 * Provides consistent data fetching patterns across the application
 */

import { useState, useCallback } from "react";
import { apiClient, parseApiError } from "@/lib/api";
import { ApiError } from "@/types";

interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: ApiError | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (...args: unknown[]) => Promise<T | null>;
  reset: () => void;
  setData: (data: T | null) => void;
}

/**
 * Generic hook for API calls
 * Handles loading states, errors, and data management
 */
export function useApi<T>(
  apiFunction: (...args: unknown[]) => Promise<{ data: T }>
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await apiFunction(...args);
        setState({ data: response.data, isLoading: false, error: null });
        return response.data;
      } catch (err) {
        const apiError = parseApiError(err);
        setState((prev) => ({ ...prev, isLoading: false, error: apiError }));
        return null;
      }
    },
    [apiFunction]
  );

  const reset = useCallback(() => {
    setState({ data: null, isLoading: false, error: null });
  }, []);

  const setData = useCallback((data: T | null) => {
    setState((prev) => ({ ...prev, data }));
  }, []);

  return {
    ...state,
    execute,
    reset,
    setData,
  };
}

/**
 * Hook for GET requests with automatic execution
 */
export function useFetch<T>(url: string, immediate = true) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    isLoading: immediate,
    error: null,
  });

  const fetch = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await apiClient.get<T>(url);
      setState({ data: response.data, isLoading: false, error: null });
      return response.data;
    } catch (err) {
      const apiError = parseApiError(err);
      setState((prev) => ({ ...prev, isLoading: false, error: apiError }));
      return null;
    }
  }, [url]);

  // Auto-fetch on mount if immediate is true
  useState(() => {
    if (immediate) {
      fetch();
    }
  });

  const refetch = useCallback(() => fetch(), [fetch]);

  return {
    ...state,
    refetch,
  };
}

/**
 * Hook for POST requests
 */
export function usePost<T, D = unknown>(url: string) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const post = useCallback(
    async (data: D): Promise<T | null> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await apiClient.post<T>(url, data);
        setState({ data: response.data, isLoading: false, error: null });
        return response.data;
      } catch (err) {
        const apiError = parseApiError(err);
        setState((prev) => ({ ...prev, isLoading: false, error: apiError }));
        return null;
      }
    },
    [url]
  );

  const reset = useCallback(() => {
    setState({ data: null, isLoading: false, error: null });
  }, []);

  return {
    ...state,
    post,
    reset,
  };
}

/**
 * Hook for mutation operations (POST, PUT, DELETE)
 */
export function useMutation<T, D = unknown>() {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const mutate = useCallback(
    async (
      method: "post" | "put" | "patch" | "delete",
      url: string,
      data?: D
    ): Promise<T | null> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await apiClient[method]<T>(url, data);
        setState({ data: response.data, isLoading: false, error: null });
        return response.data;
      } catch (err) {
        const apiError = parseApiError(err);
        setState((prev) => ({ ...prev, isLoading: false, error: apiError }));
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ data: null, isLoading: false, error: null });
  }, []);

  return {
    ...state,
    mutate,
    reset,
  };
}
