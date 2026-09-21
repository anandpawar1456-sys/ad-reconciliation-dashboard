import Link from "next/link";
import { notFound } from "next/navigation";
import NavBar from "../../dashboard/NavBar";
import { getCampaignDetail } from "@/lib/campaignQueries";
import { formatCurrency, formatRoas } from "@/lib/format";
import { FUNNEL_STAGE_LABELS, type FunnelStage } from "@/lib/funnelStages";

export const dynamic = "force-dynamic";

const LOOKBACK_DAYS = 30;

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const until = new Date();
  const since = new Date(until.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const campaign = await getCampaignDetail(params.id, since, until);

  if (!campaign) notFound();

  const gapAmount = campaign.ghlRevenue - campaign.metaRevenue;

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/campaigns" className="text-sm text-ink-400 hover:text-ink-900">
          ← Campaigns
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{campaign.name}</h1>
          <span className="rounded-full bg-ink-900/5 px-2.5 py-1 text-xs font-semibold text-ink-500">
            {campaign.effectiveStatus.replaceAll("_", " ")}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-400">Last {LOOKBACK_DAYS} days · {campaign.campaignId}</p>

        {/* Meta reported vs true ROAS — the headline comparison */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatTile label="Meta Reported ROAS" value={formatRoas(campaign.metaRoas)} accent="from-fuchsia-400 to-pink-500" />
          <StatTile label="True ROAS" value={formatRoas(campaign.trueRoas)} accent="from-violet-400 to-purple-500" />
          <StatTile
            label="Recovered Revenue"
            value={campaign.recoveredRevenue > 0 ? `+${formatCurrency(campaign.recoveredRevenue)}` : "$0.00"}
            accent="from-emerald-400 to-teal-500"
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="Ad Spend" value={formatCurrency(campaign.spend)} accent="from-indigo-400 to-blue-500" />
          <StatTile label="Meta Revenue" value={formatCurrency(campaign.metaRevenue)} accent="from-sky-400 to-cyan-500" />
          <StatTile label="GHL Revenue" value={formatCurrency(campaign.ghlRevenue)} accent="from-orange-400 to-amber-500" />
          <StatTile
            label="Gap (GHL − Meta)"
            value={`${formatCurrency(gapAmount)}`}
            accent={gapAmount > 0 ? "from-rose-400 to-orange-500" : "from-emerald-400 to-teal-500"}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="Meta Purchases" value={String(campaign.purchases)} accent="from-indigo-300 to-blue-400" />
          <StatTile label="GHL Transactions" value={String(campaign.ghlTransactions)} accent="from-indigo-300 to-blue-400" />
          <StatTile label="CTR" value={`${campaign.ctr.toFixed(2)}%`} accent="from-indigo-300 to-blue-400" />
          <StatTile label="Frequency" value={campaign.frequency.toFixed(2)} accent="from-indigo-300 to-blue-400" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-2">
          <StatTile label="Impressions" value={campaign.impressions.toLocaleString()} accent="from-slate-300 to-slate-400" />
          <StatTile label="Clicks" value={campaign.clicks.toLocaleString()} accent="from-slate-300 to-slate-400" />
        </div>

        {/* Funnel breakdown for this campaign — answers "how many upsells" etc */}
        <div className="mt-6 section-card">
          <span className="text-sm font-semibold text-ink-900">Funnel Breakdown (GHL, this campaign)</span>
          <div className="mt-4 space-y-2.5">
            {campaign.funnelBreakdown.length === 0 ? (
              <p className="text-sm text-ink-400">No GHL orders attributed to this campaign in this range.</p>
            ) : (
              campaign.funnelBreakdown.map((stage) => (
                <div key={stage.funnelStage} className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">
                    {FUNNEL_STAGE_LABELS[stage.funnelStage as FunnelStage] ?? stage.funnelStage}
                  </span>
                  <span className="font-medium text-ink-900">
                    {formatCurrency(stage.revenue)} · {stage.transactions} txns
                  </span>
                </div>
              ))
            )}
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
      <div className="mt-3 text-xl font-extrabold tracking-tight text-ink-900">{value}</div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">{label}</div>
    </div>
  );
}
