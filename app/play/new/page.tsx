"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/nav/NavBar";
import { PillButton } from "@/components/ui/PillButton";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const TIME_CONTROLS = [
  { label: "3 min", minutes: 3, increment: 0 },
  { label: "5 min", minutes: 5, increment: 0 },
  { label: "10 min", minutes: 10, increment: 0 },
  { label: "15 | 10", minutes: 15, increment: 10 },
];

export default function NewGamePage() {
  const { isAuthed, loading: authLoading } = useAuth();
  const [selectedTC, setSelectedTC] = useState(TIME_CONTROLS[2]);
  const [isRated, setIsRated] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isRated,
          timeControlMinutes: selectedTC.minutes,
          timeControlIncrement: selectedTC.increment,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not create game");
        setCreating(false);
        return;
      }
      router.push(`/play/${body.game.room_code}`);
    } catch {
      setError("Something went wrong. Try again.");
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f2f2f0]">
      <NavBar />
      <div className="flex justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-[26px] bg-[#0a0a0a] p-8">
          <h1 className="text-3xl font-bold lowercase text-white mb-1">new game</h1>
          <p className="text-[#a3a3a3] text-sm mb-8">Pick a time control, then share the link with a friend.</p>

          <p className="text-[#a3a3a3] text-sm mb-3">Time control</p>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {TIME_CONTROLS.map((tc) => (
              <button
                key={tc.label}
                onClick={() => setSelectedTC(tc)}
                className={cn(
                  "rounded-2xl py-3 text-sm font-medium transition-colors",
                  selectedTC.label === tc.label
                    ? "bg-white text-[#0a0a0a]"
                    : "bg-[#121212] text-[#a3a3a3] hover:bg-[#1a1a1a]"
                )}
              >
                {tc.label}
              </button>
            ))}
          </div>

          <label className="flex items-center justify-between mb-8 cursor-pointer">
            <span className="text-[#a3a3a3] text-sm">Rated game</span>
            <input
              type="checkbox"
              checked={isRated}
              onChange={(e) => setIsRated(e.target.checked)}
              className="h-5 w-5 accent-[#5b8def]"
            />
          </label>

          {error && <p className="text-[#ef4444] text-sm mb-4">{error}</p>}

          {!authLoading && !isAuthed ? (
            <p className="text-[#a3a3a3] text-sm">
              You need to sign in before starting a game.
            </p>
          ) : (
            <PillButton
              variant="primary"
              className="w-full"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? "Creating…" : "Create game"}
            </PillButton>
          )}
        </div>
      </div>
    </div>
  );
}
