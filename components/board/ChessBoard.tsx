"use client";

import { memo, useState, useMemo, useCallback } from "react";
import { Square } from "chess.js";
import { getLegalMoves, createGame } from "@/lib/chess/engine";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

const PIECE_UNICODE: Record<string, string> = {
  wp: "♙", wn: "♘", wb: "♗", wr: "♖", wq: "♕", wk: "♔",
  bp: "♟", bn: "♞", bb: "♝", br: "♜", bq: "♛", bk: "♚",
};

interface ChessBoardProps {
  fen: string;
  onMove: (from: Square, to: Square, promotion?: string) => void;
  orientation?: "white" | "black";
  lastMove?: { from: Square; to: Square } | null;
  interactive?: boolean;
}

export const ChessBoard = memo(function ChessBoard({
  fen,
  onMove,
  orientation = "white",
  lastMove,
  interactive = true,
}: ChessBoardProps) {
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const game = useMemo(() => createGame(fen), [fen]);

  const legalTargets = useMemo(() => {
    if (!selected) return [];
    return getLegalMoves(game, selected).map((m) => m.to);
  }, [selected, game]);

  const files = orientation === "white" ? FILES : [...FILES].reverse();
  const ranks = orientation === "white" ? RANKS : [...RANKS].reverse();

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (!interactive) return;

      if (selected) {
        if (legalTargets.includes(square)) {
          const selectedPiece = game.get(selected);
          const isPromotion =
            selectedPiece?.type === "p" &&
            ((selectedPiece.color === "w" && square[1] === "8") ||
              (selectedPiece.color === "b" && square[1] === "1"));
          if (isPromotion) {
            setPendingPromotion({ from: selected, to: square });
            setSelected(null);
            return;
          }
          onMove(selected, square);
          setSelected(null);
          return;
        }
        const piece = game.get(square);
        if (piece && piece.color === game.turn()) {
          setSelected(square);
          return;
        }
        setSelected(null);
        return;
      }

      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
        setSelected(square);
      }
    },
    [interactive, selected, legalTargets, game, onMove],
  );

  const inCheckSquare = useMemo(() => {
    if (!game.inCheck()) return null;
    const turn = game.turn();
    for (const rank of RANKS) {
      for (const file of FILES) {
        const sq = `${file}${rank}` as Square;
        const piece = game.get(sq);
        if (piece && piece.type === "k" && piece.color === turn) return sq;
      }
    }
    return null;
  }, [game]);

  return (
    <div className="relative w-full max-w-[560px]">
      <div className="grid grid-cols-8 aspect-square w-full rounded-2xl overflow-hidden shadow-xl">
        {ranks.map((rank) =>
          files.map((file) => {
            const square = `${file}${rank}` as Square;
            const piece = game.get(square);
            const isLight = (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 === 0;
            const isSelected = selected === square;
            const isLegalTarget = legalTargets.includes(square);
            const isLastMove =
              lastMove && (lastMove.from === square || lastMove.to === square);
            const isCheck = inCheckSquare === square;
            const isEdgeFile = file === files[0];
            const isEdgeRank = rank === ranks[ranks.length - 1];
            const coordColor = isLight ? "var(--board-dark)" : "var(--board-light)";

            return (
              <div
                key={square}
                onClick={() => handleSquareClick(square)}
                className="relative flex items-center justify-center cursor-pointer select-none"
                style={{
                  backgroundColor: isLight ? "var(--board-light)" : "var(--board-dark)",
                }}
              >
                {isLastMove && <div className="absolute inset-0 bg-yellow-300/30" />}
                {isSelected && <div className="absolute inset-0 bg-blue-400/40" />}
                {isCheck && <div className="check-pulse" />}
                {isLegalTarget && !piece && (
                  <div className="absolute h-3 w-3 rounded-full bg-black/20 dark:bg-white/40" />
                )}
                {isLegalTarget && piece && (
                  <div className="absolute inset-1 rounded-full border-4 border-black/20 dark:border-white/40" />
                )}
                {isEdgeFile && (
                  <span
                    className="absolute bottom-0.5 left-1 text-[10px] font-bold leading-none z-20 select-none"
                    style={{ color: coordColor }}
                  >
                    {rank}
                  </span>
                )}
                {isEdgeRank && (
                  <span
                    className="absolute bottom-0.5 right-1 text-[10px] font-bold leading-none z-20 select-none"
                    style={{ color: coordColor }}
                  >
                    {file}
                  </span>
                )}
                {piece && (
                  <span
                    className="text-4xl md:text-5xl relative z-10"
                    style={{
                      color: piece.color === "w" ? "var(--piece-white)" : "var(--piece-black)",
                      filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.25))",
                    }}
                  >
                    {PIECE_UNICODE[`${piece.color}${piece.type}`]}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {pendingPromotion && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 rounded-2xl">
          <div className="flex gap-2 bg-[#0a0a0a] rounded-2xl p-3">
            {(["q", "r", "b", "n"] as const).map((p) => (
              <button
                key={p}
                onClick={() => {
                  onMove(pendingPromotion.from, pendingPromotion.to, p);
                  setPendingPromotion(null);
                }}
                className="h-12 w-12 rounded-xl text-3xl flex items-center justify-center hover:brightness-95"
                style={{
                  backgroundColor: "var(--board-light)",
                  color: game.turn() === "w" ? "var(--piece-white)" : "var(--piece-black)",
                }}
              >
                {PIECE_UNICODE[`${game.turn()}${p}`]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
