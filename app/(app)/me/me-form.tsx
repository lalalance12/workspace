"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { StatusNote, type NoteStatus } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input } from "@/components/ui/field";
import { RpcError, setStatus } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";
import {
  STATUS_STATES,
  presentationFor,
  type StatusState,
} from "@/lib/status-state";

interface QuickPick {
  id: string;
  state: string;
  note: string | null;
  ticket_ref: string | null;
}

interface Props {
  profileId: string;
  displayName: string;
  current: NoteStatus | null;
  quickPicks: QuickPick[];
  serverNow: number;
}

/**
 * Setting a status — the most important screen in the product.
 *
 *   submit
 *     -> optimistic local update (the card flips immediately)
 *     -> supabase.rpc('set_status')
 *     -> Postgres closes the old row, inserts the new one, resolves any open
 *        system nudge, saves the quick pick
 *     -> Realtime broadcasts the INSERT and every other client patches
 *
 * On failure the optimistic update rolls back and the message says what failed
 * and what to do. Never a bare "Something went wrong".
 *
 * The card on the right is not a mockup — it is the same StatusNote the board
 * renders, fed from local state as you type. Choosing a state recolours it
 * before you commit to anything.
 */
export function MeForm({
  profileId,
  displayName,
  current,
  quickPicks,
  serverNow,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [state, setState] = useState<StatusState>(
    (current?.state as StatusState) ?? "working",
  );
  const [note, setNote] = useState(current?.note ?? "");
  const [ticketRef, setTicketRef] = useState(current?.ticket_ref ?? "");
  const [customLabel, setCustomLabel] = useState(current?.custom_label ?? "");
  const [durationMinutes, setDurationMinutes] = useState<number | null>(
    current?.duration_minutes ?? null,
  );
  const [autoSwitchTo, setAutoSwitchTo] = useState<StatusState | null>(
    (current?.auto_switch_to as StatusState | null) ?? null,
  );
  const [preview, setPreview] = useState<NoteStatus | null>(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // What the card would look like if posted now. Falls back to the saved status
  // so the panel is never empty while someone is mid-edit.
  const draft: NoteStatus | null =
    note.trim() || ticketRef.trim() || customLabel.trim() || preview
      ? {
          id: preview?.id ?? "draft",
          profile_id: profileId,
          state,
          note: note.trim() || null,
          ticket_ref: ticketRef.trim() || null,
          duration_minutes: durationMinutes,
          auto_switch_to: durationMinutes ? autoSwitchTo : null,
          custom_label: state === "other" ? customLabel.trim() || null : null,
          started_at: preview?.started_at ?? new Date(serverNow).toISOString(),
        }
      : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const rollbackTo = preview;

    // Optimistic: the card flips before the round trip.
    const optimistic: NoteStatus = {
      id: "optimistic",
      profile_id: profileId,
      state,
      note: note.trim() || null,
      ticket_ref: ticketRef.trim() || null,
      duration_minutes: durationMinutes,
      auto_switch_to: durationMinutes ? autoSwitchTo : null,
      custom_label: state === "other" ? customLabel.trim() || null : null,
      started_at: new Date().toISOString(),
    };
    setPreview(optimistic);

    try {
      const saved = await setStatus(createClient(), {
        state,
        note: note.trim() || null,
        ticketRef: ticketRef.trim() || null,
        durationMinutes,
        autoSwitchTo: durationMinutes ? autoSwitchTo : null,
        customLabel: state === "other" ? customLabel.trim() || null : null,
      });
      setPreview(saved as unknown as NoteStatus);
      startTransition(() => router.refresh());
    } catch (err) {
      setPreview(rollbackTo);
      setError(
        err instanceof RpcError
          ? err.message
          : "That update didn't reach the board. Check your connection and post it again.",
      );
    } finally {
      setPending(false);
    }
  }

  function applyQuickPick(pick: QuickPick) {
    setState(pick.state as StatusState);
    setNote(pick.note ?? "");
    setTicketRef(pick.ticket_ref ?? "");
    // Quick picks don't carry a custom label; if it was an 'other' pick the
    // person re-types it in the field that appears.
    setCustomLabel("");
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <form onSubmit={onSubmit} className="flex flex-col gap-7">
        <fieldset className="flex flex-col gap-3">
          <legend className="annotation mb-3">State</legend>
          <div className="flex flex-wrap gap-2">
            {STATUS_STATES.map((s) => {
              const look = presentationFor(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setState(s)}
                  aria-pressed={s === state}
                  className="chip"
                  style={
                    {
                      "--state": look.accent,
                      "--chip-ink": look.onAccent,
                    } as React.CSSProperties
                  }
                >
                  <span className="state-dot" aria-hidden="true" />
                  {look.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {state === "other" && (
          <Field
            label="What state are you in?"
            hint="Shown on your card in place of a preset state."
          >
            <Input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              maxLength={40}
              required
              autoFocus
              placeholder="Pairing, on a call, learning…"
            />
          </Field>
        )}

        <Field label="What you're on">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={140}
            placeholder="Fixing the checkout bug"
          />
        </Field>

        <Field label="Ticket">
          <Input
            value={ticketRef}
            onChange={(e) => setTicketRef(e.target.value)}
            maxLength={32}
            placeholder="WS-118"
            className="font-[family-name:var(--font-mono)] text-sm uppercase"
          />
        </Field>

        <Field label="Duration" hint="How long you expect to be on this.">
          <select
            value={durationMinutes ?? ""}
            onChange={(e) => {
              const next = e.target.value ? Number(e.target.value) : null;
              setDurationMinutes(next);
              // A target only makes sense with a timer to fire it.
              if (!next) setAutoSwitchTo(null);
            }}
            className="input"
          >
            <option value="">Not set</option>
            <option value="1">1 minute (test)</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
          </select>
        </Field>

        {durationMinutes && (
          <Field
            label="Then switch to"
            hint="Optional. When the timer runs out, flip me to this automatically."
          >
            <select
              value={autoSwitchTo ?? ""}
              onChange={(e) =>
                setAutoSwitchTo((e.target.value || null) as StatusState | null)
              }
              className="input"
            >
              <option value="">Stay as is</option>
              {STATUS_STATES.filter((s) => s !== "other").map((s) => (
                <option key={s} value={s}>
                  {presentationFor(s).label}
                </option>
              ))}
            </select>
          </Field>
        )}

        {quickPicks.length > 0 && (
          <div className="flex flex-col gap-3">
            <span className="annotation">Recent</span>
            <div className="flex flex-wrap gap-2">
              {quickPicks.map((pick) => (
                <button
                  key={pick.id}
                  type="button"
                  onClick={() => applyQuickPick(pick)}
                  className="chip"
                  style={
                    { "--state": presentationFor(pick.state).accent } as React.CSSProperties
                  }
                >
                  <span className="state-dot" aria-hidden="true" />
                  {pick.note ?? presentationFor(pick.state).label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <Button type="submit" disabled={pending} data-testid="post-update">
            {pending ? "Posting…" : "Post update"}
          </Button>
        </div>

        {error && <ErrorNote testId="status-error">{error}</ErrorNote>}
      </form>

      <aside className="flex flex-col gap-3">
        <span className="annotation">On the board</span>
        {draft ? (
          <StatusNote status={draft} name={displayName} now={serverNow} />
        ) : (
          <div
            className="grid min-h-44 place-items-center rounded-[var(--radius-card)] border border-dashed p-4 text-center"
            style={{ borderColor: "var(--line-strong)" }}
          >
            <p className="annotation">Nothing pinned yet</p>
          </div>
        )}
        <p className="text-sm text-[var(--ink-soft)]">
          This is the card your team sees. It loses colour as it ages.
        </p>
      </aside>
    </div>
  );
}
