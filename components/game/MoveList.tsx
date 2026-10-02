"use client";

import { useEffect, useRef } from "react";
import { MoveRow } from "@/hooks/useGameRealtime";

export function MoveList({ moves }: { moves: MoveRow[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [moves.length]);

  const pairs: { number: number; white?: string; black?: string }[] = [];
  moves.forEach((m, i) => {
    const pairIndex = Math.floor(i / 2);
    if (!pairs[pairIndex]) pairs[pairIndex] = { number: pairIndex + 1 };
    if (m.player_color === "white") pairs[pairIndex].white = m.san;
    else pairs[pairIndex].black = m.san;
  });

  return (
    <div className="rounded-2xl bg-[#0a0a0a] p-4 h-64 overflow-y-auto">
      <p className="text-[#a3a3a3] text-sm mb-3">Moves</p>
      {pairs.length === 0 && (
        <p className="text-[#a3a3a3]/60 text-sm">No moves yet</p>
      )}
      <div className="space-y-1">
        {pairs.map((p) => (
          <div key={p.number} className="grid grid-cols-[2rem_1fr_1fr] gap-2 text-[15px]">
            <span className="text-[#a3a3a3]">{p.number}.</span>
            <span className="text-white">{p.white ?? ""}</span>
            <span className="text-white">{p.black ?? ""}</span>
          </div>
        ))}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
