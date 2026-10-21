import Link from "next/link";
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
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
          <StatTile label="GHL Revenue" value={formatCurrency(data.totals.ghlRevenue)} />
          <StatTile label="Organic Sales" value={formatCurrency(data.totals.ghlOtherRevenue)} />
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
            Organic sales are GHL orders Meta can&apos;t claim: customers who came back on their own more than 7 days
            after their first purchase (Meta&apos;s 7-day click window), plus email and direct sales. Back-to-back and
            same-day upsells stay with the ad. Organic sales are kept out of the gap and every ad&apos;s numbers. The gap
            compares Meta&apos;s revenue with the {formatCurrency(data.totals.ghlMetaRevenue)} of GHL sales that came
            through Meta ads.
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
                    {t.isOrganic && (
                      <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700">
                        Organic
                      </span>
                    )}
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

// Smooth curve through the points (Catmull-Rom converted to cubic Beziers).
function smoothPath(pts: Array<[number, number]>): string {
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

// Soft area sparkline. `dot` adds the end-point marker (used on the profit curve).
function Spark({
  values,
  color,
  id,
  line = false,
  dot = false,
  fillOpacity = 0.35,
  amplitude = 1,
  className = "",
}: {
  values: number[];
  color: string;
  id: string;
  line?: boolean;
  dot?: boolean;
  fillOpacity?: number;
  amplitude?: number; // 1 = fill the box; smaller keeps the wave gentle and low
  className?: string;
}) {
  const W = 100;
  const H = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts: Array<[number, number]> = values.map((v, i) => [
    4 + (i / Math.max(values.length - 1, 1)) * 90,
    max === min ? H * 0.6 : H - 6 - ((v - min) / span) * (H - 12) * amplitude,
  ]);
  const curve = smoothPath(pts);
  const last = pts[pts.length - 1];
  return (
    <div className={`pointer-events-none ${className}`} aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={fillOpacity} />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${curve} L ${last[0]} ${H} L ${pts[0][0]} ${H} Z`} fill={`url(#${id})`} />
        {line && <path d={curve} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />}
      </svg>
      {dot && (
        <span
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${(last[0] / W) * 100}%`, top: `${(last[1] / H) * 100}%`, backgroundColor: color }}
        />
      )}
    </div>
  );
}

const FACT_TONES = {
  indigo: { tile: "from-indigo-50 to-indigo-100/70", color: "#818cf8" },
  pink: { tile: "from-rose-50 to-pink-100/80", color: "#fb7185" },
  violet: { tile: "from-violet-50 to-purple-100/70", color: "#a78bfa" },
  sky: { tile: "from-sky-50 to-sky-100/80", color: "#38bdf8" },
  amber: { tile: "from-amber-50 to-amber-100/80", color: "#fbbf24" },
  emerald: { tile: "from-emerald-50 to-emerald-100/80", color: "#34d399" },
} as const;

function Fact({
  value,
  label,
  tone,
  trend,
}: {
  value: string;
  label: string;
  tone: keyof typeof FACT_TONES;
  trend: number[];
}) {
  const t = FACT_TONES[tone];
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br px-4 py-3 ${t.tile}`}>
      <Spark
        values={trend}
        color={t.color}
        id={`spark-${label.replace(/\W/g, "")}`}
        fillOpacity={0.6}
        amplitude={0.55}
        className="absolute bottom-0 right-0 h-[60%] w-[60%]"
      />
      <div className="relative">
        <div className="text-2xl font-extrabold leading-none tracking-tight text-ink-900">{value}</div>
        <div className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400">{label}</div>
      </div>
    </div>
  );
}

// Compact greeting card (about half the height of the first version): the
// title row carries the date and the best-ad link, and the body is a single
// profit block beside the six stat tiles.
function GreetingBanner({
  greeting,
  yesterday,
}: {
  greeting: string;
  yesterday: YesterdaySnapshot;
}) {
  const profitPositive = yesterday.profit >= 0;
  const dateLabel = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(
    yesterday.dateLabel
  );
  const delta = yesterday.previousProfit === null ? null : yesterday.profit - yesterday.previousProfit;
  const T = yesterday.trends;
  const profitColor = profitPositive ? "#10b981" : "#f43f5e";

  return (
    <div className="section-card bg-gradient-to-br from-white via-white to-indigo-50/60 !p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-2xl font-extrabold tracking-tight !text-ink-900 ![text-shadow:none]">{greeting}</h1>
          {yesterday.hasData && (
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-400">Yesterday, {dateLabel}</span>
          )}
        </div>

        {yesterday.hasData && yesterday.bestAd && (
          <Link
            href={`/ads/${yesterday.bestAd.adId}`}
            title="Open in Ad Lookup"
            className="flex max-w-full items-center gap-2.5 rounded-full bg-gradient-to-r from-indigo-50 to-violet-100/80 px-4 py-1.5 text-sm transition hover:shadow-md"
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">Best ad</span>
            <span className="truncate font-extrabold text-ink-900">{yesterday.bestAd.name}</span>
            <span className="shrink-0 font-bold text-emerald-600">
              +{whole(yesterday.bestAd.profit)}
              {yesterday.bestAd.trueRoas !== null && ` · ${yesterday.bestAd.trueRoas.toFixed(1)}x`}
            </span>
            <span className="shrink-0 text-indigo-500">→</span>
          </Link>
        )}
      </div>

      {!yesterday.hasData ? (
        <p className="mt-1 text-sm font-medium !text-ink-400">No data for yesterday yet.</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(260px,4fr)_8fr] lg:items-stretch">
          <div className="relative flex min-h-[132px] flex-col justify-center">
            <Spark
              values={T.profit}
              color={profitColor}
              id="spark-profit"
              line
              dot
              fillOpacity={0.35}
              className="absolute bottom-0 right-0 h-[70%] w-[48%]"
            />
            <div className="relative z-10">
              <div
                className={`text-5xl font-extrabold leading-none tracking-tight sm:text-6xl ${
                  profitPositive ? "text-emerald-600" : "text-rose-500"
                }`}
              >
                {profitPositive ? "+" : "-"}
                {whole(yesterday.profit)}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-ink-700">{profitPositive ? "Profit" : "Loss"}</span>
                {delta !== null && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      delta >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                    }`}
                  >
                    {delta >= 0 ? "▲" : "▼"} {whole(delta)} vs day before
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Fact value={whole(yesterday.ghlRevenue)} label="Revenue" tone="indigo" trend={T.revenue} />
            <Fact value={whole(yesterday.metaSpend)} label="Ad spend" tone="pink" trend={T.spend} />
            <Fact
              value={yesterday.trueRoas !== null ? `${yesterday.trueRoas.toFixed(2)}x` : "-"}
              label="True ROAS"
              tone="violet"
              trend={T.trueRoas}
            />
            <Fact value={String(yesterday.ghlOrders)} label="Orders" tone="sky" trend={T.orders} />
            <Fact value={yesterday.cpa !== null ? `$${yesterday.cpa.toFixed(2)}` : "-"} label="CPA" tone="amber" trend={T.cpa} />
            <Fact value={whole(yesterday.recoveredRevenue)} label="Recovered" tone="emerald" trend={T.recovered} />
          </div>
        </div>
      )}
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
