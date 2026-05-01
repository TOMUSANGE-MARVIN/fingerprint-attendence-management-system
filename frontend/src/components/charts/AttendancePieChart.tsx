"use client";

/**
 * Attendance Pie/Donut Chart Component
 * Shows attendance distribution (present, absent, excused)
 */

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

interface AttendanceDistribution {
  name: string;
  value: number;
  color: string;
}

interface AttendancePieChartProps {
  present: number;
  absent: number;
  excused: number;
  height?: number;
}

export function AttendancePieChart({
  present,
  absent,
  excused,
  height = 300,
}: AttendancePieChartProps) {
  const data: AttendanceDistribution[] = [
    { name: "Present", value: present, color: "#22c55e" },
    { name: "Absent", value: absent, color: "#ef4444" },
    { name: "Excused", value: excused, color: "#3b82f6" },
  ].filter((item) => item.value > 0);

  const total = present + absent + excused;

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; payload: AttendanceDistribution }>;
  }) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const percentage = ((item.value / total) * 100).toFixed(1);
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
          <p className="font-medium text-gray-900">{item.name}</p>
          <p className="text-sm text-gray-600">
            {item.value} sessions ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom legend
  const CustomLegend = ({ payload }: {
    payload?: Array<{ value: string; color: string }>;
  }) => {
    if (!payload) return null;
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-gray-600">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLegend />} />
        {/* Center text */}
        <text
          x="50%"
          y="45%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-gray-900 text-2xl font-bold"
        >
          {total}
        </text>
        <text
          x="50%"
          y="52%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-gray-500 text-xs"
        >
          Total Sessions
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}
