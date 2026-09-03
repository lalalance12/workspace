-- Workspace: an "Other" state for anything the six fixed states don't cover.
--
-- This is its own migration on purpose: a new enum value has to be committed
-- before anything can reference it, so the column and RPC that use it live in
-- the next migration rather than this transaction.
alter type public.status_state add value if not exists 'other';
