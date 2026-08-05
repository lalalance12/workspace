-- Workspace: Realtime publication.
--
-- Postgres Changes carries what people are DOING. Whether they are THERE is
-- Presence, which lives entirely in Realtime and never touches Postgres.
-- There is no heartbeat table here on purpose, and there must never be one.
--
-- Realtime respects RLS per subscriber, so the policies in 20260805090300 are
-- what decide who sees which change. A system nudge does not broadcast to the
-- whole team just because it is in the publication.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

alter publication supabase_realtime add table public.status_updates;
alter publication supabase_realtime add table public.nudges;
alter publication supabase_realtime add table public.notifications;

-- Send the full old row on update/delete so clients can patch their store by
-- profile_id without a refetch.
alter table public.status_updates replica identity full;
alter table public.nudges         replica identity full;
