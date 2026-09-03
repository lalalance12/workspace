import { MeSettingsForm } from "./me-settings-form";
import { PasswordSettingsForm } from "./password-settings-form";
import { PageHeader } from "@/components/ui/page";
import { getViewer } from "@/lib/queries";

export default async function MeSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) return null;

  return (
    <>
      <PageHeader title="Your settings" meta={viewer.profile.display_name} />

      <div className="flex flex-col gap-10">
        <MeSettingsForm profile={viewer.profile} />
        <PasswordSettingsForm />
      </div>
    </>
  );
}
