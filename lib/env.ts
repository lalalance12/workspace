/**
 * Public Supabase configuration.
 *
 * Two values, and only two. There is no service-role/secret key anywhere in
 * this project: every write goes through a security-definer RPC executed as
 * the signed-in user, and the scheduler runs inside Postgres via pg_cron.
 * Nothing here needs to bypass RLS, so nothing here is given the means to.
 */

// Supabase renamed the anon key to the "publishable key" (sb_publishable_...).
// They are interchangeable; the local CLI still emits the older JWT form, so
// both names are accepted.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "Missing Supabase configuration. Copy .env.example to .env.local and set " +
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
  );
}

export const SUPABASE_URL = url;
export const SUPABASE_PUBLISHABLE_KEY = key;
