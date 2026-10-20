"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/nav/NavBar";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentGamesList, RecentGame } from "@/components/dashboard/RecentGamesList";
import { useAuth } from "@/hooks/useAuth";
import { useMyAccount } from "@/hooks/useMyAccount";
import { createClient } from "@/lib/supabase/client";

// recharts is heavy — keep it out of the initial dashboard chunk.
const RatingChart = dynamic(
  () => import("@/components/dashboard/RatingChart").then((m) => m.RatingChart),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl bg-card p-5 h-64">
        <div className="h-4 w-32 rounded bg-black/5 dark:bg-white/10 animate-pulse mb-4" />
        <div className="h-40 rounded-xl bg-black/5 dark:bg-white/10 animate-pulse" />
      </div>
    ),
  },
);

export default function DashboardPage() {
  const { isAuthed, loading: authLoading } = useAuth();
  const { account, loading: accountLoading } = useMyAccount();
  const router = useRouter();
  const supabase = createClient();

  const [ratingHistory, setRatingHistory] = useState<{ date: string; rating: number }[]>([]);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);

  useEffect(() => {
    if (!authLoading && !isAuthed) router.push("/sign-in");
  }, [authLoading, isAuthed, router]);

  // Google users who haven't picked a username yet belong in onboarding.
  useEffect(() => {
    if (!accountLoading && account && !account.username_confirmed) {
      router.replace(`/onboarding/username?next=${encodeURIComponent("/dashboard")}`);
    }
  }, [accountLoading, account, router]);

  useEffect(() => {
    if (!account) return;

    supabase
      .from("rating_history")
      .select("rating_after, created_at")
      .eq("player_id", account.id)
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
      .select("id, white_player_id, black_player_id, result, ended_at, white:profiles!games_white_player_id_fkey(display_name, username), black:profiles!games_black_player_id_fkey(display_name, username)")
      .or(`white_player_id.eq.${account.id},black_player_id.eq.${account.id}`)
      .eq("status", "completed")
      .order("ended_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        const games: RecentGame[] = (data ?? []).map((g: any) => {
          const isWhite = g.white_player_id === account.id;
          const opponent = isWhite ? g.black : g.white;
          const opponentName =
            opponent?.display_name ?? opponent?.username ?? "opponent";
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
  }, [account, supabase]);

  const loading = authLoading || accountLoading || !account;

  return (
    <div className="min-h-screen bg-page">
      <NavBar />
      <div className="px-4 md:px-8 py-10">
        <div className="flex items-start justify-between gap-4 mb-1">
          <h1 className="text-3xl font-bold text-[#0a0a0a] dark:text-[#f5f5f5]">
            {loading ? "\u00a0" : account!.display_name ?? account!.username}
          </h1>
          <Link
            href="/settings/profile"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-white transition-colors underline mt-2"
          >
            settings
          </Link>
        </div>
        {loading ? (
          <div className="h-6 mb-8" />
        ) : (
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            <Link href={`/member/${account!.username}`} className="hover:text-white transition-colors">
              @{account!.username}
            </Link>{" "}
            · your rating, your stats, your games.
          </p>
        )}

        {loading ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-black/5 dark:bg-white/10 animate-pulse" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-64 rounded-2xl bg-black/5 dark:bg-white/10 animate-pulse" />
              <div className="h-64 rounded-2xl bg-black/5 dark:bg-white/10 animate-pulse" />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <StatCard label="Rating" value={account!.rating} />
              <StatCard label="Games played" value={account!.games_played} />
              <StatCard label="Wins" value={account!.wins} />
              <StatCard label="Losses / draws" value={`${account!.losses} / ${account!.draws}`} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RatingChart data={ratingHistory} />
              <RecentGamesList games={recentGames} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
