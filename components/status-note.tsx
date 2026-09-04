import type { ReactNode } from "react";

import { decayFor } from "@/lib/staleness";
import { presentationFor } from "@/lib/status-state";

export interface NoteStatus {
  id: string;
  profile_id: string;
  state: string;
  note: string | null;
  ticket_ref: string | null;
  duration_minutes: number | null;
  /** Only read by the /me form to re-fill its picker; the card never shows it. */
  auto_switch_to?: string | null;
  /** The person's own words, shown in place of the label when state is 'other'. */
  custom_label?: string | null;
  /**
   * The long half. Never drawn on the card — the preview is what opens it. Its
   * presence is the only thing the card shows, as a marker in the footer.
   */
  details?: string | null;
  started_at: string;
}

interface Props {
  status: NoteStatus;
  name: string;
  /**
   * Supplied by the caller rather than read from Date.now() so the server and
   * client agree on first paint. The board ticks it once a minute.
   */
  now: number;
  /**
   * Rendered at the right of the header row. A slot rather than a set of
   * flags — the board puts a nudge control here, the timeline puts nothing, and
   * the card does not need to know which is which. Anything placed here shares
   * the header's row, so it can never land on top of the status text or the
   * footer the way an absolutely positioned overlay did.
   */
  action?: ReactNode;
  /**
   * Opens the preview. Optional: the board passes it, the /me draft card and
   * the timeline do not — a card you are still typing has nothing to expand to,
   * and the timeline is already the long view.
   *
   * Rendered as a button stretched over the whole card rather than by making
   * the card itself clickable. The card contains the Nudge button, and a button
   * inside a button is invalid HTML that screen readers cannot announce. As a
   * sibling under the interactive bits it gets keyboard focus, Enter and Space
   * for free, and nests nothing.
   */
  onOpen?: () => void;
}

/**
 * A status card.
 *
 * Two elements, not one. The avatar overhangs the card's top-left corner, so it
 * is a sibling of the card rather than a child of it, and a wrapper carries
 * data-decay and --state for both of them to inherit from one place. (It began
 * as a workaround for a clip-path that took a bite out of an ageing card and
 * cut off anything crossing the boundary. That went with the geometry; the
 * structure stayed, because one element owning the tint is still right.)
 *
 * The decay treatment stays data-driven: data-decay carries the tier and the
 * CSS mixes every colour against it. The card gets two inputs — --state from
 * the status, --tint from its age — and everything else falls out of those.
 *
 * The mono age label is always rendered. Under prefers-reduced-motion, with the
 * breathing gone, it is the entire staleness signal.
 */
export function StatusNote({ status, name, now, action, onOpen }: Props) {
  const decay = decayFor({
    startedAt: status.started_at,
    state: status.state,
    now,
  });
  const look = presentationFor(status.state);
  const blocked = status.state === "blocked";
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  // For 'other', the person's own words stand in for the generic state name.
  const label =
    status.state === "other" && status.custom_label
      ? status.custom_label
      : look.label;

  return (
    <div
      className="note-wrap relative pt-3.5"
      data-decay={decay.tier}
      data-blocked={blocked}
      style={{ "--state": look.accent } as React.CSSProperties}
    >
      <article
        className="note flex min-h-44 w-full flex-col gap-3 p-4"
        data-decay={decay.tier}
        data-blocked={blocked}
        data-testid="status-note"
        data-state={status.state}
        data-profile-id={status.profile_id}
      >
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            data-testid="open-status"
            className="note-open"
            // The card's own text is the accessible name of everything under
            // this button, so the button has to say what it does instead.
            aria-label={`Open ${name}'s status`}
          />
        )}

        {/* Left padding clears the avatar overhanging from above. */}
        <header className="flex min-h-9 items-center justify-between gap-2 pl-11">
          <h3 className="truncate text-sm font-medium tracking-tight">{name}</h3>
          {/* Lifted above the stretched trigger: this is where the Nudge button
              lives, and it must stay clickable in its own right. */}
          <div className="relative z-[2] flex items-center gap-2">
            {status.duration_minutes != null && (
              <span
                className="annotation rounded-full border px-2 py-0.5 text-[0.65rem] whitespace-nowrap"
                style={{
                  color: "inherit",
                  opacity: 0.7,
                  borderColor:
                    "color-mix(in oklab, currentColor 30%, transparent)",
                }}
                title={`Planned for ${status.duration_minutes} minutes`}
              >
                {status.duration_minutes}M
              </span>
            )}
            {action}
          </div>
        </header>

        {/* Clamped to three lines. The database allows 140 characters and the
            card is one column of a grid: unclamped, one wordy status makes its
            card taller than every neighbour and the row it sits in goes with
            it. The full text is one click away. */}
        <p className="note-text note-clamp flex-1 text-lg">
          {status.note ?? label}
        </p>

        <footer className="flex items-end justify-between gap-3">
          <span
            className="annotation flex min-w-0 items-center gap-1.5"
            style={{ color: "inherit", opacity: 0.65 }}
          >
            <span className="truncate">{status.ticket_ref ?? label}</span>
            {/* The only trace details leave on the card. Under the stretched
                trigger on purpose, so pressing the thing that says there is
                more is what opens it. */}
            {status.details && (
              <span
                className="shrink-0 rounded-full border px-1.5 text-[0.6rem] leading-[1.4]"
                style={{
                  borderColor:
                    "color-mix(in oklab, currentColor 30%, transparent)",
                }}
              >
                +
              </span>
            )}
          </span>
          <span
            className="annotation whitespace-nowrap"
            style={{ color: "inherit", opacity: 0.65 }}
            title={new Date(status.started_at).toLocaleString()}
          >
            {decay.annotation ?? decay.age}
          </span>
        </footer>
      </article>

      {/* Sibling, not child: see the note above. */}
      <span
        className="avatar absolute top-0 left-4 z-10"
        aria-hidden="true"
        title={name}
      >
        {initial}
      </span>
    </div>
  );
}
