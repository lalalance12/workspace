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
