"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { StatusNote, type NoteStatus } from "@/components/status-note";
import { RpcError, setStatus } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";
import { STATUS_STATES, presentationFor, type StatusState } from "@/lib/status-state";

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
 *     -> optimistic local update (the note flips immediately)
 *     -> supabase.rpc('set_status')
 *     -> Postgres closes the old row, inserts the new one, resolves any open
 *        system nudge, saves the quick pick
 *     -> Realtime broadcasts the INSERT and every other client patches
 *
 * On failure the optimistic update rolls back and the toast says what failed
 * and what to do. Never a bare "Something went wrong".
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
  const [preview, setPreview] = useState<NoteStatus | null>(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const rollbackTo = preview;

    // Optimistic: the note flips before the round trip.
    const optimistic: NoteStatus = {
      id: "optimistic",
      profile_id: profileId,
      state,
      note: note.trim() || null,
      ticket_ref: ticketRef.trim() || null,
      started_at: new Date().toISOString(),
    };
    setPreview(optimistic);

    try {
      const saved = await setStatus(createClient(), {
        state,
        note: note.trim() || null,
        ticketRef: ticketRef.trim() || null,
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
  }

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_15rem]">
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-3">
          <legend className="annotation mb-2">State</legend>
          <div className="flex flex-wrap gap-2">
            {STATUS_STATES.map((s) => {
              const look = presentationFor(s);
              const active = s === state;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setState(s)}
                  aria-pressed={active}
                  className="cursor-pointer border px-3 py-2 text-sm"
                  style={{
                    borderRadius: "var(--radius-sheet)",
                    background: active ? look.noteColor : "transparent",
                    color: active ? look.inkColor : "var(--ink)",
                    borderColor: active
                      ? "transparent"
                      : "color-mix(in srgb, var(--ink) 25%, transparent)",
                  }}
                >
                  {look.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="flex flex-col gap-2">
          <span className="annotation">What you&rsquo;re on</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={140}
            placeholder="Fixing the checkout bug"
            className="border border-[var(--ink)]/25 bg-transparent px-3 py-2"
            style={{ borderRadius: "var(--radius-sheet)" }}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="annotation">Ticket</span>
          <input
            value={ticketRef}
            onChange={(e) => setTicketRef(e.target.value)}
            maxLength={32}
            placeholder="WS-118"
            className="border border-[var(--ink)]/25 bg-transparent px-3 py-2 font-mono text-sm uppercase"
            style={{ borderRadius: "var(--radius-sheet)" }}
          />
        </label>

        {quickPicks.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="annotation">Recent</span>
            <div className="flex flex-wrap gap-2">
              {quickPicks.map((pick) => (
                <button
                  key={pick.id}
                  type="button"
                  onClick={() => applyQuickPick(pick)}
                  className="annotation cursor-pointer border border-[var(--ink)]/25 px-2 py-1"
                  style={{ borderRadius: "var(--radius-sheet)" }}
                >
                  {pick.note ?? presentationFor(pick.state).label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="dimension-rule pt-5">
          <button
            type="submit"
            disabled={pending}
            data-testid="post-update"
            className="cursor-pointer bg-[var(--ink)] px-4 py-2.5 text-sm text-[var(--paper)] disabled:opacity-60"
            style={{ borderRadius: "var(--radius-sheet)" }}
          >
            {pending ? "Posting…" : "Post update"}
          </button>
        </div>

        {error && (
          <p
            role="alert"
            data-testid="status-error"
            className="border-l-2 border-[var(--signal)] py-2 pl-3 text-sm"
          >
            {error}
          </p>
        )}
      </form>

      <aside className="flex flex-col gap-3">
        <span className="annotation">On the board</span>
        {preview ? (
          <StatusNote status={preview} name={displayName} now={serverNow} />
        ) : (
          <p className="annotation">Nothing pinned yet</p>
        )}
      </aside>
    </div>
  );
}
