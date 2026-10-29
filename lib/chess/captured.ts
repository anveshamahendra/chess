import { Chess, Color, PieceSymbol } from "chess.js";

/** A piece taken off the board, keeping the color it belonged to. */
export interface CapturedPiece {
  color: Color;
  type: PieceSymbol;
}

/** Pieces each side has lost: `w` holds White's losses, `b` Black's. */
export interface CapturedByColor {
  w: CapturedPiece[];
  b: CapturedPiece[];
}

// Display order: cheapest first, so pawns group on the left (Chess.com style).
const PIECE_RANK: Record<PieceSymbol, number> = { p: 0, n: 1, b: 2, r: 3, q: 4, k: 5 };

const NOTHING_CAPTURED: CapturedByColor = { w: [], b: [] };

/**
 * Replays `sans` from `startFen` and collects every capture, so the answer
 * comes from chess.js itself — en passant, promotion-captures and castling
 * all resolve through the rules engine instead of a second copy of them.
 * Replaying a prefix of the move list is what makes undo and history
 * browsing drop pieces back off the display.
 */
export function capturedFromSan(sans: readonly string[], startFen?: string): CapturedByColor {
  if (sans.length === 0) return NOTHING_CAPTURED;

  let game: Chess;
  try {
    game = startFen && startFen !== "start" ? new Chess(startFen) : new Chess();
  } catch {
    return NOTHING_CAPTURED;
  }

  const captured: CapturedByColor = { w: [], b: [] };

  for (const san of sans) {
    try {
      const move = game.move(san);
      if (!move.captured) continue;
      // The piece that died belongs to the side that did not just move.
      const victim: Color = move.color === "w" ? "b" : "w";
      captured[victim].push({ color: victim, type: move.captured });
    } catch {
      // A SAN the engine won't accept: show what we could verify rather
      // than guessing at the rest.
      break;
    }
  }

  captured.w.sort((a, b) => PIECE_RANK[a.type] - PIECE_RANK[b.type]);
  captured.b.sort((a, b) => PIECE_RANK[a.type] - PIECE_RANK[b.type]);
  return captured;
}
