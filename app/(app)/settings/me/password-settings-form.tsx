"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input } from "@/components/ui/field";
import { Panel } from "@/components/ui/page";
import { createClient } from "@/lib/supabase/client";

/**
 * Set or change the account password.
 *
 * This is what makes the password option on /login reachable for everyone:
 * anyone who signed up with an email link has no password at all, and without
 * this there is no way to acquire one. It is a separate form from the nudge
 * preferences because forms cannot nest, and because a failed password change
 * should not look like a failed preference save.
 */
export function PasswordSettingsForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }

    setPending(true);
    const { error: err } = await createClient().auth.updateUser({ password });
    setPending(false);

    if (err) {
      setError(
        /should be at least|weak password/i.test(err.message)
          ? "That password is too short. Use at least 8 characters."
          : `Couldn't change your password: ${err.message}`,
      );
      return;
    }

    setPassword("");
    setConfirm("");
    setSaved(true);
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-6">
      <Panel className="flex flex-col gap-6 p-6">
        <div>
          <p className="annotation">Password</p>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Set one and you can sign in without waiting for an email. The link
            keeps working either way.
          </p>
        </div>

        <Field label="New password" hint="At least 8 characters.">
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

        <Field label="Repeat it">
          <Input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
      </Panel>

      <div className="flex items-center gap-4">
        <Button type="submit" variant="quiet" disabled={pending}>
          {pending ? "Saving…" : "Save password"}
        </Button>
        {saved && <span className="annotation">Password updated</span>}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
    </form>
  );
}
