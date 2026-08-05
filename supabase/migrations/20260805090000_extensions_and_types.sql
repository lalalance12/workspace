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
