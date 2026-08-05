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
      <div className="mb-8 flex items-baseline justify-between">
        <h1 className="text-2xl tracking-tight">Office</h1>
        <span className="annotation">Floor plan</span>
      </div>

      <div className="dimension-rule pt-8 text-center">
        <p className="text-lg">The floor plan isn&rsquo;t drawn yet.</p>
        <p className="annotation mt-2">
          {members.length} desks to place · Ask the head to arrange them
        </p>
      </div>
    </>
  );
}
