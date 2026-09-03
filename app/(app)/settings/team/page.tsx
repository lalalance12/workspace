import { redirect } from "next/navigation";

import { TeamPolicyForm, type TeamPolicy } from "./team-policy-form";
import { PageHeader, Panel } from "@/components/ui/page";
import { getViewer } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

/** Head only: the join code and the whole nudge policy. */
export default async function TeamSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) return null;
  if (viewer.profile.role !== "head") redirect("/board");

  const supabase = await createClient();

  const [{ data: team }, { count: members }] = await Promise.all([
    supabase
      .from("teams")
      .select(
        "id, name, join_code, stale_after_minutes, renudge_after_minutes, system_nudges_enabled, peer_nudges_per_hour, peer_nudges_per_recipient_per_hour",
      )
      .eq("id", viewer.profile.team_id ?? "")
      .maybeSingle<TeamPolicy>(),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("team_id", viewer.profile.team_id ?? ""),
  ]);

  if (!team) {
    return (
      <Panel className="mx-auto mt-10 max-w-md p-8 text-center">
        <p className="text-lg font-medium">No team yet.</p>
      </Panel>
    );
  }

  return (
    <>
      <PageHeader
        title={team.name}
        meta={`You are the head · ${members ?? 0} on the team`}
      />
      <div className="max-w-xl">
        <TeamPolicyForm team={team} />
      </div>
    </>
  );
}
