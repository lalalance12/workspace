"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { StatusNote, type NoteStatus } from "@/components/status-note";
import { createClient } from "@/lib/supabase/client";

export interface BoardMember {
  id: string;
  display_name: string;
}

interface Props {
  teamId: string;
  viewerId: string;
  members: BoardMember[];
  initialStatuses: NoteStatus[];
  /** Server clock at render time, so first paint matches on both sides. */
  serverNow: number;
}

/**
 * The corkboard.
 *
 * Server Components fetched the initial data for a fast first paint; this
 * subscribes to Realtime and patches that data in place. Two separate
 * channels, doing two different jobs:
 *
 *   Postgres Changes — what people are DOING
 *   Presence         — whether they are THERE
 *
 * Presence is never written to Postgres. There is no heartbeat row.
 */
export function BoardView({
  teamId,
  viewerId,
  members,
  initialStatuses,
  serverNow,
}: Props) {
  const [statuses, setStatuses] = useState<Record<string, NoteStatus>>(() =>
    Object.fromEntries(initialStatuses.map((s) => [s.profile_id, s])),
  );
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(serverNow);

  const nameFor = useMemo(
    () => new Map(members.map((m) => [m.id, m.display_name])),
    [members],
  );

  // Decay is time-based, so the board has to keep its own clock or notes would
  // only age on navigation.
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const changes = supabase
      .channel(`board-statuses:${teamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "status_updates",
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          const next = payload.new as NoteStatus;
          setStatuses((prev) => ({ ...prev, [next.profile_id]: next }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(changes);
    };
  }, [teamId]);

  useEffect(() => {
    const supabase = createClient();

    const presence = supabase.channel(`team-presence:${teamId}`, {
      config: { presence: { key: viewerId } },
    });

    presence
      .on("presence", { event: "sync" }, () => {
        setOnline(new Set(Object.keys(presence.presenceState())));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void presence.track({ at: new Date().toISOString() });
        }
      });

    return () => {
      void supabase.removeChannel(presence);
    };
  }, [teamId, viewerId]);

  const pinned = members
    .map((m) => ({ member: m, status: statuses[m.id] }))
    .filter((row): row is { member: BoardMember; status: NoteStatus } =>
      Boolean(row.status),
    );

  if (pinned.length === 0) {
    return (
      <div className="dimension-rule mt-10 pt-8 text-center">
        <p className="text-lg">Nothing pinned yet.</p>
        <p className="annotation mt-2">Post the first update</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-6">
      <AnimatePresence initial={false}>
        {pinned.map(({ member, status }) => (
          <motion.div
            key={member.id}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative"
          >
            {online.has(member.id) && (
              <span
                className="absolute -top-1.5 -right-1.5 z-10 size-2.5 rounded-full bg-[var(--blueprint)]"
                title={`${member.display_name} is here`}
                aria-label={`${member.display_name} is here`}
              />
            )}
            <StatusNote
              status={status}
              name={nameFor.get(member.id) ?? "Someone"}
              now={now}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
