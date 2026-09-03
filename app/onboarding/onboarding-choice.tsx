"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

  async function run(which: Exclude<Pending, null>, action: () => Promise<unknown>) {
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
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 md:grid-cols-2">
        <section className="flex flex-col gap-4">
          <div>
            <p className="annotation">Someone invited you</p>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              Paste the 8-character code from whoever runs the board.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("join", () => joinTeam(createClient(), joinCode));
            }}
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-2">
              <span className="annotation">Join code</span>
              <input
                required
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="K7QM4RXP"
                maxLength={8}
                autoComplete="off"
                spellCheck={false}
                className="border border-[var(--ink)]/25 bg-transparent px-3 py-2 font-mono text-lg tracking-[0.3em] uppercase"
                style={{ borderRadius: "var(--radius-sheet)" }}
              />
            </label>
            <button
              type="submit"
              disabled={pending !== null}
              data-testid="join-team"
              className="cursor-pointer self-start bg-[var(--ink)] px-4 py-2.5 text-sm text-[var(--paper)] disabled:opacity-60"
              style={{ borderRadius: "var(--radius-sheet)" }}
            >
              {pending === "join" ? "Joining…" : "Join team"}
            </button>
          </form>
        </section>

        <section className="dimension-rule flex flex-col gap-4 pt-8 md:border-t-0 md:pt-0 md:pl-8">
          <div>
            <p className="annotation">Nobody did</p>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              Start a board. You become its head, and you get the join code to
              hand out.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("create", () => createTeam(createClient(), teamName.trim()));
            }}
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-2">
              <span className="annotation">Team name</span>
              <input
                required
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Product"
                maxLength={60}
                className="border border-[var(--ink)]/25 bg-transparent px-3 py-2"
                style={{ borderRadius: "var(--radius-sheet)" }}
              />
            </label>
            <button
              type="submit"
              disabled={pending !== null}
              data-testid="create-team"
              className="cursor-pointer self-start border border-[var(--ink)]/25 px-4 py-2.5 text-sm disabled:opacity-60"
              style={{ borderRadius: "var(--radius-sheet)" }}
            >
              {pending === "create" ? "Creating…" : "Create team"}
            </button>
          </form>
        </section>
      </div>

      {error && (
        <p
          role="alert"
          data-testid="onboarding-error"
          className="border-l-2 border-[var(--signal)] py-2 pl-3 text-sm"
        >
          {error}
        </p>
      )}
    </div>
  );
}
