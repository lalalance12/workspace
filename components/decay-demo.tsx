import { StatusNote, type NoteStatus } from "@/components/status-note";

/**
 * Three cards at three ages.
 *
 * The product's one real idea, rendered rather than described: a fresh status
 * at full colour, one an hour and a half old, and one that has been sitting
 * there most of a day. Nothing else on a signed-out page has to explain what
 * "ambient" means.
 *
 * Lives here rather than inside the auth shell because the landing page shows
 * the same thing, and two copies of a demo drift until they are demonstrating
 * different products.
 *
 * `now` comes from the caller — computed once on the server and passed down —
 * so the cards render identically either side of hydration.
 */
const HOUR = 3_600_000;

export function demoCards(now: number): Array<{ status: NoteStatus; name: string }> {
  const at = (hoursAgo: number) => new Date(now - hoursAgo * HOUR).toISOString();

  return [
    {
      name: "Dana",
      status: {
        id: "demo-1",
        profile_id: "demo-1",
        state: "working",
        note: "Rewriting the checkout retry",
        ticket_ref: "WS-118",
        duration_minutes: 45,
        started_at: at(0.3),
      },
    },
    {
      name: "Ravi",
      status: {
        id: "demo-2",
        profile_id: "demo-2",
        state: "blocked",
        note: "Waiting on the staging key",
        ticket_ref: "WS-121",
        duration_minutes: null,
        started_at: at(1.4),
      },
    },
    {
      name: "Mei",
      status: {
        id: "demo-3",
        profile_id: "demo-3",
        state: "reviewing",
        note: "Reading the migration diff",
        ticket_ref: "WS-104",
        duration_minutes: 30,
        started_at: at(7.5),
      },
    },
  ];
}

/** The three cards, staggered in. No preview: there is nothing behind them. */
export function DecayDemo({ now }: { now: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {demoCards(now).map(({ status, name }, i) => (
        <div
          key={status.id}
          className="rise-in"
          style={{ animationDelay: `${120 + i * 90}ms` }}
        >
          <StatusNote status={status} name={name} now={now} />
        </div>
      ))}
    </div>
  );
}
