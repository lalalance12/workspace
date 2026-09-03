import Link from "next/link";

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
 */
const NAV: NavItem[] = [
  { href: "/board", label: "Board" },
  { href: "/me", label: "Status" },
  { href: "/timeline", label: "Timeline" },
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
  const items = isHead
    ? [...NAV, { href: "/settings/team", label: "Team" }]
    : NAV;

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

        <NavLinks items={items} />

        <div className="ml-auto flex items-center gap-2">
          <NotificationBell profileId={profileId} />
          <Link
            href="/settings/me"
            className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm transition-colors duration-200 hover:bg-[var(--sunken)]"
          >
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundImage: "var(--gradient-brand)" }}
            >
              {displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden sm:inline">{displayName}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
