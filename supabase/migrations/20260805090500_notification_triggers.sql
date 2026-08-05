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
