"use client";

import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from "recharts";

export function RatingChart({ data }: { data: { date: string; rating: number }[] }) {
  return (
    <div className="rounded-2xl bg-card p-5 h-64">
      <p className="text-[#a3a3a3] text-sm mb-4">Rating over time</p>
      {data.length === 0 ? (
        <p className="text-[#a3a3a3]/60 text-sm">Play a rated game to see your rating history.</p>
      ) : (
        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={data}>
            <YAxis domain={["dataMin - 50", "dataMax + 50"]} hide />
            <Tooltip
              contentStyle={{ background: "#1a1a1a", border: "none", borderRadius: 12 }}
              labelStyle={{ color: "#a3a3a3" }}
            />
            <Line type="monotone" dataKey="rating" stroke="#8B5CF6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
