import { prisma } from "@/lib/prisma";
import { listGhlOrders, getGhlContact, extractAttribution } from "@/lib/ghl";
import { computeDailyRollup } from "@/lib/rollup";
import { toLocalDateLabel, DEFAULT_TIMEZONE } from "@/lib/timezone";
import { getSettings } from "@/lib/settings";

// Coarse, honest mapping from GHL's raw sourceSubType. GHL bundles the
// front end + its order bumps into a single "one_step_order_form" order
// (no per-line-item breakdown in the list API), while upsells are separate
// order records but without a number — so we can't yet tell UPSELL_1 from
// UPSELL_2/3 without the exact funnel step IDs mapped by hand. Adjust once
// that mapping exists; don't guess FE/OB1/OB2/UP1/UP2/UP3 without it.
function inferFunnelStage(sourceSubType: string | undefined): string {
  if (sourceSubType === "one_step_order_form") return "FRONT_END_BUNDLE";
  if (sourceSubType === "upsell") return "UPSELL";
  return "UNKNOWN";
}

export type GhlSyncResult = {
  ordersSeen: number;
  ordersUpserted: number;
  daysRolledUp: number;
};

// Pulls orders from GET /payments/orders (polling — no GHL webhook, no
// per-execution workflow cost) and upserts them, along with the
// originating contact's attribution data. `pages` controls how far back:
// 1 page (default) covers the most recent `pageSize` orders, which at this
// account's volume comfortably covers the gap between polls; pass more
// pages for a historical backfill.
export async function syncGhlOrders(
  options: { pages?: number; pageSize?: number } = {}
): Promise<GhlSyncResult> {
  const settings = await getSettings();
  if (!settings.ghlApiKey || !settings.ghlLocationId) {
    throw new Error("GHL API key or location ID not configured");
  }

  const pageSize = options.pageSize ?? 100;
  const pages = options.pages ?? 1;
  const timeZone = settings.reportingTimezone || DEFAULT_TIMEZONE;

  let ordersSeen = 0;
  let ordersUpserted = 0;
  const touchedDays = new Set<string>();
  const knownContacts = new Set<string>();

  for (let page = 0; page < pages; page++) {
    const { data } = await listGhlOrders(settings.ghlApiKey, settings.ghlLocationId, {
      limit: pageSize,
      offset: page * pageSize,
    });
    if (data.length === 0) break;
    ordersSeen += data.length;

    for (const order of data) {
      await ensureContact(order.contactId, settings.ghlApiKey, knownContacts);

      const occurredAt = new Date(order.createdAt);
      const funnelStage = inferFunnelStage(order.sourceSubType);

      await prisma.ghlOrder.upsert({
        where: { id: order.id },
        create: {
          id: order.id,
          contactId: order.contactId,
          amount: order.amount,
          currency: order.currency,
          status: order.status,
          sourceType: order.sourceType,
          sourceSubType: order.sourceSubType,
          sourceName: order.sourceName,
          sourceStepId: order.sourceStepId,
          sourcePageId: order.sourcePageId,
          funnelStage,
          occurredAt,
          rawPayload: order.raw as object,
        },
        update: {
          amount: order.amount,
          currency: order.currency,
          status: order.status,
          sourceType: order.sourceType,
          sourceSubType: order.sourceSubType,
          sourceName: order.sourceName,
          sourceStepId: order.sourceStepId,
          sourcePageId: order.sourcePageId,
          funnelStage,
          rawPayload: order.raw as object,
        },
      });

      ordersUpserted += 1;
      touchedDays.add(toLocalDateLabel(occurredAt, timeZone).toISOString());
    }
  }

  let daysRolledUp = 0;
  for (const iso of touchedDays) {
    await computeDailyRollup(new Date(iso));
    daysRolledUp += 1;
  }

  await prisma.integrationSettings.update({ where: { id: 1 }, data: { lastGhlSyncAt: new Date() } });

  return { ordersSeen, ordersUpserted, daysRolledUp };
}

// GhlOrder.contactId has a foreign key to GhlContact, so every order needs
// one. Only hits the GHL API for contacts we don't already have, to keep
// repeated polling cheap.
async function ensureContact(contactId: string, apiKey: string, cache: Set<string>): Promise<void> {
  if (cache.has(contactId)) return;

  const existing = await prisma.ghlContact.findUnique({ where: { id: contactId } });
  if (existing) {
    cache.add(contactId);
    return;
  }

  try {
    const contact = await getGhlContact(contactId, apiKey);
    const attribution = extractAttribution(contact);
    await prisma.ghlContact.upsert({
      where: { id: contactId },
      create: { id: contactId, email: contact?.email, phone: contact?.phone, ...attribution },
      update: { email: contact?.email, phone: contact?.phone, ...attribution },
    });
  } catch (err) {
    console.error(`GHL contact fetch failed for ${contactId}`, err);
    // Still need a row to satisfy GhlOrder's foreign key even if the
    // contact fetch failed — attribution just stays empty for this one.
    await prisma.ghlContact.upsert({
      where: { id: contactId },
      create: { id: contactId },
      update: {},
    });
  }

  cache.add(contactId);
}
