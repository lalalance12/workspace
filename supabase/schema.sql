-- ===========================================================================
-- Workspace — full schema, in one script.
--
-- Generated from supabase/migrations/ in filename order. Do not edit directly;
-- edit a migration and re-run: pnpm db:bundle
--
-- Safe to run on an empty project. Re-running is NOT generally safe: tables are
-- created with plain "create table", so a second run errors on the first one
-- that already exists. That is deliberate — silently re-running DDL over a live
-- database is worse than a loud failure.
--
-- After this completes, enable pg_cron (Database -> Extensions) if you want the
-- staleness scheduler; the scheduler migration skips scheduling with a notice
-- when the extension is absent rather than failing the whole script.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 20260805090000_extensions_and_types.sql
-- ---------------------------------------------------------------------------

-- Workspace: extensions and enumerated types.
--
-- This migration set is the ground truth for the application. Nothing in the
-- app may reference a table or column that is not defined here.

create extension if not exists pgcrypto with schema extensions;

-- What a person is doing. Drives the note colour on /board and the bubble on
-- /office. `blocked` is the only state rendered in --signal.
create type public.status_state as enum (
  'working',
  'reviewing',
  'blocked',
  'in_meeting',
  'break',
  'done_for_day',
  'off'
);

-- Peer and system nudges share the nudges table but are otherwise different
-- features. See the comment on public.nudges.
create type public.nudge_kind as enum ('peer', 'system');

-- Peer nudges end at 'acknowledged' (one tap, no status required).
-- System nudges end at 'resolved' (a new status arrived).
create type public.nudge_state as enum ('open', 'acknowledged', 'resolved');

create type public.team_role as enum ('head', 'member');

-- Every notification row is written by a trigger. These are the only four
-- events that produce one.
create type public.notification_kind as enum (
  'peer_nudge',        -- someone nudged you
  'system_nudge',      -- your status went stale
  'nudge_acknowledged',-- the person you nudged tapped through
  'teammate_blocked'   -- someone on your team posted a blocked status (head only)
);

-- ---------------------------------------------------------------------------
-- 20260805090100_core_tables.sql
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 20260805090200_nudges_and_notifications.sql
-- ---------------------------------------------------------------------------

-- Workspace: nudges and notifications.

-- ---------------------------------------------------------------------------
-- nudges
-- ---------------------------------------------------------------------------
-- Peer and system nudges share this table and are otherwise different
-- features. Do not collapse them into one UI.
--
--                  peer                          system
--   sent by        a teammate, from the board    pg_cron, on staleness
--   asks for       attention -> go to your DMs   a status update
--   resolves via   acknowledge_nudge()           respond_to_nudge()/set_status()
--   can stack      yes                           no, one open at a time
--   visibility     whole team                    recipient and head only
--
-- A peer nudge is a signpost, not a message: at most an 80-char note plus a
-- link out to wherever the team actually talks. It must never grow a reply
-- field.
create table public.nudges (
  id                   uuid        primary key default gen_random_uuid(),
  team_id              uuid        not null references public.teams (id) on delete cascade,
  kind                 public.nudge_kind not null,

  recipient_id         uuid        not null references public.profiles (id) on delete cascade,
  -- Always set for peer nudges, always null for system nudges.
  sender_id            uuid        references public.profiles (id) on delete cascade,

  -- Peer nudge payload. 80 chars, hard limit, on purpose.
  note                 text        check (note is null or length(note) <= 80),
  link                 text        check (link is null or link ~* '^https?://'),

  -- System nudge payload: a real question built from the person's actual
  -- current status, e.g. "Still on the checkout bug?"
  question             text        check (question is null or length(question) <= 160),

  -- The status this nudge is about. For system nudges, the stale one.
  context_status_id    uuid        references public.status_updates (id) on delete set null,

  state                public.nudge_state not null default 'open',
  created_at           timestamptz not null default now(),
  resolved_at          timestamptz,
  -- For system nudges: the status update that answered it.
  resolved_by_status_id uuid       references public.status_updates (id) on delete set null,

  -- A peer nudge has a sender and a note; a system nudge has neither and asks
  -- a question instead.
  constraint nudges_peer_shape check (
    (kind = 'peer'   and sender_id is not null and question is null)
    or
    (kind = 'system' and sender_id is null     and note is null and link is null)
  ),
  -- Peer nudges end at 'acknowledged'; system nudges end at 'resolved'.
  constraint nudges_terminal_state check (
    state = 'open'
    or (kind = 'peer'   and state = 'acknowledged')
    or (kind = 'system' and state = 'resolved')
  ),
  constraint nudges_resolved_at_set check (
    (state = 'open') = (resolved_at is null)
  ),
  constraint nudges_no_self_nudge check (sender_id is null or sender_id <> recipient_id)
);

-- One open system nudge per person, ever. Peer nudges deliberately have no
-- such index: three people needing you means three nudges.
create unique index nudges_one_open_system_per_recipient
  on public.nudges (recipient_id)
  where kind = 'system' and state = 'open';

