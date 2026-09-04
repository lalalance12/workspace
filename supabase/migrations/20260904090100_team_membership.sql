-- Workspace: leaving a team, and moving to another one.
--
-- Until now membership was one-way. join_team() refuses anyone who already has
-- a team (WS008), which is right for onboarding and wrong for everything after
-- it: people change squads, and the only way out was for someone to edit the
-- database by hand.
--
-- Two entry points, because they are two different intentions:
--
--   switch_team(code)  I am moving to that team. Atomic — the code is checked
--                      BEFORE the current membership is released, so a typo
--                      leaves you exactly where you were rather than stranding
--                      you with no team at all.
--   leave_team()       I am leaving, full stop. Lands back on /onboarding.
--
-- New error codes:
--   WS012  you are already on that team
--   WS013  details run to at most 2000 characters   (see status_details)

-- ---------------------------------------------------------------------------
-- release_team_membership
-- ---------------------------------------------------------------------------
-- Everything that has to be true before a profile's team_id may change.
--
-- Not callable by anyone: Postgres grants EXECUTE on new functions to PUBLIC by
-- default, so the revoke at the bottom is load-bearing, not decoration. The two
-- RPCs below reach it because a security-definer function runs as the owner.
--
-- The caller is responsible for the privileged_profile_write flag — this
-- promotes a successor head, which is a profile write the guard trigger blocks.
create or replace function public.release_team_membership(p_profile uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
  v_role public.team_role;
  v_heir uuid;
  v_now  timestamptz := now();
begin
  select team_id, role into v_team, v_role
    from public.profiles
   where id = p_profile;

  -- Nothing to release. switch_team() accepts someone with no team, so this is
  -- a normal path, not an error.
  if v_team is null then
    return;
  end if;

  -- 1. Close the open status.
  --
  -- The row carries the old team_id, so an open status left behind is a person
  -- still working on a board they have left. The board would not draw them —
  -- it lists members by team — but the row would sit open forever, the
  -- one-open-per-profile index would count it, and the auto-switch scheduler
  -- would keep flipping its state on a timer. Close it.
  update public.status_updates
     set ended_at = v_now
   where profile_id = p_profile
     and ended_at is null;

  -- 2. Settle every open nudge they are part of, in either direction.
  --
  -- An open nudge on a team you have left is unanswerable: the nudges select
  -- policy is team-scoped, so the row becomes invisible to the one person who
  -- was supposed to act on it, and the sender's card keeps its "Nudged" marker
  -- with nothing to clear it. The two kinds have different terminal states —
  -- nudges_terminal_state enforces peer -> acknowledged, system -> resolved —
  -- so this is two statements, not one.
  update public.nudges
     set state       = 'acknowledged',
         resolved_at = v_now
   where kind  = 'peer'
     and state = 'open'
     and (recipient_id = p_profile or sender_id = p_profile);

  update public.nudges
     set state       = 'resolved',
         resolved_at = v_now
   where kind  = 'system'
     and state = 'open'
     and recipient_id = p_profile;

  -- 3. Give up the desk. profile_id is UNIQUE across the whole table, so a desk
  --    still held on the old floor plan would block being seated on the new one.
  update public.desks
     set profile_id = null
   where profile_id = p_profile;

  -- 4. Drop their notifications.
  --
  -- All four notification kinds are about a nudge, and every nudge belongs to
  -- the team being left, so carrying the bell's contents across would mean
  -- arriving at a new team with alerts about the old one. These are transient
  -- alerts, not records — status_updates keeps the history.
  delete from public.notifications
   where profile_id = p_profile;

  -- 5. Hand over the team if this was its head.
  --
  -- A headless team is a dead end: no one can rotate the join code, edit nudge
  -- policy, or reach /settings/team's head-only half ever again. So the
  -- longest-standing remaining member is promoted. Deterministic — created_at
  -- then id, so two heads leaving at once cannot pick each other.
  --
  -- No notification. There are exactly four notification triggers and adding a
  -- fifth is out of bounds; the new head sees the role on their next load, and
  -- the UI warns the leaver by name before they confirm.
  if v_role = 'head' then
    select id into v_heir
      from public.profiles
     where team_id = v_team
       and id <> p_profile
     order by created_at, id
     limit 1;

    -- No heir means the team is now empty. The row is left in place on purpose:
    -- deleting it would cascade every status_updates row on it, and an empty
    -- team is harmless and invisible (the teams select policy is scoped to your
    -- own). Whoever still holds the join code can walk back in and pick it up.
    if v_heir is not null then
      update public.profiles
         set role = 'head'
       where id = v_heir;
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- switch_team
-- ---------------------------------------------------------------------------
-- Security definer for the same reason join_team is: the caller cannot see the
-- team they are moving to, because the teams select policy only shows the one
-- they are already on.
create or replace function public.switch_team(p_code text)
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

  -- Resolve the code FIRST. This is the whole reason this is one RPC and not a
  -- leave_team() call followed by a join_team() call: a bad code has to fail
  -- before anything is released, or a typo costs you your team.
  select * into v_team
    from public.teams
   where join_code = upper(trim(coalesce(p_code, '')));

  if v_team.id is null then
    raise exception 'that join code does not match a team' using errcode = 'WS009';
  end if;

  if v_current is not null and v_current = v_team.id then
    raise exception 'you are already on that team' using errcode = 'WS012';
  end if;

  perform set_config('workspace.privileged_profile_write', 'on', true);

  perform public.release_team_membership(auth.uid());

  -- Always 'member'. Arriving with a code makes you a member of the team you
  -- arrived at, whatever you were on the team you left.
  update public.profiles
     set team_id = v_team.id,
         role    = 'member'
   where id = auth.uid();

  perform set_config('workspace.privileged_profile_write', 'off', true);

  return v_team;
end;
$$;

-- ---------------------------------------------------------------------------
-- leave_team
-- ---------------------------------------------------------------------------
-- Leaving without arriving anywhere. team_id goes null, which the (app) layout
-- reads as "not on a team" and routes to /onboarding.
create or replace function public.leave_team()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = 'WS001';
  end if;

  select team_id into v_current from public.profiles where id = auth.uid();

  if v_current is null then
    raise exception 'you are not on a team yet' using errcode = 'WS001';
  end if;

  perform set_config('workspace.privileged_profile_write', 'on', true);

  perform public.release_team_membership(auth.uid());

  update public.profiles
     set team_id = null,
         role    = 'member'
   where id = auth.uid();

  perform set_config('workspace.privileged_profile_write', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
-- The helper is reachable only from the two RPCs above, which run as the owner.
-- Without this revoke it would be callable by any signed-in user against any
-- profile id, which would let anyone evict anyone.
revoke execute on function public.release_team_membership(uuid)
  from public, anon, authenticated;

revoke execute on function public.switch_team(text) from public, anon;
grant  execute on function public.switch_team(text) to authenticated;

revoke execute on function public.leave_team()      from public, anon;
grant  execute on function public.leave_team()      to authenticated;
