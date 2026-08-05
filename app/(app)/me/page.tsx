import { MeForm } from "./me-form";
import { getMyStatus, getQuickPicks, getViewer } from "@/lib/queries";

export default async function MePage() {
  const viewer = await getViewer();
  if (!viewer) return null;

  const [current, quickPicks] = await Promise.all([
    getMyStatus(viewer.profile.id),
    getQuickPicks(viewer.profile.id),
  ]);

  return (
    <>
      <h1 className="mb-8 text-2xl tracking-tight">What are you on?</h1>
      <MeForm
        profileId={viewer.profile.id}
        displayName={viewer.profile.display_name}
        current={current}
        quickPicks={quickPicks}
        serverNow={Date.now()}
      />
    </>
  );
}
