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
