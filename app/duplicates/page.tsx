import Link from "next/link";
import NavBar from "../dashboard/NavBar";
import { getDuplicateRows, type DuplicateRow } from "@/lib/duplicates";
import { getEarliestDataDate } from "@/lib/dashboardQueries";
import { getSettings } from "@/lib/settings";
import { getGhlFunnelStepNames } from "@/lib/ghl";
import { resolveRange, type RangePreset } from "@/lib/dateRanges";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

const RANGES: Array<{ value: RangePreset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "last14", label: "Last 14 days" },
  { value: "last30", label: "30 days" },
  { value: "last6m", label: "6 months" },
  { value: "lastYear", label: "Year" },
];

const VIEWS = [
  { value: "date", label: "By date" },
  { value: "month", label: "By month" },
  { value: "customer", label: "By customer" },
] as const;
type View = (typeof VIEWS)[number]["value"];

export default async function DuplicatesPage({
  searchParams,
}: {
  searchParams: { range?: string; view?: string };
}) {
  const settings = await getSettings();
  const timeZone = settings.reportingTimezone || DEFAULT_TIMEZONE;
  const earliest = (await getEarliestDataDate()) ?? new Date();

  const preset = (RANGES.some((r) => r.value === searchParams.range) ? searchParams.range : "last30") as RangePreset;
  const view = (VIEWS.some((v) => v.value === searchParams.view) ? searchParams.view : "date") as View;
  const resolved = resolveRange(preset, timeZone, earliest);

  const [rows, stepNames] = await Promise.all([
    getDuplicateRows(resolved.since, resolved.until),
    settings.ghlApiKey && settings.ghlLocationId
      ? getGhlFunnelStepNames(settings.ghlApiKey, settings.ghlLocationId)
      : Promise.resolve(new Map()),
  ]);

  const extraCharged = rows.reduce((s, r) => s + r.amount, 0);
  const customers = new Set(rows.map((r) => r.contactId)).size;
  const days = new Set(rows.map((r) => r.dayKey)).size;

  const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  const stepLabel = (r: DuplicateRow) => (r.stepId ? stepNames.get(r.stepId)?.stepName : undefined) ?? r.funnelName ?? "Order";
  const who = (r: DuplicateRow) => r.email ?? r.phone ?? "Unknown contact";
  const href = (next: { range?: string; view?: string }) =>
    `/duplicates?range=${next.range ?? preset}&view=${next.view ?? view}`;

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Duplicate Transactions</h1>
        <p>
          The same customer buying the same funnel step for the same amount again within 24 hours, usually a double
          checkout or a double charge. The first order is the real sale; the repeats listed here are the ones to check
          or refund.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <Link
              key={r.value}
              href={href({ range: r.value })}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                preset === r.value ? "bg-white text-ink-900 shadow-sm" : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Tile label="Duplicate orders" value={String(rows.length)} />
          <Tile label="Customers" value={String(customers)} />
          <Tile label="Extra charged" value={formatCurrency(extraCharged)} tone="bad" />
          <Tile label="Days affected" value={String(days)} />
        </div>

        <div className="mt-5 flex gap-1 rounded-2xl bg-white/10 p-1 sm:w-fit">
          {VIEWS.map((v) => (
            <Link
              key={v.value}
              href={href({ view: v.value })}
              className={`flex-1 rounded-xl px-4 py-1.5 text-center text-sm font-semibold transition sm:flex-none ${
                view === v.value ? "bg-white text-ink-900 shadow-sm" : "text-white/80 hover:bg-white/10"
              }`}
            >
              {v.label}
            </Link>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="mt-5 section-card py-12 text-center">
            <p className="font-semibold text-ink-900">No duplicate transactions in this range</p>
            <p className="mt-1 text-sm text-ink-400">{resolved.label}. Try a longer range.</p>
          </div>
        ) : view === "date" ? (
          <DateView rows={rows} timeFmt={timeFmt} stepLabel={stepLabel} who={who} />
        ) : view === "month" ? (
          <MonthView rows={rows} who={who} />
        ) : (
          <CustomerView rows={rows} who={who} timeZone={timeZone} />
        )}
      </main>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className="section-card">
      <div className={`text-2xl font-extrabold tracking-tight ${tone === "bad" ? "text-rose-600" : "text-ink-900"}`}>{value}</div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400">{label}</div>
    </div>
  );
}

