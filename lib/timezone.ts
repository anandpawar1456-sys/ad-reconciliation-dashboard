export const DEFAULT_TIMEZONE = "America/Los_Angeles";

export const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: "America/Los_Angeles", label: "Pacific Time — Los Angeles (matches Meta Ads account)" },
  { value: "America/Denver", label: "Mountain Time — Denver" },
  { value: "America/Chicago", label: "Central Time — Chicago" },
  { value: "America/New_York", label: "Eastern Time — New York" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "UK — London" },
  { value: "Asia/Kolkata", label: "India — Kolkata" },
];

// A "label date" is a UTC-midnight Date that encodes only a Y-M-D — it's
// used as the DB key for MetaInsight/DailyReconciliation/AdAttribution
// rows and never re-interpreted as a real instant. Meta's Insights API
// already returns date_start as a plain "YYYY-MM-DD" string bucketed by
// the ad account's own configured timezone, so once GHL order timestamps
// are converted to a label date in that SAME timezone, both sides line up
// on the same calendar day even though GHL's raw timestamps are UTC
// instants.
export function toLocalDateLabel(instant: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

// Given a label date (Y-M-D only, from toLocalDateLabel) and a timezone,
// returns the real UTC instant range [start, end) that calendar day spans
// in that timezone — needed to query GHL orders (which carry real UTC
// instants) for "everything that happened on this local day."
export function getUtcDayRange(labelDate: Date, timeZone: string): { start: Date; end: Date } {
  const y = labelDate.getUTCFullYear();
  const m = labelDate.getUTCMonth();
  const d = labelDate.getUTCDate();

  const start = localMidnightToUtcInstant(y, m, d, timeZone);
  const nextDay = new Date(Date.UTC(y, m, d + 1));
  const end = localMidnightToUtcInstant(
    nextDay.getUTCFullYear(),
    nextDay.getUTCMonth(),
    nextDay.getUTCDate(),
    timeZone
  );

  return { start, end };
}

// Finds the UTC instant at which the wall clock in `timeZone` reads
// Y-M-D 00:00:00, by taking a naive UTC guess and correcting for that
// timezone's offset at that moment (handles DST correctly for all but the
// literal transition night, which is an acceptable edge case for
// day-granularity business reporting).
function localMidnightToUtcInstant(year: number, month: number, day: number, timeZone: string): Date {
  const naiveUtc = Date.UTC(year, month, day, 0, 0, 0);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(naiveUtc));

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const hour = get("hour") % 24; // Intl can return "24" for midnight

  const localReadingAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  const offsetMs = localReadingAsUtc - naiveUtc;

  return new Date(naiveUtc - offsetMs);
}
