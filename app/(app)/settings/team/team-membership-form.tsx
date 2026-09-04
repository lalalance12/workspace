"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input } from "@/components/ui/field";
import { RpcError, leaveTeam, switchTeam } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";

type Action = "switch" | "leave";

interface Props {
  teamName: string;
  isHead: boolean;
  memberCount: number;
  /**
   * Who inherits the team if the viewer is its head and leaves. Null when they
   * are the only member — the team is then left empty rather than handed on.
   * Computed server-side with the same ordering the RPC uses, so the name shown
   * here is the name that actually gets promoted.
   */
  successorName: string | null;
}

/**
 * Leaving a team, and moving to another one.
 *
 * Both are irreversible from inside the app — you cannot un-leave without the
 * old code — so neither fires on first click. Pressing the button arms a
 * confirmation that spells out what is about to happen to the things people
 * forget about: the status still on the board, the nudges waiting on them, and,
 * if they are the head, who ends up holding the team.
 *
 * The two are separate actions rather than one form with a mode, because they
 * fail differently: a bad join code is a typo you fix and retry, and leaving
 * has nothing to get wrong.
 */
export function TeamMembershipForm({
  teamName,
  isHead,
  memberCount,
  successorName,
}: Props) {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [confirming, setConfirming] = useState<Action | null>(null);
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = pending !== null;

  /**
   * What the person is actually agreeing to. Assembled rather than written out
   * twice: switching and leaving release the membership through the same RPC
   * helper, so they have the same consequences and must not drift apart.
   */
  const consequences = [
    "Your current status closes and comes off the board.",
    "Open nudges to and from you are settled, and your notifications clear.",
    ...(isHead
      ? successorName
        ? [`${successorName} becomes head of ${teamName}.`]
        : [
            `You are the only member, so ${teamName} is left empty. Keep the join code if you might come back to it.`,
          ]
      : []),
  ];

  async function run(action: Action) {
    setError(null);
    setPending(action);

    try {
      const client = createClient();

      if (action === "switch") {
        await switchTeam(client, code);
        // refresh() before navigating, so the server components behind /board
        // rebuild against the team the profile now has rather than the one it
        // was rendered with.
        router.refresh();
        router.replace("/board");
      } else {
        await leaveTeam(client);
        router.refresh();
        // No team means the app layout would bounce off /board anyway. Go
        // straight to the screen that fixes it.
        router.replace("/onboarding");
      }
    } catch (err) {
      setPending(null);
      setConfirming(null);
      setError(
        err instanceof RpcError
          ? err.message
          : action === "switch"
            ? "Couldn't move you to that team. Check the code and your connection."
            : "Couldn't leave the team. Check your connection and try again.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="panel p-6">
        <h2 className="text-xl">Move to another team</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--ink-soft)]">
          Paste the eight-character code for the team you are joining. You leave{" "}
          {teamName} and arrive as a member.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setConfirming("switch");
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Join code">
            <Input
              required
              value={code}
              // Uppercased as it is typed: the codes are generated from an
              // unambiguous uppercase alphabet and the RPC upper()s anyway, so
              // showing it any other way is a lie about what was entered.
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setConfirming(null);
              }}
              placeholder="K7QM4RXP"
              maxLength={8}
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              className="text-center font-[family-name:var(--font-mono)] text-lg tracking-[0.35em] uppercase"
            />
          </Field>

          {confirming !== "switch" && (
            <div>
              <Button
                type="submit"
                variant="quiet"
                disabled={busy || code.trim().length === 0}
                data-testid="switch-team"
              >
                Move to that team
              </Button>
            </div>
          )}
        </form>

        {confirming === "switch" && (
          <Confirmation
            consequences={consequences}
            label="Yes, move me"
            working={pending === "switch"}
            busy={busy}
            onConfirm={() => void run("switch")}
            onCancel={() => setConfirming(null)}
            testId="confirm-switch"
          />
        )}
      </section>

      <section className="panel p-6">
        <h2 className="text-xl">Leave {teamName}</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--ink-soft)]">
          You come off the board and land back on the join screen.{" "}
          {memberCount > 1
            ? `${memberCount - 1} other ${memberCount - 1 === 1 ? "person stays" : "people stay"} on the team.`
            : "Nobody else is on this team."}
        </p>

        {confirming !== "leave" ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setError(null);
              setConfirming("leave");
            }}
            disabled={busy}
            data-testid="leave-team"
            className="text-[var(--signal)]"
          >
            Leave team
          </Button>
        ) : (
          <Confirmation
            consequences={consequences}
            label="Yes, leave"
            working={pending === "leave"}
            busy={busy}
            onConfirm={() => void run("leave")}
            onCancel={() => setConfirming(null)}
            testId="confirm-leave"
          />
        )}
      </section>

      {error && <ErrorNote testId="membership-error">{error}</ErrorNote>}
    </div>
  );
}

/**
 * Deliberately at module scope, not nested in the component above.
 *
 * A component declared inside a render is a new type on every render, so React
 * unmounts and remounts its whole subtree each time the parent updates. Here
 * that would land exactly on the click that matters: pressing Confirm sets
 * pending, the parent re-renders, and the button being pressed is replaced by a
 * fresh DOM node — taking keyboard focus with it, mid-action.
 */
function Confirmation({
  consequences,
  label,
  working,
  busy,
  onConfirm,
  onCancel,
  testId,
}: {
  consequences: string[];
  label: string;
  working: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testId: string;
}) {
  return (
    <div
      className="rise-in mt-4 rounded-[var(--radius-control)] border p-4"
      style={{
        borderColor: "color-mix(in oklab, var(--signal) 35%, transparent)",
        backgroundColor: "color-mix(in oklab, var(--signal) 5%, transparent)",
      }}
    >
      <p className="text-sm font-medium">Before you do:</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {consequences.map((line) => (
          <li key={line} className="flex gap-2 text-sm text-[var(--ink-soft)]">
            <span
              aria-hidden="true"
              className="mt-1.5 size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: "var(--signal)" }}
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          data-testid={testId}
        >
          {working ? "Working…" : label}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
