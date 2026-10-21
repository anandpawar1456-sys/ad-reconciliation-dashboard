import { prisma } from "@/lib/prisma";

// Which orders belong to the ad that brought the customer in, and which are
// ORGANIC (the customer came back on their own, e.g. buying an upsell from an
// email days after the front end).
//
// GHL ties attribution to the CONTACT, not to each order, so without this a
// later email-driven purchase gets credited to whichever ad sold the front
// end. In this account every funnel order (front end, bumps, upsells) lands
// within ~3 hours of the customer's first purchase, and nothing lands between
// 3 and 24 hours, so anything later than the window below is a separate,
// organic sale.
export const JOURNEY_WINDOW_MS = 6 * 60 * 60 * 1000;

// First COMPLETED order time per contact (all history). One cheap grouped
// query over the whole order table.
export async function getFirstOrderTimes(): Promise<Map<string, Date>> {
  const rows = await prisma.ghlOrder.groupBy({
    by: ["contactId"],
    where: { status: "completed" },
    _min: { occurredAt: true },
  });
  const map = new Map<string, Date>();
  for (const r of rows) if (r._min.occurredAt) map.set(r.contactId, r._min.occurredAt);
  return map;
}

// True when the order is part of the customer's first purchase journey.
export function isJourneyOrder(occurredAt: Date, firstAt: Date | undefined): boolean {
  return !firstAt || occurredAt.getTime() - firstAt.getTime() <= JOURNEY_WINDOW_MS;
}

const META_SOURCES = ["meta", "facebook", "fb", "ig", "instagram"];

export function hasMetaSignal(contact: { adId?: string | null; fbclid?: string | null; utmSource?: string | null } | null | undefined): boolean {
  if (!contact) return false;
  const source = (contact.utmSource ?? "").toLowerCase();
  return !!contact.adId || !!contact.fbclid || META_SOURCES.some((m) => source === m || source.startsWith(m + " "));
}

// "meta" = the customer's first-journey order from a contact with Meta ad
// evidence. Everything else (returning buyers, email, direct) is "organic".
export function orderSource(
  contact: { adId?: string | null; fbclid?: string | null; utmSource?: string | null } | null | undefined,
  occurredAt: Date,
  firstAt: Date | undefined
): "meta" | "organic" {
  return hasMetaSignal(contact) && isJourneyOrder(occurredAt, firstAt) ? "meta" : "organic";
}
