"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/reconciliation", label: "Reconciliation" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/true-roas", label: "True ROAS" },
  { href: "/funnel", label: "Funnel" },
  { href: "/missing-transactions", label: "Missing" },
  { href: "/settings", label: "Settings" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header className="glass-nav sticky top-0 z-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 shrink-0 rounded-xl bg-aurora-full shadow-glow" />
          <span className="text-sm font-bold tracking-tight text-ink-900">Reconciliation</span>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-white text-ink-900 shadow-sm"
                    : "text-ink-500 hover:bg-white/60 hover:text-ink-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="ml-2 shrink-0 border-l border-ink-900/10 pl-2">
            <LogoutButton />
          </div>
        </nav>
      </div>
    </header>
  );
}
