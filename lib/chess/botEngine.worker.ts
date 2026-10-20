// Web Worker entry for the built-in minimax bot. Receives { id, fen,
// difficulty }, replies { id, move } or { id, error }. Running the search here
// keeps hard/master depths off the main thread so the UI stays responsive.

import { getBotMove, BotDifficulty } from "./botEngine";

export type BotWorkerRequest = {
  id: number;
  fen: string;
  difficulty: BotDifficulty;
};

export type BotWorkerResponse =
  | { id: number; move: { from: string; to: string; promotion?: string } | null }
  | { id: number; error: string };

const ctx = self as unknown as Worker;

ctx.onmessage = async (e: MessageEvent<BotWorkerRequest>) => {
  const { id, fen, difficulty } = e.data;
  try {
    const move = await getBotMove(fen, difficulty);
    ctx.postMessage({ id, move } satisfies BotWorkerResponse);
  } catch (err) {
    ctx.postMessage({
      id,
      error: err instanceof Error ? err.message : "Bot search failed",
    } satisfies BotWorkerResponse);
  }
};
