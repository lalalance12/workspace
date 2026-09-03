import Link from "next/link";

import { SignupForm } from "./signup-form";
import { AuthShell } from "@/components/auth-shell";

export default function SignupPage() {
  return (
    <AuthShell
      title={
        <>
          Start <span className="gradient-text">posting</span>.
        </>
      }
      subtitle="Create an account, then join a team or start one."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[var(--violet)] underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
