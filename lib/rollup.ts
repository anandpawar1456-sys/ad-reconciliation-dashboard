import { prisma } from "@/lib/prisma";
import type { GhlOrder, GhlContact, MetaInsight } from "@prisma/client";
import { getSettings } from "@/lib/settings";
import { getUtcDayRange, DEFAULT_TIMEZONE } from "@/lib/timezone";

// Only orders in these statuses count as real revenue. Confirmed against
// this account's actual order history (1564 orders sampled): GHL's
// payments/orders API only ever returns "completed" (paid) or "pending"
// (unpaid, e.g. a failed/incomplete checkout) — there's no separate
// "refunded"/"void" status observed on the order itself. Revisit if GHL
// starts returning other values.
const COUNTED_STATUSES = ["completed"];

// Recomputes DailyReconciliation and AdAttribution for a single day from
// raw GhlOrder/GhlContact/MetaInsight rows. `labelDate` must already be a
// label date (Y-M-D only, from lib/timezone's toLocalDateLabel) — this
// function does NOT re-interpret it through a timezone, since doing so
// twice would shift the day. Called synchronously (for just today) right
// after a GHL webhook lands, so sales reflect immediately — and from the
// hourly Meta-sync cron (for the last few days), so ad-level numbers catch
// up once Meta's own data arrives.
export async function computeDailyRollup(labelDate: Date): Promise<void> {
  const settings = await getSettings();
  const timeZone = settings.reportingTimezone || DEFAULT_TIMEZONE;
  const { start, end } = getUtcDayRange(labelDate, timeZone);

  const orders = await prisma.ghlOrder.findMany({
    where: { occurredAt: { gte: start, lt: end }, status: { in: COUNTED_STATUSES } },
    include: { contact: true },
  });

  const metaRows = await prisma.metaInsight.findMany({
    where: { date: labelDate, level: "ad" },
  });

  await upsertDailyReconciliation(labelDate, orders, metaRows);
  await upsertAdAttribution(labelDate, orders, metaRows);
  await flagUnmatchedTransactions(orders);
}

// `since`/`until` must already be label dates (see computeDailyRollup).
export async function computeRollupRange(since: Date, until: Date): Promise<number> {
  let cursor = since;
  let days = 0;

  while (cursor <= until) {
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
  // Fallback campaign/adset id for an ad, from GHL's OWN captured
  // attribution on the contact — needed because an ad can have real GHL
  // revenue on a day Meta reported zero data for it (e.g. it wasn't
  // served that day), leaving no MetaInsight row to read campaignId from.
  // Without this fallback, that recovered revenue silently drops out of
  // every campaign/ad-set rollup (it was still counted at the ad level,
  // just invisible one level up).
  const contactIdsByAd = new Map<string, { campaignId: string | null; adsetId: string | null }>();
  for (const order of orders) {
    const adId = order.contact?.adId;
    if (!adId) continue;
    ghlRevenueByAd.set(adId, (ghlRevenueByAd.get(adId) ?? 0) + Number(order.amount));
    if (!contactIdsByAd.has(adId)) {
      contactIdsByAd.set(adId, {
        campaignId: order.contact?.campaignId ?? null,
        adsetId: order.contact?.adsetId ?? null,
      });
    }
  }

  const metaByAd = new Map(metaRows.filter((r) => r.adId).map((r) => [r.adId as string, r]));
  const adIds = new Set([...ghlRevenueByAd.keys(), ...metaByAd.keys()]);

  for (const adId of adIds) {
    const ghlRevenue = ghlRevenueByAd.get(adId) ?? 0;
    const meta = metaByAd.get(adId);
    const metaSpend = meta ? Number(meta.spend) : 0;
    const metaRevenue = meta ? Number(meta.purchaseValue) : 0;
    const fallback = contactIdsByAd.get(adId);
    const campaignId = meta?.campaignId ?? fallback?.campaignId ?? null;
    const adsetId = meta?.adsetId ?? fallback?.adsetId ?? null;

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
        adsetId,
        campaignId,
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
        adsetId,
        campaignId,
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
