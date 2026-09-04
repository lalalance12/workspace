import Link from "next/link";

import { AccountMenu } from "@/components/account-menu";
import { NavLinks, type NavItem } from "@/components/nav-links";
import { NotificationBell } from "@/components/notification-bell";

/**
 * Office is deliberately absent.
 *
 * The route still exists and still reads the real roster — it is parked until
 * after the presentation, not deleted. Leaving a nav item pointing at a screen
 * that says "not drawn yet" spends a click to deliver a disappointment, so it
 * comes back to the bar when the floor plan does.
 *
 * "Me" became "Status": next to Board and Timeline it read as an account page,
 * which is what /settings/me actually is.
 *
 * Team is in the bar for everyone now, not just the head. It used to be gated
 * because the page was nothing but head-only controls; it now also holds the
 * membership half — which team you are on, and how to leave or move to another
 * — and that belongs to whoever is standing in it.
 */
const NAV: NavItem[] = [
  { href: "/board", label: "Board" },
  { href: "/me", label: "Status" },
  { href: "/timeline", label: "Timeline" },
  { href: "/settings/team", label: "Team" },
];

export function TopBar({
  profileId,
  displayName,
  isHead,
}: {
  profileId: string;
  displayName: string;
  isHead: boolean;
}) {
  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-md"
      style={{
        borderColor: "var(--line)",
        backgroundColor: "color-mix(in oklab, var(--surface) 82%, transparent)",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        <Link href="/board" className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="size-5 rounded-md"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          />
          <span className="gradient-text font-[family-name:var(--font-display)] text-base font-bold tracking-tight">
            Workspace
          </span>
        </Link>

        <NavLinks items={NAV} />

        <div className="ml-auto flex items-center gap-2">
          <NotificationBell profileId={profileId} />
          <AccountMenu displayName={displayName} isHead={isHead} />
        </div>
      </div>
    </header>
  );
}
