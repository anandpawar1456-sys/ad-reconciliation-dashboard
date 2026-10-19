import Link from "next/link";
import NavBar from "../dashboard/NavBar";
import { getDuplicateRows, groupDuplicates, type DuplicateGroup } from "@/lib/duplicates";
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

  const groups = groupDuplicates(rows);
  const extraCharged = rows.reduce((s, r) => s + r.amount, 0);
  const customers = new Set(rows.map((r) => r.contactId)).size;
  const days = new Set(rows.map((r) => r.dayKey)).size;

  const stepLabel = (g: DuplicateGroup) => (g.stepId ? stepNames.get(g.stepId)?.stepName : undefined) ?? g.funnelName ?? "Order";
  const who = (g: DuplicateGroup) => g.email ?? g.phone ?? "Unknown contact";
  const href = (next: { range?: string; view?: string }) =>
    `/duplicates?range=${next.range ?? preset}&view=${next.view ?? view}`;

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Duplicate Transactions</h1>
        <p>
          Only the same product charged to the same customer at the same price again within 24 hours. A front end followed
          by Upsell 1 or Upsell 2 is never a duplicate, and neither are two different upsells. Each entry below shows the
          original charge and its repeat, so the original is the real sale and the repeat is what to check or refund.
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
          <Tile label="Repeat charges" value={String(rows.length)} />
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
          <DateView groups={groups} stepLabel={stepLabel} who={who} timeZone={timeZone} />
        ) : view === "month" ? (
          <MonthView groups={groups} stepLabel={stepLabel} who={who} />
        ) : (
          <CustomerView groups={groups} stepLabel={stepLabel} who={who} />
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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const groupExtra = (list: DuplicateGroup[]) => list.reduce((s, g) => s + g.extraCharged, 0);
const repeatCount = (list: DuplicateGroup[]) => list.reduce((s, g) => s + g.repeats.length, 0);

function dayLabel(key: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${key}T00:00:00Z`)
  );
}

function monthLabel(key: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`));
}

function when(d: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone }).format(d);
}

// One product charged to one customer more than once: original first, then
// each repeat.
function GroupBlock({
  g,
  stepLabel,
  who,
  timeZone,
}: {
  g: DuplicateGroup;
  stepLabel: (g: DuplicateGroup) => string;
  who: (g: DuplicateGroup) => string;
  timeZone: string;
}) {
  return (
    <div className="py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <div className="truncate text-sm font-extrabold text-ink-900">{who(g)}</div>
          <div className="text-xs font-semibold text-ink-500">
            {stepLabel(g)} · {formatCurrency(g.amount)} each · charged {g.repeats.length + 1} times
          </div>
        </div>
        <div className="text-sm font-extrabold text-rose-600">+{formatCurrency(g.extraCharged)} extra</div>
      </div>
      <div className="mt-2 space-y-1 border-l-2 border-ink-900/10 pl-3 text-xs">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-700">
            {when(g.originalAt, timeZone)} <span className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-600">original</span>
          </span>
          <span className="font-semibold text-ink-500">{formatCurrency(g.amount)}</span>
        </div>
        {g.repeats.map((r) => (
          <div key={r.orderId} className="flex items-center justify-between gap-3">
            <span className="text-ink-700">
              {when(r.at, timeZone)} <span className="ml-1 rounded-full bg-rose-50 px-2 py-0.5 font-bold text-rose-600">duplicate</span>
              <span className="ml-1.5 text-ink-400">{r.minutesAfterOriginal < 1 ? "under a minute" : `${r.minutesAfterOriginal} min`} after the original</span>
            </span>
            <span className="font-semibold text-ink-500">{formatCurrency(r.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DateView({
  groups,
  stepLabel,
  who,
  timeZone,
}: {
  groups: DuplicateGroup[];
  stepLabel: (g: DuplicateGroup) => string;
  who: (g: DuplicateGroup) => string;
  timeZone: string;
}) {
  return (
    <div className="mt-5 space-y-4">
      {groupBy(groups, (g) => g.dayKey).map(([day, list]) => (
        <div key={day} className="section-card">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-extrabold text-ink-900">{dayLabel(day)}</h2>
            <span className="text-sm font-semibold text-ink-400">
              {plural(repeatCount(list), "repeat charge")} · <span className="text-rose-600">{formatCurrency(groupExtra(list))}</span>
            </span>
          </div>
          <div className="mt-1 divide-y divide-ink-900/5">
            {list.map((g) => (
              <GroupBlock key={g.originalId} g={g} stepLabel={stepLabel} who={who} timeZone={timeZone} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MonthView({
  groups,
  stepLabel,
  who,
}: {
  groups: DuplicateGroup[];
  stepLabel: (g: DuplicateGroup) => string;
  who: (g: DuplicateGroup) => string;
}) {
  return (
    <div className="mt-5 space-y-4">
      {groupBy(groups, (g) => g.monthKey).map(([month, list]) => (
        <div key={month} className="section-card">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-extrabold text-ink-900">{monthLabel(month)}</h2>
            <span className="text-sm font-semibold text-ink-400">
              {plural(repeatCount(list), "repeat charge")} · {plural(new Set(list.map((g) => g.contactId)).size, "customer")} ·{" "}
              <span className="text-rose-600">{formatCurrency(groupExtra(list))}</span>
            </span>
          </div>
          <div className="mt-2 divide-y divide-ink-900/5">
            {list.map((g) => (
              <div key={g.originalId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink-900">{who(g)}</div>
                  <div className="text-xs text-ink-400">
                    {stepLabel(g)} · {formatCurrency(g.amount)} charged {g.repeats.length + 1} times
                  </div>
                </div>
                <div className="text-sm font-extrabold text-rose-600">+{formatCurrency(g.extraCharged)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CustomerView({
  groups,
  stepLabel,
  who,
}: {
  groups: DuplicateGroup[];
  stepLabel: (g: DuplicateGroup) => string;
  who: (g: DuplicateGroup) => string;
}) {
  const customers = groupBy(groups, (g) => g.contactId)
    .map(([, list]) => ({ list, name: who(list[0]), extra: groupExtra(list), repeats: repeatCount(list) }))
    .sort((a, b) => b.repeats - a.repeats || b.extra - a.extra);

  return (
    <div className="mt-5 space-y-4">
      {customers.map((c) => (
        <div key={c.list[0].contactId} className="section-card">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="truncate text-base font-extrabold text-ink-900">{c.name}</h2>
            <span className="text-sm font-semibold text-ink-400">
              {plural(c.repeats, "repeat charge")} · <span className="text-rose-600">{formatCurrency(c.extra)}</span>
            </span>
          </div>
          <div className="mt-2 divide-y divide-ink-900/5">
            {c.list.map((g) => (
              <div key={g.originalId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-2.5">
                <div className="text-sm text-ink-900">
                  <span className="font-semibold">{stepLabel(g)}</span>{" "}
                  <span className="text-ink-400">
                    {formatCurrency(g.amount)} × {g.repeats.length + 1} · {dayLabel(g.dayKey)}
                  </span>
                </div>
                <div className="text-sm font-extrabold text-rose-600">+{formatCurrency(g.extraCharged)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
