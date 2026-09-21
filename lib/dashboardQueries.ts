import { prisma } from "@/lib/prisma";

// Window filters below don't need to be exact label-date boundaries — a
// day of slop on a "last N days" display window is inconsequential, unlike
// the actual rollup bucketing in lib/rollup.ts which must be precise.
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function getEarliestDataDate(): Promise<Date | null> {
  const earliest = await prisma.dailyReconciliation.findFirst({ orderBy: { date: "asc" } });
  return earliest?.date ?? null;
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
    where: { occurredAt: { gte: since }, status: { in: ["completed"] } },
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

export type DailySeriesPoint = {
  date: Date;
  ghlRevenue: number;
  metaRevenue: number;
  metaSpend: number;
};

export type OverviewData = {
  series: DailySeriesPoint[];
  totals: {
    ghlRevenue: number;
    ghlTransactions: number;
    metaSpend: number;
    metaRevenue: number;
    metaPurchases: number;
    gapAmount: number;
    gapPercent: number;
    trueRevenue: number;
    avgTrueRoas: number | null;
  };
  topAds: AdAttributionTotal[];
  funnelBreakdown: FunnelStageTotal[];
  unmatchedCount: number;
};

// The single consolidated query behind the homepage — everything for one
// explicit [since, until] label-date range (see lib/dateRanges.ts), so the
// date-range picker drives one query instead of each section fetching its
// own separately-windowed data.
export async function getOverviewData(since: Date, until: Date): Promise<OverviewData> {
  const untilExclusive = new Date(until.getTime() + 24 * 60 * 60 * 1000);

  const [reconciliationRows, attributionRows, unmatchedCount] = await Promise.all([
    prisma.dailyReconciliation.findMany({
      where: { date: { gte: since, lt: untilExclusive } },
      orderBy: { date: "asc" },
    }),
    prisma.adAttribution.findMany({ where: { date: { gte: since, lt: untilExclusive } } }),
    prisma.unmatchedTransaction.count({ where: { status: "NEEDS_REVIEW" } }),
  ]);

  const series: DailySeriesPoint[] = reconciliationRows.map((r) => ({
    date: r.date,
    ghlRevenue: Number(r.ghlRevenue),
    metaRevenue: Number(r.metaRevenue),
    metaSpend: 0, // filled in below from attributionRows, summed per day
  }));
  const spendByDay = new Map<string, number>();
  for (const row of attributionRows) {
    const key = row.date.toISOString();
    spendByDay.set(key, (spendByDay.get(key) ?? 0) + Number(row.metaSpend));
  }
  for (const point of series) {
    point.metaSpend = spendByDay.get(point.date.toISOString()) ?? 0;
  }

  const totals = reconciliationRows.reduce(
    (acc, r) => {
      acc.ghlRevenue += Number(r.ghlRevenue);
      acc.ghlTransactions += r.ghlTransactions;
      acc.metaRevenue += Number(r.metaRevenue);
      acc.metaPurchases += r.metaPurchases;
      return acc;
    },
    { ghlRevenue: 0, ghlTransactions: 0, metaRevenue: 0, metaPurchases: 0 }
  );
  const metaSpend = attributionRows.reduce((sum, r) => sum + Number(r.metaSpend), 0);
  const trueRevenue = attributionRows.reduce((sum, r) => sum + Number(r.trueRevenue), 0);
  const gapAmount = totals.ghlRevenue - totals.metaRevenue;
  const gapPercent = totals.metaRevenue > 0 ? (gapAmount / totals.metaRevenue) * 100 : totals.ghlRevenue > 0 ? 100 : 0;
  const avgTrueRoas = metaSpend > 0 ? trueRevenue / metaSpend : null;

  const byAd = new Map<string, AdAttributionTotal>();
  for (const row of attributionRows) {
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
  const topAds = [...byAd.values()]
    .map((ad) => ({
      ...ad,
      metaRoas: ad.metaSpend > 0 ? ad.metaRevenue / ad.metaSpend : null,
      trueRoas: ad.metaSpend > 0 ? ad.trueRevenue / ad.metaSpend : null,
    }))
    .sort((a, b) => b.trueRevenue - a.trueRevenue)
    .slice(0, 5);

  const orders = await prisma.ghlOrder.findMany({
    where: { occurredAt: { gte: since, lt: untilExclusive }, status: "completed" },
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
  const funnelBreakdown = [...byStage.values()].sort((a, b) => b.revenue - a.revenue);

  return {
    series,
    totals: { ...totals, metaSpend, gapAmount, gapPercent, trueRevenue, avgTrueRoas },
    topAds,
    funnelBreakdown,
    unmatchedCount,
  };
}
