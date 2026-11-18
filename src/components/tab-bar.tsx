"use client";

import { Compass, House } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Home",
    icon: House,
    isActive: (path: string) => path === "/",
  },
  {
    href: "/discover",
    label: "Discover",
    icon: Compass,
    // The Matches view lives under /discover, so the tab stays active there.
    isActive: (path: string) => path.startsWith("/discover"),
  },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="border-line bg-surface border-t pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-2">
        {TABS.map(({ href, label, icon: Icon, isActive }) => {
          const active = isActive(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
                  active ? "text-brand" : "text-muted hover:text-ink"
                }`}
              >
                <Icon className="size-6" strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
