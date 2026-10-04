-- Run this whole file in the Supabase SQL editor, top to bottom, on a fresh project.
-- For an EXISTING project, run supabase/migrations/20261004_security_policies.sql instead.

-- ============ PROFILES ============
create table profiles (
  id uuid references auth.users(id) primary key,
  username text unique not null,
  avatar_color text default '#5B8DEF',
  rating integer default 1200,
  games_played integer default 0,
  wins integer default 0,
  losses integer default 0,
  draws integer default 0,
  created_at timestamp with time zone default now()
);

alter table profiles enable row level security;

-- Any signed-in user may read profiles (leaderboard, opponent names).
drop policy if exists "Profiles are viewable by signed-in users" on profiles;
create policy "Profiles are viewable by signed-in users"
  on profiles for select using (auth.uid() is not null);

-- Row-level security alone still allows `select=*` over every row, so grant
-- only the columns the leaderboard and opponent names need. `created_at` and
-- any future column stay server-only unless added to this list explicitly.
revoke select on table profiles from anon, authenticated;
grant select (id, username, avatar_color, rating, games_played, wins, losses, draws)
  on table profiles to authenticated;

-- Users may edit only their own row; the column grants below limit which columns.
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Rating and win/loss counters must never be client-writable.
revoke update on table profiles from anon, authenticated;
grant update (username, avatar_color) on table profiles to authenticated;
-- Rows are created only by the signup trigger below.
revoke insert, delete on table profiles from anon, authenticated;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', 'player_' || substr(new.id::text, 1, 8)));
  return new;
end;
$$ language plpgsql security definer set search_path = '';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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