create index nudges_recipient_created_idx on public.nudges (recipient_id, created_at desc);
create index nudges_team_created_idx      on public.nudges (team_id, created_at desc);
-- Supports the per-hour rate-limit counts in send_peer_nudge().
create index nudges_sender_created_idx    on public.nudges (sender_id, created_at desc) where kind = 'peer';
-- Supports the scheduler's no-double-nudge guard.
create index nudges_system_recipient_created_idx
  on public.nudges (recipient_id, created_at desc) where kind = 'system';

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
-- Every row here is written by a database trigger. There is no insert policy
-- on this table and there must never be one. Client code reads these and marks
-- them read; it never creates them.
--
-- This is also the whole delivery mechanism. No email, no SMS, no push
-- provider: Supabase Realtime plus this table is the product.
create table public.notifications (
  id         uuid        primary key default gen_random_uuid(),
  profile_id uuid        not null references public.profiles (id) on delete cascade,
  kind       public.notification_kind not null,

  nudge_id   uuid        references public.nudges (id) on delete cascade,
  -- Who caused this. Null for scheduler-generated notifications.
  actor_id   uuid        references public.profiles (id) on delete set null,

  title      text        not null check (length(title) <= 120),
  body       text        check (body is null or length(body) <= 240),
  -- Where the bell popover sends you when tapped.
  href       text,

  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_inbox_idx
  on public.notifications (profile_id, created_at desc);

create index notifications_unread_idx
  on public.notifications (profile_id)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- 20260805090300_rls.sql
-- ---------------------------------------------------------------------------

-- Workspace: row level security.
--
-- Every app query runs through the publishable (anon) key as the signed-in
-- user. Nothing bypasses RLS. If a query comes back empty, the fix is a policy
-- here, never a privileged key.
--
-- Note which tables have no write policies at all: status_updates, quick_picks
-- and nudges are written only by security-definer RPCs, and notifications only
-- by triggers. That is not a convention, it is the enforcement.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- These are security definer so that a policy on profiles can ask about
-- profiles without recursing into its own policy.

create or replace function public.current_team_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select team_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_team_head()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select role = 'head' from public.profiles where id = auth.uid()), false);
$$;

grant execute on function public.current_team_id() to authenticated;
grant execute on function public.is_team_head()   to authenticated;

-- Role and team membership are not self-service. They change only inside an
-- RPC that sets this flag, never through a plain update on your own row.
create or replace function public.guard_privileged_profile_columns()
returns trigger
language plpgsql
as $$
begin
  if (new.role is distinct from old.role or new.team_id is distinct from old.team_id)
     and coalesce(current_setting('workspace.privileged_profile_write', true), 'off') <> 'on'
  then
    raise exception 'role and team_id are managed by RPC, not by direct update'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row execute function public.guard_privileged_profile_columns();

-- ---------------------------------------------------------------------------
alter table public.teams          enable row level security;
alter table public.profiles       enable row level security;
alter table public.status_updates enable row level security;
alter table public.quick_picks    enable row level security;
alter table public.desks          enable row level security;
alter table public.nudges         enable row level security;
alter table public.notifications  enable row level security;

-- teams ---------------------------------------------------------------------
create policy "read own team"
  on public.teams for select to authenticated
  using (id = public.current_team_id());

-- The head edits nudge policy in /settings/team.
create policy "head updates own team"
  on public.teams for update to authenticated
  using (id = public.current_team_id() and public.is_team_head())
  with check (id = public.current_team_id() and public.is_team_head());

-- profiles ------------------------------------------------------------------
create policy "read teammates"
  on public.profiles for select to authenticated
  using (id = auth.uid() or team_id = public.current_team_id());

-- /settings/me. The trigger above still blocks role and team_id.
create policy "update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- status_updates ------------------------------------------------------------
-- Read-only to the app. Writes go through set_status().
create policy "read team statuses"
  on public.status_updates for select to authenticated
  using (team_id = public.current_team_id());

-- quick_picks ---------------------------------------------------------------
create policy "read own quick picks"
  on public.quick_picks for select to authenticated
  using (profile_id = auth.uid());

create policy "delete own quick picks"
  on public.quick_picks for delete to authenticated
  using (profile_id = auth.uid());

-- desks ---------------------------------------------------------------------
create policy "read team desks"
  on public.desks for select to authenticated
  using (team_id = public.current_team_id());

create policy "head manages desks"
  on public.desks for all to authenticated
  using (team_id = public.current_team_id() and public.is_team_head())
  with check (team_id = public.current_team_id() and public.is_team_head());

-- nudges --------------------------------------------------------------------
-- Peer nudges are visible team-wide on purpose: nudging in the open keeps it
-- social. Covert nudging turns the feature into a management cudgel.
--
-- System nudges are the opposite: private to the recipient and the head, so a
-- stale status is never a public scolding.
create policy "read peer nudges team-wide"
  on public.nudges for select to authenticated
  using (kind = 'peer' and team_id = public.current_team_id());

create policy "read own system nudges"
  on public.nudges for select to authenticated
  using (
    kind = 'system'
    and (
      recipient_id = auth.uid()
      or (team_id = public.current_team_id() and public.is_team_head())
    )
  );

-- notifications -------------------------------------------------------------
create policy "read own notifications"
  on public.notifications for select to authenticated
  using (profile_id = auth.uid());

-- Marking read is the only write the client may perform.
create policy "mark own notifications read"
  on public.notifications for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- There is deliberately no insert policy on public.notifications.
-- Rows are written by trigger only. Do not add one.

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------
-- A policy filters rows; it does not grant access to the table. Without these
-- GRANTs every query fails with "permission denied for table ...", policies or
-- no policies.
--
-- These are deliberately narrower than the policies above. Note what is NOT
-- granted: no INSERT anywhere, and no UPDATE on status_updates, quick_picks or
-- nudges. Those are written only by security-definer RPCs and triggers, so the
-- privilege layer and the policy layer say the same thing. If someone later
-- adds an INSERT policy by mistake, this still stops it.

grant usage on schema public to authenticated;

grant select                 on public.teams          to authenticated;
grant update                 on public.teams          to authenticated;  -- head only, by policy
grant select, update         on public.profiles       to authenticated;
grant select                 on public.status_updates to authenticated;
grant select, delete         on public.quick_picks    to authenticated;
grant select                 on public.nudges         to authenticated;
grant select, update         on public.notifications  to authenticated;
grant select, insert, update, delete on public.desks  to authenticated;  -- head only, by policy

