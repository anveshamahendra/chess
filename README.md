# Chess — a dialed.gg-styled multiplayer chess platform

Real-time multiplayer chess with room-code matchmaking, Elo ratings, a
dashboard, and Stockfish-powered post-game analysis, styled after dialed.gg.

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Create a Supabase project. In the SQL editor, run `supabase/schema.sql`
   top to bottom on a fresh database. On an *existing* database, run
   `supabase/migrations/20261004_security_policies.sql` once instead — it
   applies the same security policies idempotently — followed by
   `supabase/migrations/20261005_hardening.sql` and
   `supabase/migrations/20261020_accounts.sql` (both idempotent; the latter
   adds the Google accounts / username system).
3. Sign-in methods:
   - **Email**: enable Email sign-in in Supabase Auth settings. Sign-up
     takes a username, which becomes the account's handle.
   - **Google**: sign-in with Google is implemented in code (button on
     `/sign-in` and `/sign-up`, PKCE exchange in `/auth/callback`, username
     onboarding for new Google users). It needs one-time manual setup:
     1. **Google Cloud Console** → OAuth consent screen → Credentials →
        create an **OAuth client ID (Web application)** with the authorized
        redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`.
        Publish the consent screen (move it out of "Testing") before launch
        — test-mode tokens expire and limit you to 100 users.
     2. **Supabase → Authentication → Providers → Google**: enable it and
        paste the Client ID and Client Secret.
     3. **Supabase → Authentication → URL Configuration**: set the Site URL
        and add the Redirect URLs — `http://localhost:3000/auth/callback`,
        `https://yourdomain.com/auth/callback`, and a wildcard such as
        `https://*.vercel.app/auth/callback` for preview deployments.
     4. Run `supabase/migrations/20261020_accounts.sql` in the SQL editor
        (step 2) if you haven't already.

   No new environment variables are needed — Supabase stores the Google
   credentials; the app only reads `NEXT_PUBLIC_SUPABASE_*`.
4. Copy `.env.local.example` to `.env.local` and fill in all three vars.
   `SUPABASE_SERVICE_ROLE_KEY` is **required**: every `/api/games/*` route
   writes through it (all client-side DML on game tables is revoked in favor
   of RLS + service-role routes), so writes fail closed without it.
   Add `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` too (free tier,
   https://upstash.com) — without them rate limits fall back to a per-instance
   in-memory map, which is much weaker under a distributed flood.
5. Stockfish for post-game analysis is already bundled at
   `public/stockfish/` (Stockfish 19 lite, single-threaded). To upgrade or
   swap builds, drop a different `stockfish.js` + `stockfish.wasm` pair in
   the same folder � see `public/stockfish/README.md`.
6. `npm run dev` and open http://localhost:3000.
7. Deploy to Vercel; add the same three env vars there.

## Security

The anon key is public (it ships in the browser bundle), so the API surface is
only as safe as the row level security policies in `supabase/schema.sql`:

- `profiles` — readable by signed-in users (leaderboard, member pages,
  opponent names) but only over the granted public columns (`id`,
  `username`, `display_name`, `avatar_url`, `avatar_color`, rating stats);
  account-private fields (`username_confirmed`, `username_changed_at`) are
  readable only through the `get_my_account()` security-definer RPC.
  Updatable by the owner but only `display_name` / `avatar_url` /
  `avatar_color` via column-level grants — `username` changes go through the
  `change_username()` RPC (format + uniqueness + one change per 30 days
  enforced in the database), and `rating`, `wins`, `losses`, `draws` are
  never client-writable.
- `username_available()` / `resolve_username_email()` are security-definer
  RPCs for the sign-up/sign-in forms (availability check, and username →
  email for login). `resolve_username_email` returns only the one matching
  username's email — nothing else is readable.
- `games` / `moves` / `game_analysis` — readable by participants only; all
  writes go through the service-role API routes (`/api/games/*`), and client
  DML on these tables is revoked.
- `rating_history` — readable only by the row's owner.
- `apply_elo_update` is `SECURITY DEFINER` with an empty `search_path`, a
  score-validation guard, and `EXECUTE` revoked from `public` / `anon` /
  `authenticated` — only the service role can call it.
- Realtime `postgres_changes` events are filtered by the same SELECT
  policies, so live game feeds only reach participants.
- Room codes resolve through `GET /api/games/lookup/[code]` — the room code
  is the invite secret and is generated with `node:crypto`.

## Abuse / DDoS protection

Two layers, doing different jobs:

- **`middleware.ts`** caps every `/api/*` request per caller IP (120/min,
  400/5min) *before* the route handler runs, so junk never boots a Node
  function or reaches Supabase. Returns `429` + `Retry-After`.
- **Per-route limits** (`lib/rateLimit.ts`) — room lookup 10/min per IP,
  game creation 5/min, `move` 60/min, `join` 10/min, `resign` /
  `draw-offer` 20/min per user. User-keyed limits necessarily run after
  auth, which is why the IP layer exists first.

Both are backed by Upstash Redis (sliding window, shared across instances)
when `UPSTASH_REDIS_REST_*` is set, and by an in-memory map otherwise.
`callerIp()` prefers `NextRequest.ip` and otherwise takes the rightmost
`x-forwarded-for` entry — never the leftmost, which is client-controlled.

Redis errors fail *open* (request allowed, error logged) so an Upstash blip
can't take the site down.

**What this does not cover:** volumetric (L3/L4) floods and bot traffic are
an infrastructure problem — put Cloudflare in front (free tier: Bot Fight Mode
plus a rate-limit rule on `/api/*`) or configure Vercel WAF rules. That step
is outside this repo.

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
