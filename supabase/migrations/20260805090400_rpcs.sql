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
