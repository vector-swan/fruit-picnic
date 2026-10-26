-- Fruit Picnic friends leaderboard
-- Paste this whole file into Supabase → SQL Editor → New query, then press Run.
-- It's safe to run more than once.
--
-- The game never reads or writes the tables directly. Everything goes through
-- the functions below, which check names and keep the private player ids
-- private. Each phone has a random player id that only that phone knows.

-- ── Tables ────────────────────────────────────────────────────────────────────

-- One row per player (per phone): their name and their best score so far.
-- public_id is what the game sees, so it can hide or report a row without ever
-- learning anyone's private player id. hidden = the name got reported and shows
-- as "Picnic Player" until you review it (set it back to false to restore it).
create table if not exists public.scores (
  player_id  uuid primary key,
  name       text not null check (char_length(name) between 1 and 20),
  score      integer not null check (score between 0 and 4000000),
  top_tile   integer not null check (top_tile between 2 and 131072),
  updated_at timestamptz not null default now()
);
alter table public.scores add column if not exists public_id uuid not null default gen_random_uuid();
alter table public.scores add column if not exists hidden boolean not null default false;
create unique index if not exists scores_public_id on public.scores (public_id);

-- Words that aren't allowed in names. Add your own in Table Editor → blocked_words.
--   match = 'part': blocked anywhere in the name, even split up ("f.u.c.k")
--   match = 'word': blocked only as a whole word, for short words that hide
--                   inside normal names ("ass" in "Cassie")
-- Letters only, lowercase. Common swaps (0→o, 1→i, 3→e, 4→a, 5→s …) and
-- stretched letters ("fuuuck") are caught automatically.
create table if not exists public.blocked_words (
  word  text primary key check (word ~ '^[a-z]+$'),
  match text not null default 'part' check (match in ('part', 'word'))
);

-- "Report name" taps. Two different players reporting a name hides it.
create table if not exists public.reports (
  reporter   uuid not null,
  target     uuid not null,          -- scores.public_id
  created_at timestamptz not null default now(),
  primary key (reporter, target)
);

-- Friend groups. Anyone with the code can join.
create table if not exists public.groups (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,   -- like PLUM-4827
  name       text not null check (char_length(name) between 1 and 24),
  created_by uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  player_id uuid not null,
  joined_at timestamptz not null default now(),
  primary key (group_id, player_id)
);
create index if not exists group_members_player on public.group_members (player_id);

