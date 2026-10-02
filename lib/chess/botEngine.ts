import { Chess, Square, Move } from "chess.js";

export type BotDifficulty = "easy" | "medium" | "hard" | "master";

// Piece values in centipawns
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-Square Tables (White perspective, rank 8 to rank 1)
const PAWN_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 25, 25, 10, 5, 5],
  [0, 0, 0, 20, 20, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -20, -20, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const KNIGHT_PST = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
];

const BISHOP_PST = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 5, 0, 0, 0, 0, 5, -10],
  [-10, 10, 10, 10, 10, 10, 10, -10],
  [-10, 0, 10, 10, 10, 10, 0, -10],
  [-10, 5, 5, 10, 10, 5, 5, -10],
  [-10, 0, 5, 10, 10, 5, 0, -10],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20],
];

const ROOK_PST = [
  [0, 0, 0, 5, 5, 0, 0, 0],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [5, 10, 10, 10, 10, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const QUEEN_PST = [
  [-20, -10, -10, -5, -5, -10, -10, -20],
  [-10, 0, 5, 0, 0, 0, 0, -10],
  [-10, 5, 5, 5, 5, 5, 0, -10],
  [0, 0, 5, 5, 5, 5, 0, -5],
  [-5, 0, 5, 5, 5, 5, 0, -5],
  [-10, 0, 5, 5, 5, 5, 0, -10],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-20, -10, -10, -5, -5, -10, -10, -20],
];

const KING_PST_MID = [
  [20, 30, 10, 0, 0, 10, 30, 20],
  [20, 20, 0, 0, 0, 0, 20, 20],
  [-10, -20, -20, -20, -20, -20, -20, -10],
  [-20, -30, -30, -40, -40, -30, -30, -20],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
];

function getPSTValue(piece: string, r: number, c: number, isWhite: boolean): number {
  const row = isWhite ? r : 7 - r;
  const col = isWhite ? c : 7 - c;

  switch (piece) {
    case "p":
      return PAWN_PST[row][col];
    case "n":
      return KNIGHT_PST[row][col];
    case "b":
      return BISHOP_PST[row][col];
    case "r":
      return ROOK_PST[row][col];
    case "q":
      return QUEEN_PST[row][col];
    case "k":
      return KING_PST_MID[row][col];
    default:
      return 0;
  }
}

export function evaluateBoard(game: Chess): number {
  let score = 0;
  const board = game.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const isWhite = piece.color === "w";
      const value = PIECE_VALUES[piece.type] + getPSTValue(piece.type, r, c, isWhite);
      score += isWhite ? value : -value;
    }
  }

  // Factor in check status
  if (game.inCheck()) {
    score += game.turn() === "w" ? -50 : 50;
  }

  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    if (a.captured) {
      scoreA += (PIECE_VALUES[a.captured] || 100) * 10 - (PIECE_VALUES[a.piece] || 100);
    }
    if (a.promotion) scoreA += 800;

    if (b.captured) {
      scoreB += (PIECE_VALUES[b.captured] || 100) * 10 - (PIECE_VALUES[b.piece] || 100);
    }
    if (b.promotion) scoreB += 800;

    return scoreB - scoreA;
  });
}

function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean
): { score: number; bestMove?: Move } {
  if (depth === 0 || game.isGameOver()) {
    if (game.isCheckmate()) {
      return { score: isMaximizing ? -100000 : 100000 };
    }
    if (game.isDraw() || game.isStalemate()) {
      return { score: 0 };
    }
    return { score: evaluateBoard(game) };
  }

  const moves = orderMoves(game.moves({ verbose: true }) as Move[]);
  if (moves.length === 0) {
    return { score: evaluateBoard(game) };
  }

  let bestMove: Move = moves[0];

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      game.move(move);
      const evaluation = minimax(game, depth - 1, alpha, beta, false).score;
      game.undo();

      if (evaluation > maxEval) {
        maxEval = evaluation;
        bestMove = move;
      }
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return { score: maxEval, bestMove };
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      game.move(move);
      const evaluation = minimax(game, depth - 1, alpha, beta, true).score;
      game.undo();

      if (evaluation < minEval) {
        minEval = evaluation;
        bestMove = move;
      }
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    return { score: minEval, bestMove };
  }
}

export async function getBotMove(
  fen: string,
  difficulty: BotDifficulty
): Promise<{ from: Square; to: Square; promotion?: string } | null> {
  const game = fen && fen !== "start" ? new Chess(fen) : new Chess();
  if (game.isGameOver()) return null;

  const legalMoves = game.moves({ verbose: true }) as Move[];
  if (legalMoves.length === 0) return null;

  const isWhite = game.turn() === "w";

  // Easy bot: 75% random, 25% greedy capture/simple evaluation
  if (difficulty === "easy") {
    if (Math.random() < 0.7) {
      const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      return {
        from: randomMove.from as Square,
        to: randomMove.to as Square,
        promotion: randomMove.promotion,
      };
    }
    // Simple 1-ply search
    const result = minimax(game, 1, -Infinity, Infinity, isWhite);
    if (result.bestMove) {
      return {
        from: result.bestMove.from as Square,
        to: result.bestMove.to as Square,
        promotion: result.bestMove.promotion,
      };
    }
  }

  // Medium bot: Depth 2 minimax with PST
  if (difficulty === "medium") {
    // 15% chance to pick a random capture/move to keep it human-like
    if (Math.random() < 0.15) {
      const captures = legalMoves.filter((m) => m.captured);
      const pool = captures.length > 0 ? captures : legalMoves;
      const m = pool[Math.floor(Math.random() * pool.length)];
      return { from: m.from as Square, to: m.to as Square, promotion: m.promotion };
    }
    const result = minimax(game, 2, -Infinity, Infinity, isWhite);
    if (result.bestMove) {
      return {
        from: result.bestMove.from as Square,
        to: result.bestMove.to as Square,
        promotion: result.bestMove.promotion,
      };
    }
  }

  // Hard bot: Depth 3 minimax with alpha-beta + PST + move ordering
  if (difficulty === "hard") {
    const result = minimax(game, 3, -Infinity, Infinity, isWhite);
    if (result.bestMove) {
      return {
        from: result.bestMove.from as Square,
        to: result.bestMove.to as Square,
        promotion: result.bestMove.promotion,
      };
    }
  }

  // Master bot: Depth 4 minimax
  const result = minimax(game, 4, -Infinity, Infinity, isWhite);
  if (result.bestMove) {
    return {
      from: result.bestMove.from as Square,
      to: result.bestMove.to as Square,
      promotion: result.bestMove.promotion,
    };
  }

  // Fallback
  const m = legalMoves[0];
  return { from: m.from as Square, to: m.to as Square, promotion: m.promotion };
}
