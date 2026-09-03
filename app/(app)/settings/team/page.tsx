import { redirect } from "next/navigation";

import { PageHeader, Panel } from "@/components/ui/page";
import { getViewer } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

/** Head-only: nudge policy, members, desks. Read-only shell for now. */
export default async function TeamSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) return null;
  if (viewer.profile.role !== "head") redirect("/board");

  const supabase = await createClient();
  const { data: team } = await supabase
    .from("teams")
    .select("*")
    .eq("id", viewer.profile.team_id ?? "")
    .maybeSingle();

  if (!team) {
    return (
      <Panel className="mx-auto mt-10 max-w-md p-8 text-center">
        <p className="text-lg font-medium">No team yet.</p>
      </Panel>
    );
  }

  return (
    <>
      <PageHeader title={team.name} meta="You are the head" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* The join code is the one thing anyone comes to this page for, so it
            gets the brand treatment and the full width of its panel. */}
        <Panel className="p-6">
          <p className="annotation">Join code</p>
          <p
            className="gradient-text mt-3 font-[family-name:var(--font-mono)] text-3xl font-bold tracking-[0.28em]"
            data-testid="join-code"
          >
            {team.join_code}
          </p>
          <p className="mt-4 text-sm text-[var(--ink-soft)]">
            Anyone holding this can join. Share it, then rotate it when the
            people you meant to invite are in.
          </p>
        </Panel>

        <Panel className="p-6">
          <p className="annotation mb-4">Nudge policy</p>
          <dl className="grid gap-3">
            <Row label="Stale after" value={`${team.stale_after_minutes} min`} />
            <Row
              label="Re-nudge after"
              value={`${team.renudge_after_minutes} min`}
            />
            <Row
              label="System nudges"
              value={team.system_nudges_enabled ? "On" : "Off"}
            />
            <Row
              label="Peer nudges / hour"
              value={`${team.peer_nudges_per_hour} total · ${team.peer_nudges_per_recipient_per_hour} per person`}
            />
          </dl>
          <p className="annotation mt-6">Editing these is not wired up yet</p>
        </Panel>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0"
      style={{ borderColor: "var(--line)" }}
    >
      <dt className="annotation">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}
