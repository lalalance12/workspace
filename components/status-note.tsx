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
 * A sticky note on the corkboard.
 *
 * The decay treatment is the signature element of the whole interface, so it
 * is data-driven rather than class-driven: data-decay carries the tier and the
 * CSS in globals.css does the ageing. The mono age label is always rendered,
 * because under prefers-reduced-motion it is the entire staleness signal.
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
      className="note flex min-h-40 w-full flex-col gap-3 p-4"
      data-decay={decay.tier}
      data-blocked={blocked}
      data-testid="status-note"
      data-state={status.state}
      data-profile-id={status.profile_id}
      style={
        {
          "--note-bg": look.noteColor,
          color: look.inkColor,
        } as React.CSSProperties
      }
    >
      <header className="flex items-center gap-2">
        <span className="pushpin" aria-hidden="true" />
        <h3 className="text-sm font-medium tracking-tight">{name}</h3>
      </header>

      <p className="hand flex-1 text-lg">
        {status.note ?? look.label}
      </p>

      <footer className="flex items-end justify-between gap-2">
        <span className="annotation" style={{ color: "inherit", opacity: 0.7 }}>
          {status.ticket_ref ?? look.label}
        </span>
        <span
          className="annotation"
          style={{ color: "inherit", opacity: 0.7 }}
          title={new Date(status.started_at).toLocaleString()}
        >
          {decay.annotation ?? decay.age}
        </span>
      </footer>
    </article>
  );
}
