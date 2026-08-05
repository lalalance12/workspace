-- Workspace: teams, profiles, statuses, quick picks, desks.

-- Eight characters from an alphabet with no 0/O/1/I/L, so a code read aloud or
-- copied off a screen doesn't get mistyped.
create or replace function public.generate_join_code()
returns text
language sql
volatile
as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1),
    ''
  )
  from generate_series(1, 8);
$$;

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------
-- Nudge policy lives here because /settings/team is where the head edits it.
-- The peer rate limits are policy columns rather than constants so that screen
-- has something to edit; send_peer_nudge() still enforces them, and the
-- defaults are the numbers from the spec (1/hour per recipient, 5/hour total).
create table public.teams (
  id                          uuid primary key default gen_random_uuid(),
  name                        text        not null check (length(trim(name)) between 1 and 80),

  -- How a second person gets onto the team: the head shares this, they enter
  -- it in /settings/me. Anyone holding the code can join, so it is rotatable.
  join_code                   text        not null unique default public.generate_join_code(),

  -- A status older than this is considered stale and eligible for a system
  -- nudge. Default 2h matches the SQL scheduler test.
  stale_after_minutes         integer     not null default 120 check (stale_after_minutes between 15 and 1440),

  -- The no-double-nudge guard: how long after a system nudge before the same
  -- person may be nudged by the scheduler again.
  renudge_after_minutes       integer     not null default 120 check (renudge_after_minutes between 15 and 1440),

  system_nudges_enabled       boolean     not null default true,
  peer_nudges_per_recipient_per_hour integer not null default 1 check (peer_nudges_per_recipient_per_hour between 0 and 20),
  peer_nudges_per_hour        integer     not null default 5 check (peer_nudges_per_hour between 0 and 100),

  created_at                  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  team_id               uuid        references public.teams (id) on delete set null,
  role                  public.team_role not null default 'member',

  display_name          text        not null check (length(trim(display_name)) between 1 and 60),
  avatar_url            text,

  -- Where a peer nudge sends you: the Slack/Discord/etc. DM link. Workspace
  -- never carries the conversation itself, it only points at it.
  message_link          text        check (message_link is null or message_link ~* '^https?://'),

  -- /settings/me: nudge preferences and pause.
  peer_nudges_enabled   boolean     not null default true,
  system_nudges_enabled boolean     not null default true,
  nudges_paused_until   timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index profiles_team_id_idx on public.profiles (team_id);

-- ---------------------------------------------------------------------------
-- status_updates
-- ---------------------------------------------------------------------------
-- Append-only history. The current status for a person is the single row with
-- ended_at is null; set_status() closes the previous row as it inserts.
-- /timeline replays this table for the day.
--
-- There is deliberately no insert/update policy on this table. Every write
-- goes through set_status(), which is security definer.
create table public.status_updates (
  id          uuid        primary key default gen_random_uuid(),
  profile_id  uuid        not null references public.profiles (id) on delete cascade,
  -- Denormalised so RLS can check team membership without joining profiles.
  team_id     uuid        not null references public.teams (id) on delete cascade,

  state       public.status_state not null,
  -- The handwritten line on the sticky note. Rendered in Architects Daughter.
  note        text        check (note is null or length(note) <= 140),
  -- Optional ticket reference, rendered in mono.
  ticket_ref  text        check (ticket_ref is null or length(ticket_ref) <= 32),

  started_at  timestamptz not null default now(),
  ended_at    timestamptz check (ended_at is null or ended_at >= started_at),
  created_at  timestamptz not null default now()
);

-- Exactly one open status per person. This is what makes "the current status"
-- a well-defined thing rather than a max(created_at) race.
create unique index status_updates_one_open_per_profile
  on public.status_updates (profile_id)
  where ended_at is null;

create index status_updates_team_started_idx on public.status_updates (team_id, started_at desc);
create index status_updates_profile_started_idx on public.status_updates (profile_id, started_at desc);

-- ---------------------------------------------------------------------------
-- quick_picks
-- ---------------------------------------------------------------------------
-- set_status() records what you posted so /me can offer it back as a one-tap
-- option next time. Ordered by last_used_at.
create table public.quick_picks (
  id           uuid        primary key default gen_random_uuid(),
  profile_id   uuid        not null references public.profiles (id) on delete cascade,
  state        public.status_state not null,
  note         text,
  ticket_ref   text,
  use_count    integer     not null default 1,
  last_used_at timestamptz not null default now()
);

create unique index quick_picks_unique_per_profile
  on public.quick_picks (profile_id, state, coalesce(note, ''), coalesce(ticket_ref, ''));

create index quick_picks_recent_idx on public.quick_picks (profile_id, last_used_at desc);

-- ---------------------------------------------------------------------------
-- desks
-- ---------------------------------------------------------------------------
-- The /office floor plan. Coordinates are on an abstract grid, not pixels, so
-- the view can scale. The head arranges these in /settings/team.
create table public.desks (
  id         uuid        primary key default gen_random_uuid(),
  team_id    uuid        not null references public.teams (id) on delete cascade,
  profile_id uuid        unique references public.profiles (id) on delete set null,

  -- Mono dimension label on the drawing, e.g. "D-04".
  label      text        not null check (length(trim(label)) between 1 and 12),
  -- Room grouping, drawn as a --blueprint outline.
  room       text        check (room is null or length(room) <= 40),

  grid_x     integer     not null default 0 check (grid_x between 0 and 200),
  grid_y     integer     not null default 0 check (grid_y between 0 and 200),
  grid_w     integer     not null default 4 check (grid_w between 1 and 50),
  grid_h     integer     not null default 3 check (grid_h between 1 and 50),

  created_at timestamptz not null default now()
);

create index desks_team_idx on public.desks (team_id);

-- ---------------------------------------------------------------------------
-- New signup -> profile row
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(coalesce(new.email, 'someone'), '@', 1)
    ),
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
