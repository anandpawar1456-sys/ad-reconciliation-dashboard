import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getUtcRangeForLabels, DEFAULT_TIMEZONE } from "@/lib/timezone";
import { notExcludedCustomer } from "@/lib/excludedCampaigns";
import { getFirstOrderTimes, hasMetaSignal, isJourneyOrder } from "@/lib/journey";

export type OrganicReason = "no_meta_signal" | "returning_customer_after_7_days";

export type OrganicOrder = {
  at: Date;
  amount: number;
  funnelName: string | null;
  stepId: string | null;
  reason: OrganicReason;
  daysAfterFirstPurchase: number;
};

export type OrganicBreakdown = {
  totalRevenue: number;
  metaRevenue: number;
  organicRevenue: number;
  organicOrders: number;
  byReason: Record<OrganicReason, { orders: number; revenue: number }>;
  orders: OrganicOrder[]; // newest first, no customer identity
};

// Splits GHL revenue in a label-date range into Meta-driven and organic sales,
// with the reason each organic order is organic. Same rule the dashboard uses
// (lib/journey.ts): organic = no Meta signal on the contact, or placed more
// than 7 days after the customer's first purchase.
export async function getOrganicBreakdown(since: Date, until: Date): Promise<OrganicBreakdown> {
  const settings = await getSettings();
  const range = getUtcRangeForLabels(since, until, settings.reportingTimezone || DEFAULT_TIMEZONE);

  const [orders, firstTimes] = await Promise.all([
    prisma.ghlOrder.findMany({
      where: { ...notExcludedCustomer, status: "completed", occurredAt: { gte: range.start, lt: range.end } },
      select: {
        amount: true,
        occurredAt: true,
        contactId: true,
        sourceName: true,
        sourceStepId: true,
        contact: { select: { adId: true, fbclid: true, utmSource: true } },
      },
      orderBy: { occurredAt: "desc" },
    }),
    getFirstOrderTimes(),
  ]);

  const out: OrganicBreakdown = {
    totalRevenue: 0,
    metaRevenue: 0,
    organicRevenue: 0,
    organicOrders: 0,
    byReason: {
      no_meta_signal: { orders: 0, revenue: 0 },
      returning_customer_after_7_days: { orders: 0, revenue: 0 },
    },
    orders: [],
  };

  for (const o of orders) {
    const amount = Number(o.amount);
    const firstAt = firstTimes.get(o.contactId);
    out.totalRevenue += amount;

    const metaSignal = hasMetaSignal(o.contact);
    const inJourney = isJourneyOrder(o.occurredAt, firstAt);
    if (metaSignal && inJourney) {
      out.metaRevenue += amount;
      continue;
    }

    const reason: OrganicReason = metaSignal ? "returning_customer_after_7_days" : "no_meta_signal";
    out.organicRevenue += amount;
    out.organicOrders += 1;
    out.byReason[reason].orders += 1;
    out.byReason[reason].revenue += amount;
    out.orders.push({
      at: o.occurredAt,
      amount,
      funnelName: o.sourceName,
      stepId: o.sourceStepId,
      reason,
      daysAfterFirstPurchase: firstAt ? Math.round(((o.occurredAt.getTime() - firstAt.getTime()) / 86400000) * 10) / 10 : 0,
    });
  }

  return out;
}
