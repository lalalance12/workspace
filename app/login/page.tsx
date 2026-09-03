import Link from "next/link";

import { SignInForm } from "./sign-in-form";
import { AuthShell } from "@/components/auth-shell";
import { ErrorNote } from "@/components/ui/field";

/**
 * A failed code exchange used to redirect here with ?error=auth and say
 * nothing, which looks identical to arriving normally. Name what happened.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthShell
      title={
        <>
          Welcome <span className="gradient-text">back</span>.
        </>
      }
      subtitle="Sign in to see what everyone is working on."
      footer={
        <>
          New to Workspace?{" "}
          <Link href="/signup" className="font-medium text-[var(--violet)] underline">
            Create an account
          </Link>
        </>
      }
    >
      {error === "auth" && (
        <div className="mb-5">
          <ErrorNote>
            That sign-in link didn&rsquo;t work. It may have expired or already
            been used — sign in below, or send yourself a new one.
          </ErrorNote>
        </div>
      )}

      <SignInForm />
    </AuthShell>
  );
}