-- Lock the tables: the game only gets in through the functions below.
-- (You can still see and edit everything in Supabase's Table Editor.)
alter table public.scores        enable row level security;
alter table public.blocked_words enable row level security;
alter table public.reports       enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
drop policy if exists "Anyone can read the leaderboard" on public.scores;
revoke all on public.scores, public.blocked_words, public.reports, public.groups, public.group_members
  from anon, authenticated;

-- ── The starting word list ────────────────────────────────────────────────────
insert into public.blocked_words (word, match) values
  ('fuck','part'), ('shit','part'), ('bitch','part'), ('bastard','part'), ('asshole','part'),
  ('butthole','part'), ('dickhead','part'), ('motherf','part'), ('wank','part'), ('twat','part'),
  ('bollock','part'), ('piss','part'), ('slut','part'), ('whore','part'), ('pussy','part'),
  ('penis','part'), ('vagina','part'), ('dildo','part'), ('porn','part'), ('jizz','part'),
  ('boob','part'), ('horny','part'), ('milf','part'), ('rapist','part'), ('retard','part'),
  ('nigger','part'), ('nigga','part'), ('faggot','part'), ('tranny','part'), ('kike','part'),
  ('nazi','part'), ('hitler','part'), ('killyourself','part'),
  ('cunt','word'), ('ass','word'), ('arse','word'), ('dick','word'), ('cock','word'), ('fag','word'),
  ('cum','word'), ('tit','word'), ('tits','word'), ('sex','word'), ('anal','word'), ('anus','word'),
  ('rape','word'), ('prick','word'), ('spic','word'), ('chink','word'), ('coon','word'), ('dyke','word'),
  ('kkk','word'), ('heil','word'), ('kys','word'), ('naked','word'), ('nude','word'), ('poop','word')
on conflict (word) do nothing;

-- ── Name check ────────────────────────────────────────────────────────────────
-- Tidies a name: trims it and squeezes repeated spaces.
create or replace function public.tidy_name(p_name text)
returns text language sql immutable as $$
  select regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
$$;

-- true if a player or group name is OK to show.
create or replace function public.name_allowed(p_name text, p_max integer default 20)
returns boolean
language plpgsql stable
set search_path = public
as $$
declare
  v_name   text := tidy_name(p_name);
  v_plain  text;   -- lowercase with look-alike digits turned into letters
  v_joined text;   -- just the letters, run together
  w record;
  v_pat text;
begin
  -- 2 to p_max characters: letters (any language), numbers, spaces and . - _ '
  if char_length(v_name) < 2 or char_length(v_name) > p_max then return false; end if;
  if v_name !~ '^[[:alnum:] .''_-]+$' then return false; end if;
  -- no web addresses
  v_plain := lower(v_name);
  if v_plain ~ '(https?|www)' or v_plain ~ '[a-z0-9]\s*\.\s*(com|net|org|io|co|gg|tv|xyz|ly|me|app)\y' then
    return false;
  end if;

  v_plain  := translate(v_plain, '01345789', 'oieastbg');
  v_joined := regexp_replace(v_plain, '[^a-z]', '', 'g');
  for w in select word, match from blocked_words loop
    -- every letter may repeat, so "fuuuck" still matches "fuck"
    v_pat := regexp_replace(w.word, '(.)', '\1+', 'g');
    if w.match = 'part' then
      if v_joined ~ v_pat then return false; end if;
    else
      -- whole words only, also with a plural ending (ass, asses, tits…)
      if v_plain ~ ('(^|[^a-z])' || v_pat || '(e?s|z)?([^a-z]|$)') then return false; end if;
    end if;
  end loop;
  return true;
end;
$$;

-- Lets the game check a name before saving it, so it can say so right away.
create or replace function public.check_name(p_name text)
returns boolean
language sql stable security definer
set search_path = public
as $$ select name_allowed(p_name, 20); $$;

-- ── Scores ────────────────────────────────────────────────────────────────────
-- Save a finished game. Keeps each player's best score, updates their name,
-- and returns their place on the leaderboard (1 = top).
create or replace function public.submit_score(p_player uuid, p_name text, p_score integer, p_tile integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := tidy_name(p_name);
  v_best integer;
begin
  if p_player is null or p_score is null or p_score < 0 or p_score > 4000000
     or p_tile is null or p_tile < 2 or p_tile > 131072 or (p_tile & (p_tile - 1)) <> 0 then
    raise exception 'That score doesn''t look right';
  end if;
  if not name_allowed(v_name, 20) then
    raise exception 'name_not_allowed';
  end if;

  -- A new name gets a fresh start, so someone reported unfairly can fix it
  delete from reports where target = (select public_id from scores where player_id = p_player and name <> v_name);

  insert into scores (player_id, name, score, top_tile)
  values (p_player, v_name, p_score, p_tile)
  on conflict (player_id) do update set
    hidden     = scores.hidden and scores.name = excluded.name,
    name       = excluded.name,
    score      = greatest(scores.score, excluded.score),
    top_tile   = greatest(scores.top_tile, excluded.top_tile),
    updated_at = case when excluded.score > scores.score then now() else scores.updated_at end;

  select score into v_best from scores where player_id = p_player;
  return (select count(*) + 1 from scores where score > v_best);
end;
$$;

-- The top scores, for everyone (p_code null) or for one group the player is in.
-- Reported names show as "Picnic Player". "held" tells a player that their own
-- name is waiting for review.
drop function if exists public.leaderboard(uuid, text, integer);
create or replace function public.leaderboard(p_player uuid, p_code text default null, p_limit integer default 15)
returns table (id uuid, name text, score integer, me boolean, held boolean)
language sql stable security definer
set search_path = public
as $$
  select s.public_id,
         case when s.hidden then 'Picnic Player' else s.name end,
         s.score,
         s.player_id = p_player,
         s.hidden and s.player_id = p_player
  from scores s
  where p_code is null
     or s.player_id in (
       select m.player_id from group_members m join groups g on g.id = m.group_id
       where g.code = upper(p_code)
         and exists (select 1 from group_members me where me.group_id = g.id and me.player_id = p_player))
  order by s.score desc, s.updated_at asc
  limit least(greatest(coalesce(p_limit, 15), 1), 50);
$$;

-- "Report name". Two different players reporting the same name hides it.
create or replace function public.report_name(p_player uuid, p_target uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if p_player is null or p_target is null
     or exists (select 1 from scores where public_id = p_target and player_id = p_player) then
    return;   -- can't report yourself
  end if;
  insert into reports (reporter, target) values (p_player, p_target) on conflict do nothing;
  if (select count(*) from reports where target = p_target) >= 2 then
    update scores set hidden = true where public_id = p_target;
  end if;
end;
$$;

-- Remove a player from the leaderboard ("Remove me" in the game): their score,
-- their group memberships and their reports. Only the phone that posted the
-- score knows its private player id, so players can only remove themselves.
create or replace function public.remove_score(p_player uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from reports where reporter = p_player
    or target in (select public_id from scores where player_id = p_player);
  delete from group_members where player_id = p_player;
  update groups set created_by = null where created_by = p_player;
  delete from scores where player_id = p_player;
$$;

-- ── Groups ────────────────────────────────────────────────────────────────────
-- Start a group. Returns its code and name. The player who starts it joins it.
create or replace function public.create_group(p_player uuid, p_name text)
returns table (code text, name text)
language plpgsql security definer
set search_path = public
as $$
declare
  v_name  text := tidy_name(p_name);
  v_fruit text[] := array['PLUM','PEAR','KIWI','LIME','FIG','MANGO','PEACH','BERRY','MELON','APPLE','GRAPE','LEMON','CHERRY','GUAVA'];
  v_code  text;
  v_id    uuid;
begin
  if p_player is null then raise exception 'That doesn''t look right'; end if;
  if not name_allowed(v_name, 24) then raise exception 'name_not_allowed'; end if;
  if (select count(*) from groups g where g.created_by = p_player) >= 10 then
    raise exception 'too_many_groups';
  end if;
  if (select count(*) from group_members m where m.player_id = p_player) >= 20 then
    raise exception 'too_many_groups';
  end if;
  loop
    v_code := v_fruit[1 + floor(random() * array_length(v_fruit, 1))::int] || '-' || (1000 + floor(random() * 9000))::int;
    begin
      insert into groups (code, name, created_by) values (v_code, v_name, p_player) returning id into v_id;
      exit;
    exception when unique_violation then
      -- that code is taken, try another
    end;
  end loop;
  insert into group_members (group_id, player_id) values (v_id, p_player);
  return query select v_code, v_name;
end;
$$;

-- Look up a group by its code (to show its name before joining).
-- Codes can be typed any way: "plum 4827", "PLUM4827" and "PLUM-4827" all work.
create or replace function public.find_group(p_code text)
returns table (code text, name text, members integer)
language sql stable security definer
set search_path = public
as $$
  select g.code, g.name, (select count(*)::int from group_members m where m.group_id = g.id)
  from groups g
  where replace(g.code, '-', '') = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create or replace function public.join_group(p_player uuid, p_code text)
returns table (code text, name text)
language plpgsql security definer
set search_path = public
as $$
declare
  v_group groups;
begin
  select * into v_group from groups g
  where replace(g.code, '-', '') = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_group.id is null or p_player is null then raise exception 'group_not_found'; end if;
  if not exists (select 1 from group_members m where m.group_id = v_group.id and m.player_id = p_player)
     and (select count(*) from group_members m where m.player_id = p_player) >= 20 then
    raise exception 'too_many_groups';
  end if;
  insert into group_members (group_id, player_id) values (v_group.id, p_player) on conflict do nothing;
  return query select v_group.code, v_group.name;
end;
$$;

create or replace function public.leave_group(p_player uuid, p_code text)
returns void
language sql security definer
set search_path = public
as $$
  delete from group_members m using groups g
  where m.group_id = g.id and m.player_id = p_player and g.code = upper(p_code);
  -- a group nobody is in any more goes away
  delete from groups g where g.code = upper(p_code)
    and not exists (select 1 from group_members m where m.group_id = g.id);
$$;

create or replace function public.my_groups(p_player uuid)
returns table (code text, name text)
language sql stable security definer
set search_path = public
as $$
  select g.code, g.name from groups g join group_members m on m.group_id = g.id
  where m.player_id = p_player
  order by m.joined_at;
$$;

-- ── Who can call what ─────────────────────────────────────────────────────────
-- Only the functions the game uses are open to it.
do $$
declare f text;
begin
  foreach f in array array[
    'tidy_name(text)', 'name_allowed(text, integer)',
    'check_name(text)', 'submit_score(uuid, text, integer, integer)', 'leaderboard(uuid, text, integer)',
    'report_name(uuid, uuid)', 'remove_score(uuid)', 'create_group(uuid, text)', 'find_group(text)',
    'join_group(uuid, text)', 'leave_group(uuid, text)', 'my_groups(uuid)']
  loop
    execute format('revoke all on function public.%s from public', f);
  end loop;
  foreach f in array array[
    'check_name(text)', 'submit_score(uuid, text, integer, integer)', 'leaderboard(uuid, text, integer)',
    'report_name(uuid, uuid)', 'remove_score(uuid)', 'create_group(uuid, text)', 'find_group(text)',
    'join_group(uuid, text)', 'leave_group(uuid, text)', 'my_groups(uuid)']
  loop
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end;
$$;

-- Names already on the board that the new rules don't allow show as
-- "Picnic Player" until you review them (Table Editor → scores → hidden).
update public.scores set hidden = true where not hidden and not public.name_allowed(name, 20);
