import { MeForm } from "./me-form";
import { PageHeader } from "@/components/ui/page";
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
      <PageHeader
        title="What are you on?"
        meta={current ? "Posted" : "Nothing posted yet"}
      />
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
