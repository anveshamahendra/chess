"use client";

import { cn } from "@/lib/utils";
import { useClock } from "@/hooks/useClock";

export function ClockDisplay({
  remainingMs,
  isRunning,
  label,
  active,
}: {
  remainingMs: number;
  isRunning: boolean;
  label: string;
  active: boolean;
}) {
  const { formatted, isLow } = useClock(remainingMs, isRunning);

  return (
    <div
      className={cn(
        "rounded-2xl px-4 py-3 flex items-center justify-between transition-colors",
        active ? "bg-white text-[#0a0a0a]" : "bg-card-alt text-[#a3a3a3]"
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      <span className={cn("text-xl font-bold tabular-nums", isLow && active && "text-[#ef4444]")}>
        {formatted}
      </span>
    </div>
  );
}
