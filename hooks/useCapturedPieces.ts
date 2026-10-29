"use client";

import { useMemo } from "react";
import { CapturedByColor, capturedFromSan } from "@/lib/chess/captured";

interface MoveLike {
  san: string;
}

/**
 * Captured pieces for the position after `plyCount` plies of `moves`, plus an
 * optional `pendingSan` for a move already applied locally but not yet
 * recorded. Memoized on the inputs, so clock ticks and hover re-renders don't
 * replay the game; slicing at `plyCount` is what keeps undo and history
 * browsing in sync with the board.
 */
export function useCapturedPieces(
  moves: readonly MoveLike[],
  plyCount: number,
  pendingSan?: string
): CapturedByColor {
  return useMemo(() => {
    const sans = moves.slice(0, plyCount).map((m) => m.san);
    if (pendingSan) sans.push(pendingSan);
    return capturedFromSan(sans);
  }, [moves, plyCount, pendingSan]);
}
