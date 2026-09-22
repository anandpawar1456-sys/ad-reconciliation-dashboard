"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RANGE_PRESETS, type RangePreset } from "@/lib/dateRanges";
import Calendar from "./Calendar";

export default function DateRangePicker({
  currentPreset,
  currentLabel,
  basePath = "/dashboard",
}: {
  currentPreset: RangePreset;
  currentLabel: string;
  basePath?: string;
}) {
  const [open, setOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [mobileTop, setMobileTop] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCalendar(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) setMobileTop(null);
  }, [open]);

  function selectPreset(preset: RangePreset) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", preset);
    params.delete("since");
    params.delete("until");
    router.push(`${basePath}?${params.toString()}`);
    setOpen(false);
    setShowCalendar(false);
  }

  function applyCustomRange(since: string, until: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", "custom");
    params.set("since", since);
    params.set("until", until);
    router.push(`${basePath}?${params.toString()}`);
    setOpen(false);
    setShowCalendar(false);
  }

  // On a wrapped header row the button can land anywhere on the line
  // (not necessarily the right edge), so an `absolute right-0` popover
  // anchored to it can render off-screen. Below the sm breakpoint, measure
  // the button's actual position and use `fixed` positioning clamped to
  // the viewport instead of anchoring to the button.
  function toggleOpen() {
    if (!open && buttonRef.current && window.innerWidth < 640) {
      setMobileTop(buttonRef.current.getBoundingClientRect().bottom + 8);
    }
    setOpen((v) => !v);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        onClick={toggleOpen}
        className="flex items-center gap-2 rounded-2xl border border-ink-900/10 bg-white/80 px-4 py-2 text-sm font-semibold text-ink-900 shadow-sm transition hover:bg-white"
      >
        {currentLabel}
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className={`transition ${open ? "rotate-180" : ""}`}>
          <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        // Stacked by default (fits any phone width) and side-by-side once
        // there's room — laying the preset list and calendar out
        // horizontally always needs ~450px, which clips off-screen on a
        // 375px viewport if forced with flex-row unconditionally. Below
        // sm, positioned `fixed` at the measured top (see toggleOpen) and
        // clamped to the viewport width instead of anchored to the
        // button, since the button isn't reliably at the right edge once
        // the header wraps.
        <div
          className="z-20 flex max-w-[calc(100vw-2rem)] flex-col gap-2 sm:absolute sm:right-0 sm:mt-2 sm:max-w-none sm:flex-row"
          style={mobileTop !== null ? { position: "fixed", top: mobileTop, left: 16, right: 16 } : undefined}
        >
          <div className="w-48 max-w-full rounded-2xl border border-white/60 bg-white/95 p-2 shadow-soft backdrop-blur-xl">
            {RANGE_PRESETS.filter((p) => p.value !== "custom").map((p) => (
              <button
                key={p.value}
                onClick={() => selectPreset(p.value)}
                className={`block w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                  currentPreset === p.value
                    ? "bg-aurora-blue text-white"
                    : "text-ink-700 hover:bg-ink-900/5"
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setShowCalendar((v) => !v)}
              className={`block w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                currentPreset === "custom" ? "bg-aurora-blue text-white" : "text-ink-700 hover:bg-ink-900/5"
              }`}
            >
              Custom range
            </button>
          </div>

          {showCalendar && (
            <div className="max-w-full rounded-2xl border border-white/60 bg-white/95 p-3 shadow-soft backdrop-blur-xl">
              <Calendar onRangeSelected={applyCustomRange} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
