import { prisma } from "@/lib/prisma";

export type HierarchySummary = {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  spend: number;
  metaRevenue: number;
  metaRoas: number | null;
  trueRevenue: number;
  trueRoas: number | null;
  recoveredRevenue: number;
  ghlRevenue: number;
  ghlProfit: number; // ghlRevenue - spend: the real, GHL-verified profit/loss
  metaProfit: number; // metaRevenue - spend: what Meta's own numbers claim — often wrong
  purchases: number;
  impressions: number;
  clicks: number;
  uniqueLinkClicks: number;
  ctr: number;
  frequency: number;
};

type Level = "campaign" | "adset" | "ad";

// Shared aggregation for all three drill-down levels — campaigns (no
// parent filter), ad sets (filtered to one campaign), ads (filtered to one
// ad set). Joins MetaInsight (performance), the matching Meta*/status
// table, AdAttribution (recovered/true revenue — only computed at ad
// level today, summed up for adset/campaign rollups), and GHL revenue via
// the contact's captured campaignId/adsetId/adId.
async function getHierarchySummaries(
  level: Level,
  parentId: string | null,
  since: Date,
  until: Date
): Promise<HierarchySummary[]> {
  const untilExclusive = new Date(until.getTime() + 24 * 60 * 60 * 1000);
  const idField = level === "campaign" ? "campaignId" : level === "adset" ? "adsetId" : "adId";

  const insightWhere: Record<string, unknown> = { date: { gte: since, lt: untilExclusive }, level: "ad" };
  if (level === "adset" && parentId) insightWhere.campaignId = parentId;
  if (level === "ad" && parentId) insightWhere.adsetId = parentId;

  const [insightRows, attributionRows, statusRows] = await Promise.all([
    prisma.metaInsight.findMany({ where: insightWhere }),
    prisma.adAttribution.findMany({ where: { date: { gte: since, lt: untilExclusive } } }),
    level === "campaign"
      ? prisma.metaCampaign.findMany()
      : level === "adset"
        ? prisma.metaAdSet.findMany(parentId ? { where: { campaignId: parentId } } : undefined)
        : prisma.metaAd.findMany(parentId ? { where: { adsetId: parentId } } : undefined),
  ]);

  const statusById = new Map(statusRows.map((s) => [s.id, s]));

  const byId = new Map<string, HierarchySummary>();
  const freqSums = new Map<string, { sum: number; count: number }>();

  function blankSummary(id: string, name: string): HierarchySummary {
    return {
      id,
      name,
      status: statusById.get(id)?.status ?? "UNKNOWN",
      effectiveStatus: statusById.get(id)?.effectiveStatus ?? "UNKNOWN",
      spend: 0,
      metaRevenue: 0,
      metaRoas: null,
      trueRevenue: 0,
      trueRoas: null,
      recoveredRevenue: 0,
      ghlRevenue: 0,
      ghlProfit: 0,
      metaProfit: 0,
      purchases: 0,
      impressions: 0,
      clicks: 0,
      uniqueLinkClicks: 0,
      ctr: 0,
      frequency: 0,
    };
  }

  // Seed every known entity (from the Meta*/status table) with a zeroed
  // row first, so a campaign/ad set/ad with no activity in the selected
  // range still shows up — the full list should always be there, only the
  // numbers should change with the date range, not which rows exist.
  for (const status of statusRows) {
    byId.set(status.id, blankSummary(status.id, status.name));
  }

  for (const row of insightRows) {
    const id = (row as unknown as Record<string, string | null>)[idField];
    if (!id) continue;

    const existing =
      byId.get(id) ??
      blankSummary(id, (level === "campaign" ? row.campaignName : level === "adset" ? row.adsetName : row.adName) ?? id);
    existing.spend += Number(row.spend);
    existing.metaRevenue += Number(row.purchaseValue);
    existing.purchases += row.purchases;
    existing.impressions += row.impressions;
    existing.clicks += row.clicks;
    existing.uniqueLinkClicks += row.uniqueLinkClicks;
    byId.set(id, existing);

    const f = freqSums.get(id) ?? { sum: 0, count: 0 };
    f.sum += Number(row.frequency);
    f.count += 1;
    freqSums.set(id, f);
  }

  const recoveredById = new Map<string, number>();
  const trueRevenueById = new Map<string, number>();
  for (const row of attributionRows) {
    const id = level === "campaign" ? row.campaignId : level === "adset" ? row.adsetId : row.adId;
    if (!id) continue;
    if (level === "adset" && parentId && row.campaignId !== parentId) continue;
    recoveredById.set(id, (recoveredById.get(id) ?? 0) + Number(row.recoveredRevenue));
    trueRevenueById.set(id, (trueRevenueById.get(id) ?? 0) + Number(row.trueRevenue));
  }

  // GHL revenue joined via the contact's captured attribution id for this level.
  const contactField = level === "campaign" ? "campaignId" : level === "adset" ? "adsetId" : "adId";
  const ghlOrders = await prisma.ghlOrder.findMany({
    where: {
      occurredAt: { gte: since, lt: untilExclusive },
      status: "completed",
      contact: parentId
        ? level === "adset"
          ? { campaignId: parentId }
          : level === "ad"
            ? { adsetId: parentId }
            : undefined
        : undefined,
    },
    select: { amount: true, contact: { select: { campaignId: true, adsetId: true, adId: true } } },
  });
  const ghlRevenueById = new Map<string, number>();
  for (const order of ghlOrders) {
    const id = order.contact?.[contactField as "campaignId" | "adsetId" | "adId"];
    if (!id) continue;
    ghlRevenueById.set(id, (ghlRevenueById.get(id) ?? 0) + Number(order.amount));
  }

  const summaries = [...byId.values()].map((c) => {
    const recoveredRevenue = recoveredById.get(c.id) ?? 0;
    const trueRevenue = trueRevenueById.get(c.id) ?? c.metaRevenue;
    const ghlRevenue = ghlRevenueById.get(c.id) ?? 0;
    const freq = freqSums.get(c.id);
    return {
      ...c,
      recoveredRevenue,
      trueRevenue,
      ghlRevenue,
      ghlProfit: ghlRevenue - c.spend,
      metaProfit: c.metaRevenue - c.spend,
      metaRoas: c.spend > 0 ? c.metaRevenue / c.spend : null,
      trueRoas: c.spend > 0 ? trueRevenue / c.spend : null,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      frequency: freq && freq.count > 0 ? freq.sum / freq.count : 0,
    };
  });

  return summaries.sort((a, b) => b.spend - a.spend);
}

export async function getCampaignSummaries(since: Date, until: Date): Promise<HierarchySummary[]> {
  return getHierarchySummaries("campaign", null, since, until);
}

export async function getAdSetSummaries(campaignId: string, since: Date, until: Date): Promise<HierarchySummary[]> {
  return getHierarchySummaries("adset", campaignId, since, until);
}

export async function getAdSummaries(adsetId: string, since: Date, until: Date): Promise<HierarchySummary[]> {
  return getHierarchySummaries("ad", adsetId, since, until);
}

export async function getCampaignName(campaignId: string): Promise<string | null> {
  const c = await prisma.metaCampaign.findUnique({ where: { id: campaignId } });
  return c?.name ?? null;
}

export async function getAdSetName(adsetId: string): Promise<{ name: string; campaignId: string } | null> {
  const a = await prisma.metaAdSet.findUnique({ where: { id: adsetId } });
  return a ? { name: a.name, campaignId: a.campaignId } : null;
}
