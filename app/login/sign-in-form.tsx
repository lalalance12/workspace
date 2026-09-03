"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input } from "@/components/ui/field";
import { readableAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { authCallbackURL } from "@/lib/site-url";

/**
 * Signing in.
 *
 * Password is the default because it is the fast path and the one people
 * expect. The emailed link stays available underneath for anyone who never set
 * a password, or forgot it — which is also why there is no separate password
 * reset flow: the link already is one, and a second set of recovery mail is a
 * second thing to keep working.
 */
export function SignInForm() {
  const router = useRouter();

  const [useLink, setUseLink] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createClient();

    try {
      if (useLink) {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: authCallbackURL() },
        });
        if (error) {
          setError(readableAuthError(error.message));
          return;
        }
        setLinkSent(true);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
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

  if (linkSent) {
    return (
      <div className="panel rise-in p-6">
        <span
          aria-hidden="true"
          className="mb-4 block h-1 w-10 rounded-full"
          style={{ backgroundImage: "var(--gradient-brand)" }}
        />
        <p className="text-lg font-medium">Check your inbox</p>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          A sign-in link is on its way to {email}. It expires in an hour.
        </p>
        <Button
          variant="ghost"
          type="button"
          onClick={() => setLinkSent(false)}
          className="mt-4 -ml-3"
        >
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
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

      {!useLink && (
        <Field label="Password">
          <Input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending
          ? useLink
            ? "Sending…"
            : "Signing in…"
          : useLink
            ? "Send sign-in link"
            : "Sign in"}
      </Button>

      <Button
        variant="ghost"
        type="button"
        data-testid="toggle-sign-in-method"
        onClick={() => {
          setUseLink((v) => !v);
          setError(null);
        }}
        className="-ml-3 self-start"
      >
        {useLink ? "Use a password instead" : "Email me a link instead"}
      </Button>

      {error && <ErrorNote>{error}</ErrorNote>}
    </form>
  );
}
