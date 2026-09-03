-- ---------------------------------------------------------------------------
-- Backfill profiles for accounts that predate the trigger.
--
-- public.handle_new_user() fires "after insert on auth.users", so it only ever
-- sees signups that happen once it exists. Anyone who signed in to a project
-- before the migrations were pushed has an auth.users row and no profile, and
-- the app greets them with "you're signed in, but you have no profile" — which
-- is accurate and completely unactionable.
--
-- Runs on every push and is idempotent: on a fresh database there are no users
-- to backfill and this does nothing.
--
-- The column expressions mirror handle_new_user() deliberately. If that
-- function changes how it derives a display name, change it here too.
-- ---------------------------------------------------------------------------

insert into public.profiles (id, display_name, avatar_url)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(u.email, 'someone'), '@', 1)
  ),
  nullif(trim(u.raw_user_meta_data ->> 'avatar_url'), '')
from auth.users u
on conflict (id) do nothing;