-- anon can reach the auth endpoints and nothing else. Signing in is not a
-- table read.
revoke all on public.teams, public.profiles, public.status_updates,
              public.quick_picks, public.nudges, public.notifications,
              public.desks
  from anon;

-- ---------------------------------------------------------------------------
-- 20260805090400_rpcs.sql
-- ---------------------------------------------------------------------------

-- Workspace: the write API.
--
-- These functions are the only way the app changes data. They are security
-- definer, so the tables they touch need no insert/update policies at all.
--
-- Errors raise distinct SQLSTATEs so the client can show a toast that says
-- what failed and what to do, instead of a bare "Something went wrong".
--
--   WS001  you are not on a team yet
--   WS002  peer nudge: already nudged this person this hour
--   WS003  peer nudge: hourly limit reached
--   WS004  peer nudge: recipient has nudges paused or turned off
--   WS005  that person is not on your team
--   WS006  nudge not found, already handled, or not yours
--   WS007  a peer nudge carries at most 80 characters
--   WS008  you are already on a team
--   WS009  that join code doesn't match a team

-- ---------------------------------------------------------------------------
-- create_team
-- ---------------------------------------------------------------------------
-- Onboarding: a fresh signup has a profile but no team. Creating one makes you
-- its head.
create or replace function public.create_team(p_name text)
returns public.teams
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team public.teams;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = 'WS001';
  end if;

  insert into public.teams (name) values (trim(p_name)) returning * into v_team;

  perform set_config('workspace.privileged_profile_write', 'on', true);
  update public.profiles
     set team_id = v_team.id,
         role    = 'head'
   where id = auth.uid();
  perform set_config('workspace.privileged_profile_write', 'off', true);

  return v_team;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_team
-- ---------------------------------------------------------------------------
-- The other half of onboarding. Security definer because the caller has no
-- team yet, so the teams select policy cannot see the row they are joining.
create or replace function public.join_team(p_code text)
returns public.teams
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team    public.teams;
  v_current uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = 'WS001';
  end if;

  select team_id into v_current from public.profiles where id = auth.uid();
  if v_current is not null then
    raise exception 'you are already on a team' using errcode = 'WS008';
  end if;

  select * into v_team
    from public.teams
   where join_code = upper(trim(p_code));

  if v_team.id is null then
    raise exception 'that join code does not match a team' using errcode = 'WS009';
  end if;

  perform set_config('workspace.privileged_profile_write', 'on', true);
  update public.profiles
     set team_id = v_team.id,
         role    = 'member'
   where id = auth.uid();
  perform set_config('workspace.privileged_profile_write', 'off', true);

  return v_team;
end;
$$;

-- Anyone holding the code can join, so the head needs a way to invalidate it.
create or replace function public.rotate_join_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
begin
  if not public.is_team_head() then
    raise exception 'only the team head can rotate the join code' using errcode = 'WS005';
  end if;

  update public.teams
     set join_code = public.generate_join_code()
   where id = public.current_team_id()
  returning join_code into v_code;

  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_status
-- ---------------------------------------------------------------------------
-- The most important write in the product. In one transaction it closes the
-- previous status row, inserts the new one, resolves any open system nudge,
-- and records the quick pick.
create or replace function public.set_status(
  p_state      public.status_state,
  p_note       text default null,
  p_ticket_ref text default null
)
returns public.status_updates
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles;
  v_status  public.status_updates;
  v_note    text := nullif(trim(coalesce(p_note, '')), '');
  v_ticket  text := nullif(trim(coalesce(p_ticket_ref, '')), '');
  v_now     timestamptz := now();
begin
  select * into v_profile from public.profiles where id = auth.uid();

  if v_profile.id is null or v_profile.team_id is null then
    raise exception 'you are not on a team yet' using errcode = 'WS001';
  end if;

  -- Close the currently open row, if any.
  update public.status_updates
     set ended_at = v_now
   where profile_id = v_profile.id
     and ended_at is null;

  insert into public.status_updates (profile_id, team_id, state, note, ticket_ref, started_at)
  values (v_profile.id, v_profile.team_id, p_state, v_note, v_ticket, v_now)
  returning * into v_status;

  -- Any status update answers an open system nudge. There is at most one.
  update public.nudges
     set state                 = 'resolved',
         resolved_at           = v_now,
         resolved_by_status_id = v_status.id
   where recipient_id = v_profile.id
     and kind  = 'system'
     and state = 'open';

  -- Remember it so /me can offer it back as one tap next time.
  insert into public.quick_picks (profile_id, state, note, ticket_ref, use_count, last_used_at)
  values (v_profile.id, p_state, v_note, v_ticket, 1, v_now)
  on conflict (profile_id, state, coalesce(note, ''), coalesce(ticket_ref, ''))
  do update set use_count    = quick_picks.use_count + 1,
                last_used_at = v_now;

  return v_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- send_peer_nudge
-- ---------------------------------------------------------------------------
-- A signpost, not a message. At most 80 characters and a link out to wherever
-- the team actually talks. Rate limits are enforced here, by policy value.
create or replace function public.send_peer_nudge(
  p_recipient_id uuid,
  p_note         text default null,
  p_link         text default null
)
returns public.nudges
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sender    public.profiles;
  v_recipient public.profiles;
  v_team      public.teams;
  v_nudge     public.nudges;
  v_note      text := nullif(trim(coalesce(p_note, '')), '');
  v_link      text := nullif(trim(coalesce(p_link, '')), '');
  v_since     timestamptz := now() - interval '1 hour';
  v_to_recipient integer;
  v_total     integer;
