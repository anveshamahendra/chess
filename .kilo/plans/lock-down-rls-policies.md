# Lock down backend security policies (profiles + game data)

## Problem

The Supabase backend ships **no effective read policies**: every table's `SELECT`
policy is `USING (true)`, and the browser uses the public anon key. Anyone can
query all data without logging in:

```
GET {SUPABASE_URL}/rest/v1/profiles?select=*        → every profile (rating, W/L/D)
GET {SUPABASE_URL}/rest/v1/games?select=*           → every game + room codes
GET {SUPABASE_URL}/rest/v1/moves?select=*           → every move list
GET {SUPABASE_URL}/rest/v1/rpc/apply_elo_update …   → forge ratings (SECURITY DEFINER, EXECUTE=PUBLIC)
```

Related write holes: users can `PATCH` their own `rating`/`wins`
(`supabase/schema.sql:21-22`), any signed-in user can tamper with any
`waiting` game (`schema.sql:68-73`), and `join` has a status race
(`app/api/games/[id]/join/route.ts:33-42`).

**Confirmed decisions:** profiles readable by *signed-in* users only; games/moves
readable by *participants* only; fix reads **and** the write holes.

Enforcement lives entirely in RLS + grants; Supabase Realtime `postgres_changes`
also enforces RLS, so live feeds lock down automatically — no realtime code change.

## Changes

### 1. `supabase/schema.sql` (fresh installs)

Final policy set:

| Table | Command | Rule |
|---|---|---|
| profiles | SELECT | `auth.uid() is not null` (signed-in only; leaderboard works) |
| profiles | UPDATE | own row (`using` + `with check`); **column grant limited to `username, avatar_color`** — rating/W-L-D not updatable |
| profiles | INSERT/DELETE | revoke from `anon, authenticated` (rows created only by signup trigger) |
| games | SELECT | participant: `auth.uid() in (white_player_id, black_player_id)` |
| games | INSERT/UPDATE/DELETE | **revoke** from `anon, authenticated` — all writes go through service-role routes |
| moves | SELECT | participant via `exists` on `games` (keep pattern from `schema.sql:94-101`) |
| moves | INSERT/DELETE | revoke from client roles |
| game_analysis | SELECT | participant via `exists` on `games` |
| game_analysis | INSERT/DELETE | revoke from client roles |
| rating_history | SELECT | `player_id = auth.uid()` (dashboard only reads own) |
| rating_history | INSERT/DELETE | revoke from client roles |

Kept as RLS backstops (even though grants are revoked): tightened versions of
"Players can create games", "Participants can insert moves/analysis".

Elo RPC (`apply_elo_update`):
```sql
revoke execute on function public.apply_elo_update(uuid, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.apply_elo_update(uuid, numeric, numeric)
  to service_role;
```
Plus a guard inside the function body: raise unless
`p_white_score in (0, 0.5, 1) and p_white_score + p_black_score = 1`.

All `create policy` → `drop policy if exists` + `create` so the file stays re-runnable.

### 2. NEW `supabase/migrations/20261004_security_policies.sql`

Same changes expressed idempotently for an **existing** database (drop old
policies by the exact names in `schema.sql:18,21,62,65,68,91,94,117,120,141`,
recreate, apply revokes/grants, `create or replace` the Elo function).
Applied by pasting into the Supabase SQL editor (no CLI config in repo).

### 3. NEW `app/api/games/lookup/[code]/route.ts`

`GET` → resolves room code → game (admin client), so the invited player can
find a game **before** being a participant:

- returns `{ id, status, isParticipant }` where `isParticipant` is computed
  server-side (`uid === white || uid === black`) — never leaks player UUIDs;
- `404` unknown code, `401` unauthenticated is *not* required (room code is the
  invite secret; page still needs to show "Sign in to join"),
- validates code format (`^[A-Z2-9]{6}$`) before querying.

### 4. `app/play/[roomCode]/page.tsx` — rework join flow

- Replace the direct `supabase.from("games").eq("room_code", …)` lookup
  (`:35-51`) with the new API route; store `lookup` state.
- New render branch for the invitee **before joining** (game row unreadable
  under new RLS): show the existing waiting-room invite UI (copy ported from
  `:151-160`) driven by `lookup.status === "waiting" && !lookup.isParticipant`.
- Non-participant hitting an already-started game → "This game already
  started." instead of infinite "Loading game…" (currently `game === null`
  falls into `:117`).
- `handleJoin` success → `setJoined(true)` + `refetch()` so the hook (now
  passing RLS) loads the game it previously couldn't.

### 5. `app/leaderboard/page.tsx` — auth gate

Mirror the dashboard pattern (`app/dashboard/page.tsx:30-32`): while auth
loads show loading; unauthenticated → `router.push("/sign-in")`. Prevents the
silent empty leaderboard caused by RLS filtering.

### 6. `app/analysis/[gameId]/page.tsx` — access states

Add loading + not-found states: after fetch, `game === null` means unknown id
**or** not a participant → render "This game isn't available to you." instead
of the current empty board ("White vs Black", `:106`).

### 7. Small hardening in existing routes

- `app/api/games/route.ts:5-8`: room code from `crypto.getRandomValues`
  (invite link is now the access capability; `Math.random` isn't cryptographically
  secure).
- `app/api/games/[id]/join/route.ts`: add `.eq("status", "waiting")` to the
  update (`:40`) and treat 0 rows as "Game already started" — closes the
  fetch/update race that could overwrite `black_player_id` of an active game.

### 8. `README.md`

- Fix the false claim (`:17-19`) that the service key "isn't used by any route"
  — every route uses it, and **it is now required** (missing key ⇒ writes fail closed).
- Add a "Security" note: policies live in `schema.sql`; existing projects run
  the migration file once.

## Verification

1. `npm run build` (typecheck) and `npm run lint`.
2. SQL review pass (no local DB assumed).
3. **If Docker is available** (optional): `npx supabase start`, apply
   `schema.sql`, then with the anon key assert:
   - `/rest/v1/profiles`, `/rest/v1/games`, `/rest/v1/moves` → `[]`
   - `/rest/v1/rpc/apply_elo_update` → 403
   - authed non-participant reading someone's game id → `[]`
4. Manual test checklist (live project, after the user runs the migration):
   - anon curl to the three tables → empty
   - logged-out visitor → leaderboard redirects to sign-in
   - invite link flow: share → second account joins → moves flow works
   - analysis link from own GameEndModal still works; same link from a
     signed-out/other account shows the unavailable state
   - live game: both players still receive realtime moves

## Out of scope (noted, not touched)

- Rate limiting on lookup/join (no infra present), `error.message` leakage from
  routes, request-body validation libs, security headers/CSP, `middleware.ts`
  page guarding (RLS is the enforcement layer).
- Stale duplicate worktree `.kilo/worktrees/salt-racer` (detached, 1 commit
  behind) — left untouched.
