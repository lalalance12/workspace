-- Workspace: the staleness scheduler, tested in SQL.
--
--   pnpm exec supabase test db
--
-- The no-double-nudge guard is the part most likely to break, so it is the
-- centre of this file: seed a member with a 2-hour-old status, run
-- enqueue_due_nudges() and assert exactly one row lands, then run it again and
-- assert zero.

begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pg_temp;

select plan(10);

-- The dev seed also has stale members. Mute every other team so the return
-- value of enqueue_due_nudges() is exactly the count this test caused.
update public.teams set system_nudges_enabled = false;

insert into public.teams (id, name, stale_after_minutes, renudge_after_minutes, system_nudges_enabled)
values ('11111111-1111-1111-1111-111111111111', 'Scheduler Test', 120, 120, true);

-- handle_new_user() turns these into profiles.
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'sched-active@example.com', now(), now(), '{}', '{"full_name":"Active"}'),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', 'sched-signedoff@example.com', now(), now(), '{}', '{"full_name":"Signed Off"}');

select set_config('workspace.privileged_profile_write', 'on', true);
update public.profiles
   set team_id = '11111111-1111-1111-1111-111111111111'
 where id in ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');
select set_config('workspace.privileged_profile_write', 'off', true);

-- ---------------------------------------------------------------------------
-- A fresh status is not stale.
-- ---------------------------------------------------------------------------
insert into public.status_updates (profile_id, team_id, state, note, started_at)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
        'working', 'Fixing the checkout bug', now() - interval '5 minutes');

select is(
  public.enqueue_due_nudges(), 0,
  'a five-minute-old status is not nudged'
);

-- ---------------------------------------------------------------------------
-- Age it past the two-hour threshold.
-- ---------------------------------------------------------------------------
update public.status_updates
   set started_at = now() - interval '2 hours'
 where profile_id = '22222222-2222-2222-2222-222222222222';

select is(
  public.enqueue_due_nudges(), 1,
  'a two-hour-old status produces exactly one system nudge'
);

select is(
  (select count(*) from public.nudges
    where recipient_id = '22222222-2222-2222-2222-222222222222' and kind = 'system'),
  1::bigint,
  'exactly one row landed in nudges'
);

-- ---------------------------------------------------------------------------
-- The guard. This is the assertion that matters.
-- ---------------------------------------------------------------------------
select is(
  public.enqueue_due_nudges(), 0,
  'running again nudges nobody - the no-double-nudge guard holds'
);

select is(
  (select count(*) from public.nudges
    where recipient_id = '22222222-2222-2222-2222-222222222222' and kind = 'system'),
  1::bigint,
  'still exactly one row after a second run'
);

-- ---------------------------------------------------------------------------
-- The question is built from the actual status, never a generic prompt.
-- ---------------------------------------------------------------------------
select is(
  (select question from public.nudges
    where recipient_id = '22222222-2222-2222-2222-222222222222' and kind = 'system'),
  'Still fixing the checkout bug?',
  'the nudge asks about the work, not "please update your status"'
);

-- A note that already opens with an activity is its own predicate.
select is(
  public.compose_nudge_question('reviewing', 'Reviewing the nudge rate limits'),
  'Still reviewing the nudge rate limits?',
  'the state verb does not stutter against a note that already has one'
);

-- A note that is a bare noun phrase needs the state to supply the verb.
select is(
  public.compose_nudge_question('working', 'the checkout bug'),
  'Still on the checkout bug?',
  'a noun-phrase note gets the state verb'
);

select is(
  public.compose_nudge_question('in_meeting', null),
  'Still in that meeting?',
  'an empty note falls back to a question about the state itself'
);

-- ---------------------------------------------------------------------------
-- Signed off is finished, not stale.
-- ---------------------------------------------------------------------------
insert into public.status_updates (profile_id, team_id, state, note, started_at)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
        'done_for_day', 'Back tomorrow', now() - interval '9 hours');

select is(
  public.enqueue_due_nudges(), 0,
  'someone who signed off nine hours ago is not nudged'
);

select * from finish();
rollback;
