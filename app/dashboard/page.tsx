"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/nav/NavBar";
import { StatCard } from "@/components/dashboard/StatCard";
import { RatingChart } from "@/components/dashboard/RatingChart";
import { RecentGamesList, RecentGame } from "@/components/dashboard/RecentGamesList";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  username: string;
  rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
}

export default function DashboardPage() {
  const { user, isAuthed, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [ratingHistory, setRatingHistory] = useState<{ date: string; rating: number }[]>([]);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);

  useEffect(() => {
    if (!authLoading && !isAuthed) router.push("/sign-in");
  }, [authLoading, isAuthed, router]);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("profiles")
      .select("username, rating, games_played, wins, losses, draws")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data as Profile));

    supabase
      .from("rating_history")
      .select("rating_after, created_at")
      .eq("player_id", user.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setRatingHistory(
          (data ?? []).map((r: any) => ({
            date: new Date(r.created_at).toLocaleDateString(),
            rating: r.rating_after,
          }))
        );
      });

    supabase
      .from("games")
      .select("id, white_player_id, black_player_id, result, ended_at, white:profiles!games_white_player_id_fkey(username), black:profiles!games_black_player_id_fkey(username)")
      .or(`white_player_id.eq.${user.id},black_player_id.eq.${user.id}`)
      .eq("status", "completed")
      .order("ended_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        const games: RecentGame[] = (data ?? []).map((g: any) => {
          const isWhite = g.white_player_id === user.id;
          const opponentName = isWhite ? g.black?.username ?? "opponent" : g.white?.username ?? "opponent";
          let result: RecentGame["result"] = "draw";
          if (g.result === "1-0") result = isWhite ? "win" : "loss";
          if (g.result === "0-1") result = isWhite ? "loss" : "win";
          return {
            id: g.id,
            opponentName,
            result,
            ratingDelta: 0,
            playedAt: g.ended_at ? new Date(g.ended_at).toLocaleDateString() : "",
          };
        });
        setRecentGames(games);
      });
  }, [user, supabase]);

  if (authLoading || !profile) {
    return (
      <div className="min-h-screen bg-[#f2f2f0]">
        <NavBar />
        <div className="px-4 py-10 text-center text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f2f0]">
      <NavBar />
      <div className="px-4 md:px-8 py-10">
        <h1 className="text-3xl font-bold lowercase text-[#0a0a0a] mb-1">{profile.username}</h1>
        <p className="text-gray-500 mb-8">Your rating, your stats, your games.</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <StatCard label="Rating" value={profile.rating} />
          <StatCard label="Games played" value={profile.games_played} />
          <StatCard label="Wins" value={profile.wins} />
          <StatCard label="Losses / draws" value={`${profile.losses} / ${profile.draws}`} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RatingChart data={ratingHistory} />
          <RecentGamesList games={recentGames} />
        </div>
      </div>
    </div>
  );
}