begin
  select * into v_sender from public.profiles where id = auth.uid();
  if v_sender.id is null or v_sender.team_id is null then
    raise exception 'you are not on a team yet' using errcode = 'WS001';
  end if;

  if length(coalesce(v_note, '')) > 80 then
    raise exception 'a nudge carries at most 80 characters' using errcode = 'WS007';
  end if;

  select * into v_recipient from public.profiles where id = p_recipient_id;
  if v_recipient.id is null or v_recipient.team_id is distinct from v_sender.team_id then
    raise exception 'that person is not on your team' using errcode = 'WS005';
  end if;

  if v_recipient.id = v_sender.id then
    raise exception 'you cannot nudge yourself' using errcode = 'WS005';
  end if;

  if not v_recipient.peer_nudges_enabled
     or (v_recipient.nudges_paused_until is not null and v_recipient.nudges_paused_until > now())
  then
    raise exception 'that person has nudges paused' using errcode = 'WS004';
  end if;

  select * into v_team from public.teams where id = v_sender.team_id;

  select count(*) into v_to_recipient
    from public.nudges
   where kind = 'peer' and sender_id = v_sender.id
     and recipient_id = p_recipient_id and created_at > v_since;

  if v_to_recipient >= v_team.peer_nudges_per_recipient_per_hour then
    raise exception 'you already nudged this person in the last hour' using errcode = 'WS002';
  end if;

  select count(*) into v_total
    from public.nudges
   where kind = 'peer' and sender_id = v_sender.id and created_at > v_since;

  if v_total >= v_team.peer_nudges_per_hour then
    raise exception 'you have reached your nudges for this hour' using errcode = 'WS003';
  end if;

  insert into public.nudges (team_id, kind, recipient_id, sender_id, note, link, context_status_id)
  values (
    v_sender.team_id, 'peer', p_recipient_id, v_sender.id, v_note, v_link,
    (select id from public.status_updates
      where profile_id = p_recipient_id and ended_at is null limit 1)
  )
  returning * into v_nudge;

  return v_nudge;
end;
$$;

-- ---------------------------------------------------------------------------
-- acknowledge_nudge
-- ---------------------------------------------------------------------------
-- One tap. No status required. This is the whole interaction: it says "seen,
-- heading to Slack now" and nothing more.
create or replace function public.acknowledge_nudge(p_nudge_id uuid)
returns public.nudges
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nudge public.nudges;
begin
  update public.nudges
     set state = 'acknowledged', resolved_at = now()
   where id = p_nudge_id
     and recipient_id = auth.uid()
     and kind  = 'peer'
     and state = 'open'
  returning * into v_nudge;

  if v_nudge.id is null then
    raise exception 'that nudge is not open, or is not yours' using errcode = 'WS006';
  end if;

  return v_nudge;
end;
$$;

-- ---------------------------------------------------------------------------
-- respond_to_nudge
-- ---------------------------------------------------------------------------
-- Answering a system nudge is just posting a status, so this validates the
-- nudge and delegates. set_status() does the resolving.
create or replace function public.respond_to_nudge(
  p_nudge_id   uuid,
  p_state      public.status_state,
  p_note       text default null,
  p_ticket_ref text default null
)
returns public.status_updates
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_exists boolean;
begin
  select true into v_exists
    from public.nudges
   where id = p_nudge_id
     and recipient_id = auth.uid()
     and kind  = 'system'
     and state = 'open';

  if not coalesce(v_exists, false) then
    raise exception 'that nudge is not open, or is not yours' using errcode = 'WS006';
  end if;

  return public.set_status(p_state, p_note, p_ticket_ref);
end;
$$;

-- ---------------------------------------------------------------------------
revoke execute on function public.create_team(text)                                             from public, anon;
revoke execute on function public.join_team(text)                                               from public, anon;
revoke execute on function public.rotate_join_code()                                            from public, anon;
revoke execute on function public.set_status(public.status_state, text, text)                   from public, anon;
revoke execute on function public.send_peer_nudge(uuid, text, text)                             from public, anon;
revoke execute on function public.acknowledge_nudge(uuid)                                       from public, anon;
revoke execute on function public.respond_to_nudge(uuid, public.status_state, text, text)       from public, anon;

grant execute on function public.create_team(text)                                              to authenticated;
grant execute on function public.join_team(text)                                                to authenticated;
grant execute on function public.rotate_join_code()                                             to authenticated;
grant execute on function public.set_status(public.status_state, text, text)                    to authenticated;
grant execute on function public.send_peer_nudge(uuid, text, text)                              to authenticated;
grant execute on function public.acknowledge_nudge(uuid)                                        to authenticated;
grant execute on function public.respond_to_nudge(uuid, public.status_state, text, text)        to authenticated;

-- ---------------------------------------------------------------------------
-- 20260805090500_notification_triggers.sql
-- ---------------------------------------------------------------------------

-- Workspace: notification triggers.
--
-- Every notification row in the product is written here. The notifications
-- table has no insert policy, so this is not merely the preferred path, it is
-- the only one.
--
-- These three events are the entire notification surface. In-app only: no
-- email, no SMS, no push provider. Supabase Realtime plus the notifications
-- table is the delivery mechanism.

create or replace function public.notify_on_nudge_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sender_name text;
  v_link        text;
begin
  if new.kind = 'peer' then
    select display_name, coalesce(new.link, message_link)
      into v_sender_name, v_link
      from public.profiles where id = new.sender_id;

    insert into public.notifications (profile_id, kind, nudge_id, actor_id, title, body, href)
    values (
      new.recipient_id,
      'peer_nudge',
      new.id,
      new.sender_id,
      coalesce(v_sender_name, 'A teammate') || ' nudged you',
      coalesce(new.note, 'Check your messages.'),
      coalesce(v_link, '/board')
    );
  else
    insert into public.notifications (profile_id, kind, nudge_id, actor_id, title, body, href)
    values (
      new.recipient_id,
      'system_nudge',
      new.id,
      null,
      coalesce(new.question, 'Still on this?'),
      'Post an update so the board stays honest.',
      '/me'
    );
  end if;

  return new;
end;
$$;

