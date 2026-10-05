// Loads the Stockfish WASM build in public/stockfish/ as a Web Worker and
// talks UCI to it. Every failure path rejects so callers never hang: a missing
// worker script fires an async `error` event (it does NOT throw), which is why
// the promise must listen for it.

const WORKER_URL = "/stockfish/stockfish.js";
const BOOT_TIMEOUT_MS = 15_000;
const SEARCH_TIMEOUT_MS = 60_000;

interface EngineState {
  worker: Worker;
  ready: Promise<void>;
}

let engineState: EngineState | null = null;

function createEngine(): EngineState {
  const worker = new Worker(WORKER_URL);

  const ready = new Promise<void>((resolve, reject) => {
    let settled = false;

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      clearTimeout(timer);
      if (err) reject(err);
      else resolve();
    };

    const onMessage = (e: MessageEvent) => {
      if (typeof e.data !== "string") return;
      if (e.data.startsWith("uciok")) worker.postMessage("isready");
      else if (e.data.startsWith("readyok")) finish();
    };

    const onError = (e: ErrorEvent) =>
      finish(new Error(e.message || `Failed to load ${WORKER_URL}`));

    const timer = setTimeout(
      () => finish(new Error("Stockfish engine timed out while starting")),
      BOOT_TIMEOUT_MS
    );

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.postMessage("uci");
  });

  // Drop the broken worker so the next attempt starts from scratch.
  ready.catch(() => {
    worker.terminate();
    if (engineState?.worker === worker) engineState = null;
  });

  return { worker, ready };
}

function getEngine(): EngineState {
  if (!engineState) engineState = createEngine();
  return engineState;
}

function resetEngine() {
  engineState?.worker.terminate();
  engineState = null;
}

function abortError(): Error {
  const err = new Error("Analysis cancelled");
  err.name = "AbortError";
  return err;
}

export function evaluatePosition(
  fen: string,
  depth: number = 15,
  signal?: AbortSignal
): Promise<{ evalCp: number | null; mateIn: number | null; bestMove: string }> {
  return (async () => {
    if (signal?.aborted) throw abortError();

    const state = getEngine();
    await state.ready; // rejects (and resets the worker) if the engine failed to boot

    return new Promise((resolve, reject) => {
      const worker = state.worker;
      let settled = false;
      let cancelled = false;
      let evalCp: number | null = null;
      let mateIn: number | null = null;

      const cleanup = () => {
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      };

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        resetEngine();
        reject(err);
      };

      const onAbort = () => {
        cancelled = true;
        worker.postMessage("stop"); // let the search finish so no stale bestmove leaks into the next call
      };

      const onMessage = (e: MessageEvent) => {
        if (settled || typeof e.data !== "string") return;
        const line = e.data;

        if (line.startsWith("info") && line.includes("score")) {
          const cpMatch = line.match(/score cp (-?\d+)/);
          const mateMatch = line.match(/score mate (-?\d+)/);
          if (cpMatch) evalCp = parseInt(cpMatch[1], 10);
          if (mateMatch) mateIn = parseInt(mateMatch[1], 10);
        }

        if (line.startsWith("bestmove")) {
          settled = true;
          cleanup();
          if (cancelled) {
            reject(abortError());
            return;
          }
          resolve({ evalCp, mateIn, bestMove: line.split(" ")[1] ?? "" });
          return;
        }

        // Fatal engine errors surface as output lines (e.g. a missing .wasm).
        if (line.startsWith("Aborted") || line.includes("fetching of the wasm failed")) {
          fail(new Error(`Stockfish failed to start: ${line}`));
        }
      };

      const onError = (e: ErrorEvent) =>
        fail(new Error(e.message || "Stockfish engine crashed"));

      const timer = setTimeout(
        () => fail(new Error(`Stockfish timed out evaluating a position (depth ${depth})`)),
        SEARCH_TIMEOUT_MS
      );

      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      signal?.addEventListener("abort", onAbort);

      worker.postMessage("ucinewgame");
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${depth}`);
    });
  })();
}
