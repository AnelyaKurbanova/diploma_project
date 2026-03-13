'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type BarChartDatum = {
  label: string;
  value: number;
};

type BarChartProps = {
  data: BarChartDatum[];
  maxValue?: number;
  barColor?: string;
};

export function BarChart({
  data,
  maxValue,
  barColor = "#3b82f6",
}: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <RechartsBarChart
        data={data}
        margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          angle={-30}
          textAnchor="end"
          height={60}
        />
        <YAxis
          domain={[0, maxValue ?? "auto"]}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            fontSize: 12,
          }}
        />
        <Bar dataKey="value" fill={barColor} radius={[6, 6, 0, 0]} maxBarSize={40} />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
