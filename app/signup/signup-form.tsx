"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input } from "@/components/ui/field";
import { readableAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { authCallbackURL } from "@/lib/site-url";

/**
 * Creating an account. Valid inputs in, signed-in session out — no email, no
 * confirmation step, no waiting on a provider that rations messages by the
 * hour.
 *
 * That requires "Confirm email" to be OFF on the Supabase project. It is off in
 * supabase/config.toml for local, but the hosted project ships with it ON, and
 * the difference is invisible until someone signs up. So the no-session branch
 * below does not pretend everything is fine: it says which setting is wrong,
 * because the person hitting it is usually the one who can fix it.
 *
 * The display name is asked for rather than derived. handle_new_user() falls
 * back to the local part of the email address, and nobody wants that pinned to
 * their card in front of the team.
 */
export function SignupForm() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const { data, error } = await createClient().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: displayName.trim() },
          // Unused while confirmations are off, and exactly what makes the
          // link land somewhere sensible if they are ever switched back on.
          emailRedirectTo: authCallbackURL(),
        },
      });

      if (error) {
        setError(readableAuthError(error.message));
        return;
      }

      if (!data.session) {
        setNeedsConfirmation(true);
        return;
      }

      router.refresh();
      router.replace("/onboarding");
    } finally {
      setPending(false);
    }
  }

  if (needsConfirmation) {
    return (
      <div className="panel rise-in p-6">
        <span
          aria-hidden="true"
          className="mb-4 block h-1 w-10 rounded-full"
          style={{ backgroundImage: "var(--gradient-brand)" }}
        />
        <p className="text-lg font-medium">Account made, but not active yet</p>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          This project still has email confirmation switched on, so we sent a
          link to {email} and the account stays inert until it is opened.
        </p>
        <p className="annotation mt-4">
          Turn it off: Supabase → Authentication → Sign In / Providers → Email →
          Confirm email
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Name" hint="What your team sees on your card.">
        <Input
          required
          autoFocus
          autoComplete="name"
          maxLength={60}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Lance"
          data-testid="name"
        />
      </Field>

      <Field label="Email">
        <Input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          data-testid="email"
        />
      </Field>

      <Field label="Password" hint="At least 8 characters.">
        <Input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          data-testid="password"
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full" data-testid="create-account">
        {pending ? "Creating account…" : "Create account"}
      </Button>

      {error && <ErrorNote>{error}</ErrorNote>}
    </form>
  );
}
