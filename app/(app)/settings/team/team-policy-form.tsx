"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input, Toggle } from "@/components/ui/field";
import { Panel } from "@/components/ui/page";
import { RpcError, messageForError, rotateJoinCode } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";

export interface TeamPolicy {
  id: string;
  name: string;
  join_code: string;
  stale_after_minutes: number;
  renudge_after_minutes: number;
  system_nudges_enabled: boolean;
  peer_nudges_per_hour: number;
  peer_nudges_per_recipient_per_hour: number;
}

/**
 * The head edits nudge policy here.
 *
 * These write straight to public.teams — no RPC needed, because the "head
 * updates own team" policy plus the table GRANT already say exactly who may.
 * A member reaching this page is redirected before it renders.
 *
 * The bounds below are not UI preferences. They mirror CHECK constraints on the
 * table, so a value outside them is refused by Postgres whatever the input
 * says. Stating them in the hint means nobody discovers the limit by hitting it.
 */
const BOUNDS = {
  stale_after_minutes: { min: 15, max: 1440 },
  renudge_after_minutes: { min: 15, max: 1440 },
  peer_nudges_per_recipient_per_hour: { min: 0, max: 20 },
  peer_nudges_per_hour: { min: 0, max: 100 },
} as const;

export function TeamPolicyForm({ team }: { team: TeamPolicy }) {
  const router = useRouter();

  const [name, setName] = useState(team.name);
  const [stale, setStale] = useState(String(team.stale_after_minutes));
  const [renudge, setRenudge] = useState(String(team.renudge_after_minutes));
  const [system, setSystem] = useState(team.system_nudges_enabled);
  const [perPerson, setPerPerson] = useState(
    String(team.peer_nudges_per_recipient_per_hour),
  );
  const [perHour, setPerHour] = useState(String(team.peer_nudges_per_hour));

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [code, setCode] = useState(team.join_code);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const numbers = {
      stale_after_minutes: Number(stale),
      renudge_after_minutes: Number(renudge),
      peer_nudges_per_recipient_per_hour: Number(perPerson),
      peer_nudges_per_hour: Number(perHour),
    };

    for (const [key, value] of Object.entries(numbers)) {
      const { min, max } = BOUNDS[key as keyof typeof BOUNDS];
      if (!Number.isInteger(value) || value < min || value > max) {
        setError(
          `${LABELS[key as keyof typeof LABELS]} has to be a whole number between ${min} and ${max}.`,
        );
        return;
      }
    }

    if (!name.trim()) {
      setError("The team needs a name — it's the heading on this page.");
      return;
    }

    // A re-nudge window shorter than the staleness window means the scheduler
    // becomes eligible again before the status it is chasing has even gone
    // stale, which reads as nagging. Postgres allows it; say something.
    if (numbers.renudge_after_minutes < numbers.stale_after_minutes) {
      setError(
        "Re-nudge after should be at least as long as Stale after, or people get asked again before the next status has had time to age.",
      );
      return;
    }

    setPending(true);
    const { error: err } = await createClient()
      .from("teams")
      .update({ name: name.trim(), system_nudges_enabled: system, ...numbers })
      .eq("id", team.id);
    setPending(false);

    if (err) setError(messageForError(err));
    else {
      setSaved(true);
      router.refresh();
    }
  }

  async function onRotate() {
    setError(null);
    setRotating(true);
    try {
      const next = await rotateJoinCode(createClient());
      // The RPC returns the new code; take it rather than refetching.
      if (typeof next === "string") setCode(next);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof RpcError ? err.message : "Couldn't rotate the code.",
      );
    } finally {
      setRotating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel className="p-6">
        <p className="annotation">Join code</p>
        <p
          className="gradient-text mt-3 font-[family-name:var(--font-mono)] text-3xl font-bold tracking-[0.28em]"
          data-testid="join-code"
        >
          {code}
        </p>
        <p className="mt-4 text-sm text-[var(--ink-soft)]">
          Anyone holding this can join. Rotating it invalidates the old one
          immediately — people already on the team stay on it.
        </p>
        <Button
          variant="quiet"
          type="button"
          onClick={() => void onRotate()}
          disabled={rotating}
          className="mt-4"
        >
          {rotating ? "Rotating…" : "Rotate code"}
        </Button>
      </Panel>

      <form onSubmit={onSave} className="flex flex-col gap-6">
        <Panel className="flex flex-col gap-6 p-6">
          <p className="annotation">Team</p>
          <Field label="Name">
            <Input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="team-name"
            />
          </Field>
        </Panel>

        <Panel className="flex flex-col gap-6 p-6">
          <div>
            <p className="annotation">System nudges</p>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              The scheduler asks people to update when their status has sat too
              long. It never stacks — one open question at a time.
            </p>
          </div>

          <Toggle checked={system} onChange={setSystem}>
            Ask people to update when their status goes stale
          </Toggle>

          <Field
            label="Stale after (minutes)"
            hint={`When a status becomes eligible for a nudge. ${BOUNDS.stale_after_minutes.min}–${BOUNDS.stale_after_minutes.max}.`}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={BOUNDS.stale_after_minutes.min}
              max={BOUNDS.stale_after_minutes.max}
              value={stale}
              onChange={(e) => setStale(e.target.value)}
              disabled={!system}
              data-testid="stale-after"
            />
          </Field>

          <Field
            label="Re-nudge after (minutes)"
            hint={`How long before the same person can be asked again, answered or not. ${BOUNDS.renudge_after_minutes.min}–${BOUNDS.renudge_after_minutes.max}.`}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={BOUNDS.renudge_after_minutes.min}
              max={BOUNDS.renudge_after_minutes.max}
              value={renudge}
              onChange={(e) => setRenudge(e.target.value)}
              disabled={!system}
              data-testid="renudge-after"
            />
          </Field>
        </Panel>

        <Panel className="flex flex-col gap-6 p-6">
          <div>
            <p className="annotation">Peer nudges</p>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              What one teammate can send another from the board. Set either
              limit to 0 to switch peer nudging off for the whole team.
            </p>
          </div>

          <Field
            label="Per person, per hour"
            hint={`How often one teammate can nudge the same person. ${BOUNDS.peer_nudges_per_recipient_per_hour.min}–${BOUNDS.peer_nudges_per_recipient_per_hour.max}.`}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={BOUNDS.peer_nudges_per_recipient_per_hour.min}
              max={BOUNDS.peer_nudges_per_recipient_per_hour.max}
              value={perPerson}
              onChange={(e) => setPerPerson(e.target.value)}
              data-testid="per-recipient"
            />
          </Field>

          <Field
            label="Total, per hour"
            hint={`How many nudges one person can send in total. ${BOUNDS.peer_nudges_per_hour.min}–${BOUNDS.peer_nudges_per_hour.max}.`}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={BOUNDS.peer_nudges_per_hour.min}
              max={BOUNDS.peer_nudges_per_hour.max}
              value={perHour}
              onChange={(e) => setPerHour(e.target.value)}
              data-testid="per-hour"
            />
          </Field>
        </Panel>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={pending} data-testid="save-policy">
            {pending ? "Saving…" : "Save policy"}
          </Button>
          {saved && <span className="annotation">Saved</span>}
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}
      </form>
    </div>
  );
}

const LABELS = {
  stale_after_minutes: "Stale after",
  renudge_after_minutes: "Re-nudge after",
  peer_nudges_per_recipient_per_hour: "Per person, per hour",
  peer_nudges_per_hour: "Total, per hour",
} as const;
