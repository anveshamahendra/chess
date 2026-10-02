import { Chess, Square, Move } from "chess.js";

export function createGame(fen?: string) {
  return fen && fen !== "start" ? new Chess(fen) : new Chess();
}

export function getLegalMoves(game: Chess, square: Square): Move[] {
  return game.moves({ square, verbose: true }) as Move[];
}

export function makeMove(
  game: Chess,
  from: Square,
  to: Square,
  promotion?: string
) {
  try {
    return game.move({ from, to, promotion });
  } catch {
    return null;
  }
}

export function getGameStatus(game: Chess) {
  if (game.isCheckmate()) return { over: true, result: game.turn() === "w" ? "0-1" : "1-0", reason: "checkmate" };
  if (game.isStalemate()) return { over: true, result: "1/2-1/2", reason: "stalemate" };
  if (game.isThreefoldRepetition()) return { over: true, result: "1/2-1/2", reason: "repetition" };
  if (game.isInsufficientMaterial()) return { over: true, result: "1/2-1/2", reason: "insufficient_material" };
  if (game.isDraw()) return { over: true, result: "1/2-1/2", reason: "fifty_move_rule" };
  return { over: false, result: null, reason: null };
}
