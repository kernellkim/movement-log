"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BodyComposition } from "@/lib/types";

export function BodyCompositionChart({ records }: { records: BodyComposition[] }) {
  const data = records.map((r) => ({
    measured_at: r.measured_at,
    체중: r.weight_kg,
    골격근량: r.skeletal_muscle_mass_kg,
    체지방량: r.body_fat_mass_kg,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="measured_at" fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip contentStyle={{ background: "#151516", border: "1px solid #2a2a2d", borderRadius: 6, color: "#f2f2f0" }} labelStyle={{ color: "#f2f2f0" }} />
          <Legend />
          <Line type="monotone" dataKey="체중" stroke="#f2f2f0" connectNulls />
          <Line type="monotone" dataKey="골격근량" stroke="#f26065" connectNulls />
          <Line type="monotone" dataKey="체지방량" stroke="#f5a524" connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
