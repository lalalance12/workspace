import { MeSettingsForm } from "./me-settings-form";
import { getViewer } from "@/lib/queries";

export default async function MeSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) return null;

  return (
    <>
      <h1 className="mb-8 text-2xl tracking-tight">Your settings</h1>
      <MeSettingsForm profile={viewer.profile} />
    </>
  );
}
