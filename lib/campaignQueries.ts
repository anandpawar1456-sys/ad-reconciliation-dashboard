import { prisma } from "@/lib/prisma";

export type CampaignSummary = {
  campaignId: string;
  name: string;
  status: string;
  effectiveStatus: string;
  spend: number;
  metaRevenue: number;
  metaRoas: number | null;
  trueRevenue: number;
  trueRoas: number | null;
  recoveredRevenue: number;
  purchases: number;
  impressions: number;
  clicks: number;
  ctr: number;
  frequency: number;
};

// One row per campaign, aggregated over [since, until], joined against
// MetaCampaign for name/status. Campaigns with no MetaCampaign row yet
// (status not synced) still show up, labeled by their id.
export async function getCampaignSummaries(since: Date, until: Date): Promise<CampaignSummary[]> {
  const untilExclusive = new Date(until.getTime() + 24 * 60 * 60 * 1000);

  const [insightRows, attributionRows, campaigns] = await Promise.all([
    prisma.metaInsight.findMany({
      where: { date: { gte: since, lt: untilExclusive }, level: "ad" },
    }),
    prisma.adAttribution.findMany({ where: { date: { gte: since, lt: untilExclusive } } }),
    prisma.metaCampaign.findMany(),
  ]);

  const campaignById = new Map(campaigns.map((c) => [c.id, c]));

  const byCampaign = new Map<string, CampaignSummary>();
  for (const row of insightRows) {
    const existing = byCampaign.get(row.campaignId) ?? {
      campaignId: row.campaignId,
      name: campaignById.get(row.campaignId)?.name ?? row.campaignName ?? row.campaignId,
      status: campaignById.get(row.campaignId)?.status ?? "UNKNOWN",
      effectiveStatus: campaignById.get(row.campaignId)?.effectiveStatus ?? "UNKNOWN",
      spend: 0,
      metaRevenue: 0,
      metaRoas: null,
      trueRevenue: 0,
      trueRoas: null,
      recoveredRevenue: 0,
      purchases: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      frequency: 0,
    };
    existing.spend += Number(row.spend);
    existing.metaRevenue += Number(row.purchaseValue);
    existing.purchases += row.purchases;
    existing.impressions += row.impressions;
    existing.clicks += row.clicks;
    byCampaign.set(row.campaignId, existing);
  }

  // Adjust average frequency per campaign (impressions-weighted would need
  // per-ad reach; simple mean across the day/ad rows is a reasonable
  // approximation for now).
  const freqSums = new Map<string, { sum: number; count: number }>();
  for (const row of insightRows) {
    const entry = freqSums.get(row.campaignId) ?? { sum: 0, count: 0 };
    entry.sum += Number(row.frequency);
    entry.count += 1;
    freqSums.set(row.campaignId, entry);
  }

  const recoveredByCampaign = new Map<string, number>();
  const trueRevenueByCampaign = new Map<string, number>();
  for (const row of attributionRows) {
    if (!row.campaignId) continue;
    recoveredByCampaign.set(row.campaignId, (recoveredByCampaign.get(row.campaignId) ?? 0) + Number(row.recoveredRevenue));
    trueRevenueByCampaign.set(row.campaignId, (trueRevenueByCampaign.get(row.campaignId) ?? 0) + Number(row.trueRevenue));
  }

  const summaries = [...byCampaign.values()].map((c) => {
    const recoveredRevenue = recoveredByCampaign.get(c.campaignId) ?? 0;
    const trueRevenue = trueRevenueByCampaign.get(c.campaignId) ?? c.metaRevenue;
    const freq = freqSums.get(c.campaignId);
    return {
      ...c,
      recoveredRevenue,
      trueRevenue,
      metaRoas: c.spend > 0 ? c.metaRevenue / c.spend : null,
      trueRoas: c.spend > 0 ? trueRevenue / c.spend : null,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      frequency: freq && freq.count > 0 ? freq.sum / freq.count : 0,
    };
  });

  return summaries.sort((a, b) => b.spend - a.spend);
}

export type CampaignDetail = CampaignSummary & {
  ghlRevenue: number;
  ghlTransactions: number;
  funnelBreakdown: { funnelStage: string; revenue: number; transactions: number }[];
};

export async function getCampaignDetail(campaignId: string, since: Date, until: Date): Promise<CampaignDetail | null> {
  const summaries = await getCampaignSummaries(since, until);
  const summary = summaries.find((c) => c.campaignId === campaignId);
  if (!summary) return null;

  const untilExclusive = new Date(until.getTime() + 24 * 60 * 60 * 1000);

  // GHL-side revenue for this campaign, resolved via the order's contact's
  // campaignId (captured by attribution — see lib/ghl.ts extractAttribution).
  const orders = await prisma.ghlOrder.findMany({
    where: {
      occurredAt: { gte: since, lt: untilExclusive },
      status: "completed",
      contact: { campaignId },
    },
    select: { amount: true, funnelStage: true },
  });

  const ghlRevenue = orders.reduce((sum, o) => sum + Number(o.amount), 0);
  const byStage = new Map<string, { funnelStage: string; revenue: number; transactions: number }>();
  for (const order of orders) {
    const entry = byStage.get(order.funnelStage) ?? { funnelStage: order.funnelStage, revenue: 0, transactions: 0 };
    entry.revenue += Number(order.amount);
    entry.transactions += 1;
    byStage.set(order.funnelStage, entry);
  }

  return {
    ...summary,
    ghlRevenue,
    ghlTransactions: orders.length,
    funnelBreakdown: [...byStage.values()].sort((a, b) => b.revenue - a.revenue),
  };
}
