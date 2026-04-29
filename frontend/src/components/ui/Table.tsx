/**
 * Reusable Table Component
 * Supports sorting, pagination, and custom cell rendering
 */

import React from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Table Column Definition
export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (item: T, index: number) => React.ReactNode;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyMessage = "No data available",
  onRowClick,
  className,
}: TableProps<T>) {
  const alignmentClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-100 rounded mb-2" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-50 rounded mb-2" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={cn(
                  "px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider",
                  alignmentClasses[column.align || "left"]
                )}
                style={{ width: column.width }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            (() => {
              const keyUsage = new Map<string, number>();
              return data.map((item, rowIndex) => {
                const extractedKey = keyExtractor(item);
                const baseKey =
                  extractedKey === undefined || extractedKey === null || String(extractedKey).trim() === ""
                    ? `row-${rowIndex}`
                    : String(extractedKey);

                const occurrence = keyUsage.get(baseKey) ?? 0;
                keyUsage.set(baseKey, occurrence + 1);
                const rowKey = occurrence === 0 ? baseKey : `${baseKey}-${rowIndex}`;

                return (
                  <tr
                    key={rowKey}
                    onClick={() => onRowClick?.(item)}
                    className={cn(
                      "bg-white dark:bg-gray-900 transition-colors",
                      onRowClick && "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={`${rowKey}-${String(column.key)}`}
                        className={cn(
                          "px-4 py-4 text-sm text-gray-900 dark:text-gray-100",
                          alignmentClasses[column.align || "left"]
                        )}
                      >
                        {column.render
                          ? column.render(item, rowIndex)
                          : String((item as Record<string, unknown>)[column.key as string] ?? "")}
                      </td>
                    ))}
                  </tr>
                );
              });
            })()
          )}
        </tbody>
      </table>
    </div>
  );
}

// Pagination Component
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: PaginationProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getVisiblePages = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    pages.push(1);

    if (currentPage > 3) {
      pages.push("...");
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      if (!pages.includes(i)) pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push("...");
    }

    if (!pages.includes(totalPages)) {
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Showing <span className="font-medium">{startItem}</span> to{" "}
        <span className="font-medium">{endItem}</span> of{" "}
        <span className="font-medium">{totalItems}</span> results
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-400"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {getVisiblePages().map((page, index) =>
          typeof page === "number" ? (
            <button
              key={index}
              onClick={() => onPageChange(page)}
              className={cn(
                "px-3 py-1 rounded-lg text-sm font-medium transition-colors",
                currentPage === page
                  ? "bg-primary-600 text-white"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
              )}
            >
              {page}
            </button>
          ) : (
            <span key={index} className="px-2 text-gray-400 dark:text-gray-600">
              {page}
            </span>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-400"
          aria-label="Next page"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
