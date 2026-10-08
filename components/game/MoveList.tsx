"use client";

import { useEffect, useRef } from "react";
import { MoveRow } from "@/hooks/useGameRealtime";
import { cn } from "@/lib/utils";

interface MoveListProps {
  moves: MoveRow[];
  cursor?: number;
  onSelect?: (ply: number) => void;
}

function MoveCell({
  san,
  ply,
  active,
  onSelect,
}: {
  san: string | undefined;
  ply: number;
  active: boolean;
  onSelect?: (ply: number) => void;
}) {
  if (!san) return <span />;
  if (!onSelect) {
    return <span className={cn("text-white", active && "rounded-lg bg-white/10")}>{san}</span>;
  }
  return (
    <button
      onClick={() => onSelect(ply)}
      className={cn(
        "rounded-lg px-1 text-left text-white transition-colors",
        active ? "bg-white/10" : "hover:bg-white/5"
      )}
    >
      {san}
    </button>
  );
}

export function MoveList({ moves, cursor, onSelect }: MoveListProps) {
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
    <div className="rounded-2xl bg-card p-4 h-64 overflow-y-auto">
      <p className="text-[#a3a3a3] text-sm mb-3">Moves</p>
      {pairs.length === 0 && (
        <p className="text-[#a3a3a3]/60 text-sm">No moves yet</p>
      )}
      <div className="space-y-1">
        {pairs.map((p) => (
          <div key={p.number} className="grid grid-cols-[2rem_1fr_1fr] gap-2 text-[15px]">
            <span className="text-[#a3a3a3]">{p.number}.</span>
            <MoveCell
              san={p.white}
              ply={(p.number - 1) * 2 + 1}
              active={cursor === (p.number - 1) * 2 + 1}
              onSelect={onSelect}
            />
            <MoveCell
              san={p.black}
              ply={(p.number - 1) * 2 + 2}
              active={cursor === (p.number - 1) * 2 + 2}
              onSelect={onSelect}
            />
          </div>
        ))}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
