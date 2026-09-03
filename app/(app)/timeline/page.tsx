import Link from "next/link";

import { TimelineView, type TimelineRow } from "./timeline-view";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { getViewer } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

/** Today's history. Fetched once on the server; filtered and re-cut client-side. */
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
      .eq("team_id", viewer.profile.team_id)
      .order("display_name"),
  ]);

  const count = rows?.length ?? 0;

  return (
    <>
      <PageHeader
        title="Timeline"
        meta={`Today · ${count} update${count === 1 ? "" : "s"}`}
      />

      {count === 0 ? (
        <EmptyState
          title="Nothing posted today yet"
          hint="Every status the team posts today lands here, and you can cut it by person, state or hour."
          action={
            <Link href="/me" className="btn btn-primary">
              Post the first update
            </Link>
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
