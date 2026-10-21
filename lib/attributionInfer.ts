import { prisma } from "@/lib/prisma";
import { getFirstOrderTimes, isJourneyOrder } from "@/lib/journey";
import { getSettings } from "@/lib/settings";
import { getUtcDayRange, toLocalDateLabel, DEFAULT_TIMEZONE } from "@/lib/timezone";
import { isExcludedCampaignName, notExcludedCustomer } from "@/lib/excludedCampaigns";

const DAY_MS = 24 * 60 * 60 * 1000;
const CENTS = 0.01;

type DayOrder = { orderId: string; contactId: string; amount: number };

// Why this exists: some buyers reach the checkout page with no tracking in
// the URL at all (e.g. the VSL page's button drops the query string), so
// GHL records the sale but the contact carries no ad id — while Meta's
// pixel, which rides on its own click cookie, still credits the purchase to
// the right ad. Every Meta purchase is fired by a real GHL checkout, so when
// an ad shows MORE Meta purchase value on a day than GHL orders tied to it,
// the missing amount must be sitting among that day's unattributed GHL
// orders. We only act when the amount fits exactly ONE unattributed order
// (or one pair) and no other ad is competing for it — anything ambiguous is
// left alone rather than guessed. The matched contact gets the ad id, so all
// of that buyer's orders (bumps/upsells) follow it.
export type InferredAssignment = { adId: string; adsetId: string | null; campaignId: string | null; day: string; amount: number };

export async function planInference(daysBack = 45): Promise<Map<string, InferredAssignment>> {
  const settings = await getSettings();
  const timeZone = settings.reportingTimezone || DEFAULT_TIMEZONE;
  const today = toLocalDateLabel(new Date(), timeZone);
  const since = new Date(today.getTime() - daysBack * DAY_MS);
  const range = { start: getUtcDayRange(since, timeZone).start, end: getUtcDayRange(today, timeZone).end };

  const [allOrders, insights, firstTimes] = await Promise.all([
    prisma.ghlOrder.findMany({
      where: { ...notExcludedCustomer, occurredAt: { gte: range.start, lt: range.end }, status: "completed" },
      select: { id: true, contactId: true, amount: true, occurredAt: true, contact: { select: { adId: true } } },
    }),
    prisma.metaInsight.findMany({
      where: { level: "ad", date: { gte: since, lte: today } },
      select: { date: true, adId: true, adsetId: true, campaignId: true, campaignName: true, purchaseValue: true },
    }),
    getFirstOrderTimes(),
  ]);
  // only first-journey orders can belong to an ad; later organic ones never match
  const orders = allOrders.filter((o) => isJourneyOrder(o.occurredAt, firstTimes.get(o.contactId)));

  const attributedByDayAd = new Map<string, number>();
  const unattributedByDay = new Map<string, DayOrder[]>();
  for (const o of orders) {
    const day = toLocalDateLabel(o.occurredAt, timeZone).toISOString();
    if (o.contact?.adId) {
      const key = `${day}|${o.contact.adId}`;
      attributedByDayAd.set(key, (attributedByDayAd.get(key) ?? 0) + Number(o.amount));
    } else {
      const list = unattributedByDay.get(day) ?? [];
      list.push({ orderId: o.id, contactId: o.contactId, amount: Number(o.amount) });
      unattributedByDay.set(day, list);
    }
  }

  const metaByDayAd = new Map<string, { value: number; adsetId: string | null; campaignId: string | null; day: string; adId: string }>();
  for (const i of insights) {
    if (!i.adId || isExcludedCampaignName(i.campaignName)) continue;
    const day = i.date.toISOString();
    const key = `${day}|${i.adId}`;
    const existing = metaByDayAd.get(key);
    if (existing) existing.value += Number(i.purchaseValue);
    else metaByDayAd.set(key, { value: Number(i.purchaseValue), adsetId: i.adsetId || null, campaignId: i.campaignId, day, adId: i.adId });
  }

  // contactId -> chosen ad, resolved day by day.
  const assignments = new Map<string, InferredAssignment>();

  for (const [day, pool] of unattributedByDay) {
    const deficits = [...metaByDayAd.values()]
      .filter((m) => m.day === day)
      .map((m) => ({ ...m, deficit: m.value - (attributedByDayAd.get(`${day}|${m.adId}`) ?? 0) }))
      .filter((m) => m.deficit >= 1);
    if (deficits.length === 0) continue;

    // order -> ads that could claim it
    const claims = new Map<string, Array<(typeof deficits)[number]>>();
    const proposals: Array<{ ad: (typeof deficits)[number]; orders: DayOrder[] }> = [];

    for (const ad of deficits) {
      const singles = pool.filter((o) => Math.abs(o.amount - ad.deficit) < CENTS);
      let matches: DayOrder[][] = singles.map((o) => [o]);
      if (matches.length === 0) {
        matches = [];
        for (let a = 0; a < pool.length; a++) {
          for (let b = a + 1; b < pool.length; b++) {
            if (pool[a].contactId !== pool[b].contactId && Math.abs(pool[a].amount + pool[b].amount - ad.deficit) < CENTS) {
              matches.push([pool[a], pool[b]]);
            }
          }
        }
      }
      if (matches.length !== 1) continue; // none, or ambiguous
      proposals.push({ ad, orders: matches[0] });
      for (const o of matches[0]) claims.set(o.orderId, [...(claims.get(o.orderId) ?? []), ad]);
    }

    for (const p of proposals) {
      // Another ad wants one of the same orders -> too uncertain, skip both.
      if (p.orders.some((o) => (claims.get(o.orderId) ?? []).length > 1)) continue;
      for (const o of p.orders) {
        if (!assignments.has(o.contactId)) {
          assignments.set(o.contactId, {
            adId: p.ad.adId,
            adsetId: p.ad.adsetId,
            campaignId: p.ad.campaignId,
            day,
            amount: o.amount,
          });
        }
      }
    }
  }

  return assignments;
}

export async function inferContactsFromMetaDeficits(daysBack = 45): Promise<string[]> {
  const assignments = await planInference(daysBack);
  const changed: string[] = [];
  for (const [contactId, a] of assignments) {
    const updated = await prisma.ghlContact.updateMany({
      where: { id: contactId, adId: null },
      data: { adId: a.adId, adsetId: a.adsetId, campaignId: a.campaignId },
    });
    if (updated.count > 0) changed.push(contactId);
  }
  return changed;
}
