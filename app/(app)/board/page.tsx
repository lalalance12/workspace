import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BoardView } from "./board-view";
import { PageHeader } from "@/components/ui/page";
import { getBoardData, getOpenPeerNudges, getViewer } from "@/lib/queries";

export const metadata: Metadata = { title: "Board" };

/**
 * Server shell: fetch the initial data for a fast first paint, then hand off
 * to a client component that subscribes to Realtime and patches it.
 */
export default async function BoardPage() {
  const viewer = await getViewer();
  if (!viewer) return null;

  // The layout already sent teamless viewers to /onboarding; this repeats the
  // check only to narrow the type.
  if (!viewer.profile.team_id) redirect("/onboarding");

  const [{ members, statuses }, nudges] = await Promise.all([
    getBoardData(viewer.profile.team_id),
    getOpenPeerNudges(viewer.profile.team_id),
  ]);

  return (
    <>
      <PageHeader
        title="Board"
        meta={`${members.length} on the team · ${statuses.length} posted`}
      />

      <BoardView
        teamId={viewer.profile.team_id}
        viewerId={viewer.profile.id}
        members={members}
        initialStatuses={statuses}
        initialNudges={nudges}
        serverNow={Date.now()}
      />
    </>
  );
}
