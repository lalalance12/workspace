import type { Metadata } from "next";

import { MeForm } from "./me-form";
import { PageHeader } from "@/components/ui/page";
import { getMyStatus, getQuickPicks, getViewer } from "@/lib/queries";

/** Matches the nav label rather than the h1 — a tab title is a way back to a place. */
export const metadata: Metadata = { title: "Status" };

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
