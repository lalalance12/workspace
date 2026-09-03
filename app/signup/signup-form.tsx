"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input } from "@/components/ui/field";
import { readableAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { authCallbackURL } from "@/lib/site-url";

/**
 * Creating an account.
 *
 * The display name is asked for here rather than derived, because the database
 * trigger falls back to the local part of the email address and "yahshua.lompon"
 * is not what anyone wants pinned to their card in front of the team. It goes
 * into user metadata as full_name, which is exactly where handle_new_user()
 * looks first.
 */
export function SignupForm() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmSent, setConfirmSent] = useState(false);
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
          emailRedirectTo: authCallbackURL(),
          data: { full_name: displayName.trim() },
        },
      });

      if (error) {
        setError(readableAuthError(error.message));
        return;
      }

      // With "Confirm email" on — the default for a hosted project — signUp
      // returns no session and the account is inert until the link is opened.
      if (!data.session) {
        setConfirmSent(true);
        return;
      }

      router.refresh();
      router.replace("/onboarding");
    } finally {
      setPending(false);
    }
  }

  if (confirmSent) {
    return (
      <div className="panel rise-in p-6">
        <span
          aria-hidden="true"
          className="mb-4 block h-1 w-10 rounded-full"
          style={{ backgroundImage: "var(--gradient-brand)" }}
        />
        <p className="text-lg font-medium">Confirm your email</p>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          We sent a link to {email}. Open it and your account is live.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Name" hint="What your team sees on your card.">
        <Input
          required
          autoComplete="name"
          maxLength={60}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Lance"
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
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>

      {error && <ErrorNote>{error}</ErrorNote>}
    </form>
  );
}