create trigger nudges_notify_on_insert
  after insert on public.nudges
  for each row execute function public.notify_on_nudge_insert();

-- Acknowledging closes the loop for whoever sent it, so they know to expect
-- the person in their DMs.
create or replace function public.notify_on_nudge_acknowledged()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recipient_name text;
begin
  if new.kind = 'peer'
     and new.state = 'acknowledged'
     and old.state is distinct from new.state
     and new.sender_id is not null
  then
    select display_name into v_recipient_name
      from public.profiles where id = new.recipient_id;

    insert into public.notifications (profile_id, kind, nudge_id, actor_id, title, body, href)
    values (
      new.sender_id,
      'nudge_acknowledged',
      new.id,
      new.recipient_id,
      coalesce(v_recipient_name, 'They') || ' saw your nudge',
      null,
      '/board'
    );
  end if;

  return new;
end;
$$;

create trigger nudges_notify_on_acknowledged
  after update on public.nudges
  for each row execute function public.notify_on_nudge_acknowledged();

-- ---------------------------------------------------------------------------
-- A teammate going blocked tells the head.
-- ---------------------------------------------------------------------------
-- Blocked is already the loudest thing on the board, so this fires only on the
-- transition INTO blocked. Editing the note on an existing blocker does not
-- re-alert, and the head is never told about their own.
create or replace function public.notify_head_on_blocked()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_head_id uuid;
  v_prev    public.status_state;
  v_name    text;
begin
  if new.state <> 'blocked' then
    return new;
  end if;

  select state into v_prev
    from public.status_updates
   where profile_id = new.profile_id and id <> new.id
   order by started_at desc
   limit 1;

  if v_prev = 'blocked' then
    return new;
  end if;

  select id into v_head_id
    from public.profiles
   where team_id = new.team_id and role = 'head'
   limit 1;

  if v_head_id is null or v_head_id = new.profile_id then
    return new;
  end if;

  select display_name into v_name
    from public.profiles where id = new.profile_id;

  insert into public.notifications (profile_id, kind, actor_id, title, body, href)
  values (
    v_head_id,
    'teammate_blocked',
    new.profile_id,
    coalesce(v_name, 'Someone') || ' is blocked',
    new.note,
    '/board'
  );

  return new;
end;
$$;

create trigger status_updates_notify_head_on_blocked
  after insert on public.status_updates
  for each row execute function public.notify_head_on_blocked();

-- The update policy on notifications exists so people can mark them read. It
-- is a row filter, not a column filter, so this pins down which column may
-- actually change. Rewriting the title of a notification you were sent is not
-- a thing the product does.
create or replace function public.guard_notification_columns()
returns trigger
language plpgsql
as $$
begin
  if new.id         is distinct from old.id
     or new.profile_id is distinct from old.profile_id
     or new.kind       is distinct from old.kind
     or new.nudge_id   is distinct from old.nudge_id
     or new.actor_id   is distinct from old.actor_id
     or new.title      is distinct from old.title
     or new.body       is distinct from old.body
     or new.href       is distinct from old.href
     or new.created_at is distinct from old.created_at
  then
    raise exception 'notifications are written by trigger; only read_at may change'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger notifications_guard_columns
  before update on public.notifications
  for each row execute function public.guard_notification_columns();

-- ---------------------------------------------------------------------------
-- 20260805090600_scheduler.sql
-- ---------------------------------------------------------------------------

-- Workspace: the staleness scheduler.

