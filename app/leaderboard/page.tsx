"use client";

import { useEffect, useState } from "react";
import { NavBar } from "@/components/nav/NavBar";
import { createClient } from "@/lib/supabase/client";

interface Row {
  id: string;
  username: string;
  rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
}

const MEDAL: Record<number, string> = { 0: "#F2C94C", 1: "#C0C0C0", 2: "#CD7F32" };

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, username, rating, games_played, wins, losses, draws")
      .order("rating", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setRows((data as Row[]) ?? []);
        setLoading(false);
      });
  }, [supabase]);

  return (
    <div className="min-h-screen bg-page">
      <NavBar />
      <div className="px-4 md:px-8 py-10">
        <h1 className="text-3xl font-bold lowercase text-[#0a0a0a] dark:text-[#f5f5f5] mb-1">leaderboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">See who's on top.</p>

        <div className="rounded-[26px] bg-card overflow-hidden">
          {loading && <p className="text-[#a3a3a3] p-6 text-sm">Loading…</p>}
          {!loading && rows.length === 0 && (
            <p className="text-[#a3a3a3] p-6 text-sm">No rated players yet.</p>
          )}
          {rows.map((row, i) => (
            <div
              key={row.id}
              className="flex items-center justify-between px-6 py-4 border-b border-white/5 last:border-0"
            >
              <div className="flex items-center gap-4">
                <span
                  className="w-6 text-sm font-bold"
                  style={{ color: MEDAL[i] ?? "#a3a3a3" }}
                >
                  {i + 1}
                </span>
                <span className="text-white text-[15px]">{row.username}</span>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <span className="text-[#a3a3a3]">
                  {row.wins}W {row.losses}L {row.draws}D
                </span>
                <span className="text-white font-bold w-12 text-right">{row.rating}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
