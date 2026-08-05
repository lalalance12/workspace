"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/** Google OAuth and magic link. No passwords in the product. */
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signInWithGoogle() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (!error) return;

    // "Unsupported provider: provider is not enabled" means nobody has
    // configured Google yet, which is a setup step, not something the person
    // signing in can fix. Point them at the path that does work.
    setError(
      /provider is not enabled/i.test(error.message)
        ? "Google sign-in isn't set up on this project yet. Use the email link below."
        : error.message,
    );
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setPending(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="dimension-rule pt-6">
        <p className="text-sm">Check {email} for a sign-in link.</p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="annotation mt-3 cursor-pointer underline"
        >
          Use a different address
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={signInWithGoogle}
        className="cursor-pointer border border-[var(--ink)]/25 px-4 py-2.5 text-sm"
        style={{ borderRadius: "var(--radius-sheet)" }}
      >
        Continue with Google
      </button>

      <div className="dimension-rule pt-5">
        <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="annotation">Or by email</span>
            <input
              type="email"
              required
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
      </div>

      {error && (
        <p role="alert" className="border-l-2 border-[var(--signal)] py-2 pl-3 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
