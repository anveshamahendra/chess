"use client";

import { cn } from "@/lib/utils";
import { CapturedPiece } from "@/lib/chess/captured";
import { PIECE_UNICODE } from "@/components/board/ChessBoard";

/**
 * Compact row of the pieces one player has lost, for sitting beside or just
 * below their name. Keeps each piece's original color, with a halo of the
 * opposite one so the icon still reads on both dark cards and the white
 * background an active clock uses.
 */
export function CapturedPieces({
  pieces,
  className,
}: {
  pieces: readonly CapturedPiece[];
  className?: string;
}) {
  if (pieces.length === 0) return null;

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-0.5 select-none", className)}
      aria-label="Captured pieces"
    >
      {pieces.map((piece, index) => (
        <span
          key={`${piece.color}${piece.type}-${index}`}
          aria-hidden
          className={cn(
            "text-base leading-none",
            piece.color === "w" ? "captured-piece-white" : "captured-piece-black"
          )}
        >
          {PIECE_UNICODE[`${piece.color}${piece.type}`]}
        </span>
      ))}
    </div>
  );
}
