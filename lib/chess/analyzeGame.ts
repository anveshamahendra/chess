import { evaluatePosition } from "./stockfishWorker";

export interface MoveAnalysis {
  moveId: string;
  evalCp: number | null;
  mateIn: number | null;
  bestMoveSan: string;
  classification: "best" | "good" | "inaccuracy" | "mistake" | "blunder";
}

export interface AnalyzeOptions {
  onProgress?: (done: number, total: number) => void;
  onUpdate?: (results: MoveAnalysis[]) => void;
  signal?: AbortSignal;
}

function classify(swing: number): MoveAnalysis["classification"] {
  if (swing < 20) return "best";
  if (swing < 50) return "good";
  if (swing < 100) return "inaccuracy";
  if (swing < 200) return "mistake";
  return "blunder";
}

export async function analyzeGame(
  moves: { id: string; fen_after: string }[],
  options: AnalyzeOptions = {}
): Promise<MoveAnalysis[]> {
  const { onProgress, onUpdate, signal } = options;
  const results: MoveAnalysis[] = [];
  let previousEval = 0; // centipawns, white-positive

  for (let i = 0; i < moves.length; i++) {
    if (signal?.aborted) {
      const err = new Error("Analysis cancelled");
      err.name = "AbortError";
      throw err;
    }

    const move = moves[i];
    const { evalCp, mateIn, bestMove } = await evaluatePosition(move.fen_after, 14, signal);

    // UCI scores are from the side to move's perspective; flip to white's
    // perspective so consecutive positions are comparable and the eval bar
    // points at the right player.
    const sign = move.fen_after.split(" ")[1] === "b" ? -1 : 1;
    const whiteCp = evalCp === null ? null : evalCp * sign;
    const whiteMate = mateIn === null ? null : mateIn * sign;

    const currentEval =
      whiteCp ?? (whiteMate ? whiteMate * 1000 : previousEval);
    const swing = Math.abs(currentEval - previousEval);

    results.push({
      moveId: move.id,
      evalCp: whiteCp,
      mateIn: whiteMate,
      bestMoveSan: bestMove,
      classification: classify(swing),
    });

    previousEval = currentEval;
    onProgress?.(i + 1, moves.length);
    onUpdate?.(results.slice());
  }

  return results;
}
