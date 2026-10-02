import { Square } from "chess.js";

export interface PuzzleMove {
  from: Square;
  to: Square;
  promotion?: string;
  san?: string;
}

export interface ChessPuzzle {
  id: string;
  title: string;
  rating: number;
  theme: string;
  fen: string; // The FEN at player's turn to move (or just before opponent setup move)
  playerColor: "white" | "black";
  moves: string[]; // UCI format e.g. ["d1h5", "g7g6", "h5e5"]
  description: string;
  hint?: string;
  explanation?: string;
}

export const BUILTIN_PUZZLES: ChessPuzzle[] = [
  // 1. Scholar's Mate Finish (Beginner Mate in 1)
  {
    id: "p-01",
    title: "Scholar's Punishment",
    rating: 650,
    theme: "Mate in 1",
    fen: "r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4",
    playerColor: "white",
    moves: ["f3f7"],
    description: "Black left the f7 square unguarded. Deliver the fatal blow!",
    hint: "Target the weak f7 pawn with your Queen.",
    explanation: "Queen takes f7 with checkmate, guarded by the bishop on c4."
  },
  // 2. Anastasia's Mate Pattern (Intermediate Mate in 2)
  {
    id: "p-02",
    title: "Anastasia's Corridor",
    rating: 1350,
    theme: "Mate in 2",
    fen: "5rk1/1p3ppp/8/3N4/8/8/5PPP/4R1K1 w - - 0 1",
    playerColor: "white",
    moves: ["d5e7", "g8h8", "e1e8"],
    description: "Use your Knight and Rook in harmony to mate the trapped King.",
    hint: "Force the Black King into the corner with a knight check first.",
    explanation: "Ne7+ forces Kh8, followed by Re8# exploiting the back rank."
  },
  // 3. Royal Knight Fork (Tactics / Fork)
  {
    id: "p-03",
    title: "The Royal Fork",
    rating: 1100,
    theme: "Knight Fork",
    fen: "r1bqk2r/pppp1ppp/2n2n2/4p3/1b2P3/2NP1N2/PPP2PPP/R1BQKB1R w KQkq - 1 5",
    playerColor: "white",
    moves: ["d3d4", "e5d4", "f3d4"],
    description: "Strike in the center and seize control.",
    hint: "Push in the center with d4.",
    explanation: "d4 opens up lines and recaptures with great piece activity."
  },
  // 4. Classic Greek Gift Sacrifice
  {
    id: "p-04",
    title: "The Greek Gift",
    rating: 1550,
    theme: "Sacrifice / Attack",
    fen: "r1bq1rk1/ppp2ppp/2n1pn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQK2R w KQ - 0 7",
    playerColor: "white",
    moves: ["d3h7", "g8h7", "f3g5"],
    description: "The classic bishop sacrifice against the castled king.",
    hint: "Sacrifice your bishop on h7 to shatter the Black king's shelter.",
    explanation: "Bxh7+ Kxh7 Ng5+ starts a decisive kingside attack."
  },
  // 5. Back Rank Clearance
  {
    id: "p-05",
    title: "Back Rank Destruction",
    rating: 900,
    theme: "Back Rank",
    fen: "3r2k1/5ppp/8/8/8/8/4QPPP/6K1 w - - 0 1",
    playerColor: "white",
    moves: ["e2e8", "d8e8"],
    description: "Black has no luft (escape square). Punish the back rank.",
    hint: "Offer your Queen on the back rank to deflect Black's rook.",
    explanation: "Qe8+ forces Rxe8 and leaves Black defenseless on the 8th rank."
  },
  // 6. Absolute Pin Exploit
  {
    id: "p-06",
    title: "Deadly Absolute Pin",
    rating: 1200,
    theme: "Pin",
    fen: "r1b1k2r/pppp1ppp/8/4q3/1bP5/2N1P3/PP3PPP/R1BQKB1R w KQkq - 0 9",
    playerColor: "white",
    moves: ["c1d2", "b4c3", "d2c3"],
    description: "Neutralize Black's pin and win key diagonal control.",
    hint: "Block the pin with your bishop on d2.",
    explanation: "Bd2 breaks the pin and prepares powerful tactical threats on g7."
  },
  // 7. Smothered Mate Pattern
  {
    id: "p-07",
    title: "Philidor's Legacy (Smothered Mate)",
    rating: 1600,
    theme: "Smothered Mate",
    fen: "6k1/5ppp/8/8/8/8/1Q4PP/5q1K w - - 0 1",
    playerColor: "white",
    moves: ["b2b8"],
    description: "Spot the immediate back-rank mate with Queen infiltration.",
    hint: "Deliver check on the 8th rank.",
    explanation: "Qb8# is instantaneous checkmate."
  },
  // 8. Queen Deflection
  {
    id: "p-08",
    title: "Deflection to Mate",
    rating: 1400,
    theme: "Deflection",
    fen: "r4rk1/ppp2ppp/2n5/3q4/3P4/2PB1Q2/P4PPP/R3R1K1 w - - 0 16",
    playerColor: "white",
    moves: ["d3h7", "g8h7", "f3d5"],
    description: "Black's queen is defended only while the king is on g8.",
    hint: "Draw the Black king away with a checking bishop sacrifice.",
    explanation: "Bxh7+ Kxh7 removes the defender of the Queen, allowing Qxd5 winning the Queen!"
  },
  // 9. Trapped Queen
  {
    id: "p-09",
    title: "Nowhere to Run",
    rating: 1250,
    theme: "Trapped Piece",
    fen: "r1b1kb1r/pp1n1ppp/2p1pn2/q5B1/2PP4/2N2N2/PP3PPP/R2QKB1R w KQkq - 2 8",
    playerColor: "white",
    moves: ["c1d2", "a5c7"],
    description: "Reposition your minor piece with tempo against Black's ambitious Queen.",
    hint: "Dislodge the Queen by moving your dark-square bishop.",
    explanation: "Bd2 attacks the Queen with tempo, developing smoothly."
  },
  // 10. Skewer on the Long Diagonal
  {
    id: "p-10",
    title: "Long Diagonal Skewer",
    rating: 1300,
    theme: "Skewer",
    fen: "r3k2r/pppb1ppp/8/3Bp3/8/8/PP3PPP/R1B1K2R w KQkq - 0 13",
    playerColor: "white",
    moves: ["d5b7", "a8b8", "b7d5"],
    description: "Snag material and compromise Black's queenside structure.",
    hint: "Capture the undefended pawn on b7.",
    explanation: "Bxb7 attacks the rook on a8, winning crucial material."
  },
  // 11. Discovered Check & Mate
  {
    id: "p-11",
    title: "Discovered Strike",
    rating: 1450,
    theme: "Discovered Attack",
    fen: "r1b2rk1/pp3ppp/2n5/1B1N4/8/8/PP3PPP/R4RK1 w - - 0 16",
    playerColor: "white",
    moves: ["b5c6", "b7c6", "d5e7"],
    description: "Liquidate the defender to secure a menacing outpost on e7.",
    hint: "Remove the c6 knight first.",
    explanation: "Bxc6 bxc6 Ne7+ establishes an ironclad knight on e7."
  },
  // 12. Double Rook Infiltration
  {
    id: "p-12",
    title: "Pigs on the Seventh",
    rating: 1500,
    theme: "7th Rank Rook",
    fen: "2r3k1/R4pp1/7p/8/8/P7/1r3PPP/4R1K1 w - - 0 24",
    playerColor: "white",
    moves: ["e1e7", "b2b1", "e7e1", "b1e1"],
    description: "Defend against back rank while creating threats.",
    hint: "Beware back rank weaknesses when placing rooks.",
    explanation: "Sharp tactical calculation is key in rook endgames."
  },
  // 13. Black to Move - Smothered Checkmate
  {
    id: "p-13",
    title: "Knight Execution",
    rating: 1150,
    theme: "Mate in 1",
    fen: "k7/8/K7/1N6/8/8/8/2q5 b - - 0 1",
    playerColor: "black",
    moves: ["c1c6"],
    description: "Black to move. Check the White king and force resignation.",
    hint: "Bring your queen to c6 to trap the king.",
    explanation: "Qc6+ confines White's king and seals the victory."
  },
  // 14. Black to Move - Back Rank Mate
  {
    id: "p-14",
    title: "Corridor of Doom",
    rating: 850,
    theme: "Mate in 1",
    fen: "4r1k1/5ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1",
    playerColor: "black",
    moves: ["e8e1"],
    description: "Black to move. Take advantage of White's exposed first rank.",
    hint: "Capture the rook on e1.",
    explanation: "Rxe1# delivers instant checkmate."
  },
  // 15. Black to Move - Forking Queen and Rook
  {
    id: "p-15",
    title: "Central Knight Fork",
    rating: 1200,
    theme: "Knight Fork",
    fen: "r1bqk2r/pppp1ppp/2n5/2b1p3/4P1n1/2NP1N2/PPP2PPP/R1BQKB1R b KQkq - 2 5",
    playerColor: "black",
    moves: ["c5f2", "e1e2", "f2b6"],
    description: "Black to move. Shatter White's castling rights with an invasive bishop strike.",
    hint: "Target f2 with Bxf2+.",
    explanation: "Bxf2+ strips White of castling rights and disrupts their development."
  }
];

