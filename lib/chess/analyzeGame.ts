import { evaluatePosition } from "./stockfishWorker";

export interface MoveAnalysis {
  moveId: string;
  evalCp: number | null;
  mateIn: number | null;
  bestMoveSan: string;
  classification: "best" | "good" | "inaccuracy" | "mistake" | "blunder";
}

function classify(swing: number): MoveAnalysis["classification"] {
  if (swing < 20) return "best";
  if (swing < 50) return "good";
  if (swing < 100) return "inaccuracy";
  if (swing < 200) return "mistake";
  return "blunder";
}

export async function analyzeGame(
  moves: { id: string; fen_after: string }[]
): Promise<MoveAnalysis[]> {
  const results: MoveAnalysis[] = [];
  let previousEval = 0;

  for (const move of moves) {
    const { evalCp, mateIn, bestMove } = await evaluatePosition(move.fen_after, 14);
    const currentEval = evalCp ?? (mateIn ? mateIn * 1000 : 0);
    const swing = Math.abs(currentEval - previousEval);

    results.push({
      moveId: move.id,
      evalCp,
      mateIn,
      bestMoveSan: bestMove,
      classification: classify(swing),
    });

    previousEval = currentEval;
  }

  return results;
}
