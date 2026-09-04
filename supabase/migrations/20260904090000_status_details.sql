-- Workspace: the long half of a status.
--
-- The note is the headline and stays short — 140 characters, and the card now
-- clamps it to three lines so one wordy status cannot stretch its card taller
-- than its neighbours and pull the whole grid out of line. Details is where the
-- rest goes: the paragraph you would have typed into the note if it had room.
--
-- It is deliberately not on the card. A board earns its keep by being
-- glanceable, so anything that has to be *read* rather than *scanned* lives one
-- click away, in the preview. Optional everywhere: a status with no details is
-- the normal case, not a half-finished one.
--
-- 2000 characters is a real paragraph or three and still small enough that
-- selecting a whole team's worth of open statuses stays cheap.

alter table public.status_updates
  add column details text
    check (details is null or length(details) <= 2000);

-- ---------------------------------------------------------------------------
-- set_status gains p_details
-- ---------------------------------------------------------------------------
-- Same overload dance as duration and custom_label before it: adding a
-- parameter changes the signature, so the six-argument version has to go first
-- or a three-argument call (respond_to_nudge still makes one) is ambiguous
-- between the two. Postgres does not track function-to-function references as
-- dependencies, so dropping this is safe even though respond_to_nudge calls
-- it — the call re-resolves to the new function.
drop function if exists public.set_status(
  public.status_state, text, text, integer, public.status_state, text
);

create or replace function public.set_status(
  p_state            public.status_state,
  p_note             text    default null,
  p_ticket_ref       text    default null,
  p_duration_minutes integer default null,
  p_auto_switch_to   public.status_state default null,
  p_custom_label     text    default null,
  p_details          text    default null
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
  -- Trimmed at the ends but not in the middle: the blank line between two
  -- paragraphs is the author's, and squashing it would rewrite what they wrote.
  v_details text := nullif(trim(coalesce(p_details, '')), '');
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

  -- Belt and braces alongside the CHECK, so an over-long paste gets a sentence
  -- it can act on instead of a raw constraint violation.
  if v_details is not null and length(v_details) > 2000 then
    raise exception 'details run to at most 2000 characters' using errcode = 'WS013';
  end if;

  -- Close the currently open row, if any.
  update public.status_updates
     set ended_at = v_now
   where profile_id = v_profile.id
     and ended_at is null;

  insert into public.status_updates
    (profile_id, team_id, state, note, ticket_ref, duration_minutes,
     auto_switch_to, custom_label, details, started_at)
  values
    (v_profile.id, v_profile.team_id, p_state, v_note, v_ticket, p_duration_minutes,
     v_switch, v_label, v_details, v_now)
  returning * into v_status;

  -- Any status update answers an open system nudge. There is at most one.
  update public.nudges
     set state                 = 'resolved',
         resolved_at           = v_now,
         resolved_by_status_id = v_status.id
   where recipient_id = v_profile.id
     and kind  = 'system'
     and state = 'open';

  -- Remember it so /me can offer it back as one tap next time. Details are not
  -- part of a quick pick's identity, for the same reason duration is not: the
  -- headline is the habit, the paragraph is written fresh each time.
  insert into public.quick_picks (profile_id, state, note, ticket_ref, use_count, last_used_at)
  values (v_profile.id, p_state, v_note, v_ticket, 1, v_now)
  on conflict (profile_id, state, coalesce(note, ''), coalesce(ticket_ref, ''))
  do update set use_count    = quick_picks.use_count + 1,
                last_used_at = v_now;

  return v_status;
end;
$$;

revoke execute on function public.set_status(
  public.status_state, text, text, integer, public.status_state, text, text
) from public, anon;
grant execute on function public.set_status(
  public.status_state, text, text, integer, public.status_state, text, text
) to authenticated;