function groupBy<T>(items: T[], key: (t: T) => string): Array<[string, T[]]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return [...map.entries()];
}

const sum = (rows: DuplicateRow[]) => rows.reduce((s, r) => s + r.amount, 0);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function dayLabel(key: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${key}T00:00:00Z`)
  );
}

function monthLabel(key: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`));
}

function DateView({
  rows,
  timeFmt,
  stepLabel,
  who,
}: {
  rows: DuplicateRow[];
  timeFmt: Intl.DateTimeFormat;
  stepLabel: (r: DuplicateRow) => string;
  who: (r: DuplicateRow) => string;
}) {
  return (
    <div className="mt-5 space-y-4">
      {groupBy(rows, (r) => r.dayKey).map(([day, list]) => (
        <div key={day} className="section-card">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-extrabold text-ink-900">{dayLabel(day)}</h2>
            <span className="text-sm font-semibold text-ink-400">
              {plural(list.length, "duplicate")} · <span className="text-rose-600">{formatCurrency(sum(list))}</span>
            </span>
          </div>
          <div className="mt-3 divide-y divide-ink-900/5">
            {list.map((r) => (
              <div key={r.orderId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink-900">{who(r)}</div>
                  <div className="text-xs text-ink-400">
                    {stepLabel(r)} · {timeFmt.format(r.at)} · {r.minutesAfterOriginal < 1 ? "under a minute" : `${r.minutesAfterOriginal} min`} after the first order
                  </div>
                </div>
                <div className="text-sm font-extrabold text-ink-900">{formatCurrency(r.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MonthView({ rows, who }: { rows: DuplicateRow[]; who: (r: DuplicateRow) => string }) {
  return (
    <div className="mt-5 space-y-4">
      {groupBy(rows, (r) => r.monthKey).map(([month, list]) => {
        const perCustomer = groupBy(list, (r) => r.contactId)
          .map(([, rs]) => ({ name: who(rs[0]), count: rs.length, total: sum(rs) }))
          .sort((a, b) => b.count - a.count || b.total - a.total);
        return (
          <div key={month} className="section-card">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-extrabold text-ink-900">{monthLabel(month)}</h2>
              <span className="text-sm font-semibold text-ink-400">
                {plural(list.length, "duplicate")} · {plural(perCustomer.length, "customer")} ·{" "}
                <span className="text-rose-600">{formatCurrency(sum(list))}</span>
              </span>
            </div>
            <div className="mt-3 divide-y divide-ink-900/5">
              {perCustomer.map((c) => (
                <div key={c.name} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="min-w-0 truncate text-sm font-semibold text-ink-900">{c.name}</span>
                  <span className="shrink-0 text-sm text-ink-400">
                    {plural(c.count, "duplicate")} · <span className="font-extrabold text-ink-900">{formatCurrency(c.total)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CustomerView({ rows, who, timeZone }: { rows: DuplicateRow[]; who: (r: DuplicateRow) => string; timeZone: string }) {
  const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone });
  const customers = groupBy(rows, (r) => r.contactId)
    .map(([, rs]) => ({ rs, name: who(rs[0]), total: sum(rs) }))
    .sort((a, b) => b.rs.length - a.rs.length || b.total - a.total);

  return (
    <div className="mt-5 section-card divide-y divide-ink-900/5 !py-2">
      {customers.map((c) => (
        <div key={c.rs[0].contactId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink-900">{c.name}</div>
            <div className="text-xs text-ink-400">{[...new Set(c.rs.map((r) => dateFmt.format(r.at)))].join(", ")}</div>
          </div>
          <div className="text-sm text-ink-400">
            {plural(c.rs.length, "duplicate")} · <span className="font-extrabold text-rose-600">{formatCurrency(c.total)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
