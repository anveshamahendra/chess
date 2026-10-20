-- Accounts upgrade: Google OAuth + chess.com-style usernames.
-- Safe to run multiple times. Run in the Supabase SQL editor, top to bottom.
-- Depends on 20261004_security_policies.sql + 20261005_hardening.sql.
--
-- Fresh projects should run supabase/schema.sql instead.

-- ============ PROFILES: NEW COLUMNS ============
-- username_confirmed backfills to true (inside the guard below) because every
-- pre-migration user picked their own username at email signup.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'username_confirmed'
  ) then
    alter table public.profiles add column username_confirmed boolean not null default false;
    update public.profiles set username_confirmed = true;
  end if;
end $$;

alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists username_changed_at timestamp with time zone;

-- Existing email users never had a display_name; mirror their username so
-- every row has one. Idempotent: skips rows that already have one.
update public.profiles set display_name = username where display_name is null;

-- ============ PROFILES: NORMALIZE USERNAMES ============
-- Old signups allowed any characters. Lowercase + sanitize + dedupe so the
-- new format constraint can be added without failing on existing rows.
do $$
declare
  r record;
  v_new text;
begin
  for r in
    select id, username from public.profiles
    where username <> lower(username) or username !~ '^[a-z0-9_]{3,20}$'
  loop
    v_new := substr(trim(both '_' from lower(regexp_replace(r.username, '[^a-zA-Z0-9_]+', '_', 'g'))), 1, 20);
    if v_new !~ '^[a-z0-9_]{3,20}$' then
      v_new := 'player_' || substr(r.id::text, 1, 8);
    end if;
    -- Collision: append this user's id (unique); last-resort digit loop
    -- keeps the string inside the 20-char charset limit.
    if exists (select 1 from public.profiles p where p.id <> r.id and lower(p.username) = v_new) then
      v_new := substr(v_new, 1, 13) || '_' || substr(r.id::text, 1, 6);
    end if;
    while exists (select 1 from public.profiles p where p.id <> r.id and lower(p.username) = v_new) loop
      v_new := substr(v_new, 1, 19) || floor(random() * 10)::text;
    end loop;
    update public.profiles set username = v_new where id = r.id;
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_username_format' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$');
  end if;
end $$;

create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

-- ============ PROFILES: COLUMN GRANTS ============
-- Signed-in users may read the public identity fields (display_name,
-- avatar_url join the list). Account-private fields (username_confirmed,
-- username_changed_at) and any future column stay server-only unless added
-- here explicitly; they are readable through get_my_account() instead.
revoke select on table public.profiles from anon, authenticated;
grant select (id, username, display_name, avatar_url, avatar_color, rating, games_played, wins, losses, draws)
  on table public.profiles to authenticated;

-- Clients may write only cosmetic fields on their own row. Username changes
-- go exclusively through change_username().
revoke update on table public.profiles from anon, authenticated;
grant update (display_name, avatar_url, avatar_color) on table public.profiles to authenticated;
revoke insert, delete on table public.profiles from anon, authenticated;

-- ============ SIGNUP TRIGGER ============
-- create or replace only — the on_auth_user_created trigger already exists;
-- do not drop/recreate it.
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
    v_username := substr(trim(both '_' from lower(regexp_replace(v_supplied, '[^a-z0-9_]+', '_', 'g'))), 1, 20);
    if v_username !~ '^[a-z0-9_]{3,20}$' then
      v_username := 'player_' || substr(new.id::text, 1, 8);
    end if;
    v_confirmed := true;
  else
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

-- ============ USERNAME RPCs ============

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
$$;

revoke execute on function public.change_username(text) from public, anon;
grant execute on function public.change_username(text) to authenticated;

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
