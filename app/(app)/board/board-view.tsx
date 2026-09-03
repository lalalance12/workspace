"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";

import { NudgeBanner, type PeerNudge } from "@/components/nudge-banner";
import { NudgeComposer } from "@/components/nudge-composer";
import { StatusNote, type NoteStatus } from "@/components/status-note";
import { EmptyState } from "@/components/ui/page";
import { createClient } from "@/lib/supabase/client";

export interface BoardMember {
  id: string;
  display_name: string;
  message_link?: string | null;
  peer_nudges_enabled?: boolean;
  nudges_paused_until?: string | null;
}

interface Props {
  teamId: string;
  viewerId: string;
  members: BoardMember[];
  initialStatuses: NoteStatus[];
  initialNudges: PeerNudge[];
  /** Server clock at render time, so first paint matches on both sides. */
  serverNow: number;
}

/**
 * The corkboard.
 *
 * Server Components fetched the initial data for a fast first paint; this
 * subscribes to Realtime and patches that data in place. Three channels, three
 * jobs:
 *
 *   Postgres Changes on status_updates — what people are DOING
 *   Postgres Changes on nudges         — who is being asked for attention
 *   Presence                           — whether they are THERE
 *
 * Presence is never written to Postgres. There is no heartbeat row.
 */
export function BoardView({
  teamId,
  viewerId,
  members,
  initialStatuses,
  initialNudges,
  serverNow,
}: Props) {
  const [statuses, setStatuses] = useState<Record<string, NoteStatus>>(() =>
    Object.fromEntries(initialStatuses.map((s) => [s.profile_id, s])),
  );
  const [nudges, setNudges] = useState<PeerNudge[]>(initialNudges);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(serverNow);
  const [composingFor, setComposingFor] = useState<string | null>(null);

  const memberFor = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );

  const nameFor = useMemo(
    () => (id: string | null) =>
      (id && memberFor.get(id)?.display_name) || "A teammate",
    [memberFor],
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

  // Peer nudges are readable team-wide, so everyone's board reacts: the marker
  // appears on the recipient's card for the whole team, and the banner appears
  // for the recipient. Both from the same stream.
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`board-nudges:${teamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "nudges",
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          const row = payload.new as PeerNudge & {
            kind?: string;
            state?: string;
          };
          if (row?.kind && row.kind !== "peer") return;

          setNudges((prev) => {
            const without = prev.filter((n) => n.id !== row.id);
            return row.state === "open" ? [row, ...without] : without;
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
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

  // The board shows the latest open nudge against you and nothing else. Peer
  // nudges stack by design, but a stack of banners turns the board into an
  // inbox — which is the one thing this product refuses to be. The full history
  // lives in the bell, where a list belongs.
  const latestForMe = nudges
    .filter((n) => n.recipient_id === viewerId)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 1);

  const olderForMe =
    nudges.filter((n) => n.recipient_id === viewerId).length - latestForMe.length;

  const nudgedIds = new Set(nudges.map((n) => n.recipient_id));

  const pinned = members
    .map((m) => ({ member: m, status: statuses[m.id] }))
    .filter((row): row is { member: BoardMember; status: NoteStatus } =>
      Boolean(row.status),
    );

  return (
    <>
      <NudgeBanner
        nudges={latestForMe}
        olderCount={olderForMe}
        nameFor={nameFor}
        onAcknowledged={(id) =>
          setNudges((prev) => prev.filter((n) => n.id !== id))
        }
      />

      {pinned.length === 0 ? (
        <EmptyState
          title="Nothing pinned yet"
          hint="The board fills up as people post. Yours is the first."
          action={
            <Link href="/me" className="btn btn-primary">
              Post the first update
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-6">
          <AnimatePresence initial={false}>
            {pinned.map(({ member, status }, i) => {
              const isSelf = member.id === viewerId;
              const paused =
                member.nudges_paused_until != null &&
                new Date(member.nudges_paused_until).getTime() > now;
              const canNudge =
                !isSelf && member.peer_nudges_enabled !== false && !paused;

              return (
                <motion.div
                  key={member.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{
                    duration: 0.26,
                    ease: [0.2, 0.8, 0.2, 1],
                    // A short stagger on first paint only. Long enough to read
                    // as a board assembling itself, short enough that nobody
                    // waits.
                    delay: Math.min(i * 0.035, 0.28),
                  }}
                  className="group relative"
                >
                  {online.has(member.id) && (
                    <span
                      className="absolute top-2 -right-1 z-20 size-3 rounded-full ring-2"
                      style={{
                        backgroundImage: "var(--gradient-brand)",
                        ["--tw-ring-color" as string]: "var(--canvas)",
                      }}
                      title={`${member.display_name} is here`}
                      aria-label={`${member.display_name} is here`}
                    />
                  )}

                  <motion.div
                    key={status.id}
                    initial={{ opacity: 0.4, scale: 0.985 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    <StatusNote
                      status={status}
                      name={member.display_name}
                      now={now}
                      action={
                        <span className="relative flex shrink-0 items-center gap-1.5">
                          {/* Nudged is public on purpose — nudging in the open
                              keeps it social. */}
                          {nudgedIds.has(member.id) && (
                            <span className="tag">Nudged</span>
                          )}

                          {canNudge && (
                            <button
                              type="button"
                              onClick={() =>
                                setComposingFor((v) =>
                                  v === member.id ? null : member.id,
                                )
                              }
                              aria-expanded={composingFor === member.id}
                              aria-label={`Nudge ${member.display_name}`}
                              className="btn btn-quiet px-2.5 py-1 text-xs opacity-0 transition-opacity focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                            >
                              Nudge
                            </button>
                          )}

                        </span>
                      }
                    />
                  </motion.div>

                  {/* Sibling of the card, not a child. Inside it, the popover
                      was bounded by the card and appeared cut off. */}
                  {composingFor === member.id && (
                    <NudgeComposer
                      recipientId={member.id}
                      recipientName={member.display_name}
                      onClose={() => setComposingFor(null)}
                      onSent={() => setComposingFor(null)}
                    />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}
