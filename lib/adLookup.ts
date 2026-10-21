import { prisma } from "@/lib/prisma";
import { notExcludedCustomer } from "@/lib/excludedCampaigns";
import { getSettings } from "@/lib/settings";
import { getFirstOrderTimes, isJourneyOrder } from "@/lib/journey";
import { toLocalDateLabel, DEFAULT_TIMEZONE } from "@/lib/timezone";

export type AdSearchResult = {
  adId: string;
  name: string;
  campaignName: string | null;
  adsetName: string | null;
  effectiveStatus: string;
  spend: number;
};

// Accepts an exact ad id, or any part of an ad name.
export async function searchAds(query: string): Promise<AdSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const ads = await prisma.metaAd.findMany({
    where: /^\d+$/.test(q)
      ? { OR: [{ id: q }, { id: { contains: q } }] }
      : { name: { contains: q, mode: "insensitive" } },
    take: 25,
  });
  if (ads.length === 0) return [];

  const ids = ads.map((a) => a.id);
  const [campaigns, adsets, spend] = await Promise.all([
    prisma.metaCampaign.findMany({ where: { id: { in: ads.map((a) => a.campaignId) } } }),
    prisma.metaAdSet.findMany({ where: { id: { in: ads.map((a) => a.adsetId) } } }),
    prisma.metaInsight.groupBy({ by: ["adId"], where: { level: "ad", adId: { in: ids } }, _sum: { spend: true } }),
  ]);
  const campaignName = new Map(campaigns.map((c) => [c.id, c.name]));
  const adsetName = new Map(adsets.map((a) => [a.id, a.name]));
  const spendById = new Map(spend.map((s) => [s.adId, Number(s._sum.spend ?? 0)]));

  return ads
    .map((a) => ({
      adId: a.id,
      name: a.name,
      campaignName: campaignName.get(a.campaignId) ?? null,
      adsetName: adsetName.get(a.adsetId) ?? null,
      effectiveStatus: a.effectiveStatus,
      spend: spendById.get(a.id) ?? 0,
    }))
    .sort((a, b) => b.spend - a.spend);
}

export type AdDailyRow = {
  date: Date;
  spend: number;
  metaPurchases: number;
  metaRevenue: number;
  ghlOrders: number;
  ghlRevenue: number;
  trueRevenue: number;
};

export type Verdict = {
  level: "keep" | "watch" | "kill" | "nodata";
  label: string;
  reasons: string[];
};

export type AdTotals = {
  spend: number;
  metaPurchases: number;
  metaRevenue: number;
  ghlOrders: number;
  ghlRevenue: number;
  recoveredRevenue: number;
  trueRevenue: number;
  trueRoas: number | null;
  metaRoas: number | null;
  profit: number;
  metaCpa: number | null; // spend / Meta-reported purchases
  ghlCpa: number | null; // spend / GHL orders attributed to this ad
};

export type AdHistory = {
  adId: string;
  name: string;
  status: string;
  campaignId: string | null;
  campaignName: string | null;
  adsetId: string | null;
  adsetName: string | null;
  firstDate: Date | null;
  lastDate: Date | null;
  activeDays: number;
  lifetime: AdTotals;
  last7: AdTotals;
  daily: AdDailyRow[];
  verdict: Verdict;
  timeZone: string;
  customers: Array<{ orderId: string; when: Date; email: string | null; amount: number; funnel: string | null }>;
};

const MIN_SPEND_FOR_VERDICT = 30;
const MIN_SPEND_RECENT = 20;

function totalsOf(rows: AdDailyRow[], recoveredRevenue: number): AdTotals {
  const t = rows.reduce(
    (a, r) => ({
      spend: a.spend + r.spend,
      metaPurchases: a.metaPurchases + r.metaPurchases,
      metaRevenue: a.metaRevenue + r.metaRevenue,
      ghlOrders: a.ghlOrders + r.ghlOrders,
      ghlRevenue: a.ghlRevenue + r.ghlRevenue,
      trueRevenue: a.trueRevenue + r.trueRevenue,
    }),
    { spend: 0, metaPurchases: 0, metaRevenue: 0, ghlOrders: 0, ghlRevenue: 0, trueRevenue: 0 }
  );
  return {
    ...t,
    recoveredRevenue,
    trueRoas: t.spend > 0 ? t.trueRevenue / t.spend : null,
    metaRoas: t.spend > 0 ? t.metaRevenue / t.spend : null,
    profit: t.trueRevenue - t.spend,
    metaCpa: t.metaPurchases > 0 ? t.spend / t.metaPurchases : null,
    ghlCpa: t.ghlOrders > 0 ? t.spend / t.ghlOrders : null,
  };
}

