export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "" : ""}${value.toFixed(1)}%`;
}

export function formatRoas(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2)}x`;
}

export function formatCpa(value: number | null): string {
  return value === null ? "—" : formatCurrency(value);
}

export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

// For "label dates" (DailyReconciliation.date, AdAttribution.date, etc — see
// lib/timezone.ts) which are stored as UTC-midnight Y-M-D encodings, not
// real instants. Must format with timeZone: "UTC" or the displayed date can
// shift by a day depending on where the server rendering it is located.
export function formatLabelDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}
