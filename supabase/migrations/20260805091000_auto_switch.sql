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
