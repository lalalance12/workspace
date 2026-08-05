import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Browser client. Used by client components for Realtime subscriptions and
 * RPC calls, always as the signed-in user under RLS.
 *
 * `@supabase/ssr` only. `@supabase/auth-helpers-nextjs` is deprecated — if you
 * are reaching for createClientComponentClient, you have the wrong package.
 *
 * Memoised on purpose. The board holds one Postgres Changes channel and one
 * Presence channel, and the bell holds a third; a fresh client per call would
 * open a websocket per caller instead of multiplexing them over one.
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  browserClient ??= createBrowserClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
  );
  return browserClient;
}
