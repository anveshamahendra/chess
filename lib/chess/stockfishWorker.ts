// This file runs inside a Web Worker. Load the stockfish.js WASM build
// (e.g. from the 'stockfish' npm package or a CDN-hosted .wasm/.js pair) and
// communicate via postMessage with UCI commands.

let engine: Worker | null = null;

export function initEngine(): Worker {
  if (!engine) {
    engine = new Worker("/stockfish/stockfish.js");
    engine.postMessage("uci");
  }
  return engine;
}

export function evaluatePosition(
  fen: string,
  depth: number = 15
): Promise<{ evalCp: number | null; mateIn: number | null; bestMove: string }> {
  return new Promise((resolve) => {
    const eng = initEngine();
    let evalCp: number | null = null;
    let mateIn: number | null = null;

    function handleMessage(e: MessageEvent) {
      const line: string = e.data;

      if (line.startsWith("info") && line.includes("score")) {
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        if (cpMatch) evalCp = parseInt(cpMatch[1], 10);
        if (mateMatch) mateIn = parseInt(mateMatch[1], 10);
      }

      if (line.startsWith("bestmove")) {
        const bestMove = line.split(" ")[1];
        eng.removeEventListener("message", handleMessage);
        resolve({ evalCp, mateIn, bestMove });
      }
    }

    eng.addEventListener("message", handleMessage);
    eng.postMessage(`position fen ${fen}`);
    eng.postMessage(`go depth ${depth}`);
  });
}
