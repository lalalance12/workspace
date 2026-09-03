import { decayFor } from "@/lib/staleness";
import { presentationFor } from "@/lib/status-state";

export interface NoteStatus {
  id: string;
  profile_id: string;
  state: string;
  note: string | null;
  ticket_ref: string | null;
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
}

/**
 * A status card.
 *
 * The decay treatment is the signature of the whole interface, so it stays
 * data-driven rather than class-driven: data-decay carries the tier and the CSS
 * mixes every colour on the card against it. The card gets exactly two inputs —
 * --state from the status, --tint from its age — and everything else falls out
 * of those.
 *
 * The mono age label is always rendered. Under prefers-reduced-motion, with the
 * tilt and the breathing gone, it is the entire staleness signal.
 */
export function StatusNote({ status, name, now }: Props) {
  const decay = decayFor({
    startedAt: status.started_at,
    state: status.state,
    now,
  });
  const look = presentationFor(status.state);
  const blocked = status.state === "blocked";

  return (
    <article
      className="note flex min-h-44 w-full flex-col gap-3 p-4 pl-5"
      data-decay={decay.tier}
      data-blocked={blocked}
      data-testid="status-note"
      data-state={status.state}
      data-profile-id={status.profile_id}
      style={{ "--state": look.accent } as React.CSSProperties}
    >
      <header className="flex items-center gap-2">
        <span className="state-dot" aria-hidden="true" />
        <h3 className="text-sm font-medium tracking-tight">{name}</h3>
      </header>

      <p className="note-text flex-1 text-lg">{status.note ?? look.label}</p>

      <footer className="flex items-end justify-between gap-3">
        <span
          className="annotation truncate"
          style={{ color: "inherit", opacity: 0.65 }}
        >
          {status.ticket_ref ?? look.label}
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
  );
}
