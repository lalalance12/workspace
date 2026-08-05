-- Workspace: local development seed.
--
-- Runs after migrations on `supabase db reset`. Local only.
--
-- This file writes to status_updates directly, which application code must
-- never do (non-negotiable #5). That is deliberate: seeding has no auth.uid()
-- to run set_status() as, and it needs to backdate started_at to produce the
-- staleness ladder. Nothing here is a pattern to copy into the app.

set search_path = public, auth, extensions;

-- Five people at deliberately different ages so every rung of the decay
-- ladder is visible the first time you open /board:
--   Lance   20 min   full saturation, crisp shadow, flat
--   Dana     2 h     shadow softens, ~15% desaturated
--   Kit      4 h     ~35% desaturated, corner curls, slight tilt
--   Rey      7 h     near-greyscale, pronounced curl, "STALE · 7H"
--   Ola    blocked   exempt from decay: signal pushpin, slow pulse
do $$
declare
  v_team   uuid := gen_random_uuid();
  v_lance  uuid := gen_random_uuid();
  v_dana   uuid := gen_random_uuid();
  v_kit    uuid := gen_random_uuid();
  v_rey    uuid := gen_random_uuid();
  v_ola    uuid := gen_random_uuid();

  v_person record;
begin
  insert into public.teams (id, name) values (v_team, 'Product');

  -- Local auth users. Password for all of them: password123
  for v_person in
    select * from (values
      (v_lance, 'lance@example.com', 'Lance'),
      (v_dana,  'dana@example.com',  'Dana'),
      (v_kit,   'kit@example.com',   'Kit'),
      (v_rey,   'rey@example.com',   'Rey'),
      (v_ola,   'ola@example.com',   'Ola')
    ) as t(id, email, name)
  loop
    -- The empty-string token columns matter: GoTrue reads them as Go strings
    -- and errors on NULL, which breaks magic-link sign-in for seeded users.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token,
      email_change_token_new, email_change, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_person.id, 'authenticated', 'authenticated', v_person.email,
      extensions.crypt('password123', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_person.name),
      '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_person.id, v_person.id::text,
      jsonb_build_object('sub', v_person.id::text, 'email', v_person.email),
      'email', now(), now(), now()
    );
  end loop;

  -- handle_new_user() created the profile rows; place them on the team.
  perform set_config('workspace.privileged_profile_write', 'on', true);
  update public.profiles
     set team_id      = v_team,
         message_link = 'https://slack.com/app_redirect?channel=' || lower(display_name)
   where id in (v_lance, v_dana, v_kit, v_rey, v_ola);

  update public.profiles set role = 'head' where id = v_lance;
  perform set_config('workspace.privileged_profile_write', 'off', true);

  -- The staleness ladder.
  insert into public.status_updates (profile_id, team_id, state, note, ticket_ref, started_at)
  values
    (v_lance, v_team, 'working',   'Wiring the board realtime patch', 'WS-118', now() - interval '20 minutes'),
    (v_dana,  v_team, 'reviewing', 'Reviewing the nudge rate limits', 'WS-104', now() - interval '2 hours'),
    (v_kit,   v_team, 'in_meeting','Design sync on the office view',  null,     now() - interval '4 hours'),
    (v_rey,   v_team, 'working',   'Fixing the checkout bug',         'WS-92',  now() - interval '7 hours'),
    (v_ola,   v_team, 'blocked',   'Waiting on staging credentials',  'WS-121', now() - interval '3 hours');

  -- Floor plan for /office.
  insert into public.desks (team_id, profile_id, label, room, grid_x, grid_y, grid_w, grid_h)
  values
    (v_team, v_lance, 'D-01', 'Studio', 2,  2, 4, 3),
    (v_team, v_dana,  'D-02', 'Studio', 8,  2, 4, 3),
    (v_team, v_kit,   'D-03', 'Studio', 14, 2, 4, 3),
    (v_team, v_rey,   'D-04', 'Annex',  2,  8, 4, 3),
    (v_team, v_ola,   'D-05', 'Annex',  8,  8, 4, 3),
    (v_team, null,    'D-06', 'Annex',  14, 8, 4, 3);
end;
$$;
