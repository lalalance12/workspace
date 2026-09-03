"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Split out of TopBar only because knowing the current route requires a client
 * component, and the bar itself has no other reason to be one. The head-only
 * Team link is appended by the caller rather than gated by a prop here — this
 * component renders the items it is given and makes no decisions about them.
 */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="relative px-3 py-2 text-sm transition-colors duration-200"
            style={{ color: active ? "var(--ink)" : "var(--ink-soft)" }}
          >
            {item.label}
            {active && (
              <span
                aria-hidden="true"
                className="absolute inset-x-3 -bottom-px h-0.5 rounded-full"
                style={{ backgroundImage: "var(--gradient-brand)" }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
