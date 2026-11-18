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
      className="bg-paper border-ink border-t-2 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-2 gap-2 p-2.5">
        {TABS.map(({ href, label, icon: Icon, isActive }) => {
          const active = isActive(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-12 items-center justify-center gap-2 rounded-full border-2 text-base font-bold transition-colors ${
                  active
                    ? "bg-pink hard-sm border-ink"
                    : "hover:bg-soft border-transparent"
                }`}
              >
                <Icon aria-hidden className="size-5" strokeWidth={2.5} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
