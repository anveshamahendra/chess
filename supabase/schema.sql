-- Run this whole file in the Supabase SQL editor, top to bottom, on a fresh project.
-- For an EXISTING project, run supabase/migrations/20261004_security_policies.sql,
-- then 20261005_hardening.sql, then 20261020_accounts.sql (all idempotent).

-- ============ PROFILES ============
create table profiles (
  id uuid references auth.users(id) primary key,
  -- Lowercase, 3–20 chars, [a-z0-9_]. Enforced by the check constraint below;
  -- stored lowercase and double-guarded by a lower() unique index.
  username text unique not null,
  display_name text,
  avatar_url text,
  avatar_color text default '#5B8DEF',
  rating integer default 1200,
  games_played integer default 0,
  wins integer default 0,
  losses integer default 0,
  draws integer default 0,
  username_changed_at timestamp with time zone,
  username_confirmed boolean default false,
  created_at timestamp with time zone default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

create unique index if not exists profiles_username_lower_key
  on profiles (lower(username));

alter table profiles enable row level security;

-- Any signed-in user may read profiles (leaderboard, opponent names, member
-- pages). The column grant below limits which fields are readable — emails
-- live in auth.users and are never exposed here.
drop policy if exists "Profiles are viewable by signed-in users" on profiles;
create policy "Profiles are viewable by signed-in users"
  on profiles for select using (auth.uid() is not null);

-- Row-level security alone still allows `select=*` over every row, so grant
-- only the columns other players need. `username_confirmed`,
-- `username_changed_at`, and `created_at` stay account-private (readable only
-- through the get_my_account RPC) unless explicitly added here.
revoke select on table profiles from anon, authenticated;
grant select (id, username, display_name, avatar_url, avatar_color, rating, games_played, wins, losses, draws)
  on table profiles to authenticated;

-- Users may edit only their own row; the column grants below limit which
-- columns. Username changes go exclusively through change_username().
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Rating and win/loss counters must never be client-writable, and neither
-- must username / username_confirmed / username_changed_at.
revoke update on table profiles from anon, authenticated;
grant update (display_name, avatar_url, avatar_color) on table profiles to authenticated;
-- Rows are created only by the signup trigger below.
revoke insert, delete on table profiles from anon, authenticated;

-- ============ SIGNUP TRIGGER ============
-- Derives username / display_name / avatar_url from whatever metadata the
-- provider sent. Must NEVER raise: a failed insert here would block signup.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_supplied text;
  v_username text;
  v_display text;
  v_avatar text;
  v_confirmed boolean := false;
  v_id_suffix text := substr(new.id::text, 1, 6);
begin
  v_supplied := nullif(btrim(coalesce(new.raw_user_meta_data->>'username', '')), '');

  if v_supplied is not null then
    -- Email signup: the user picked a username. Normalize it; if normalization
    -- destroys it, fall back to the generated name (still confirmed — the
    -- user supplied a name, so no onboarding is needed).
    v_username := substr(trim(both '_' from lower(regexp_replace(v_supplied, '[^a-z0-9_]+', '_', 'g'))), 1, 20);
    if v_username !~ '^[a-z0-9_]{3,20}$' then
      v_username := 'player_' || substr(new.id::text, 1, 8);
    end if;
    v_confirmed := true;
  else
    -- Google (or any provider without a username): sanitize full_name, else
    -- fall back to a generated handle. username_confirmed stays false so the
    -- user is sent through onboarding to pick their own name.
    v_display := nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');
    if v_display is not null then
      v_username := substr(trim(both '_' from lower(regexp_replace(v_display, '[^a-z0-9_]+', '_', 'g'))), 1, 20);
    end if;
    if v_username is null or v_username !~ '^[a-z0-9_]{3,20}$' then
      v_username := 'player_' || substr(new.id::text, 1, 8);
    end if;
  end if;

  if v_display is null then
    v_display := coalesce(nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''), v_username);
  end if;
  v_avatar := nullif(btrim(coalesce(new.raw_user_meta_data->>'avatar_url', '')), '');

  begin
    insert into public.profiles (id, username, display_name, avatar_url, username_confirmed)
    values (new.id, v_username, v_display, v_avatar, v_confirmed);
  exception when unique_violation then
    -- Username collision: retry once with a per-user id suffix, truncating
    -- the base so the total stays within the 20-char limit.
    insert into public.profiles (id, username, display_name, avatar_url, username_confirmed)
    values (
      new.id,
      substr(v_username, 1, 20 - length(v_id_suffix) - 1) || '_' || v_id_suffix,
      v_display,
      v_avatar,
      v_confirmed
    );
  end;
  return new;
end;
$$ language plpgsql security definer set search_path = '';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============ USERNAME RPCs ============

