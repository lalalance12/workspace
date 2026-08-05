import Link from "next/link";

import { NotificationBell } from "@/components/notification-bell";

const NAV = [
  { href: "/board", label: "Board" },
  { href: "/office", label: "Office" },
  { href: "/me", label: "Me" },
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
  return (
    <header className="border-b border-[var(--ink)]/20 bg-[var(--paper)]">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        <Link href="/board" className="annotation !text-[var(--ink)]">
          Workspace
        </Link>

        <nav className="flex items-center gap-4">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm">
              {item.label}
            </Link>
          ))}
          {isHead && (
            <Link href="/settings/team" className="text-sm">
              Team
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <NotificationBell profileId={profileId} />
          <Link href="/settings/me" className="annotation">
            {displayName}
          </Link>
        </div>
      </div>
    </header>
  );
}
