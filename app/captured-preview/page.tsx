"use client";

import { CapturedPieces } from "@/components/game/CapturedPieces";
import { ClockDisplay } from "@/components/game/ClockDisplay";
import { CapturedPiece } from "@/lib/chess/captured";

const white: CapturedPiece[] = [
  { color: "w", type: "p" },
  { color: "w", type: "p" },
  { color: "w", type: "n" },
  { color: "w", type: "b" },
  { color: "w", type: "r" },
  { color: "w", type: "q" },
];

const black: CapturedPiece[] = [
  { color: "b", type: "p" },
  { color: "b", type: "p" },
  { color: "b", type: "p" },
  { color: "b", type: "n" },
  { color: "b", type: "q" },
];

export default function CapturedPreviewPage() {
  return (
    <div className="min-h-screen bg-page p-8 flex flex-col gap-6 max-w-3xl">
      <ClockDisplay label="Opponent" remainingMs={300000} isRunning={false} active={false} captured={black} />
      <ClockDisplay label="You" remainingMs={300000} isRunning active captured={white} />
      <ClockDisplay label="No captures yet" remainingMs={300000} isRunning={false} active={false} captured={[]} />

      <div className="w-full max-w-[560px] flex items-center justify-between bg-card rounded-2xl px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">Bot (Intermediate)</span>
          <span className="text-xs font-mono font-bold text-amber-400">1400</span>
        </div>
        <div className="flex items-center gap-3">
          <CapturedPieces pieces={black} />
          <div className="flex items-center gap-2 bg-[#1a1a1a] px-3 py-1 rounded-full text-xs text-[#f5a524]">
            <span>Thinking…</span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[560px] flex items-center justify-between bg-card rounded-2xl px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">You</span>
          <span className="text-xs text-[#a3a3a3]">(white)</span>
        </div>
        <div className="flex items-center gap-3">
          <CapturedPieces pieces={white} />
          <span className="text-xs bg-[#22c55e]/20 text-[#22c55e] px-2.5 py-0.5 rounded-full font-medium">
            Your turn
          </span>
        </div>
      </div>

      <div className="rounded-2xl bg-card overflow-hidden max-w-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <span className="text-sm font-medium text-white truncate">Grandmaster Magnus</span>
          <CapturedPieces pieces={black} />
        </div>
        <div className="h-px bg-white/5" />
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <span className="text-sm font-medium text-white truncate">You</span>
          <CapturedPieces pieces={white} />
        </div>
      </div>
    </div>
  );
}
