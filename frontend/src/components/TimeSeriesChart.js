import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function TimeSeriesChart({ data }) {
  if (!data || data.length === 0) return null;

  // Format data for Recharts
  const chartData = data.map((point) => ({
    date: point.date,
    RVI: point.rvi_mean != null ? Number(point.rvi_mean.toFixed(3)) : null,
    "VV (dB)": point.vv_mean != null ? Number(point.vv_mean.toFixed(1)) : null,
    "VH (dB)": point.vh_mean != null ? Number(point.vh_mean.toFixed(1)) : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={(val) => {
            const d = new Date(val);
            return `${d.getMonth() + 1}/${d.getDate()}`;
          }}
        />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{ fontSize: 12 }}
          labelStyle={{ fontWeight: "bold" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="RVI"
          stroke="#2d9b6e"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="VV (dB)"
          stroke="#5b8ff9"
          strokeWidth={1.5}
          dot={{ r: 2 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="VH (dB)"
          stroke="#ff7a45"
          strokeWidth={1.5}
          dot={{ r: 2 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
