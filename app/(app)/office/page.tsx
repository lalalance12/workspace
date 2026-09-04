import type { Metadata } from "next";

import { EmptyState, PageHeader } from "@/components/ui/page";
import { getBoardData, getViewer } from "@/lib/queries";

export const metadata: Metadata = { title: "Office" };

/**
 * Floor-plan view with speech bubbles.
 *
 * Parked until after the presentation, and deliberately not deleted: it reads
 * the real roster, so whatever gets drawn here starts from true data. The route
 * stays reachable by URL; it is only off the nav, because a tab that leads to
 * "not built yet" spends a click to deliver a disappointment.
 */
export default async function OfficePage() {
  const viewer = await getViewer();
  if (!viewer?.profile.team_id) return null;

  const { members } = await getBoardData(viewer.profile.team_id);

  return (
    <>
      <PageHeader title="Office" meta="Floor plan" />

      <EmptyState
        title="The floor plan comes next"
        hint={`${members.length} desk${members.length === 1 ? "" : "s"} to place. Parked until after the presentation — the board is the proven path through the stack, and this view will follow it.`}
      />
    </>
  );
}
