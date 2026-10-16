"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import LogoutButton from "./LogoutButton";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/reconciliation", label: "Reconciliation" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/ads", label: "Ad Lookup" },
  { href: "/true-roas", label: "True ROAS" },
  { href: "/funnel", label: "Funnel" },
  { href: "/missing-transactions", label: "Missing" },
  { href: "/settings", label: "Settings" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <header className="glass-nav sticky top-0 z-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="" width={32} height={32} priority className="h-8 w-8 shrink-0" />
          <span className="text-sm font-bold tracking-tight text-white">Reconciliation</span>
        </div>

        {/* Desktop nav — hidden below md, where it's replaced by the
            hamburger menu (this row doesn't have room for 7 links plus
            logout once the viewport gets narrow). */}
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                isActive(link.href)
                  ? "bg-white text-ink-900 shadow-sm"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="ml-2 shrink-0 border-l border-white/15 pl-2">
            <LogoutButton />
          </div>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition hover:bg-white/10 md:hidden"
        >
          {open ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 6H17M3 10H17M3 14H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <nav className="border-t border-white/10 bg-[#0b2230]/95 px-4 py-3 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive(link.href) ? "bg-white text-ink-900 shadow-sm" : "text-white/75 hover:bg-white/10"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-1 border-t border-white/10 pt-2">
              <LogoutButton />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
