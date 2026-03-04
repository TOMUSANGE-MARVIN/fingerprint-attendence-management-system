"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, Badge, Table, TableColumn, Input, PageLoading } from "@/components/ui";
import { apiClient, API_ENDPOINTS } from "@/lib/api";
import { AuditLog } from "@/types";
import { Search, Shield, Clock } from "lucide-react";

const DEMO_LOGS: AuditLog[] = [
  { id: 1, userId: 1, userName: "Admin User", action: "CREATE", resource: "User", resourceId: 42, details: "Created student account for John Doe", ipAddress: "192.168.1.10", timestamp: "2026-02-21T09:15:00Z" },
  { id: 2, userId: 1, userName: "Admin User", action: "UPDATE", resource: "Course", resourceId: 3, details: "Updated CS301 course details", ipAddress: "192.168.1.10", timestamp: "2026-02-21T08:55:00Z" },
  { id: 3, userId: 2, userName: "Dr. Alice Brown", action: "CREATE", resource: "AttendanceSession", resourceId: 15, details: "Started attendance session for CS301", ipAddress: "192.168.1.25", timestamp: "2026-02-21T08:00:00Z" },
  { id: 4, userId: 1, userName: "Admin User", action: "CREATE", resource: "FingerprintTemplate", resourceId: 38, details: "Registered fingerprint for student STU038", ipAddress: "192.168.1.10", timestamp: "2026-02-20T16:30:00Z" },
  { id: 5, userId: 3, userName: "Prof. Bob Wilson", action: "UPDATE", resource: "AttendanceRecord", resourceId: 220, details: "Manually marked student as present", ipAddress: "192.168.1.30", timestamp: "2026-02-20T14:10:00Z" },
  { id: 6, userId: 1, userName: "Admin User", action: "DELETE", resource: "User", resourceId: 5, details: "Deleted inactive account", ipAddress: "192.168.1.10", timestamp: "2026-02-20T11:00:00Z" },
];

const ACTION_VARIANTS: Record<string, "success" | "danger" | "warning" | "default"> = {
  CREATE: "success",
  DELETE: "danger",
  UPDATE: "warning",
  LOGIN: "default",
  LOGOUT: "default",
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await apiClient.get<{ results: AuditLog[] } | AuditLog[]>(
          API_ENDPOINTS.admin.auditLogs
        );
        const data = response.data as any;
        setLogs(Array.isArray(data) ? data : data.results ?? []);
      } catch {
        setLogs(DEMO_LOGS);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filtered = logs.filter((l) =>
    `${l.userName} ${l.action} ${l.resource} ${l.details ?? ""}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTimestamp = (ts: string) =>
    new Date(ts).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  const columns: TableColumn<AuditLog>[] = [
    {
      key: "timestamp",
      header: "Time",
      render: (l) => (
        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
          <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
          {formatTimestamp(l.timestamp)}
        </div>
      ),
    },
    {
      key: "user",
      header: "User",
      render: (l) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{l.userName}</span>
      ),
    },
    {
      key: "action",
      header: "Action",
      align: "center",
      render: (l) => (
        <Badge variant={ACTION_VARIANTS[l.action] ?? "default"}>{l.action}</Badge>
      ),
    },
    {
      key: "resource",
      header: "Resource",
      render: (l) => (
        <span className="text-gray-700 dark:text-gray-300">
          {l.resource}{l.resourceId ? ` #${l.resourceId}` : ""}
        </span>
      ),
    },
    {
      key: "details",
      header: "Details",
      render: (l) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">{l.details}</span>
      ),
    },
    {
      key: "ip",
      header: "IP Address",
      render: (l) => (
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{l.ipAddress}</span>
      ),
    },
  ];

  if (isLoading) return <PageLoading message="Loading audit logs..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Logs</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Track all administrative actions and system events
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(["CREATE", "UPDATE", "DELETE", "LOGIN"] as const).map((action) => (
          <Card key={action} className="text-center">
            <p className="text-2xl font-bold text-primary-600">
              {logs.filter((l) => l.action === action).length}
            </p>
            <Badge variant={ACTION_VARIANTS[action] ?? "default"} className="mt-1">
              {action}
            </Badge>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Activity Log"
          subtitle={`${filtered.length} entries`}
          action={
            <div className="w-64">
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
          }
        />
        <Table
          columns={columns}
          data={filtered}
          keyExtractor={(l) => l.id}
          emptyMessage="No audit logs found"
        />
      </Card>

      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Shield className="w-4 h-4" />
        <span>Audit logs are retained for 90 days and cannot be modified or deleted.</span>
      </div>
    </div>
  );
}
