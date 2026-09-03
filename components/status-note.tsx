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
}

/**
 * A status card.
 *
 * Two elements, not one. The avatar overhangs the card's top-left corner, and
 * the curl on an ageing card is a clip-path — which cuts off every child that
 * crosses the boundary. So the avatar is a sibling of the card, and a wrapper
 * carries data-decay and --state for both of them to inherit.
 *
 * The decay treatment stays data-driven: data-decay carries the tier and the
 * CSS mixes every colour against it. The card gets two inputs — --state from
 * the status, --tint from its age — and everything else falls out of those.
 *
 * The mono age label is always rendered. Under prefers-reduced-motion, with the
 * tilt and the breathing gone, it is the entire staleness signal.
 */
export function StatusNote({ status, name, now, action }: Props) {
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
        {/* Left padding clears the avatar overhanging from above. */}
        <header className="flex min-h-9 items-center justify-between gap-2 pl-11">
          <h3 className="truncate text-sm font-medium tracking-tight">{name}</h3>
          <div className="flex items-center gap-2">
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

        <p className="note-text flex-1 text-lg">{status.note ?? label}</p>

        <footer className="flex items-end justify-between gap-3">
          <span
            className="annotation truncate"
            style={{ color: "inherit", opacity: 0.65 }}
          >
            {status.ticket_ref ?? label}
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

      {/* Sibling, not child: see the note above about clip-path. */}
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