-- Live availability check for the signup / onboarding / settings UI. Returns
-- false for invalid format or an already-taken name. Exposed to anon because
-- the signup page checks before an account exists.
create or replace function public.username_available(p_username text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select p_username ~ '^[a-z0-9_]{3,20}$'
    and not exists (
      select 1 from public.profiles where lower(username) = lower(p_username)
    );
$$;

revoke execute on function public.username_available(text) from public, anon;
grant execute on function public.username_available(text) to anon, authenticated;

-- Resolves a username to its sign-in email so the login form can accept
-- either identifier. Returns only the email for that one username and never
-- exposes the profiles table; emails are not otherwise readable by clients.
create or replace function public.resolve_username_email(p_username text)
returns text
language sql
security definer
set search_path = ''
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(p_username)
  limit 1;
$$;

revoke execute on function public.resolve_username_email(text) from public, anon;
grant execute on function public.resolve_username_email(text) to anon, authenticated;

-- Changes the caller's username. Only path to a new username (column grants
-- exclude username from client updates). The first-time onboarding pick
-- (username_confirmed = false) is exempt from the change interval.
create or replace function public.change_username(p_new_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
-- >>> Change this interval to alter how often players may rename. <<<
declare
  CHANGE_INTERVAL constant interval := interval '30 days';
  v_uid uuid := auth.uid();
  v_new text := lower(btrim(coalesce(p_new_username, '')));
  v_changed_at timestamptz;
  v_confirmed boolean;
begin
  if v_uid is null then
    raise exception 'You must be signed in to change your username.';
  end if;

  if v_new !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Usernames are 3–20 characters and can only contain lowercase letters, numbers, and underscores.';
  end if;

  select username_changed_at, username_confirmed
    into v_changed_at, v_confirmed
  from public.profiles where id = v_uid;

  if v_confirmed and v_changed_at is not null and v_changed_at > now() - CHANGE_INTERVAL then
    raise exception 'You can change your username again on %.',
      to_char(v_changed_at + CHANGE_INTERVAL, 'YYYY-MM-DD');
  end if;

  -- Own current username is not "taken" (lets onboarding keep the suggestion).
  if exists (
    select 1 from public.profiles
    where lower(username) = v_new and id <> v_uid
  ) then
    raise exception 'That username is taken.';
  end if;

  -- The first-time pick (username_confirmed = false) must not count against
  -- the limit: it leaves username_changed_at untouched, so the next real
  -- change is still free. Every confirmed change starts the 30-day clock.
  update public.profiles
    set username = v_new,
        username_changed_at = case when v_confirmed then now() else username_changed_at end,
        username_confirmed = true
    where id = v_uid;

  return v_new;
end;
$$ language plpgsql security definer set search_path = '';

revoke execute on function public.change_username(text) from public, anon;
grant execute on function public.change_username(text) to authenticated;

-- Own-account read: username_confirmed / username_changed_at are excluded
-- from the column grants (they would be world-readable among signed-in users
-- otherwise), so account screens fetch them through this RPC instead.
create or replace function public.get_my_account()
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  avatar_color text,
  username_confirmed boolean,
  username_changed_at timestamptz,
  rating integer,
  games_played integer,
  wins integer,
  losses integer,
  draws integer
)
language sql
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.avatar_color,
         p.username_confirmed, p.username_changed_at,
         p.rating, p.games_played, p.wins, p.losses, p.draws
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke execute on function public.get_my_account() from public, anon;
grant execute on function public.get_my_account() to authenticated;

-- ============ GAMES ============
create table games (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  white_player_id uuid references profiles(id),
  black_player_id uuid references profiles(id),
  status text default 'waiting', -- waiting | active | completed | aborted
  result text,
  result_reason text,
  is_rated boolean default true,
  time_control_minutes integer default 10,
  time_control_increment integer default 0,
  fen_current text default 'start',
  pgn text default '',
  white_time_remaining_ms integer,
  black_time_remaining_ms integer,
  last_move_at timestamp with time zone,
  draw_offered_by uuid references profiles(id),
  created_at timestamp with time zone default now(),
  started_at timestamp with time zone,
  ended_at timestamp with time zone
);

alter table games enable row level security;

-- Only the two players may see a game. Invitees resolve the room code through
-- GET /api/games/lookup/[code] before they join.
drop policy if exists "Participants can view their games" on games;
create policy "Participants can view their games"
  on games for select using (
    auth.uid() = white_player_id
    or auth.uid() = black_player_id
  );

-- Kept as a backstop: client DML on games is revoked below, all writes go
-- through the service-role API routes.
drop policy if exists "Players can create games" on games;
create policy "Players can create games"
  on games for insert with check (auth.uid() = white_player_id);

drop policy if exists "Participants can update their game" on games;
create policy "Participants can update their game"
  on games for update
  using (
    auth.uid() = white_player_id
    or auth.uid() = black_player_id
  )
  with check (
    auth.uid() = white_player_id
    or auth.uid() = black_player_id
  );

revoke insert, update, delete on table games from anon, authenticated;

-- ============ MOVES ============
create table moves (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) not null,
  move_number integer not null,
  player_color text not null,
  san text not null,
  from_square text not null,
  to_square text not null,
  fen_after text not null,
  time_taken_ms integer,
  created_at timestamp with time zone default now()
);

alter table moves enable row level security;

drop policy if exists "Moves viewable by game participants" on moves;
create policy "Moves viewable by game participants"
  on moves for select using (
    exists (
      select 1 from games
      where games.id = moves.game_id
      and (games.white_player_id = auth.uid() or games.black_player_id = auth.uid())
    )
  );

