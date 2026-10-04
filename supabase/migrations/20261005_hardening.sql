-- Hardening pass for EXISTING projects.
-- Safe to run multiple times. Run in the Supabase SQL editor, top to bottom.
-- Depends on 20261004_security_policies.sql having been applied.
--
-- Fresh projects should run supabase/schema.sql instead.

-- ============ PROFILES: COLUMN-LEVEL READ GRANT ============
-- Row-level security alone still let any signed-in user run
-- `GET /rest/v1/profiles?select=*` and dump every row. The leaderboard only
-- needs identity + rating stats, so grant exactly those columns and nothing
-- else. `created_at` — and any column added later — stays server-only unless
-- it is explicitly added to this grant, so `select *` can never silently
-- start leaking new fields.
revoke select on table public.profiles from anon, authenticated;
grant select (id, username, avatar_color, rating, games_played, wins, losses, draws)
  on table public.profiles to authenticated;

-- Clients may only ever write their own cosmetic fields; the row-level
-- UPDATE policy above already scopes this to auth.uid() = id.
revoke update on table public.profiles from anon, authenticated;
grant update (username, avatar_color) on table public.profiles to authenticated;
revoke insert, delete on table public.profiles from anon, authenticated;
