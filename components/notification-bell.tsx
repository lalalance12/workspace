"use client";

import { useEffect, useState } from "react";

import { markNotificationRead } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";

interface Notification {
  id: string;
  kind: string;
  nudge_id: string | null;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

/**
 * The notification feed is a bell popover in the top bar, not a route. It's a
 * glance, same as everything else here.
 *
 * Rows arrive by trigger and stream in over Realtime. This component never
 * creates one — there is no insert policy on the table, by design.
 *
 * It reports and does not act. Nothing here is answerable: acknowledging a
 * nudge happens on the board, where the nudge actually is. A list that both
 * tells you things and asks things of you is an inbox, and this is not one.
 *
 * Every row is the same height — one line of title, two of body — so a long
 * note cannot push the rest of the list out of view.
 */
export function NotificationBell({ profileId }: { profileId: string }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    void supabase
      .from("notifications")
      .select("id, kind, nudge_id, title, body, href, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (active && data) setItems(data);
      });

    const channel = supabase
      .channel(`notifications:${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `profile_id=eq.${profileId}`,
        },
        (payload) => {
          setItems((prev) => [payload.new as Notification, ...prev]);
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [profileId]);

  // Escape closes it. A popover you can only dismiss with the mouse is a trap
  // for anyone driving the board from the keyboard.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const unread = items.filter((n) => !n.read_at).length;

  async function markRead(n: Notification) {
    if (n.read_at) return;
    setItems((prev) =>
      prev.map((i) =>
        i.id === n.id ? { ...i, read_at: new Date().toISOString() } : i,
      ),
    );
    try {
      await markNotificationRead(createClient(), n.id);
    } catch {
      // Put it back if the write didn't land.
      setItems((prev) =>
        prev.map((i) => (i.id === n.id ? { ...i, read_at: null } : i)),
      );
    }
  }

  async function markAllRead() {
    const pending = items.filter((n) => !n.read_at);
    if (pending.length === 0) return;

    const stamp = new Date().toISOString();
    setItems((prev) => prev.map((i) => ({ ...i, read_at: i.read_at ?? stamp })));

    const client = createClient();
    await Promise.allSettled(
      pending.map((n) => markNotificationRead(client, n.id)),
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={
          unread > 0 ? `${unread} unread notifications` : "Notifications"
        }
        className="relative grid size-9 cursor-pointer place-items-center rounded-full text-[var(--ink-soft)] transition-colors duration-200 hover:bg-[var(--sunken)] hover:text-[var(--ink)]"
      >
        <BellGlyph ringing={unread > 0} />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4 font-semibold text-white"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div className="panel rise-in absolute right-0 z-50 mt-2 w-[22rem] overflow-hidden">
            <div
              className="flex items-center justify-between border-b px-4 py-2.5"
              style={{ borderColor: "var(--line)" }}
            >
              <span className="annotation">
                {unread > 0 ? `${unread} unread` : "Notifications"}
              </span>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="cursor-pointer text-xs font-medium text-[var(--violet)] hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <span
                  aria-hidden="true"
                  className="mx-auto mb-3 block h-1 w-10 rounded-full"
                  style={{ backgroundImage: "var(--gradient-brand)" }}
                />
                <p className="text-sm font-medium">You&rsquo;re all caught up</p>
                <p className="mt-1 text-xs text-[var(--ink-soft)]">
                  Nudges and blockers land here.
                </p>
              </div>
            ) : (
              <ul className="flex max-h-[26rem] flex-col overflow-y-auto p-1.5">
                {items.map((n) => (
                  <li key={n.id}>
                    <a
                      href={n.href ?? "/board"}
                      onClick={() => void markRead(n)}
                      className="flex h-[4.75rem] items-start gap-2.5 rounded-[10px] p-3 transition-colors duration-150 hover:bg-[var(--sunken)]"
                      style={{
                        background: n.read_at
                          ? undefined
                          : "color-mix(in oklab, var(--violet) 6%, transparent)",
                      }}
                    >
                      <KindMark kind={n.kind} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {n.title}
                          </span>
                          <span className="annotation shrink-0">
                            {relativeTime(n.created_at)}
                          </span>
                        </span>
                        <span className="mt-1 line-clamp-2 text-sm text-[var(--ink-soft)]">
                          {n.body ?? SUBTITLE[n.kind] ?? ""}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Fills the body line for kinds the triggers leave empty, so rows stay even. */
const SUBTITLE: Record<string, string> = {
  nudge_acknowledged: "They know to expect you.",
  peer_nudge: "Check your messages.",
};

/**
 * A coloured dot per kind, using the same state palette as the board so the
 * two surfaces agree: a blocked teammate is signal red in both places.
 */
function KindMark({ kind }: { kind: string }) {
  const color =
    kind === "teammate_blocked"
      ? "var(--color-state-blocked)"
      : kind === "system_nudge"
        ? "var(--color-state-meeting)"
        : kind === "nudge_acknowledged"
          ? "var(--color-state-break)"
          : "var(--violet)";

  return (
    <span
      aria-hidden="true"
      className="mt-1.5 size-2 shrink-0 rounded-full"
      style={{ background: color }}
    />
  );
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function BellGlyph({ ringing }: { ringing: boolean }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={ringing ? { color: "var(--violet)" } : undefined}
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
