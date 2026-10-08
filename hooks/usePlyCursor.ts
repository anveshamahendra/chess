"use client";

import { useCallback, useEffect, useState } from "react";

// Ply cursor for browsing move history while a game is live.
// `pinned` is null while following the latest position, so the view tracks
// incoming moves automatically until the user steps back.
export function usePlyCursor(plyCount: number) {
  const [pinned, setPinned] = useState<number | null>(null);

  // If history shrinks (undo, new game), drop the pin when the pinned ply
  // no longer exists or has become the latest position.
  useEffect(() => {
    setPinned((p) => (p !== null && p >= plyCount ? null : p));
  }, [plyCount]);

  const cursor = pinned === null ? plyCount : Math.min(pinned, plyCount);
  const atLatest = cursor >= plyCount;

  // Pinning to the latest ply resumes following live moves.
  const goTo = useCallback(
    (ply: number) => {
      const next = Math.max(0, Math.min(ply, plyCount));
      setPinned(next >= plyCount ? null : next);
    },
    [plyCount]
  );

  const step = useCallback((delta: number) => goTo(cursor + delta), [goTo, cursor]);
  const goLive = useCallback(() => setPinned(null), []);

  useEffect(() => {
    if (plyCount === 0) return;
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goLive();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step, goTo, goLive]);

  return { cursor, atLatest, goTo, step, goLive };
}
