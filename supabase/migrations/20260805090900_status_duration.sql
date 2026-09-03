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
