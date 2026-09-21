export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "" : ""}${value.toFixed(1)}%`;
}

export function formatRoas(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2)}x`;
}

export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}
