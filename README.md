# Chess — a dialed.gg-styled multiplayer chess platform

Real-time multiplayer chess with room-code matchmaking, Elo ratings, a
dashboard, and Stockfish-powered post-game analysis, styled after dialed.gg.

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Create a Supabase project. In the SQL editor, run `supabase/schema.sql`
   top to bottom on a fresh database.
3. In Supabase Auth settings, enable Email sign-in (and Google OAuth if you
   want it — no extra code changes needed for email).
4. Copy `.env.local.example` to `.env.local` and fill in your Supabase URL
   and anon key (`SUPABASE_SERVICE_ROLE_KEY` isn't used by any route yet —
   everything runs through RLS-scoped user sessions — but it's there if you
   add admin-only routes later).
5. Download a Stockfish WASM build (e.g. `npm install stockfish` and copy
   its `stockfish.js` + `.wasm` files, or grab a prebuilt release from
   https://github.com/lichess-org/stockfish.wasm) into `public/stockfish/`
   as `stockfish.js`.
6. `npm run dev` and open http://localhost:3000.
7. Deploy to Vercel; add the same three env vars there.

## What's implemented

Everything in the original spec's Parts 5–11, plus everything Part 13
flagged as not yet built:

- Sign-in / sign-up pages (`app/sign-in`, `app/sign-up`)
- Waiting-room + live game screen with share link (`app/play/[roomCode]`)
- Draw-offer flow: offer / accept / decline (`api/games/[id]/draw-offer`,
  `components/game/DrawOfferBanner.tsx`)
- Move list, clock display, resign/draw controls, and a game-end modal
  (`components/game/*`)
- Leaderboard page, sorted by rating
- Full analysis page: move-by-move navigation, eval bar, move classification
  colors, driven by `analyzeGame()`
- A pawn-promotion picker on the board (the original board code selected
  legal targets but had no UI for choosing the promotion piece)
- Server-side clock accounting in the move API route (elapsed time is
  charged against the mover, increment applied after each move, and a
  player who runs out of time on their move loses on time) — the original
  move route tracked `fen`/`pgn` but never touched the clock columns
- A dependency-free sound-effect helper (`lib/sounds.ts`) plus a nav-bar
  mute toggle, since the spec asked for "sound toggle wiring" but shipped
  no sound implementation

I added two columns beyond the original schema to make the above work:
`games.last_move_at` and `games.draw_offered_by`, and `moves.from_square` /
`moves.to_square` (needed to highlight the last move on the board — SAN
alone doesn't carry coordinates). All in `supabase/schema.sql`.

## Still open (same list as the original brief, still true)

- Real SVG piece set — the board currently renders unicode glyphs as a
  placeholder, as the spec called out
- A bot opponent (`/play/bot` links out but has no page yet)
- Puzzles mode
- Full mobile responsive polish pass (core pages are responsive down to
  mobile, but haven't been pixel-checked)
- Go, or any second mini-game — architecturally unblocked, per the spec's
  Part 14, by the same `FeatureCard` config-array pattern on the homepage

## Notes on things I changed from the literal spec

- `NavBar` now reads real auth state via `useAuth()` instead of taking an
  `isAuthed` prop, since every page needs it independently.
- The dashboard's recent-games query assumes Postgres foreign-key names
  `games_white_player_id_fkey` / `games_black_player_id_fkey` for the
  `profiles` joins, which is what Postgres generates by default from the
  schema above — if you rename the tables/columns, update that query.
- `rating_history`'s per-game delta isn't currently shown in the recent
  games list (it's set to `0` as a placeholder) — join `rating_history` on
  `game_id` + `player_id` there if you want the real delta.
