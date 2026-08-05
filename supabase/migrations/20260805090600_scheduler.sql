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
