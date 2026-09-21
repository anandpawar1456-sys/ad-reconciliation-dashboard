import { prisma } from "@/lib/prisma";
import type { GhlOrder, GhlContact, MetaInsight } from "@prisma/client";

// Orders in these statuses don't count as real revenue.
const EXCLUDED_STATUSES = ["refunded", "void", "cancelled"];

export function toUtcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Recomputes DailyReconciliation and AdAttribution for a single UTC day from
// raw GhlOrder/GhlContact/MetaInsight rows. Called synchronously (for just
// today) right after a GHL webhook lands, so sales reflect immediately —
// and from the hourly Meta-sync cron (for the last few days), so ad-level
// numbers catch up once Meta's own data arrives.
export async function computeDailyRollup(day: Date): Promise<void> {
  const dayStart = toUtcDateOnly(day);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const orders = await prisma.ghlOrder.findMany({
    where: { occurredAt: { gte: dayStart, lt: dayEnd }, status: { notIn: EXCLUDED_STATUSES } },
    include: { contact: true },
  });

  const metaRows = await prisma.metaInsight.findMany({
    where: { date: dayStart, level: "ad" },
  });

  await upsertDailyReconciliation(dayStart, orders, metaRows);
  await upsertAdAttribution(dayStart, orders, metaRows);
  await flagUnmatchedTransactions(orders);
}

export async function computeRollupRange(since: Date, until: Date): Promise<number> {
  let cursor = toUtcDateOnly(since);
  const end = toUtcDateOnly(until);
  let days = 0;

  while (cursor <= end) {
    await computeDailyRollup(cursor);
    days += 1;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }

  return days;
}

async function upsertDailyReconciliation(
  dayStart: Date,
  orders: GhlOrder[],
  metaRows: MetaInsight[]
) {
  const ghlRevenue = orders.reduce((sum, o) => sum + Number(o.amount), 0);
  const ghlTransactions = orders.length;
  const metaRevenue = metaRows.reduce((sum, r) => sum + Number(r.purchaseValue), 0);
  const metaPurchases = metaRows.reduce((sum, r) => sum + r.purchases, 0);

  const gapAmount = ghlRevenue - metaRevenue;
  const gapPercent = metaRevenue > 0 ? (gapAmount / metaRevenue) * 100 : ghlRevenue > 0 ? 100 : 0;

  await prisma.dailyReconciliation.upsert({
    where: { date: dayStart },
    create: { date: dayStart, ghlRevenue, ghlTransactions, metaRevenue, metaPurchases, gapAmount, gapPercent },
    update: { ghlRevenue, ghlTransactions, metaRevenue, metaPurchases, gapAmount, gapPercent },
  });
}

async function upsertAdAttribution(
  dayStart: Date,
  orders: Array<GhlOrder & { contact: GhlContact }>,
  metaRows: MetaInsight[]
) {
  const ghlRevenueByAd = new Map<string, number>();
  for (const order of orders) {
    const adId = order.contact?.adId;
    if (!adId) continue;
    ghlRevenueByAd.set(adId, (ghlRevenueByAd.get(adId) ?? 0) + Number(order.amount));
  }

  const metaByAd = new Map(metaRows.filter((r) => r.adId).map((r) => [r.adId as string, r]));
  const adIds = new Set([...ghlRevenueByAd.keys(), ...metaByAd.keys()]);

  for (const adId of adIds) {
    const ghlRevenue = ghlRevenueByAd.get(adId) ?? 0;
    const meta = metaByAd.get(adId);
    const metaSpend = meta ? Number(meta.spend) : 0;
    const metaRevenue = meta ? Number(meta.purchaseValue) : 0;

    // The portion of GHL revenue Meta's own reporting doesn't reflect for
    // this ad. Floored at zero: if Meta reports MORE than GHL (e.g. a
    // view-through conversion GHL never saw), we don't subtract — we just
    // don't add anything on top, since we can't be sure what covers what
    // without transaction-level Meta data, which the Insights API doesn't
    // expose.
    const recoveredRevenue = Math.max(0, ghlRevenue - metaRevenue);
    const trueRevenue = metaRevenue + recoveredRevenue;
    const trueRoas = metaSpend > 0 ? trueRevenue / metaSpend : null;

    await prisma.adAttribution.upsert({
      where: { date_adId: { date: dayStart, adId } },
      create: {
        date: dayStart,
        adId,
        adsetId: meta?.adsetId,
        campaignId: meta?.campaignId,
        adName: meta?.adName,
        metaSpend,
        metaRevenue,
        metaRoas: meta?.reportedRoas ?? null,
        ghlRevenue,
        recoveredRevenue,
        trueRevenue,
        trueRoas,
      },
      update: {
        adsetId: meta?.adsetId,
        campaignId: meta?.campaignId,
        adName: meta?.adName,
        metaSpend,
        metaRevenue,
        metaRoas: meta?.reportedRoas ?? null,
        ghlRevenue,
        recoveredRevenue,
        trueRevenue,
        trueRoas,
      },
    });
  }
}

// Flags GHL orders that show signs of coming from a Meta ad (utm_source is
// "meta", or an fbclid was captured) but couldn't be tied to a specific
// ad id — these are the ones "true ROAS" can't credit to any ad, and are
// worth a manual look. Note: this is a scoped-down version of the original
// "match by timestamp+amount against Meta's transaction records" idea —
// Meta's Insights API only exposes daily aggregates, not individual
// purchase events, so per-transaction matching against Meta isn't possible
// through this API. What we CAN detect is "this looks Meta-driven but we
// don't know which ad."
async function flagUnmatchedTransactions(orders: Array<GhlOrder & { contact: GhlContact }>) {
  for (const order of orders) {
    if (order.contact?.adId) continue;

    const looksLikeMeta =
      order.contact?.utmSource?.toLowerCase() === "meta" || Boolean(order.contact?.fbclid);
    if (!looksLikeMeta) continue;

    await prisma.unmatchedTransaction.upsert({
      where: { ghlOrderId: order.id },
      create: { ghlOrderId: order.id, reason: "no_ad_attribution", status: "NEEDS_REVIEW" },
      update: {}, // don't overwrite a manual review decision already made
    });
  }
}
