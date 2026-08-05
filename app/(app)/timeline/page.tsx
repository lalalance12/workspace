import { StatusNote } from "@/components/status-note";
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
      <div className="mb-8 flex items-baseline justify-between">
        <h1 className="text-2xl tracking-tight">Timeline</h1>
        <span className="annotation">Today</span>
      </div>

      {!rows || rows.length === 0 ? (
        <div className="dimension-rule pt-8 text-center">
          <p className="text-lg">Nothing posted today yet.</p>
          <p className="annotation mt-2">Post the first update</p>
        </div>
      ) : (
        <ol className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-6">
          {rows.map((row) => (
            <li key={row.id}>
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
