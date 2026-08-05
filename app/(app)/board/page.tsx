import Link from "next/link";

import { BoardView } from "./board-view";
import { getBoardData, getViewer } from "@/lib/queries";

/**
 * Server shell: fetch the initial data for a fast first paint, then hand off
 * to a client component that subscribes to Realtime and patches it.
 */
export default async function BoardPage() {
  const viewer = await getViewer();
  if (!viewer) return null;

  if (!viewer.profile.team_id) {
    return <NoTeam />;
  }

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

function NoTeam() {
  return (
    <div className="dimension-rule mt-10 pt-8 text-center">
      <p className="text-lg">You&rsquo;re not on a team yet.</p>
      <p className="annotation mt-2">
        <Link href="/settings/me" className="underline">
          Create one to start posting
        </Link>
      </p>
    </div>
  );
}