// Helper to convert UCI string (e.g. "e2e4", "e7e8q") to structured move
export function uciToMove(uci: string): PuzzleMove {
  const from = uci.substring(0, 2) as Square;
  const to = uci.substring(2, 4) as Square;
  const promotion = uci.length > 4 ? uci.substring(4, 5) : undefined;
  return { from, to, promotion };
}

// Fetch daily puzzle from Lichess with fallback
export async function fetchDailyLichessPuzzle(): Promise<ChessPuzzle | null> {
  try {
    const res = await fetch("https://lichess.org/api/puzzle/daily", {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.game?.pgn || !data?.puzzle) return null;

    return {
      id: `lichess-${data.puzzle.id}`,
      title: `Daily Challenge #${data.puzzle.id}`,
      rating: data.puzzle.rating ?? 1500,
      theme: data.puzzle.themes?.[0] ? data.puzzle.themes[0].replace(/([A-Z])/g, ' $1').trim() : "Tactics",
      fen: data.puzzle.initialFen ?? data.game.treeParts?.fen,
      playerColor: data.puzzle.initialFen?.includes(" w ") ? "black" : "white",
      moves: data.puzzle.lines ?? data.puzzle.solution ?? [],
      description: `Tactical challenge (${data.puzzle.rating} rating) - find the best continuation.`,
      hint: "Look for forcing checks, captures, and threats.",
      explanation: `Themes: ${data.puzzle.themes?.slice(0, 3).join(", ") ?? "Tactics"}. Solved by thousands of players worldwide.`
    };
  } catch (err) {
    console.warn("Could not fetch daily Lichess puzzle:", err);
    return null;
  }
}
