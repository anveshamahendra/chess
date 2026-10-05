Stockfish WASM build used by the post-game analysis page.

- `stockfish.js` + `stockfish.wasm` — Stockfish 19 lite, single-threaded
  (from the `stockfish` npm package, `bin/stockfish-19-lite-single.*`).
  Single-threaded so it runs without COOP/COEP headers.

The worker is loaded from `/stockfish/stockfish.js` by
`lib/chess/stockfishWorker.ts`; the wasm file must sit next to it under the
name `stockfish.wasm` (the build resolves it from its own script URL).
