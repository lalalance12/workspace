import { redirect } from "next/navigation";

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
      <div className="dimension-rule mt-10 pt-8 text-center">
        <p className="text-lg">No team yet.</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-8 text-2xl tracking-tight">{team.name}</h1>

      <section className="mb-10 max-w-md">
        <p className="annotation mb-2">Join code</p>
        <p className="font-mono text-2xl tracking-[0.3em]">{team.join_code}</p>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Anyone with this code can join the team. Share it, then rotate it when
          you&rsquo;re done.
        </p>
      </section>

      <dl className="grid max-w-md gap-4">
        <Row label="Stale after" value={`${team.stale_after_minutes} min`} />
        <Row label="Re-nudge after" value={`${team.renudge_after_minutes} min`} />
        <Row
          label="System nudges"
          value={team.system_nudges_enabled ? "On" : "Off"}
        />
        <Row
          label="Peer nudges / hour"
          value={`${team.peer_nudges_per_hour} total · ${team.peer_nudges_per_recipient_per_hour} per person`}
        />
      </dl>

      <p className="annotation mt-8">Editing these is not wired up yet</p>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="dimension-rule flex items-baseline justify-between pt-3">
      <dt className="annotation">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}
