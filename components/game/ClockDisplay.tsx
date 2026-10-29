"use client";

import { cn } from "@/lib/utils";
import { useClock } from "@/hooks/useClock";
import { CapturedPiece } from "@/lib/chess/captured";
import { CapturedPieces } from "@/components/game/CapturedPieces";

export function ClockDisplay({
  remainingMs,
  isRunning,
  label,
  active,
  captured,
}: {
  remainingMs: number;
  isRunning: boolean;
  label: string;
  active: boolean;
  captured?: readonly CapturedPiece[];
}) {
  const { formatted, isLow } = useClock(remainingMs, isRunning);

  return (
    <div
      className={cn(
        "rounded-2xl px-4 py-3 flex items-center justify-between transition-colors",
        active ? "bg-white text-[#0a0a0a]" : "bg-card-alt text-[#a3a3a3]"
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium truncate">{label}</span>
        <CapturedPieces pieces={captured ?? []} />
      </div>
      <span className={cn("text-xl font-bold tabular-nums", isLow && active && "text-[#ef4444]")}>
        {formatted}
      </span>
    </div>
  );
}
