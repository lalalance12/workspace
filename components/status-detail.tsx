"use client";

import Link from "next/link";

import type { NoteStatus } from "@/components/status-note";
import { Dialog } from "@/components/ui/dialog";
import { decayFor } from "@/lib/staleness";
import { presentationFor } from "@/lib/status-state";

/**
 * What a card opens to.
 *
 * The card is the headline and this is the whole thing: the note in full, the
 * details someone took the trouble to write, and the timing spelled out rather
 * than compressed into "3H".
 *
 * It is a reading surface and nothing else. There is no reply box, no comment
 * thread, no reaction — the moment this could be answered in place, Workspace
 * would be a chat app with extra steps. The one action it offers is to the
 * owner of the card, and it is a link to /me.
 */
export function StatusDetail({
  status,
  name,
  now,
  isSelf,
  open,
  onClose,
}: {
  status: NoteStatus | null;
  name: string;
  now: number;
  isSelf: boolean;
  open: boolean;
  onClose: () => void;
}) {
  // Kept mounted through the close animation, so the dialog does not empty out
  // mid-fade. Nothing to render before the first card is ever opened.
  if (!status) return null;

  const look = presentationFor(status.state);
  const decay = decayFor({
    startedAt: status.started_at,
    state: status.state,
    now,
  });
  const label =
    status.state === "other" && status.custom_label
      ? status.custom_label
      : look.label;

  const started = new Date(status.started_at);

  return (
    <Dialog open={open} onClose={onClose} label={`${name}'s status`}>
      <div style={{ "--state": look.accent } as React.CSSProperties}>
        <header className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundImage: "var(--gradient-brand)" }}
            >
              {name.trim().slice(0, 1).toUpperCase() || "?"}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg leading-tight">{name}</h2>
              <p className="annotation mt-1 flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: "var(--state)" }}
                />
                {label}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn btn-ghost shrink-0 px-2.5 py-1 text-sm"
          >
            Close
          </button>
        </header>

        {/* The note, unclamped — this is the reason the card clamps it. */}
        <p className="note-text mt-6 text-2xl break-words">
          {status.note ?? label}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <span className="annotation">Details</span>
          {status.details ? (
            // pre-wrap, not a markdown renderer: the paragraph breaks someone
            // typed are theirs to keep, and anything richer would invite this
            // to become a document.
            <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap break-words text-[var(--ink-soft)]">
              {status.details}
            </p>
          ) : (
            <p className="text-sm text-[var(--ink-soft)]">
              {isSelf
                ? "Nothing yet. Add details on your status when the headline needs more room."
                : "No details on this one."}
            </p>
          )}
        </div>

        <dl className="mt-7 grid grid-cols-2 gap-x-4 gap-y-4 border-t pt-5" style={{ borderColor: "var(--line)" }}>
          <Fact label="Ticket">
            {status.ticket_ref ? (
              <span className="font-[family-name:var(--font-mono)]">
                {status.ticket_ref}
              </span>
            ) : (
              <span className="text-[var(--ink-soft)]">None</span>
            )}
          </Fact>

          <Fact label="Posted">
            {/* The card compresses this to "3H"; here it is the real time. */}
            <span title={started.toISOString()}>
              {started.toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </Fact>

          <Fact label="Age">
            {decay.annotation ?? decay.age}
            {decay.exempt && (
              <span className="ml-2 text-xs text-[var(--ink-soft)]">
                blocked — held at full colour
              </span>
            )}
          </Fact>

          <Fact label="Planned for">
            {status.duration_minutes != null ? (
              <>
                {status.duration_minutes} minutes
                {status.auto_switch_to && (
                  <span className="block text-xs text-[var(--ink-soft)]">
                    then {presentationFor(status.auto_switch_to).label}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[var(--ink-soft)]">Open-ended</span>
            )}
          </Fact>
        </dl>

        {isSelf && (
          <div className="mt-6">
            <Link href="/me" className="btn btn-quiet text-sm">
              Edit your status
            </Link>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="annotation">{label}</dt>
      <dd className="mt-1 text-sm break-words">{children}</dd>
    </div>
  );
}
