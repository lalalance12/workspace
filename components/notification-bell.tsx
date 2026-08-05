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
        aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        className="annotation cursor-pointer border border-[var(--ink)]/25 px-2 py-1"
        style={{ borderRadius: "var(--radius-sheet)" }}
      >
        Bell{unread > 0 ? ` · ${unread}` : ""}
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-80 border border-[var(--ink)]/25 bg-[var(--paper)] p-2"
          style={{ borderRadius: "var(--radius-sheet)" }}
        >
          {items.length === 0 ? (
            <p className="annotation p-3">Nothing yet</p>
          ) : (
            <ul className="flex flex-col">
              {items.map((n) => (
                <li key={n.id}>
                  <a
                    href={n.href ?? "/board"}
                    onClick={() => void onRead(n)}
                    className="block border-b border-[var(--ink)]/10 p-3 last:border-b-0 hover:bg-[var(--paper-deep)]"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{n.title}</span>
                      {!n.read_at && (
                        <span
                          className="size-2 shrink-0 rounded-full bg-[var(--signal)]"
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
      )}
    </div>
  );
}
