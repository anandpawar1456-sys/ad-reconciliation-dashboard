import NavBar from "./NavBar";
import DateRangePicker from "./DateRangePicker";
import RevenueChart from "./RevenueChart";
import {
  getOverviewData,
  getEarliestDataDate,
  getHourlyGhlRevenue,
  getRangeTransactions,
  getYesterdaySnapshot,
  type YesterdaySnapshot,
} from "@/lib/dashboardQueries";
import { getSettings } from "@/lib/settings";
import { resolveRange, type RangePreset } from "@/lib/dateRanges";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { formatCurrency, formatRoas, formatLabelDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { range?: string; since?: string; until?: string };
}) {
  const settings = await getSettings();
  const timeZone = settings.reportingTimezone || DEFAULT_TIMEZONE;
  const earliestDataDate = (await getEarliestDataDate()) ?? new Date();

  const preset = (searchParams.range ?? "last7") as RangePreset;
  const resolved = resolveRange(preset, timeZone, earliestDataDate, searchParams.since, searchParams.until);
  const isSingleDay = resolved.since.getTime() === resolved.until.getTime();

  const data = await getOverviewData(resolved.since, resolved.until);
  const profit = data.totals.ghlRevenue - data.totals.metaSpend;

  const hourly = isSingleDay ? await getHourlyGhlRevenue(resolved.since, timeZone) : null;
  const transactions = await getRangeTransactions(resolved.since, resolved.until, timeZone);
  const yesterday = await getYesterdaySnapshot(timeZone);
  const greeting = getGreeting(timeZone);

  const chartPoints = isSingleDay
    ? hourly!.map((h) => ({
        label: formatHourLabel(h.hour),
        ghlRevenue: h.ghlRevenue,
        metaRevenue: 0,
      }))
    : data.series.map((p) => ({
        label: formatShortDate(p.date),
        ghlRevenue: p.ghlRevenue,
        metaRevenue: p.metaRevenue,
      }));

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <GreetingBanner greeting={greeting} yesterday={yesterday} />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">Overview</h1>
            <p className="mt-1 text-sm text-ink-400">
              {isSingleDay
                ? resolved.label
                : `${resolved.label} · ${resolved.since.toISOString().slice(0, 10)} to ${resolved.until.toISOString().slice(0, 10)}`}
            </p>
          </div>
          <DateRangePicker currentPreset={preset} currentLabel={resolved.label} />
        </div>

        {/* Stat tiles */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="GHL Revenue" value={formatCurrency(data.totals.ghlRevenue)} />
          <StatTile label="Meta Reported Revenue" value={formatCurrency(data.totals.metaRevenue)} />
          <StatTile label="Meta Ad Spend" value={formatCurrency(data.totals.metaSpend)} />
          <StatTile
            label="Gap (Meta-driven GHL − Meta)"
            value={`${formatCurrency(data.totals.gapAmount)} (${data.totals.gapPercent.toFixed(1)}%)`}
          />
          <StatTile label="True ROAS" value={formatRoas(data.totals.avgTrueRoas)} />
          <StatTile
            label={profit >= 0 ? "Profit" : "Loss"}
            value={formatCurrency(Math.abs(profit))}
          />
        </div>

        {data.totals.ghlOtherRevenue > 0 && (
          <p className="mt-3 text-xs text-ink-400">
            Gap compares Meta&apos;s revenue with the {formatCurrency(data.totals.ghlMetaRevenue)} of GHL sales that came through Meta
            ads. {formatCurrency(data.totals.ghlOtherRevenue)} of GHL sales (organic, email, direct) are excluded since Meta can&apos;t
            see them.
          </p>
        )}

        {/* Chart */}
        <div className="mt-5 section-card">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink-900">
              {isSingleDay ? "Revenue by Hour" : "Revenue Trend"}
            </span>
            <span className="text-xs text-ink-400">
              {data.totals.ghlTransactions} GHL txns · {data.totals.metaPurchases} Meta purchases
            </span>
          </div>
          <div className="mt-3">
            <RevenueChart points={chartPoints} showMetaLine={!isSingleDay} />
          </div>
        </div>

        {/* Transaction list for the selected range, with likely-duplicate
            purchases (same customer/product/amount repeated) flagged so
            accidental double-charges are easy to spot and refund. */}
        <div className="mt-5 section-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-ink-900">Transactions · {resolved.label}</span>
            {transactions.some((t) => t.isDuplicate) && (
              <span className="text-xs font-medium text-amber-600">
                {transactions.filter((t) => t.isDuplicate).length} possible duplicate
                {transactions.filter((t) => t.isDuplicate).length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="mt-3 max-h-96 space-y-1 overflow-y-auto">
            {transactions.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-400">No transactions in this range.</p>
            ) : (
              transactions.map((t) => (
                <div
                  key={t.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-2 py-2 ${
                    t.isDuplicate ? "bg-amber-50" : "hover:bg-ink-900/[0.03]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-28 shrink-0 text-xs font-medium text-ink-400">{t.dateTime}</span>
                    {t.isDuplicate && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                        Duplicate
                      </span>
                    )}
                    <span className="text-sm text-ink-700">{t.email ?? "Unknown contact"}</span>
                    {t.productName && <span className="text-xs text-ink-400">· {t.productName}</span>}
                  </div>
                  <span className="text-sm font-semibold text-ink-900">{formatCurrency(t.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function getGreeting(timeZone: string): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false }).format(new Date())
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const whole = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

// Greeting card: headline profit on the left, six small facts on the right
// and the best ad underneath. Plus Jakarta Sans (the site font) throughout.
function GreetingBanner({
  greeting,
  yesterday,
}: {
  greeting: string;
  yesterday: YesterdaySnapshot;
}) {
  const profitPositive = yesterday.profit >= 0;
  const dateLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(
    yesterday.dateLabel
  );
  const delta = yesterday.previousProfit === null ? null : yesterday.profit - yesterday.previousProfit;

  return (
    <div className="section-card bg-gradient-to-br from-indigo-50 via-white to-pink-50 !p-6 sm:!p-7">
      <h1 className="text-3xl font-extrabold tracking-tight !text-ink-900 ![text-shadow:none]">{greeting}</h1>
      {!yesterday.hasData ? (
        <p className="mt-1 text-sm font-medium !text-ink-400">No data for yesterday yet.</p>
      ) : (
        <>
          <p className="mt-1 text-sm font-medium !text-ink-400">Yesterday, {dateLabel}</p>

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(220px,1fr)_2fr] lg:items-center">
            <div>
              <div
                className={`text-5xl font-extrabold leading-none tracking-tight ${
                  profitPositive ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {profitPositive ? "+" : "-"}
                {whole(yesterday.profit)}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-400">
                <span>{profitPositive ? "profit" : "loss"}</span>
                {delta !== null && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      delta >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                    }`}
                  >
                    {delta >= 0 ? "▲" : "▼"} {whole(delta)} vs day before
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Fact value={whole(yesterday.ghlRevenue)} label="revenue" tone="indigo" />
              <Fact value={whole(yesterday.metaSpend)} label="ad spend" tone="pink" />
              <Fact value={yesterday.trueRoas !== null ? `${yesterday.trueRoas.toFixed(2)}x` : "-"} label="true ROAS" tone="violet" />
              <Fact value={String(yesterday.ghlOrders)} label="orders" tone="sky" />
              <Fact value={yesterday.cpa !== null ? `$${yesterday.cpa.toFixed(2)}` : "-"} label="CPA" tone="amber" />
              <Fact value={whole(yesterday.recoveredRevenue)} label="recovered" tone="emerald" />
            </div>
          </div>

          {yesterday.bestAd && (
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-ink-900/[0.04] px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-400">Best ad</span>
              <span className="text-base font-bold text-ink-900">{yesterday.bestAd.name}</span>
              <span className="text-sm font-semibold text-emerald-600">
                +{whole(yesterday.bestAd.profit)}
                {yesterday.bestAd.trueRoas !== null && ` · ${yesterday.bestAd.trueRoas.toFixed(1)}x`}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const FACT_TONES = {
  indigo: { tile: "bg-indigo-50 ring-indigo-100" },
  pink: { tile: "bg-pink-50 ring-pink-100" },
  violet: { tile: "bg-violet-50 ring-violet-100" },
  sky: { tile: "bg-sky-50 ring-sky-100" },
  amber: { tile: "bg-amber-50 ring-amber-100" },
  emerald: { tile: "bg-emerald-50 ring-emerald-100" },
} as const;

function Fact({ value, label, tone }: { value: string; label: string; tone: keyof typeof FACT_TONES }) {
  const t = FACT_TONES[tone];
  return (
    <div className={`rounded-2xl px-4 py-3 ring-1 ring-inset ${t.tile}`}>
      <div className="text-xl font-extrabold leading-none tracking-tight text-ink-900">{value}</div>
      <div className="mt-1.5 text-xs font-semibold text-ink-500">{label}</div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="section-card">
      <div className="text-xl font-extrabold tracking-tight text-ink-900">{value}</div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">{label}</div>
    </div>
  );
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

function formatShortDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d);
}
