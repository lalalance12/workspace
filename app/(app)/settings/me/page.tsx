import { MeSettingsForm } from "./me-settings-form";
import { PageHeader } from "@/components/ui/page";
import { getViewer } from "@/lib/queries";

export default async function MeSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) return null;

  return (
    <>
      <PageHeader title="Your settings" meta={viewer.profile.display_name} />
      <MeSettingsForm profile={viewer.profile} />
    </>
  );
}
