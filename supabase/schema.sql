-- Run this whole file in the Supabase SQL editor, top to bottom, on a fresh project.

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

create policy "Profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', 'player_' || substr(new.id::text, 1, 8)));
  return new;
end;
$$ language plpgsql security definer;

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

create policy "Games are viewable by participants or via room code lookup"
  on games for select using (true);

create policy "Players can create games"
  on games for insert with check (auth.uid() = white_player_id);

create policy "Participants can update their game or join waiting game"
  on games for update using (
    auth.uid() = white_player_id
    or auth.uid() = black_player_id
    or (status = 'waiting' and black_player_id is null)
  );

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

create policy "Moves viewable by game participants"
  on moves for select using (true);

create policy "Participants can insert moves"
  on moves for insert with check (
    exists (
      select 1 from games
      where games.id = moves.game_id
      and (games.white_player_id = auth.uid() or games.black_player_id = auth.uid())
    )
  );

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

create policy "Analysis viewable by everyone"
  on game_analysis for select using (true);

create policy "Participants can insert analysis"
  on game_analysis for insert with check (
    exists (
      select 1 from games
      where games.id = game_analysis.game_id
      and (games.white_player_id = auth.uid() or games.black_player_id = auth.uid())
    )
  );

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

create policy "Rating history viewable by everyone"
  on rating_history for select using (true);

-- ============ REALTIME ============
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
  select white_player_id, black_player_id into v_white_id, v_black_id
  from games where id = p_game_id;

  select rating, games_played into v_white_rating, v_white_games
  from profiles where id = v_white_id;

  select rating, games_played into v_black_rating, v_black_games
  from profiles where id = v_black_id;

  v_white_k := case when v_white_games < 30 then 32 else 16 end;
  v_black_k := case when v_black_games < 30 then 32 else 16 end;

  v_white_expected := 1.0 / (1 + power(10, (v_black_rating - v_white_rating) / 400.0));
  v_black_expected := 1.0 / (1 + power(10, (v_white_rating - v_black_rating) / 400.0));

  v_white_new := round(v_white_rating + v_white_k * (p_white_score - v_white_expected));
  v_black_new := round(v_black_rating + v_black_k * (p_black_score - v_black_expected));

  insert into rating_history (player_id, game_id, rating_before, rating_after)
  values (v_white_id, p_game_id, v_white_rating, v_white_new),
         (v_black_id, p_game_id, v_black_rating, v_black_new);

  update profiles set
    rating = v_white_new,
    games_played = games_played + 1,
    wins = wins + (case when p_white_score = 1 then 1 else 0 end),
    losses = losses + (case when p_white_score = 0 then 1 else 0 end),
    draws = draws + (case when p_white_score = 0.5 then 1 else 0 end)
  where id = v_white_id;

  update profiles set
    rating = v_black_new,
    games_played = games_played + 1,
    wins = wins + (case when p_black_score = 1 then 1 else 0 end),
    losses = losses + (case when p_black_score = 0 then 1 else 0 end),
    draws = draws + (case when p_black_score = 0.5 then 1 else 0 end)
  where id = v_black_id;
end;
$$ language plpgsql security definer;
