"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";
import { authCallbackURL } from "@/lib/site-url";

/**
 * Magic link only. No passwords, no OAuth providers.
 *
 * The redirect is built from the configured site URL rather than the current
 * origin — see lib/site-url.ts for why that distinction matters once the link
 * has to survive a trip through an inbox.
 */
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: authCallbackURL() },
    });

    setPending(false);

    if (!error) {
      setSent(true);
      return;
    }

    // Supabase rate-limits sign-in emails per address and per project. Saying
    // so beats the raw "For security purposes..." string, which reads like a
    // rejection rather than a wait.
    setError(
      /rate limit|too many requests|for security purposes/i.test(error.message)
        ? "That's a few links in a short window. Wait a minute, then try again."
        : error.message,
    );
  }

  if (sent) {
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
          onClick={() => setSent(false)}
          className="mt-4 -ml-3"
        >
          Use a different address
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={sendMagicLink} className="flex flex-col gap-4">
        <Field label="Email">
          <Input
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Sending…" : "Send sign-in link"}
        </Button>
      </form>

      <p className="text-sm text-[var(--ink-soft)]">
        No password. We email you a link that signs you in.
      </p>

      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}
