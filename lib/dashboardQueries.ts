import { prisma } from "@/lib/prisma";

// Window filters below don't need to be exact label-date boundaries — a
// day of slop on a "last N days" display window is inconsequential, unlike
// the actual rollup bucketing in lib/rollup.ts which must be precise.
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function getDailyReconciliation(days: number) {
  const since = daysAgo(days);
  return prisma.dailyReconciliation.findMany({
    where: { date: { gte: since } },
    orderBy: { date: "desc" },
  });
}

export type AdAttributionTotal = {
  adId: string;
  adName: string | null;
  adsetId: string | null;
  campaignId: string | null;
  metaSpend: number;
  metaRevenue: number;
  metaRoas: number | null;
  ghlRevenue: number;
  recoveredRevenue: number;
  trueRevenue: number;
  trueRoas: number | null;
};

// Sums AdAttribution rows across the window per ad, then recomputes ratios
// from the sums (rather than averaging daily ratios, which would skew
// low-spend days too heavily).
export async function getAdAttributionTotals(days: number): Promise<AdAttributionTotal[]> {
  const since = daysAgo(days);
  const rows = await prisma.adAttribution.findMany({ where: { date: { gte: since } } });

  const byAd = new Map<string, AdAttributionTotal>();
  for (const row of rows) {
    const existing = byAd.get(row.adId) ?? {
      adId: row.adId,
      adName: row.adName,
      adsetId: row.adsetId,
      campaignId: row.campaignId,
      metaSpend: 0,
      metaRevenue: 0,
      metaRoas: null,
      ghlRevenue: 0,
      recoveredRevenue: 0,
      trueRevenue: 0,
      trueRoas: null,
    };

    existing.adName = row.adName ?? existing.adName;
    existing.metaSpend += Number(row.metaSpend);
    existing.metaRevenue += Number(row.metaRevenue);
    existing.ghlRevenue += Number(row.ghlRevenue);
    existing.recoveredRevenue += Number(row.recoveredRevenue);
    existing.trueRevenue += Number(row.trueRevenue);
    byAd.set(row.adId, existing);
  }

  const totals = [...byAd.values()];
  for (const t of totals) {
    t.metaRoas = t.metaSpend > 0 ? t.metaRevenue / t.metaSpend : null;
    t.trueRoas = t.metaSpend > 0 ? t.trueRevenue / t.metaSpend : null;
  }

  return totals.sort((a, b) => b.trueRevenue - a.trueRevenue);
}

export type FunnelStageTotal = {
  funnelStage: string;
  revenue: number;
  transactions: number;
};

export async function getFunnelBreakdown(days: number): Promise<FunnelStageTotal[]> {
  const since = daysAgo(days);
  const orders = await prisma.ghlOrder.findMany({
    where: { occurredAt: { gte: since }, status: { notIn: ["refunded", "void", "cancelled"] } },
    select: { funnelStage: true, amount: true },
  });

  const byStage = new Map<string, FunnelStageTotal>();
  for (const order of orders) {
    const entry = byStage.get(order.funnelStage) ?? {
      funnelStage: order.funnelStage,
      revenue: 0,
      transactions: 0,
    };
    entry.revenue += Number(order.amount);
    entry.transactions += 1;
    byStage.set(order.funnelStage, entry);
  }

  return [...byStage.values()].sort((a, b) => b.revenue - a.revenue);
}

export async function getUnmatchedTransactions() {
  return prisma.unmatchedTransaction.findMany({
    where: { status: "NEEDS_REVIEW" },
    include: { ghlOrder: { include: { contact: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
