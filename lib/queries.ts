import { createClient } from "@/lib/supabase/server";

/**
 * Server-side reads for initial paint. Client components take it from here and
 * patch via Realtime.
 *
 * Everything runs as the signed-in user under RLS. If something comes back
 * empty that shouldn't, the fix is a policy in
 * supabase/migrations/20260805090300_rls.sql — never a privileged key.
 */

export async function getViewer() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // Swallowing this is how a missing GRANT turns into an infinite
  // /board -> /login -> /board redirect instead of a legible failure. If the
  // row can't be read, say why.
  if (error) {
    throw new Error(
      `Could not read your profile: ${error.message}. This is a policy or ` +
        `privilege problem in supabase/migrations, not a client bug.`,
    );
  }

  if (!profile) return null;
  return { user, profile };
}

/** Current status per teammate, plus the roster to render them against. */
export async function getBoardData(teamId: string) {
  const supabase = await createClient();

  const [{ data: members }, { data: statuses }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url, message_link")
      .eq("team_id", teamId)
      .order("display_name"),
    supabase
      .from("status_updates")
      .select("id, profile_id, state, note, ticket_ref, started_at")
      .eq("team_id", teamId)
      .is("ended_at", null),
  ]);

  return { members: members ?? [], statuses: statuses ?? [] };
}

/** Your own current status, for /me. */
export async function getMyStatus(profileId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("status_updates")
    .select("id, profile_id, state, note, ticket_ref, started_at")
    .eq("profile_id", profileId)
    .is("ended_at", null)
    .maybeSingle();

  return data;
}

/** Recent quick picks, most recently used first. */
export async function getQuickPicks(profileId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("quick_picks")
    .select("id, state, note, ticket_ref, last_used_at")
    .eq("profile_id", profileId)
    .order("last_used_at", { ascending: false })
    .limit(6);

  return data ?? [];
}
