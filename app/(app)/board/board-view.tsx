"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";

import { StatusNote, type NoteStatus } from "@/components/status-note";
import { EmptyState } from "@/components/ui/page";
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
      <EmptyState
        title="Nothing pinned yet"
        hint="The board fills up as people post. Yours is the first."
        action={
          <Link href="/me" className="btn btn-primary">
            Post the first update
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-6">
      <AnimatePresence initial={false}>
        {pinned.map(({ member, status }, i) => (
          <motion.div
            key={member.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{
              duration: 0.26,
              ease: [0.2, 0.8, 0.2, 1],
              // A short stagger on first paint only. Long enough to read as a
              // board assembling itself, short enough that nobody waits.
              delay: Math.min(i * 0.035, 0.28),
            }}
            className="relative"
          >
            {online.has(member.id) && (
              <span
                className="absolute -top-1 -right-1 z-10 size-3 rounded-full ring-2"
                style={{
                  backgroundImage: "var(--gradient-brand)",
                  // The ring cuts the dot out of the card rather than sitting
                  // on top of it, so presence reads as separate from status.
                  ["--tw-ring-color" as string]: "var(--canvas)",
                }}
                title={`${member.display_name} is here`}
                aria-label={`${member.display_name} is here`}
              />
            )}

            {/* Keyed on the status row, so a new one arriving over Realtime
                gets its own entrance instead of silently swapping text. */}
            <motion.div
              key={status.id}
              initial={{ opacity: 0.4, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <StatusNote
                status={status}
                name={nameFor.get(member.id) ?? "Someone"}
                now={now}
              />
            </motion.div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
