"use client";

import { useState } from "react";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toDateOnlyString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sameDay(a: Date | null, b: Date | null): boolean {
  return !!a && !!b && toDateOnlyString(a) === toDateOnlyString(b);
}

// Two-click range picker: first click sets the start, second sets the end
// (or restarts the range if it's before the start). Fully custom — no
// native <input type="date"> popup, which was colliding with the dropdown
// panel's layout.
export default function Calendar({
  onRangeSelected,
}: {
  onRangeSelected: (since: string, until: string) => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [hovered, setHovered] = useState<Date | null>(null);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  function handleDayClick(day: number) {
    const clicked = new Date(year, month, day);
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(clicked);
      setRangeEnd(null);
      return;
    }
    if (clicked < rangeStart) {
      setRangeStart(clicked);
      setRangeEnd(null);
      return;
    }
    setRangeEnd(clicked);
    onRangeSelected(toDateOnlyString(rangeStart), toDateOnlyString(clicked));
  }

  const previewEnd = rangeEnd ?? hovered;

  function isInRange(day: number): boolean {
    if (!rangeStart || !previewEnd) return false;
    const d = new Date(year, month, day);
    const lo = rangeStart < previewEnd ? rangeStart : previewEnd;
    const hi = rangeStart < previewEnd ? previewEnd : rangeStart;
    return d > lo && d < hi;
  }

  return (
    <div className="w-64">
      <div className="flex items-center justify-between px-1 pb-2">
        <button
          type="button"
          onClick={() => setViewMonth(new Date(year, month - 1, 1))}
          className="rounded-lg p-1 text-ink-500 hover:bg-ink-900/5"
          aria-label="Previous month"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-ink-900">
          {MONTH_LABELS[month]} {year}
        </span>
        <button
          type="button"
          onClick={() => setViewMonth(new Date(year, month + 1, 1))}
          className="rounded-lg p-1 text-ink-500 hover:bg-ink-900/5"
          aria-label="Next month"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 px-1">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={i} className="text-center text-[10px] font-semibold uppercase text-ink-400">
            {w}
          </div>
        ))}

        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const date = new Date(year, month, day);
          const isStart = sameDay(rangeStart, date);
          const isEnd = sameDay(rangeEnd, date);
          const isToday = sameDay(today, date);
          const inRange = isInRange(day);

          return (
            <button
              type="button"
              key={day}
              onClick={() => handleDayClick(day)}
              onMouseEnter={() => setHovered(date)}
              className={`h-7 w-7 justify-self-center rounded-full text-xs font-medium transition ${
                isStart || isEnd
                  ? "bg-aurora-blue text-white"
                  : inRange
                    ? "bg-indigo-100 text-ink-900"
                    : isToday
                      ? "border border-indigo-300 text-ink-900"
                      : "text-ink-700 hover:bg-ink-900/5"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="mt-2 px-1 text-xs text-ink-400">
        {rangeStart && !rangeEnd
          ? `${toDateOnlyString(rangeStart)} — pick an end date`
          : rangeStart && rangeEnd
            ? `${toDateOnlyString(rangeStart)} to ${toDateOnlyString(rangeEnd)}`
            : "Pick a start date"}
      </div>
    </div>
  );
}
