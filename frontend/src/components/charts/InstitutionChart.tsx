"use client";

/**
 * Institution-wide Analytics Chart
 * Area chart for department-wise attendance comparison
 */

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface DepartmentData {
  name: string;
  attendance: number;
  studentCount: number;
}

interface InstitutionChartProps {
  data: DepartmentData[];
  height?: number;
}

export function InstitutionChart({ data, height = 300 }: InstitutionChartProps) {
  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ value: number; payload: DepartmentData }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
          <p className="font-medium text-gray-900">{label}</p>
          <p className="text-sm text-gray-600">
            Attendance: <span className="font-semibold">{item.attendance.toFixed(1)}%</span>
          </p>
          <p className="text-xs text-gray-500">
            {item.studentCount} students
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          axisLine={{ stroke: "#e5e7eb" }}
          tickLine={false}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: "#6b7280" }}
          axisLine={{ stroke: "#e5e7eb" }}
          tickLine={false}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip content={<CustomTooltip />} />
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
        <Area
          type="monotone"
          dataKey="attendance"
          stroke="#3b82f6"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorAttendance)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
