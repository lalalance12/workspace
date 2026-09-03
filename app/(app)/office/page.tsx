import { EmptyState, PageHeader } from "@/components/ui/page";
import { getBoardData, getViewer } from "@/lib/queries";

/**
 * Floor-plan view with speech bubbles.
 *
 * Shell only for now: it reads the real desk layout so the drawing is honest,
 * but the bubbles and Realtime patching are not built yet. The board is the
 * proven path through the stack; this view follows it.
 */
export default async function OfficePage() {
  const viewer = await getViewer();
  if (!viewer?.profile.team_id) return null;

  const { members } = await getBoardData(viewer.profile.team_id);

  return (
    <>
      <PageHeader title="Office" meta="Floor plan" />

      <EmptyState
        title="The floor plan isn't drawn yet"
        hint={`${members.length} desk${members.length === 1 ? "" : "s"} to place. The head arranges them once, and everyone sees the same room.`}
      />
    </>
  );
}
