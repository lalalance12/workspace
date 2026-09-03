"use client";

import { useEffect, useState } from "react";

import { markNotificationRead } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";

interface Notification {
  id: string;
  kind: string;
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
 */
export function NotificationBell({ profileId }: { profileId: string }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    void supabase
      .from("notifications")
      .select("id, kind, title, body, href, read_at, created_at")
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

  async function onRead(n: Notification) {
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
        <BellGlyph />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4 font-semibold text-white"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Click anywhere else to dismiss. */}
          <div
            className="fixed inset-0 z-40"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div className="panel rise-in absolute right-0 z-50 mt-2 w-80 overflow-hidden p-1.5">
            {items.length === 0 ? (
              <p className="annotation p-4 text-center">Nothing yet</p>
            ) : (
              <ul className="flex max-h-96 flex-col overflow-y-auto">
                {items.map((n) => (
                  <li key={n.id}>
                    <a
                      href={n.href ?? "/board"}
                      onClick={() => void onRead(n)}
                      className="block rounded-[10px] p-3 transition-colors duration-150 hover:bg-[var(--sunken)]"
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{n.title}</span>
                        {!n.read_at && (
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ background: "var(--violet)" }}
                            aria-label="unread"
                          />
                        )}
                      </span>
                      {n.body && (
                        <span className="mt-1 block text-sm text-[var(--ink-soft)]">
                          {n.body}
                        </span>
                      )}
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

function BellGlyph() {
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
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
