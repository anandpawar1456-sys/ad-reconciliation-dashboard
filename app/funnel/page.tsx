import NavBar from "../dashboard/NavBar";
import DateRangePicker from "../dashboard/DateRangePicker";
import { getFunnelsBreakdown, getEarliestDataDate } from "@/lib/dashboardQueries";
import { getSettings } from "@/lib/settings";
import { getGhlFunnelStepNames } from "@/lib/ghl";
import { resolveRange, type RangePreset } from "@/lib/dateRanges";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FunnelPage({
  searchParams,
}: {
  searchParams: { range?: string; since?: string; until?: string };
}) {
  const settings = await getSettings();
  const timeZone = settings.reportingTimezone || DEFAULT_TIMEZONE;
  const earliestDataDate = (await getEarliestDataDate()) ?? new Date();

  const preset = (searchParams.range ?? "last30") as RangePreset;
  const resolved = resolveRange(preset, timeZone, earliestDataDate, searchParams.since, searchParams.until);

  const [funnels, stepNames] = await Promise.all([
    getFunnelsBreakdown(resolved.since, resolved.until),
    settings.ghlApiKey && settings.ghlLocationId
      ? getGhlFunnelStepNames(settings.ghlApiKey, settings.ghlLocationId)
      : Promise.resolve(new Map()),
  ]);
  const totalRevenue = funnels.reduce((sum, f) => sum + f.revenue, 0);

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">Funnel Breakdown</h1>
            <p className="mt-2 text-ink-400">
              Revenue and transactions by GHL funnel and funnel step, {resolved.label.toLowerCase()}.
            </p>
          </div>
          <DateRangePicker currentPreset={preset} currentLabel={resolved.label} basePath="/funnel" />
        </div>

        <div className="mt-8 space-y-4">
          {funnels.length === 0 ? (
            <div className="section-card py-12 text-center">
              <div className="mx-auto h-10 w-10 rounded-2xl bg-gradient-to-br from-fuchsia-400 to-pink-500 shadow-sm" />
              <p className="mt-4 font-medium text-ink-900">No orders in this range</p>
              <p className="mt-1 text-sm text-ink-400">Pick a wider date range, or wait for new GHL orders to sync.</p>
            </div>
          ) : (
            funnels.map((funnel) => {
              const share = totalRevenue > 0 ? (funnel.revenue / totalRevenue) * 100 : 0;
              return (
                <div key={funnel.funnelName} className="section-card">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-base font-bold text-ink-900">{funnel.funnelName}</span>
                    <span className="text-sm text-ink-400">
                      {funnel.transactions} txns · {share.toFixed(0)}% of revenue
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-900/5">
                      <div className="h-full rounded-full bg-aurora-full" style={{ width: `${Math.max(share, 2)}%` }} />
                    </div>
                    <span className="w-24 shrink-0 text-right text-sm font-bold text-ink-900">
                      {formatCurrency(funnel.revenue)}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-ink-900/5 pt-3">
                    {funnel.steps.map((step) => {
                      const info = step.stepId ? stepNames.get(step.stepId) : undefined;
                      const label = info?.stepName ?? (step.stepId ? `Step ${step.stepId.slice(0, 8)}` : "Unknown step");
                      const stepShare = funnel.revenue > 0 ? (step.revenue / funnel.revenue) * 100 : 0;
                      return (
                        <div key={step.stepId ?? "none"}>
                          <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="font-medium text-ink-700">{label}</span>
                            <span className="shrink-0 text-ink-400">
                              {step.transactions} txns · <span className="font-semibold text-ink-900">{formatCurrency(step.revenue)}</span>
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-900/5">
                            <div className="h-full rounded-full bg-indigo-400" style={{ width: `${Math.max(stepShare, 1.5)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