-- A system nudge asks a real question built from the person's actual current
-- status, never a generic "please update your status".
create or replace function public.compose_nudge_question(
  p_state public.status_state,
  p_note  text
)
returns text
language plpgsql
immutable
as $$
declare
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_body text;
begin
  if v_note is null then
    return case p_state
      when 'working'    then 'Still working on the same thing?'
      when 'reviewing'  then 'Still reviewing?'
      when 'blocked'    then 'Still blocked?'
      when 'in_meeting' then 'Still in that meeting?'
      when 'break'      then 'Back from break?'
      else 'Still on this?'
    end;
  end if;

  -- Lowercase the first letter so "Fixing the checkout bug" reads as part of
  -- the sentence rather than starting a new one.
  v_body := lower(left(v_note, 1)) || substr(v_note, 2);

  -- If the note already opens with an activity ("Reviewing the rate limits",
  -- "Waiting on staging creds"), it is its own predicate — prefixing it with
  -- the state verb stutters into "Still reviewing reviewing the rate limits?".
  if split_part(v_body, ' ', 1) like '%ing' then
    return left('Still ' || v_body || '?', 160);
  end if;

  -- Otherwise the note is a noun phrase and needs the state to carry the verb.
  -- A bare "the checkout bug" becomes "Still on the checkout bug?".
  return left(
    case p_state
      when 'reviewing'  then 'Still reviewing '
      when 'blocked'    then 'Still blocked on '
      when 'in_meeting' then 'Still in '
      when 'break'      then 'Back from '
      else 'Still on '
    end || v_body || '?',
    160
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- enqueue_due_nudges
-- ---------------------------------------------------------------------------
-- Run every minute by pg_cron. Returns how many nudges it created.
--
-- Two independent guards keep this from spamming, and they are the part most
-- likely to break:
--
--   1. one open system nudge per person, ever (also enforced by a unique index)
--   2. no new system nudge within renudge_after_minutes of the last one, even
--      if that one has since been resolved
--
-- The SQL test seeds a 2-hour-old status, asserts exactly one row lands, then
-- runs again and asserts zero.
create or replace function public.enqueue_due_nudges()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_created integer;
begin
  with inserted as (
    insert into public.nudges (team_id, kind, recipient_id, question, context_status_id)
    select s.team_id,
           'system',
           s.profile_id,
           public.compose_nudge_question(s.state, s.note),
           s.id
      from public.status_updates s
      join public.profiles p on p.id = s.profile_id
      join public.teams    t on t.id = s.team_id
     where s.ended_at is null
       and t.system_nudges_enabled
       and p.system_nudges_enabled
       and (p.nudges_paused_until is null or p.nudges_paused_until <= now())
       -- Someone who has signed off is not stale, they are done.
       and s.state not in ('done_for_day', 'off')
       -- Inclusive: "stale after 120 minutes" means a status that is exactly
       -- 120 minutes old is stale. Note that now() is transaction-fixed, so a
       -- strict < here would never fire for a status seeded at exactly the
       -- threshold, which is precisely what the scheduler test asserts.
       and s.started_at <= now() - make_interval(mins => t.stale_after_minutes)
       -- Guard 1: no stacking. System nudges are one at a time.
       and not exists (
         select 1 from public.nudges n
          where n.recipient_id = s.profile_id
            and n.kind  = 'system'
            and n.state = 'open'
       )
       -- Guard 2: no re-nudging too soon, resolved or not.
       and not exists (
         select 1 from public.nudges n
          where n.recipient_id = s.profile_id
            and n.kind = 'system'
            and n.created_at > now() - make_interval(mins => t.renudge_after_minutes)
       )
    returning 1
  )
  select count(*) into v_created from inserted;

  return v_created;
end;
$$;

revoke execute on function public.enqueue_due_nudges() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Schedule it.
-- ---------------------------------------------------------------------------
-- Non-fatal if pg_cron is unavailable: on a hosted project the extension may
-- need enabling first (Dashboard -> Database -> Extensions -> pg_cron). The
-- rest of the schema must still apply cleanly without it.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;

    if exists (select 1 from cron.job where jobname = 'enqueue-due-nudges') then
      perform cron.unschedule('enqueue-due-nudges');
    end if;

    perform cron.schedule(
      'enqueue-due-nudges',
      '* * * * *',
      $cron$select public.enqueue_due_nudges();$cron$
    );
  else
    raise notice 'pg_cron unavailable; enqueue_due_nudges() is not scheduled. Enable the extension and re-run this migration.';
  end if;
exception
  when insufficient_privilege then
    raise notice 'pg_cron present but not grantable here; schedule enqueue-due-nudges manually.';
end;
$$;

-- ---------------------------------------------------------------------------
-- 20260805090700_realtime.sql
-- ---------------------------------------------------------------------------

-- Workspace: Realtime publication.
--
-- Postgres Changes carries what people are DOING. Whether they are THERE is
-- Presence, which lives entirely in Realtime and never touches Postgres.
-- There is no heartbeat table here on purpose, and there must never be one.
--
-- Realtime respects RLS per subscriber, so the policies in 20260805090300 are
-- what decide who sees which change. A system nudge does not broadcast to the
-- whole team just because it is in the publication.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

alter publication supabase_realtime add table public.status_updates;
alter publication supabase_realtime add table public.nudges;
alter publication supabase_realtime add table public.notifications;

-- Send the full old row on update/delete so clients can patch their store by
-- profile_id without a refetch.
alter table public.status_updates replica identity full;
alter table public.nudges         replica identity full;

-- ---------------------------------------------------------------------------
-- 20260805090800_backfill_profiles.sql
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Backfill profiles for accounts that predate the trigger.
--
-- public.handle_new_user() fires "after insert on auth.users", so it only ever
-- sees signups that happen once it exists. Anyone who signed in to a project
-- before the migrations were pushed has an auth.users row and no profile, and
-- the app greets them with "you're signed in, but you have no profile" — which
-- is accurate and completely unactionable.
--
-- Runs on every push and is idempotent: on a fresh database there are no users
-- to backfill and this does nothing.
--
-- The column expressions mirror handle_new_user() deliberately. If that
-- function changes how it derives a display name, change it here too.
-- ---------------------------------------------------------------------------

insert into public.profiles (id, display_name, avatar_url)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(u.email, 'someone'), '@', 1)
  ),
  nullif(trim(u.raw_user_meta_data ->> 'avatar_url'), '')
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 20260805090900_status_duration.sql
-- ---------------------------------------------------------------------------

-- Workspace: an optional duration on a status.
--
-- How long the person expects to be on this. Optional — existing statuses have
-- none — and constrained to the four values the /me picker offers, so the
-- database rejects anything the UI could never have sent.

alter table public.status_updates
  add column duration_minutes integer
    check (duration_minutes is null or duration_minutes in (15, 30, 45, 60));

-- set_status gains a fourth argument. Adding a parameter changes the function's
-- signature, so the old three-argument version has to go first: leaving both in
-- place would make a three-argument call (respond_to_nudge still makes one)
-- ambiguous between the two overloads. Postgres does not track function-to-
-- function references as dependencies, so dropping this is safe even though
-- respond_to_nudge calls it — the call re-resolves to the new function.
drop function if exists public.set_status(public.status_state, text, text);

create or replace function public.set_status(
  p_state            public.status_state,
  p_note             text    default null,
  p_ticket_ref       text    default null,
  p_duration_minutes integer default null
)
returns public.status_updates
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles;
  v_status  public.status_updates;
  v_note    text := nullif(trim(coalesce(p_note, '')), '');
  v_ticket  text := nullif(trim(coalesce(p_ticket_ref, '')), '');
  v_now     timestamptz := now();
