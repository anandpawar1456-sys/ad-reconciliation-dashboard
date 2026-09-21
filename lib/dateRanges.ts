import { toLocalDateLabel } from "@/lib/timezone";

export const RANGE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last3", label: "Last 3 Days" },
  { value: "last7", label: "Last 7 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "lastYear", label: "Last Year" },
  { value: "allTime", label: "All Time" },
  { value: "custom", label: "Custom" },
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number]["value"];

const DAY_MS = 24 * 60 * 60 * 1000;

export type ResolvedRange = { since: Date; until: Date; label: string };

// All dates here are "label dates" (UTC-midnight Y-M-D encodings — see
// lib/timezone.ts), matching how DailyReconciliation/AdAttribution store
// their `date` column, computed in the account's own reporting timezone.
export function resolveRange(
  preset: RangePreset,
  timeZone: string,
  earliestDataDate: Date,
  customSince?: string,
  customUntil?: string
): ResolvedRange {
  const today = toLocalDateLabel(new Date(), timeZone);
  const presetLabel = RANGE_PRESETS.find((p) => p.value === preset)?.label ?? "Custom";

  switch (preset) {
    case "today":
      return { since: today, until: today, label: presetLabel };
    case "yesterday": {
      const y = addDays(today, -1);
      return { since: y, until: y, label: presetLabel };
    }
    case "last3":
      return { since: addDays(today, -2), until: today, label: presetLabel };
    case "last7":
      return { since: addDays(today, -6), until: today, label: presetLabel };
    case "thisMonth":
      return { since: startOfMonth(today), until: today, label: presetLabel };
    case "lastMonth": {
      const lastMonthEnd = addDays(startOfMonth(today), -1);
      return { since: startOfMonth(lastMonthEnd), until: lastMonthEnd, label: presetLabel };
    }
    case "lastYear":
      return { since: addDays(today, -365), until: today, label: presetLabel };
    case "allTime":
      return { since: earliestDataDate, until: today, label: presetLabel };
    case "custom": {
      const since = customSince ? new Date(customSince) : addDays(today, -6);
      const until = customUntil ? new Date(customUntil) : today;
      return { since, until, label: "Custom" };
    }
    default:
      return { since: addDays(today, -6), until: today, label: "Last 7 Days" };
  }
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
