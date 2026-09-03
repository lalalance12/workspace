"use client";

import { useState } from "react";

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
      <div className="dimension-rule pt-6">
        <p className="text-sm">Check {email} for a sign-in link.</p>
        <p className="annotation mt-2">It expires in an hour</p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="annotation mt-4 cursor-pointer underline"
        >
          Use a different address
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="annotation">Email</span>
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="border border-[var(--ink)]/25 bg-transparent px-3 py-2"
            style={{ borderRadius: "var(--radius-sheet)" }}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer bg-[var(--ink)] px-4 py-2.5 text-sm text-[var(--paper)] disabled:opacity-60"
          style={{ borderRadius: "var(--radius-sheet)" }}
        >
          {pending ? "Sending…" : "Send sign-in link"}
        </button>
      </form>

      <p className="text-sm text-[var(--ink-soft)]">
        No password. We email you a link that signs you in.
      </p>

      {error && (
        <p role="alert" className="border-l-2 border-[var(--signal)] py-2 pl-3 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
