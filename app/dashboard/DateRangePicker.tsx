"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RANGE_PRESETS, type RangePreset } from "@/lib/dateRanges";
import Calendar from "./Calendar";

export default function DateRangePicker({
  currentPreset,
  currentLabel,
}: {
  currentPreset: RangePreset;
  currentLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
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

  function selectPreset(preset: RangePreset) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", preset);
    params.delete("since");
    params.delete("until");
    router.push(`/dashboard?${params.toString()}`);
    setOpen(false);
    setShowCalendar(false);
  }

  function applyCustomRange(since: string, until: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", "custom");
    params.set("since", since);
    params.set("until", until);
    router.push(`/dashboard?${params.toString()}`);
    setOpen(false);
    setShowCalendar(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-2xl border border-ink-900/10 bg-white/80 px-4 py-2 text-sm font-semibold text-ink-900 shadow-sm transition hover:bg-white"
      >
        {currentLabel}
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className={`transition ${open ? "rotate-180" : ""}`}>
          <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 flex gap-2">
          <div className="w-48 rounded-2xl border border-white/60 bg-white/95 p-2 shadow-soft backdrop-blur-xl">
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
            <div className="rounded-2xl border border-white/60 bg-white/95 p-3 shadow-soft backdrop-blur-xl">
              <Calendar onRangeSelected={applyCustomRange} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
