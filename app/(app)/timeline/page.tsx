import Link from "next/link";

import { StatusNote } from "@/components/status-note";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { getViewer } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

/** Today's history. Replay is not built yet; this is the honest list. */
export default async function TimelinePage() {
  const viewer = await getViewer();
  if (!viewer?.profile.team_id) return null;

  const supabase = await createClient();
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const [{ data: rows }, { data: members }] = await Promise.all([
    supabase
      .from("status_updates")
      .select("id, profile_id, state, note, ticket_ref, started_at")
      .eq("team_id", viewer.profile.team_id)
      .gte("started_at", since.toISOString())
      .order("started_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("team_id", viewer.profile.team_id),
  ]);

  const nameFor = new Map((members ?? []).map((m) => [m.id, m.display_name]));
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Timeline"
        meta={`Today · ${rows?.length ?? 0} update${rows?.length === 1 ? "" : "s"}`}
      />

      {!rows || rows.length === 0 ? (
        <EmptyState
          title="Nothing posted today yet"
          hint="Every status the team posts today lands here, newest first."
          action={
            <Link href="/me" className="btn btn-primary">
              Post the first update
            </Link>
          }
        />
      ) : (
        <ol className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-6">
          {rows.map((row, i) => (
            <li
              key={row.id}
              className="rise-in"
              style={{ animationDelay: `${Math.min(i * 35, 280)}ms` }}
            >
              <StatusNote
                status={row}
                name={nameFor.get(row.profile_id) ?? "Someone"}
                now={now}
              />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
