import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingChoice } from "./onboarding-choice";
import { getViewer } from "@/lib/queries";

/** Names the decision, not the greeting: the h1 is personalised and a tab is not. */
export const metadata: Metadata = { title: "Join a team" };

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
        <div className="panel mx-auto max-w-sm p-8 text-center">
          <p className="text-lg font-medium">
            You&rsquo;re signed in, but you have no profile.
          </p>
          <p className="annotation mt-3">
            A profile is created on signup by a database trigger. Ask an admin.
          </p>
        </div>
      </Shell>
    );
  }

  if (viewer.profile.team_id) redirect("/board");

  return (
    <Shell>
      <div className="rise-in mx-auto w-full max-w-3xl">
        <div className="mb-10 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="size-5 rounded-md"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          />
          <span className="gradient-text font-[family-name:var(--font-display)] text-base font-bold tracking-tight">
            Workspace
          </span>
        </div>

        <h1 className="text-3xl">
          One more step, {viewer.profile.display_name}.
        </h1>
        <p className="mt-3 mb-10 max-w-lg text-[var(--ink-soft)]">
          A board belongs to a team. Join the one you were invited to, or start
          your own and hand out the code.
        </p>

        <OnboardingChoice />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="canvas-ambient grid min-h-dvh place-items-center px-6 py-16">
      {children}
    </div>
  );
}
