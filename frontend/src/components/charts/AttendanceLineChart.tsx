"use client";

/**
 * Attendance Line Chart Component
 * Displays attendance trends over time (weekly/monthly)
 * Uses Recharts for visualization
 */

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { AttendanceTrend } from "@/types";

interface AttendanceChartProps {
  data: AttendanceTrend[];
  showThreshold?: boolean;
  height?: number;
}

export function AttendanceLineChart({
  data,
  showThreshold = true,
  height = 300,
}: AttendanceChartProps) {
  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ value: number; payload: AttendanceTrend }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
          <p className="font-medium text-gray-900">{label}</p>
          <p className="text-sm text-gray-600">
            Attendance: <span className="font-semibold">{item.percentage.toFixed(1)}%</span>
          </p>
          <p className="text-xs text-gray-500">
            {item.sessionsAttended} of {item.totalSessions} sessions
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 12, fill: "#6b7280" }}
          axisLine={{ stroke: "#e5e7eb" }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: "#6b7280" }}
          axisLine={{ stroke: "#e5e7eb" }}
          tickLine={false}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        
        {/* 75% threshold reference line */}
        {showThreshold && (
          <ReferenceLine
            y={75}
            stroke="#f59e0b"
            strokeDasharray="5 5"
            label={{
              value: "75% Target",
              position: "insideTopRight",
              fill: "#f59e0b",
              fontSize: 11,
            }}
          />
        )}
        
        <Line
          type="monotone"
          dataKey="percentage"
          stroke="#2563eb"
          strokeWidth={2}
          dot={{ fill: "#2563eb", strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, fill: "#2563eb" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
