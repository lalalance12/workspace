import { redirect } from "next/navigation";

import { BoardView } from "./board-view";
import { getBoardData, getViewer } from "@/lib/queries";

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

  const { members, statuses } = await getBoardData(viewer.profile.team_id);

  return (
    <>
      <div className="mb-8 flex items-baseline justify-between">
        <h1 className="text-2xl tracking-tight">Board</h1>
        <span className="annotation">{members.length} on the team</span>
      </div>

      <BoardView
        teamId={viewer.profile.team_id}
        viewerId={viewer.profile.id}
        members={members}
        initialStatuses={statuses}
        serverNow={Date.now()}
      />
    </>
  );
}
