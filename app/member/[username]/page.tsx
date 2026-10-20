"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { NavBar } from "@/components/nav/NavBar";
import { PillButton } from "@/components/ui/PillButton";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";

interface MemberProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
  rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
}

type Status = "loading" | "found" | "missing" | "signin";

export default function MemberPage() {
  const { username } = useParams<{ username: string }>();
  const { isAuthed, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [status, setStatus] = useState<Status>("loading");
  const [profile, setProfile] = useState<MemberProfile | null>(null);

  useEffect(() => {
    if (authLoading) return;
    // RLS only lets signed-in users read profiles — same as the leaderboard.
    if (!isAuthed) {
      setStatus("signin");
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select(
        "id, username, display_name, avatar_url, avatar_color, rating, games_played, wins, losses, draws"
      )
      // eq, not ilike: usernames are stored lowercase by the format
      // constraint, and ilike would treat "_" as a wildcard.
      .eq("username", username.toLowerCase())
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          setProfile(data as MemberProfile);
          setStatus("found");
        } else {
          setStatus("missing");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [username, isAuthed, authLoading, supabase]);

  return (
    <div className="min-h-screen bg-page">
      <NavBar />
      <div className="flex justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-[26px] bg-card p-8">
          {status === "loading" && (
            <div className="flex flex-col items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-white/10 animate-pulse" />
              <div className="h-4 w-32 rounded bg-white/10 animate-pulse" />
            </div>
          )}

          {status === "signin" && (
            <div className="text-center">
              <p className="text-[#a3a3a3] text-sm mb-4">
                Sign in to view player profiles.
              </p>
              <Link href="/sign-in">
                <PillButton variant="primary">Sign in</PillButton>
              </Link>
            </div>
          )}

          {status === "missing" && (
            <div className="text-center">
              <h1 className="text-2xl font-bold lowercase text-white mb-2">
                player not found
              </h1>
              <p className="text-[#a3a3a3] text-sm mb-6">
                No player is registered as @{username.toLowerCase()}.
              </p>
              <Link href="/leaderboard">
                <PillButton variant="secondary">Back to leaderboard</PillButton>
              </Link>
            </div>
          )}

          {status === "found" && profile && (
            <div className="flex flex-col items-center text-center">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-20 w-20 rounded-full object-cover bg-white/10 mb-4"
                />
              ) : (
                <div
                  className="h-20 w-20 rounded-full flex items-center justify-center text-3xl font-bold text-white mb-4"
                  style={{ backgroundColor: profile.avatar_color || "#5B8DEF" }}
                >
                  {(profile.display_name ?? profile.username)[0]?.toUpperCase()}
                </div>
              )}
              <h1 className="text-2xl font-bold text-white">
                {profile.display_name ?? profile.username}
              </h1>
              <p className="text-[#a3a3a3] text-sm mb-6">@{profile.username}</p>

              <div className="w-full grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-2xl bg-card-alt p-4">
                  <p className="text-white text-2xl font-bold">{profile.rating}</p>
                  <p className="text-[#a3a3a3] text-xs">rating</p>
                </div>
                <div className="rounded-2xl bg-card-alt p-4">
                  <p className="text-white text-2xl font-bold">{profile.games_played}</p>
                  <p className="text-[#a3a3a3] text-xs">games played</p>
                </div>
              </div>
              <div className="w-full grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-card-alt p-4">
                  <p className="text-white text-lg font-bold">{profile.wins}</p>
                  <p className="text-[#a3a3a3] text-xs">wins</p>
                </div>
                <div className="rounded-2xl bg-card-alt p-4">
                  <p className="text-white text-lg font-bold">{profile.losses}</p>
                  <p className="text-[#a3a3a3] text-xs">losses</p>
                </div>
                <div className="rounded-2xl bg-card-alt p-4">
                  <p className="text-white text-lg font-bold">{profile.draws}</p>
                  <p className="text-[#a3a3a3] text-xs">draws</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
