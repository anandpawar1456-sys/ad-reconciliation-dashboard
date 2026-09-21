import Link from "next/link";
import NavBar from "./NavBar";
import DateRangePicker from "./DateRangePicker";
import RevenueChart from "./RevenueChart";
import { getOverviewData, getEarliestDataDate } from "@/lib/dashboardQueries";
import { getSettings } from "@/lib/settings";
import { resolveRange, type RangePreset } from "@/lib/dateRanges";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { formatCurrency, formatRoas } from "@/lib/format";
import { FUNNEL_STAGE_LABELS, type FunnelStage } from "@/lib/funnelStages";

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

  const data = await getOverviewData(resolved.since, resolved.until);

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">Overview</h1>
            <p className="mt-1 text-sm text-ink-400">
              {resolved.since.toDateString() === resolved.until.toDateString()
                ? resolved.label
                : `${resolved.label} — ${resolved.since.toISOString().slice(0, 10)} to ${resolved.until.toISOString().slice(0, 10)}`}
            </p>
          </div>
          <DateRangePicker currentPreset={preset} currentLabel={resolved.label} />
        </div>

        {/* Stat tiles */}
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="GHL Revenue" value={formatCurrency(data.totals.ghlRevenue)} accent="from-indigo-400 to-blue-500" />
          <StatTile label="Meta Ad Spend" value={formatCurrency(data.totals.metaSpend)} accent="from-fuchsia-400 to-pink-500" />
          <StatTile
            label="Gap"
            value={`${formatCurrency(data.totals.gapAmount)} (${data.totals.gapPercent.toFixed(1)}%)`}
            accent={data.totals.gapAmount > 0 ? "from-rose-400 to-orange-500" : "from-emerald-400 to-teal-500"}
          />
          <StatTile label="True ROAS" value={formatRoas(data.totals.avgTrueRoas)} accent="from-violet-400 to-purple-500" />
        </div>

        {/* Chart */}
        <div className="mt-6 section-card">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink-900">Revenue Trend</span>
            <span className="text-xs text-ink-400">
              {data.totals.ghlTransactions} GHL txns · {data.totals.metaPurchases} Meta purchases
            </span>
          </div>
          <div className="mt-4">
            <RevenueChart
              points={data.series.map((p) => ({
                date: p.date.toISOString(),
                ghlRevenue: p.ghlRevenue,
                metaRevenue: p.metaRevenue,
              }))}
            />
          </div>
        </div>

        {/* Two-column detail row */}
        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          <div className="section-card lg:col-span-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-900">Top Ads</span>
              <Link href="/true-roas" className="text-xs font-medium text-ink-500 hover:text-ink-900">
                View all →
              </Link>
            </div>
            <div className="mt-4 space-y-1">
              {data.topAds.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-400">No ad-level data in this range yet.</p>
              ) : (
                data.topAds.map((ad) => (
                  <div key={ad.adId} className="flex items-center justify-between rounded-xl px-2 py-2.5 hover:bg-ink-900/[0.03]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-aurora-full text-xs font-bold text-white">
                        {(ad.adName ?? ad.adId).slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-ink-900">{ad.adName ?? ad.adId}</div>
                        <div className="text-xs text-ink-400">{formatRoas(ad.trueRoas)} true ROAS</div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-ink-900">{formatCurrency(ad.trueRevenue)}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-6 lg:col-span-2">
            <div className="section-card">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-900">Funnel Breakdown</span>
                <Link href="/funnel" className="text-xs font-medium text-ink-500 hover:text-ink-900">
                  View all →
                </Link>
              </div>
              <div className="mt-4 space-y-2.5">
                {data.funnelBreakdown.length === 0 ? (
                  <p className="text-sm text-ink-400">No orders in this range yet.</p>
                ) : (
                  data.funnelBreakdown.map((stage) => (
                    <div key={stage.funnelStage} className="flex items-center justify-between text-sm">
                      <span className="text-ink-700">
                        {FUNNEL_STAGE_LABELS[stage.funnelStage as FunnelStage] ?? stage.funnelStage}
                      </span>
                      <span className="font-medium text-ink-900">{formatCurrency(stage.revenue)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Link href="/missing-transactions" className="section-card block">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-900">Missing Transactions</span>
                <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-500">
                  {data.unmatchedCount}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-400">Orders needing manual review →</p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="section-card">
      <div className={`h-2 w-8 rounded-full bg-gradient-to-r ${accent}`} />
      <div className="mt-3 text-2xl font-extrabold tracking-tight text-ink-900">{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-400">{label}</div>
    </div>
  );
}
