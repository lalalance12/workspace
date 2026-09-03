"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input } from "@/components/ui/field";
import { RpcError, createTeam, joinTeam } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";

type Pending = "join" | "create" | null;

/**
 * Two ways in, side by side. Not a wizard — there is no step 2, and hiding one
 * option behind a toggle would just make people guess which one they are.
 *
 * Both paths end at /board, because the first thing a new member should see is
 * what everyone else is on.
 */
export function OnboardingChoice() {
  const router = useRouter();

  const [joinCode, setJoinCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(
    which: Exclude<Pending, null>,
    action: () => Promise<unknown>,
  ) {
    setError(null);
    setPending(which);
    try {
      await action();
      // refresh() first so the server components behind /board are rebuilt with
      // the team the profile now has, rather than the null it was cached with.
      router.refresh();
      router.replace("/board");
    } catch (err) {
      setPending(null);
      setError(
        err instanceof RpcError
          ? err.message
          : which === "join"
            ? "Couldn't join with that code. Check it with whoever sent it."
            : "Couldn't create that team. Try again.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Joining is the common path, so it carries the brand weight. */}
        <section
          className="panel relative overflow-hidden p-6"
          style={{
            backgroundImage:
              "linear-gradient(160deg, color-mix(in oklab, var(--violet) 7%, var(--surface)) 0%, var(--surface) 62%)",
          }}
        >
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-0.5"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          />
          <p className="annotation">Someone invited you</p>
          <h2 className="mt-2 mb-1 text-xl">Join a team</h2>
          <p className="mb-6 text-sm text-[var(--ink-soft)]">
            Paste the eight-character code from whoever runs the board.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("join", () => joinTeam(createClient(), joinCode));
            }}
            className="flex flex-col gap-4"
          >
            <Field label="Join code">
              <Input
                required
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="K7QM4RXP"
                maxLength={8}
                autoComplete="off"
                spellCheck={false}
                className="text-center font-[family-name:var(--font-mono)] text-lg tracking-[0.35em] uppercase"
              />
            </Field>
            <Button type="submit" disabled={pending !== null} data-testid="join-team">
              {pending === "join" ? "Joining…" : "Join team"}
            </Button>
          </form>
        </section>

        <section className="panel p-6">
          <p className="annotation">Nobody did</p>
          <h2 className="mt-2 mb-1 text-xl">Start one</h2>
          <p className="mb-6 text-sm text-[var(--ink-soft)]">
            You become its head, and you get the join code to hand out.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("create", () =>
                createTeam(createClient(), teamName.trim()),
              );
            }}
            className="flex flex-col gap-4"
          >
            <Field label="Team name">
              <Input
                required
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Product"
                maxLength={60}
              />
            </Field>
            <Button
              type="submit"
              variant="quiet"
              disabled={pending !== null}
              data-testid="create-team"
            >
              {pending === "create" ? "Creating…" : "Create team"}
            </Button>
          </form>
        </section>
      </div>

      {error && <ErrorNote testId="onboarding-error">{error}</ErrorNote>}
    </div>
  );
}
