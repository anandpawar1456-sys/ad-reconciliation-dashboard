import NavBar from "../dashboard/NavBar";
import { getFunnelBreakdown } from "@/lib/dashboardQueries";
import { formatCurrency } from "@/lib/format";
import { FUNNEL_STAGE_LABELS, type FunnelStage } from "@/lib/funnelStages";

export const dynamic = "force-dynamic";

export default async function FunnelPage() {
  const stages = await getFunnelBreakdown(30);
  const totalRevenue = stages.reduce((sum, s) => sum + s.revenue, 0);

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">Funnel Breakdown</h1>
        <p className="mt-2 text-ink-400">
          Revenue and transactions by funnel stage, last 30 days. Orders show as &quot;Unknown&quot;
          until their GHL product id is mapped to a stage in Settings.
        </p>

        <div className="mt-8 space-y-3">
          {stages.length === 0 ? (
            <div className="section-card py-12 text-center">
              <div className="mx-auto h-10 w-10 rounded-2xl bg-gradient-to-br from-fuchsia-400 to-pink-500 shadow-sm" />
              <p className="mt-4 font-medium text-ink-900">No orders yet</p>
              <p className="mt-1 text-sm text-ink-400">This fills in once GHL orders start syncing.</p>
            </div>
          ) : (
            stages.map((stage) => {
              const label = FUNNEL_STAGE_LABELS[stage.funnelStage as FunnelStage] ?? stage.funnelStage;
              const share = totalRevenue > 0 ? (stage.revenue / totalRevenue) * 100 : 0;
              return (
                <div key={stage.funnelStage} className="section-card">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink-900">{label}</span>
                    <span className="text-sm text-ink-400">{stage.transactions} txns</span>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-900/5">
                      <div
                        className="h-full rounded-full bg-aurora-full"
                        style={{ width: `${Math.max(share, 2)}%` }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right text-sm font-semibold text-ink-900">
                      {formatCurrency(stage.revenue)}
                    </span>
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
