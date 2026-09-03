"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input } from "@/components/ui/field";
import { readableAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";

/**
 * Signing in. Email and password, nothing else.
 *
 * The magic link used to live here as a second option and was removed on
 * purpose: Supabase's built-in sender allows a couple of emails an HOUR across
 * the whole project, so on any team larger than two people the link stops being
 * a fallback and starts being a wall. Password sign-in touches no email
 * infrastructure at all and cannot be rate limited into uselessness.
 *
 * The consequence to keep in mind: there is no self-serve password recovery.
 * Until custom SMTP is configured, a forgotten password is reset by an admin
 * from the Supabase dashboard.
 */
export function SignInForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const { error } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setError(readableAuthError(error.message));
        return;
      }

      // refresh() first so the server rebuilds with the cookie the client just
      // set; replace() then moves off /login without leaving it in history.
      router.refresh();
      router.replace("/board");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Email">
        <Input
          type="email"
          required
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          data-testid="email"
        />
      </Field>

      <Field label="Password">
        <Input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          data-testid="password"
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full" data-testid="sign-in">
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      {error && <ErrorNote>{error}</ErrorNote>}
    </form>
  );
}
