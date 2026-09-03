import { redirect } from "next/navigation";

import { OnboardingChoice } from "./onboarding-choice";
import { getViewer } from "@/lib/queries";

/**
 * The fork every new account lands on: join the team someone invited you to,
 * or start one and become its head.
 *
 * Deliberately outside the (app) group — there is no board, no office and no
 * nudge policy until you belong somewhere, so there is nothing for the top bar
 * to navigate to. The (app) layout sends anyone without a team here.
 */
export default async function OnboardingPage() {
  const viewer = await getViewer();

  // Signed in, but the signup trigger never wrote a profile row. Same message
  // the app layout gives, because a redirect to /login would only bounce back.
  if (!viewer) {
    return (
      <Shell>
        <p className="text-lg">You&rsquo;re signed in, but you have no profile.</p>
        <p className="annotation mt-2">
          A profile is created on signup by a database trigger. Ask an admin.
        </p>
      </Shell>
    );
  }

  if (viewer.profile.team_id) redirect("/board");

  return (
    <Shell wide>
      <p className="annotation">Workspace</p>
      <h1 className="mt-2 mb-1 text-2xl tracking-tight">
        One more step, {viewer.profile.display_name}.
      </h1>
      <p className="mb-10 text-sm text-[var(--ink-soft)]">
        Workspace is a board a team shares. Join the one you were invited to, or
        start your own.
      </p>

      <OnboardingChoice />
    </Shell>
  );
}

function Shell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="drafting-grid grid min-h-dvh place-items-center px-6 py-12">
      <div className={wide ? "w-full max-w-2xl" : "max-w-sm text-center"}>
        {children}
      </div>
    </div>
  );
}