begin
  select * into v_profile from public.profiles where id = auth.uid();

  if v_profile.id is null or v_profile.team_id is null then
    raise exception 'you are not on a team yet' using errcode = 'WS001';
  end if;

  -- Belt and braces alongside the CHECK: a distinct SQLSTATE so the toast can
  -- say what was wrong rather than surfacing a raw constraint violation.
  if p_duration_minutes is not null and p_duration_minutes not in (15, 30, 45, 60) then
    raise exception 'duration must be 15, 30, 45 or 60 minutes' using errcode = 'WS010';
  end if;

  -- Close the currently open row, if any.
  update public.status_updates
     set ended_at = v_now
   where profile_id = v_profile.id
     and ended_at is null;

  insert into public.status_updates
    (profile_id, team_id, state, note, ticket_ref, duration_minutes, started_at)
  values
    (v_profile.id, v_profile.team_id, p_state, v_note, v_ticket, p_duration_minutes, v_now)
  returning * into v_status;

  -- Any status update answers an open system nudge. There is at most one.
  update public.nudges
     set state                 = 'resolved',
         resolved_at           = v_now,
         resolved_by_status_id = v_status.id
   where recipient_id = v_profile.id
     and kind  = 'system'
     and state = 'open';

  -- Remember it so /me can offer it back as one tap next time. Duration is not
  -- part of a quick pick's identity — it is a per-post choice, not a habit.
  insert into public.quick_picks (profile_id, state, note, ticket_ref, use_count, last_used_at)
  values (v_profile.id, p_state, v_note, v_ticket, 1, v_now)
  on conflict (profile_id, state, coalesce(note, ''), coalesce(ticket_ref, ''))
  do update set use_count    = quick_picks.use_count + 1,
                last_used_at = v_now;

  return v_status;
end;
$$;

revoke execute on function public.set_status(public.status_state, text, text, integer) from public, anon;
grant  execute on function public.set_status(public.status_state, text, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 20260805091000_auto_switch.sql
-- ---------------------------------------------------------------------------

-- Workspace: auto-switch a status when its duration runs out.
--
-- If someone sets a duration AND picks a state to switch to, a pg_cron job
-- flips them to that state once the timer elapses — even if their laptop is
-- asleep. Picking the target is optional: with no target the duration stays
-- purely informational (just the chip) and nothing auto-switches.

-- Where to switch to when the timer runs out. Null means "don't switch"; the
-- duration is then only a hint on the card.
alter table public.status_updates
  add column auto_switch_to public.status_state;

-- Allow a 1-minute duration alongside the usual picks, so the auto-switch job
-- can be exercised without waiting a quarter hour.
alter table public.status_updates
  drop constraint if exists status_updates_duration_minutes_check;
alter table public.status_updates
  add constraint status_updates_duration_minutes_check
    check (duration_minutes is null or duration_minutes in (1, 15, 30, 45, 60));

-- set_status gains a fifth argument. As before, adding a parameter changes the
-- signature, so drop the previous version first to avoid an ambiguous overload
-- (respond_to_nudge still calls it with three arguments, which re-resolves to
-- this one via the defaults).
drop function if exists public.set_status(public.status_state, text, text, integer);

create or replace function public.set_status(
  p_state            public.status_state,
  p_note             text    default null,
  p_ticket_ref       text    default null,
  p_duration_minutes integer default null,
  p_auto_switch_to   public.status_state default null
)
returns public.status_updates
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles;
  v_status  public.status_updates;
  v_note    text := nullif(trim(coalesce(p_note, '')), '');
  v_ticket  text := nullif(trim(coalesce(p_ticket_ref, '')), '');
  v_now     timestamptz := now();
  -- A target only means anything with a duration to fire it on.
  v_switch  public.status_state := case
              when p_duration_minutes is null then null
              else p_auto_switch_to
            end;
begin
  select * into v_profile from public.profiles where id = auth.uid();

  if v_profile.id is null or v_profile.team_id is null then
    raise exception 'you are not on a team yet' using errcode = 'WS001';
  end if;

  if p_duration_minutes is not null and p_duration_minutes not in (1, 15, 30, 45, 60) then
    raise exception 'duration must be 1, 15, 30, 45 or 60 minutes' using errcode = 'WS010';
  end if;

  -- Close the currently open row, if any.
  update public.status_updates
     set ended_at = v_now
   where profile_id = v_profile.id
     and ended_at is null;

  insert into public.status_updates
    (profile_id, team_id, state, note, ticket_ref, duration_minutes, auto_switch_to, started_at)
  values
    (v_profile.id, v_profile.team_id, p_state, v_note, v_ticket, p_duration_minutes, v_switch, v_now)
  returning * into v_status;

  -- Any status update answers an open system nudge. There is at most one.
  update public.nudges
     set state                 = 'resolved',
         resolved_at           = v_now,
         resolved_by_status_id = v_status.id
   where recipient_id = v_profile.id
     and kind  = 'system'
     and state = 'open';

  -- Remember it so /me can offer it back as one tap next time. Neither the
  -- duration nor the auto-switch target is part of a quick pick's identity —
  -- both are per-post choices, not habits.
  insert into public.quick_picks (profile_id, state, note, ticket_ref, use_count, last_used_at)
  values (v_profile.id, p_state, v_note, v_ticket, 1, v_now)
  on conflict (profile_id, state, coalesce(note, ''), coalesce(ticket_ref, ''))
  do update set use_count    = quick_picks.use_count + 1,
                last_used_at = v_now;

  return v_status;
end;
$$;

revoke execute on function public.set_status(public.status_state, text, text, integer, public.status_state) from public, anon;
grant  execute on function public.set_status(public.status_state, text, text, integer, public.status_state) to authenticated;

-- ---------------------------------------------------------------------------
-- expire_due_durations
-- ---------------------------------------------------------------------------
-- Run every minute by pg_cron. For each open status whose timer has elapsed and
-- that named a state to switch to, close it and open a fresh status in the
-- target state. Returns how many it switched.
--
-- The new row deliberately carries no note, ticket, duration or target: the
-- planned work is over, so the switched status is a clean slate. Like any status
-- change it resolves an open system nudge, but it is automated, so it does not
-- write a quick pick.
--
-- Not callable by clients: this is a scheduler entry point, like
-- enqueue_due_nudges().
create or replace function public.expire_due_durations()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now     timestamptz := now();
  v_count   integer := 0;
  v_new_id  uuid;
  r         record;
begin
  for r in
    select s.id, s.profile_id, s.team_id, s.auto_switch_to
      from public.status_updates s
     where s.ended_at is null
       and s.duration_minutes is not null
       and s.auto_switch_to is not null
       and s.started_at + make_interval(mins => s.duration_minutes) <= v_now
  loop
    -- Close the elapsed status first so the one-open-per-profile index is happy
    -- when the replacement goes in.
    update public.status_updates
       set ended_at = v_now
     where id = r.id
       and ended_at is null;

    insert into public.status_updates (profile_id, team_id, state, started_at)
    values (r.profile_id, r.team_id, r.auto_switch_to, v_now)
    returning id into v_new_id;

    update public.nudges
       set state                 = 'resolved',
           resolved_at           = v_now,
           resolved_by_status_id = v_new_id
     where recipient_id = r.profile_id
       and kind  = 'system'
       and state = 'open';

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.expire_due_durations() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Schedule it. Non-fatal if pg_cron is not enabled — same posture as the
-- staleness scheduler. Enable pg_cron (Dashboard -> Database -> Extensions)
-- and re-run this block to start it.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'expire-due-durations') then
      perform cron.unschedule('expire-due-durations');
    end if;

    perform cron.schedule(
      'expire-due-durations',
      '* * * * *',
      $cron$select public.expire_due_durations();$cron$
    );
  else
    raise notice 'pg_cron not enabled; expire_due_durations() is not scheduled. Enable it in the dashboard and re-run this block.';
  end if;
