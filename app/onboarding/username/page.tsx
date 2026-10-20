"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/nav/NavBar";
import { Input } from "@/components/ui/Input";
import { PillButton } from "@/components/ui/PillButton";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import {
  USERNAME_RE,
  useUsernameAvailability,
  usernameStatusText,
} from "@/hooks/useUsernameAvailability";

// Same guard as /auth/callback: only same-site paths.
function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")) {
    return next;
  }
  return "/dashboard";
}

export default function OnboardingUsernamePage() {
  const { isAuthed, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [username, setUsername] = useState("");
  const [suggested, setSuggested] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const next = safeNext(
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("next")
      : null
  );

  // Signed-out visitors belong at the sign-in screen.
  useEffect(() => {
    if (!authLoading && !isAuthed) router.replace("/sign-in");
  }, [authLoading, isAuthed, router]);

  // Already confirmed (or landed here by accident): nothing to pick.
  useEffect(() => {
    if (!isAuthed || loaded) return;
    supabase
      .rpc("get_my_account")
      .then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.username_confirmed) {
          router.replace(next);
          return;
        }
        if (row?.username) {
          setSuggested(row.username);
          setUsername(row.username);
        }
        setLoaded(true);
      });
  }, [isAuthed, loaded, supabase, router, next]);

  const status = useUsernameAvailability(username, suggested ?? undefined);
  const statusNote = usernameStatusText(status);
  const canContinue = status === "available" && !saving;

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const clean = username.trim().toLowerCase();
    if (!USERNAME_RE.test(clean)) {
      setError("Usernames are 3–20 characters: lowercase letters, numbers, underscores.");
      return;
    }
    if (status !== "available") {
      setError("That username isn't available.");
      return;
    }
    setSaving(true);
    const { error: rpcError } = await supabase.rpc("change_username", {
      p_new_username: clean,
    });
    if (rpcError) {
      setSaving(false);
      setError(rpcError.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-page">
      <NavBar />
      <div className="flex justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-[26px] bg-card p-8">
          <h1 className="text-3xl font-bold lowercase text-white mb-1">pick a username</h1>
          <p className="text-[#a3a3a3] text-sm mb-6">
            This is how other players will find you. You can change it later, once
            every 30 days.
          </p>

          {authLoading || !loaded ? (
            <p className="text-[#a3a3a3] text-sm">Loading…</p>
          ) : (
            <form onSubmit={handleContinue} className="flex flex-col gap-3">
              <div>
                <Input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={20}
                  autoComplete="username"
                  autoFocus
                />
                {statusNote && (
                  <p
                    className={
                      "mt-1.5 text-xs " +
                      (statusNote.tone === "good"
                        ? "text-[#22c55e]"
                        : statusNote.tone === "bad"
                          ? "text-[#ef4444]"
                          : "text-[#a3a3a3]")
                    }
                  >
                    {statusNote.text}
                  </p>
                )}
              </div>
              {error && <p className="text-[#ef4444] text-sm">{error}</p>}
              <PillButton type="submit" variant="primary" className="mt-2" disabled={!canContinue}>
                {saving ? "Saving…" : "Continue"}
              </PillButton>
              {suggested && suggested !== username.trim().toLowerCase() && (
                <button
                  type="button"
                  onClick={() => setUsername(suggested)}
                  className="text-[#a3a3a3] text-sm underline hover:text-white transition-colors"
                >
                  Keep “{suggested}” instead
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
