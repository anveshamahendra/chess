"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MoveHistoryNavProps {
  cursor: number;
  count: number;
  onGoTo: (ply: number) => void;
  onStep: (delta: number) => void;
}

export function MoveHistoryNav({ cursor, count, onGoTo, onStep }: MoveHistoryNavProps) {
  const viewingHistory = cursor < count;
  const atStart = cursor <= 0;
  const atEnd = cursor >= count;

  const btnClass =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card-alt text-[#a3a3a3] transition-colors hover:bg-[#1a1a1a] hover:text-white dark:hover:bg-[#242424] disabled:opacity-40 disabled:hover:bg-card-alt disabled:hover:text-[#a3a3a3]";

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onGoTo(0)}
        disabled={atStart}
        className={btnClass}
        title="First move (Home)"
        aria-label="First move"
      >
        <ChevronsLeft className="h-4 w-4" />
      </button>
      <button
        onClick={() => onStep(-1)}
        disabled={atStart}
        className={btnClass}
        title="Previous move (←)"
        aria-label="Previous move"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <span
        className={cn(
          "flex-1 text-center text-xs",
          viewingHistory ? "text-[#f5a524]" : "text-[#a3a3a3]"
        )}
      >
        {count === 0
          ? "No moves"
          : viewingHistory
            ? `viewing ${cursor}/${count}`
            : "live"}
      </span>

      <button
        onClick={() => onStep(1)}
        disabled={atEnd}
        className={btnClass}
        title="Next move (→)"
        aria-label="Next move"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <button
        onClick={() => onGoTo(count)}
        disabled={atEnd}
        className={btnClass}
        title="Latest move (End)"
        aria-label="Latest move"
      >
        <ChevronsRight className="h-4 w-4" />
      </button>
    </div>
  );
}
