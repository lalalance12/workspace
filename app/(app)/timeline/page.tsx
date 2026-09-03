import Link from "next/link";

import { TimelineView, type TimelineRow } from "./timeline-view";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { getViewer } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * One day of history, chosen by ?date=YYYY-MM-DD.
 *
 * The day lives in the URL rather than in client state so it survives a reload
 * and can be linked to — "here is what Tuesday looked like" is a thing people
 * say. The query stays bounded to a single day for the same reason the board
 * is: this is a glance, not an archive.
 *
 * Everything finer than the day — who, which state, which hours — is filtered
 * client-side, because a day of one team's statuses is a few dozen rows and a
 * round trip per checkbox would lose the instant feel.
 */
function parseDay(input: string | undefined): Date {
  const day = new Date();
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split("-").map(Number);
    const parsed = new Date(y, m - 1, d);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return day;
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer?.profile.team_id) return null;

  const { date } = await searchParams;
  const day = parseDay(date);

  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);

  const supabase = await createClient();

  const [{ data: rows }, { data: members }] = await Promise.all([
    supabase
      .from("status_updates")
      .select(
        "id, profile_id, state, note, ticket_ref, duration_minutes, custom_label, started_at",
      )
      .eq("team_id", viewer.profile.team_id)
      .gte("started_at", from.toISOString())
      .lt("started_at", to.toISOString())
      .order("started_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("team_id", viewer.profile.team_id)
      .order("display_name"),
  ]);

  const count = rows?.length ?? 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = from.getTime() === today.getTime();

  const prev = new Date(from);
  prev.setDate(prev.getDate() - 1);
  const next = new Date(from);
  next.setDate(next.getDate() + 1);

  return (
    <>
      <PageHeader
        title="Timeline"
        meta={`${count} update${count === 1 ? "" : "s"}`}
      />

      {/* Day navigation. Links, not state: the day belongs in the URL. */}
      <nav className="mb-6 flex flex-wrap items-center gap-2">
        <Link href={`/timeline?date=${isoDay(prev)}`} className="btn btn-quiet px-3 py-1.5 text-xs">
          ← Previous
        </Link>

        <span className="px-2 text-sm font-medium">
          {isToday
            ? "Today"
            : from.toLocaleDateString([], {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
        </span>

        {/* Forward is pointless past today — nothing has happened yet. */}
        {!isToday && (
          <Link href={`/timeline?date=${isoDay(next)}`} className="btn btn-quiet px-3 py-1.5 text-xs">
            Next →
          </Link>
        )}

        {!isToday && (
          <Link href="/timeline" className="btn btn-quiet px-3 py-1.5 text-xs">
            Today
          </Link>
        )}

        <span className="annotation ml-auto">{isoDay(from)}</span>
      </nav>

      {count === 0 ? (
        <EmptyState
          title={isToday ? "Nothing posted today yet" : "Nothing posted that day"}
          hint="Pick another day, or post an update and it lands here."
          action={
            isToday ? (
              <Link href="/me" className="btn btn-primary">
                Post the first update
              </Link>
            ) : undefined
          }
        />
      ) : (
        <TimelineView
          rows={(rows ?? []) as TimelineRow[]}
          people={members ?? []}
          serverNow={Date.now()}
        />
      )}
    </>
  );
}