-- Backstop: client DML on moves is revoked below.
drop policy if exists "Participants can insert moves" on moves;
create policy "Participants can insert moves"
  on moves for insert with check (
    exists (
      select 1 from games
      where games.id = moves.game_id
      and (games.white_player_id = auth.uid() or games.black_player_id = auth.uid())
    )
  );

revoke insert, update, delete on table moves from anon, authenticated;

-- ============ GAME ANALYSIS ============
create table game_analysis (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) not null,
  move_id uuid references moves(id) not null,
  eval_centipawns integer,
  eval_mate_in integer,
  classification text,
  best_move_san text,
  created_at timestamp with time zone default now()
);

alter table game_analysis enable row level security;

drop policy if exists "Analysis viewable by game participants" on game_analysis;
create policy "Analysis viewable by game participants"
  on game_analysis for select using (
    exists (
      select 1 from games
      where games.id = game_analysis.game_id
      and (games.white_player_id = auth.uid() or games.black_player_id = auth.uid())
    )
  );

-- Backstop: client DML on game_analysis is revoked below.
drop policy if exists "Participants can insert analysis" on game_analysis;
create policy "Participants can insert analysis"
  on game_analysis for insert with check (
    exists (
      select 1 from games
      where games.id = game_analysis.game_id
      and (games.white_player_id = auth.uid() or games.black_player_id = auth.uid())
    )
  );

revoke insert, update, delete on table game_analysis from anon, authenticated;

-- ============ RATING HISTORY ============
create table rating_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references profiles(id) not null,
  game_id uuid references games(id) not null,
  rating_before integer not null,
  rating_after integer not null,
  created_at timestamp with time zone default now()
);

alter table rating_history enable row level security;

drop policy if exists "Rating history viewable by owner" on rating_history;
create policy "Rating history viewable by owner"
  on rating_history for select using (auth.uid() = player_id);

revoke insert, update, delete on table rating_history from anon, authenticated;

-- ============ REALTIME ============
-- Realtime postgres_changes events are filtered by the same RLS SELECT
-- policies, so live game feeds only reach participants.
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table moves;

-- ============ SERVER-SIDE ELO UPDATE FUNCTION ============
create or replace function public.apply_elo_update(
  p_game_id uuid,
  p_white_score numeric,
  p_black_score numeric
) returns void as $$
declare
  v_white_id uuid;
  v_black_id uuid;
  v_white_rating integer;
  v_black_rating integer;
  v_white_games integer;
  v_black_games integer;
  v_white_k integer;
  v_black_k integer;
  v_white_expected numeric;
  v_black_expected numeric;
  v_white_new integer;
  v_black_new integer;
begin
  if p_white_score is null
     or p_black_score is null
     or p_white_score not in (0, 0.5, 1)
     or p_black_score not in (0, 0.5, 1)
     or p_white_score + p_black_score <> 1 then
    raise exception 'apply_elo_update: invalid scores';
  end if;

  select white_player_id, black_player_id into v_white_id, v_black_id
  from public.games where id = p_game_id;

  select rating, games_played into v_white_rating, v_white_games
  from public.profiles where id = v_white_id;

  select rating, games_played into v_black_rating, v_black_games
  from public.profiles where id = v_black_id;

  v_white_k := case when v_white_games < 30 then 32 else 16 end;
  v_black_k := case when v_black_games < 30 then 32 else 16 end;

  v_white_expected := 1.0 / (1 + power(10, (v_black_rating - v_white_rating) / 400.0));
  v_black_expected := 1.0 / (1 + power(10, (v_white_rating - v_black_rating) / 400.0));

  v_white_new := round(v_white_rating + v_white_k * (p_white_score - v_white_expected));
  v_black_new := round(v_black_rating + v_black_k * (p_black_score - v_black_expected));

  insert into public.rating_history (player_id, game_id, rating_before, rating_after)
  values (v_white_id, p_game_id, v_white_rating, v_white_new),
         (v_black_id, p_game_id, v_black_rating, v_black_new);

  update public.profiles set
    rating = v_white_new,
    games_played = games_played + 1,
    wins = wins + (case when p_white_score = 1 then 1 else 0 end),
    losses = losses + (case when p_white_score = 0 then 1 else 0 end),
    draws = draws + (case when p_white_score = 0.5 then 1 else 0 end)
  where id = v_white_id;

  update public.profiles set
    rating = v_black_new,
    games_played = games_played + 1,
    wins = wins + (case when p_black_score = 1 then 1 else 0 end),
    losses = losses + (case when p_black_score = 0 then 1 else 0 end),
    draws = draws + (case when p_black_score = 0.5 then 1 else 0 end)
  where id = v_black_id;
end;
$$ language plpgsql security definer set search_path = '';

-- SECURITY DEFINER + default EXECUTE for PUBLIC would let any anon caller
-- forge ratings; only the service-role API routes may call this.
revoke execute on function public.apply_elo_update(uuid, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.apply_elo_update(uuid, numeric, numeric)
  to service_role;
