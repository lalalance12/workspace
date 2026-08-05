-- Workspace: row level security.
--
-- Every app query runs through the publishable (anon) key as the signed-in
-- user. Nothing bypasses RLS. If a query comes back empty, the fix is a policy
-- here, never a privileged key.
--
-- Note which tables have no write policies at all: status_updates, quick_picks
-- and nudges are written only by security-definer RPCs, and notifications only
-- by triggers. That is not a convention, it is the enforcement.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- These are security definer so that a policy on profiles can ask about
-- profiles without recursing into its own policy.

create or replace function public.current_team_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select team_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_team_head()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select role = 'head' from public.profiles where id = auth.uid()), false);
$$;

grant execute on function public.current_team_id() to authenticated;
grant execute on function public.is_team_head()   to authenticated;

-- Role and team membership are not self-service. They change only inside an
-- RPC that sets this flag, never through a plain update on your own row.
create or replace function public.guard_privileged_profile_columns()
returns trigger
language plpgsql
as $$
begin
  if (new.role is distinct from old.role or new.team_id is distinct from old.team_id)
     and coalesce(current_setting('workspace.privileged_profile_write', true), 'off') <> 'on'
  then
    raise exception 'role and team_id are managed by RPC, not by direct update'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row execute function public.guard_privileged_profile_columns();

-- ---------------------------------------------------------------------------
alter table public.teams          enable row level security;
alter table public.profiles       enable row level security;
alter table public.status_updates enable row level security;
alter table public.quick_picks    enable row level security;
alter table public.desks          enable row level security;
alter table public.nudges         enable row level security;
alter table public.notifications  enable row level security;

-- teams ---------------------------------------------------------------------
create policy "read own team"
  on public.teams for select to authenticated
  using (id = public.current_team_id());

-- The head edits nudge policy in /settings/team.
create policy "head updates own team"
  on public.teams for update to authenticated
  using (id = public.current_team_id() and public.is_team_head())
  with check (id = public.current_team_id() and public.is_team_head());

-- profiles ------------------------------------------------------------------
create policy "read teammates"
  on public.profiles for select to authenticated
  using (id = auth.uid() or team_id = public.current_team_id());

-- /settings/me. The trigger above still blocks role and team_id.
create policy "update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- status_updates ------------------------------------------------------------
-- Read-only to the app. Writes go through set_status().
create policy "read team statuses"
  on public.status_updates for select to authenticated
  using (team_id = public.current_team_id());

-- quick_picks ---------------------------------------------------------------
create policy "read own quick picks"
  on public.quick_picks for select to authenticated
  using (profile_id = auth.uid());

create policy "delete own quick picks"
  on public.quick_picks for delete to authenticated
  using (profile_id = auth.uid());

-- desks ---------------------------------------------------------------------
create policy "read team desks"
  on public.desks for select to authenticated
  using (team_id = public.current_team_id());

create policy "head manages desks"
  on public.desks for all to authenticated
  using (team_id = public.current_team_id() and public.is_team_head())
  with check (team_id = public.current_team_id() and public.is_team_head());

-- nudges --------------------------------------------------------------------
-- Peer nudges are visible team-wide on purpose: nudging in the open keeps it
-- social. Covert nudging turns the feature into a management cudgel.
--
-- System nudges are the opposite: private to the recipient and the head, so a
-- stale status is never a public scolding.
create policy "read peer nudges team-wide"
  on public.nudges for select to authenticated
  using (kind = 'peer' and team_id = public.current_team_id());

create policy "read own system nudges"
  on public.nudges for select to authenticated
  using (
    kind = 'system'
    and (
      recipient_id = auth.uid()
      or (team_id = public.current_team_id() and public.is_team_head())
    )
  );

-- notifications -------------------------------------------------------------
create policy "read own notifications"
  on public.notifications for select to authenticated
  using (profile_id = auth.uid());

-- Marking read is the only write the client may perform.
create policy "mark own notifications read"
  on public.notifications for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- There is deliberately no insert policy on public.notifications.
-- Rows are written by trigger only. Do not add one.

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------
-- A policy filters rows; it does not grant access to the table. Without these
-- GRANTs every query fails with "permission denied for table ...", policies or
-- no policies.
--
-- These are deliberately narrower than the policies above. Note what is NOT
-- granted: no INSERT anywhere, and no UPDATE on status_updates, quick_picks or
-- nudges. Those are written only by security-definer RPCs and triggers, so the
-- privilege layer and the policy layer say the same thing. If someone later
-- adds an INSERT policy by mistake, this still stops it.

grant usage on schema public to authenticated;

grant select                 on public.teams          to authenticated;
grant update                 on public.teams          to authenticated;  -- head only, by policy
grant select, update         on public.profiles       to authenticated;
grant select                 on public.status_updates to authenticated;
grant select, delete         on public.quick_picks    to authenticated;
grant select                 on public.nudges         to authenticated;
grant select, update         on public.notifications  to authenticated;
grant select, insert, update, delete on public.desks  to authenticated;  -- head only, by policy

-- anon can reach the auth endpoints and nothing else. Signing in is not a
-- table read.
revoke all on public.teams, public.profiles, public.status_updates,
              public.quick_picks, public.nudges, public.notifications,
              public.desks
  from anon;