exception
  when insufficient_privilege then
    raise notice 'pg_cron present but not grantable here; schedule expire-due-durations manually.';
end;
$$;

-- ---------------------------------------------------------------------------
-- 20260805091100_status_state_other.sql
-- ---------------------------------------------------------------------------

-- Workspace: an "Other" state for anything the six fixed states don't cover.
--
-- This is its own migration on purpose: a new enum value has to be committed
-- before anything can reference it, so the column and RPC that use it live in
-- the next migration rather than this transaction.
alter type public.status_state add value if not exists 'other';

-- ---------------------------------------------------------------------------
-- 20260805091200_custom_state_label.sql
-- ---------------------------------------------------------------------------

-- Workspace: the free-text label that goes with the 'other' state.
--
-- Only meaningful when state = 'other'. For every other state the card already
-- has a name, so the label is forced to null there — the enum stays the source
-- of truth and 'other' is the single escape hatch.

alter table public.status_updates
  add column custom_label text
    check (custom_label is null or length(trim(custom_label)) between 1 and 40);

-- set_status gains p_custom_label. Same overload dance as before: drop the
-- five-argument version so the six-argument one is unambiguous (respond_to_nudge
-- still calls it with three, resolved via the defaults).
drop function if exists public.set_status(
  public.status_state, text, text, integer, public.status_state
);

create or replace function public.set_status(
  p_state            public.status_state,
  p_note             text    default null,
  p_ticket_ref       text    default null,
  p_duration_minutes integer default null,
  p_auto_switch_to   public.status_state default null,
  p_custom_label     text    default null
)
returns public.status_updates
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles;
  v_status  public.status_updates;
  v_note    text := nullif(trim(coalesce(p_note, '')), '');
  v_ticket  text := nullif(trim(coalesce(p_ticket_ref, '')), '');
  v_now     timestamptz := now();
  v_switch  public.status_state := case
              when p_duration_minutes is null then null
              else p_auto_switch_to
            end;
  -- A label belongs to 'other' and nothing else.
  v_label   text := case
              when p_state = 'other' then nullif(trim(coalesce(p_custom_label, '')), '')
              else null
            end;
begin
  select * into v_profile from public.profiles where id = auth.uid();

  if v_profile.id is null or v_profile.team_id is null then
    raise exception 'you are not on a team yet' using errcode = 'WS001';
  end if;

  if p_duration_minutes is not null and p_duration_minutes not in (1, 15, 30, 45, 60) then
    raise exception 'duration must be 1, 15, 30, 45 or 60 minutes' using errcode = 'WS010';
  end if;

  if p_state = 'other' and v_label is null then
    raise exception 'an Other status needs a label' using errcode = 'WS011';
  end if;

  -- Close the currently open row, if any.
  update public.status_updates
     set ended_at = v_now
   where profile_id = v_profile.id
     and ended_at is null;

  insert into public.status_updates
    (profile_id, team_id, state, note, ticket_ref, duration_minutes, auto_switch_to, custom_label, started_at)
  values
    (v_profile.id, v_profile.team_id, p_state, v_note, v_ticket, p_duration_minutes, v_switch, v_label, v_now)
  returning * into v_status;

  -- Any status update answers an open system nudge. There is at most one.
  update public.nudges
     set state                 = 'resolved',
         resolved_at           = v_now,
         resolved_by_status_id = v_status.id
   where recipient_id = v_profile.id
     and kind  = 'system'
     and state = 'open';

  -- Remember it so /me can offer it back as one tap next time.
  insert into public.quick_picks (profile_id, state, note, ticket_ref, use_count, last_used_at)
  values (v_profile.id, p_state, v_note, v_ticket, 1, v_now)
  on conflict (profile_id, state, coalesce(note, ''), coalesce(ticket_ref, ''))
  do update set use_count    = quick_picks.use_count + 1,
                last_used_at = v_now;

  return v_status;
end;
$$;

revoke execute on function public.set_status(
  public.status_state, text, text, integer, public.status_state, text
) from public, anon;
grant execute on function public.set_status(
  public.status_state, text, text, integer, public.status_state, text
) to authenticated;

