import type { Metadata } from "next";

import { TeamMembershipForm } from "./team-membership-form";
import { TeamPolicyForm, type TeamPolicy } from "./team-policy-form";
import { PageHeader, Panel } from "@/components/ui/page";
import { getViewer } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

/** Static, though the h1 is the team name: titles that move are hard to find. */
export const metadata: Metadata = { title: "Team settings" };

/**
 * Two halves with different audiences.
 *
 * The membership half — which team you are on, how to leave it, how to move to
 * another — belongs to everyone standing on the team. The policy half, the join
 * code and every nudge limit, stays with the head.
 *
 * This page used to redirect anyone who was not the head straight to /board,
 * which is why members had no way out of a team at all. The gate moved from the
 * route to the panel.
 */
export default async function TeamSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) return null;

  const isHead = viewer.profile.role === "head";
  const teamId = viewer.profile.team_id ?? "";
  const supabase = await createClient();

  const [{ data: team }, { data: roster }] = await Promise.all([
    supabase
      .from("teams")
      .select(
        "id, name, join_code, stale_after_minutes, renudge_after_minutes, system_nudges_enabled, peer_nudges_per_hour, peer_nudges_per_recipient_per_hour",
      )
      .eq("id", teamId)
      .maybeSingle<TeamPolicy>(),
    // Ordered the way release_team_membership() orders it, so the successor
    // named in the confirmation is the one the database will actually promote.
    // created_at then id — the same tiebreak, for the same reason.
    supabase
      .from("profiles")
      .select("id, display_name, created_at")
      .eq("team_id", teamId)
      .order("created_at")
      .order("id"),
  ]);

  if (!team) {
    return (
      <Panel className="mx-auto mt-10 max-w-md p-8 text-center">
        <p className="text-lg font-medium">No team yet.</p>
      </Panel>
    );
  }

  const members = roster ?? [];
  const successor = members.find((m) => m.id !== viewer.profile.id) ?? null;

  return (
    <>
      <PageHeader
        title={team.name}
        meta={`${isHead ? "You are the head" : "Member"} · ${members.length} on the team`}
      />

      <div className="flex max-w-xl flex-col gap-6">
        {isHead && <TeamPolicyForm team={team} />}

        <TeamMembershipForm
          teamName={team.name}
          isHead={isHead}
          memberCount={members.length}
          successorName={isHead ? (successor?.display_name ?? null) : null}
        />
      </div>
    </>
  );
}