// Keep / watch / kill is judged on TRUE ROAS (Meta revenue plus sales GHL
// confirmed for the ad that Meta missed) against spend — 1.0x means the ad
// paid back its own spend, before product cost. A heuristic, not a promise:
// it needs enough spend to mean anything and also checks the last 7 days so
// a fatiguing winner or a recovering loser doesn't get a stale verdict.
export function judge(lifetime: AdTotals, last7: AdTotals): Verdict {
  if (lifetime.spend < MIN_SPEND_FOR_VERDICT) {
    return {
      level: "nodata",
      label: "Not enough data",
      reasons: [`Only $${lifetime.spend.toFixed(2)} spent — wait until at least $${MIN_SPEND_FOR_VERDICT} before judging.`],
    };
  }

  const roas = lifetime.trueRoas ?? 0;
  const recent = last7.spend >= MIN_SPEND_RECENT ? last7.trueRoas ?? 0 : null;
  const reasons = [
    `Lifetime true ROAS ${roas.toFixed(2)}x on $${lifetime.spend.toFixed(0)} spend (${lifetime.profit >= 0 ? "+" : "−"}$${Math.abs(lifetime.profit).toFixed(0)}).`,
  ];
  if (recent !== null) reasons.push(`Last 7 days: ${recent.toFixed(2)}x on $${last7.spend.toFixed(0)} spend.`);
  else reasons.push("Little or no spend in the last 7 days.");

  if (roas >= 1) {
    if (recent !== null && recent < 0.7) {
      reasons.push("Profitable overall but recent performance has dropped — likely fatiguing.");
      return { level: "watch", label: "Watch — fatiguing", reasons };
    }
    return { level: "keep", label: "Keep", reasons };
  }
  if (roas >= 0.7) {
    if (recent !== null && recent >= 1) {
      reasons.push("Below break-even overall but the last 7 days are profitable.");
      return { level: "keep", label: "Keep — recovering", reasons };
    }
    reasons.push("Close to break-even; give it a bit more spend or improve the creative.");
    return { level: "watch", label: "Watch", reasons };
  }
  if (recent !== null && recent >= 1) {
    reasons.push("Poor lifetime result but the last 7 days are profitable.");
    return { level: "watch", label: "Watch — recovering", reasons };
  }
  reasons.push("Not paying back its spend — a candidate to turn off.");
  return { level: "kill", label: "Kill", reasons };
}

export async function getAdHistory(adId: string): Promise<AdHistory | null> {
  const settings = await getSettings();
  const timeZone = settings.reportingTimezone || DEFAULT_TIMEZONE;

  const [ad, insights, attribution, allOrders, firstTimes] = await Promise.all([
    prisma.metaAd.findUnique({ where: { id: adId } }),
    prisma.metaInsight.findMany({ where: { level: "ad", adId }, orderBy: { date: "asc" } }),
    prisma.adAttribution.findMany({ where: { adId }, orderBy: { date: "asc" } }),
    // Orders tied to this ad through the contact's ad id — captured from the
    // ad_id URL parameter or recovered from UTM ids/names (see
    // lib/attributionResolve.ts).
    prisma.ghlOrder.findMany({
      where: { ...notExcludedCustomer, contact: { adId }, status: "completed" },
      include: { contact: { select: { email: true } } },
      orderBy: { occurredAt: "desc" },
    }),
    getFirstOrderTimes(),
  ]);
  // organic orders (returning buyers) from this ad's contacts aren't this ad's sales
  const orders = allOrders.filter((o) => isJourneyOrder(o.occurredAt, firstTimes.get(o.contactId)));

  if (!ad && insights.length === 0 && attribution.length === 0 && orders.length === 0) return null;

  const days = new Map<string, AdDailyRow>();
  const rowFor = (date: Date) => {
    const key = date.toISOString();
    let r = days.get(key);
    if (!r) {
      r = { date, spend: 0, metaPurchases: 0, metaRevenue: 0, ghlOrders: 0, ghlRevenue: 0, trueRevenue: 0 };
      days.set(key, r);
    }
    return r;
  };

  for (const i of insights) {
    const r = rowFor(i.date);
    r.spend += Number(i.spend);
    r.metaPurchases += i.purchases;
    r.metaRevenue += Number(i.purchaseValue);
  }
  let recoveredLifetime = 0;
  const recoveredByDay = new Map<string, number>();
  for (const a of attribution) {
    const r = rowFor(a.date);
    r.trueRevenue += Number(a.trueRevenue);
    recoveredLifetime += Number(a.recoveredRevenue);
    recoveredByDay.set(a.date.toISOString(), Number(a.recoveredRevenue));
  }
  for (const o of orders) {
    const r = rowFor(toLocalDateLabel(o.occurredAt, timeZone));
    r.ghlOrders += 1;
    r.ghlRevenue += Number(o.amount);
  }
  // A day with only Meta data (no attribution row yet) still counts Meta's
  // revenue as its true revenue.
  for (const r of days.values()) if (r.trueRevenue === 0 && r.metaRevenue > 0) r.trueRevenue = r.metaRevenue;

  const daily = [...days.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  const today = toLocalDateLabel(new Date(), timeZone);
  const cutoff = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
  const recent = daily.filter((d) => d.date >= cutoff);
  const recoveredRecent = recent.reduce((s, d) => s + (recoveredByDay.get(d.date.toISOString()) ?? 0), 0);

  const lifetime = totalsOf(daily, recoveredLifetime);
  const last7 = totalsOf(recent, recoveredRecent);

  const [campaign, adset] = await Promise.all([
    ad ? prisma.metaCampaign.findUnique({ where: { id: ad.campaignId } }) : null,
    ad ? prisma.metaAdSet.findUnique({ where: { id: ad.adsetId } }) : null,
  ]);
  const spendDays = daily.filter((d) => d.spend > 0);

  return {
    adId,
    name: ad?.name ?? insights[insights.length - 1]?.adName ?? attribution[attribution.length - 1]?.adName ?? adId,
    status: ad?.effectiveStatus ?? "UNKNOWN",
    campaignId: ad?.campaignId ?? null,
    campaignName: campaign?.name ?? null,
    adsetId: ad?.adsetId ?? null,
    adsetName: adset?.name ?? null,
    firstDate: spendDays[0]?.date ?? null,
    lastDate: spendDays[spendDays.length - 1]?.date ?? null,
    activeDays: spendDays.length,
    lifetime,
    last7,
    daily,
    verdict: judge(lifetime, last7),
    timeZone,
    customers: orders.slice(0, 50).map((o) => ({
      orderId: o.id,
      when: o.occurredAt,
      email: o.contact?.email ?? null,
      amount: Number(o.amount),
      funnel: o.sourceName ?? null,
    })),
  };
}
