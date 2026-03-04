"use client";

/**
 * Attendance Bar Chart Component
 * Displays attendance by course or category
 */

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

interface CourseAttendanceData {
  courseCode: string;
  courseName: string;
  percentage: number;
}

interface AttendanceBarChartProps {
  data: CourseAttendanceData[];
  height?: number;
  showThreshold?: boolean;
}

export function AttendanceBarChart({
  data,
  height = 300,
  showThreshold = true,
}: AttendanceBarChartProps) {
  // Get color based on percentage threshold
  const getBarColor = (percentage: number): string => {
    if (percentage >= 75) return "#22c55e"; // success
    if (percentage >= 60) return "#f59e0b"; // warning
    return "#ef4444"; // danger
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: {
    active?: boolean;
    payload?: Array<{ payload: CourseAttendanceData }>;
  }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
          <p className="font-medium text-gray-900">{item.courseName}</p>
          <p className="text-sm text-gray-600">
            Attendance: <span className="font-semibold">{item.percentage.toFixed(1)}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        layout="vertical"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: "#6b7280" }}
          axisLine={{ stroke: "#e5e7eb" }}
          tickLine={false}
          tickFormatter={(value) => `${value}%`}
        />
        <YAxis
          type="category"
          dataKey="courseCode"
          tick={{ fontSize: 12, fill: "#6b7280" }}
          axisLine={{ stroke: "#e5e7eb" }}
          tickLine={false}
          width={80}
        />
        <Tooltip content={<CustomTooltip />} />
        
        {/* 75% threshold line */}
        {showThreshold && (
          <ReferenceLine
            x={75}
            stroke="#f59e0b"
            strokeDasharray="5 5"
          />
        )}
        
        <Bar dataKey="percentage" radius={[0, 4, 4, 0]} barSize={24}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.percentage)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
