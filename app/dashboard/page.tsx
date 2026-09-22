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
                : `${resolved.label} — ${resolved.since.toISOString().slice(0, 10)} to ${resolved.until.toISOString().slice(0, 10)}`}
            </p>
          </div>
          <DateRangePicker currentPreset={preset} currentLabel={resolved.label} />
        </div>

        {/* Stat tiles */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="GHL Revenue" value={formatCurrency(data.totals.ghlRevenue)} accent="from-indigo-400 to-blue-500" />
          <StatTile label="Meta Reported Revenue" value={formatCurrency(data.totals.metaRevenue)} accent="from-sky-400 to-cyan-500" />
          <StatTile label="Meta Ad Spend" value={formatCurrency(data.totals.metaSpend)} accent="from-fuchsia-400 to-pink-500" />
          <StatTile
            label="Gap (GHL − Meta Revenue)"
            value={`${formatCurrency(data.totals.gapAmount)} (${data.totals.gapPercent.toFixed(1)}%)`}
            accent={data.totals.gapAmount > 0 ? "from-rose-400 to-orange-500" : "from-emerald-400 to-teal-500"}
          />
          <StatTile label="True ROAS" value={formatRoas(data.totals.avgTrueRoas)} accent="from-violet-400 to-purple-500" />
          <StatTile
            label={profit >= 0 ? "Profit" : "Loss"}
            value={formatCurrency(Math.abs(profit))}
            accent={profit >= 0 ? "from-emerald-400 to-teal-500" : "from-red-500 to-rose-600"}
          />
        </div>

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
            <span className="text-sm font-semibold text-ink-900">Transactions — {resolved.label}</span>
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

function GreetingBanner({
  greeting,
  yesterday,
}: {
  greeting: string;
  yesterday: YesterdaySnapshot;
}) {
  const profitPositive = yesterday.profit >= 0;
  const dateLabel = formatLabelDate(yesterday.dateLabel);

  return (
    <div className="section-card bg-gradient-to-br from-indigo-50 via-white to-pink-50">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{greeting}!</h1>
      {!yesterday.hasData ? (
        <p className="mt-1.5 text-sm text-ink-400">No data synced for yesterday ({dateLabel}) yet.</p>
      ) : (
        <p className="mt-1.5 text-sm text-ink-600">
          Yesterday ({dateLabel}) you made{" "}
          <span className={`font-bold ${profitPositive ? "text-emerald-600" : "text-rose-600"}`}>
            {profitPositive ? "" : "-"}
            {formatCurrency(Math.abs(yesterday.profit))} {profitPositive ? "profit" : "loss"}
          </span>{" "}
          — {formatCurrency(yesterday.ghlRevenue)} GHL revenue vs {formatCurrency(yesterday.metaSpend)} Meta spend.
          {yesterday.bestAd && (
            <>
              {" "}Best performer:{" "}
              <span className="font-semibold text-ink-900">{yesterday.bestAd.name}</span> —{" "}
              {formatCurrency(yesterday.bestAd.profit)} profit ({formatRoas(yesterday.bestAd.trueRoas)} True ROAS).
            </>
          )}
        </p>
      )}
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="section-card">
      <div className={`h-2 w-8 rounded-full bg-gradient-to-r ${accent}`} />
      <div className="mt-3 text-xl font-extrabold tracking-tight text-ink-900">{value}</div>
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
