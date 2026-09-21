import { prisma } from "@/lib/prisma";
import { getGhlContact, extractAttribution } from "@/lib/ghl";
import { getSettings } from "@/lib/settings";

export type ContactRefreshResult = { processed: number; updated: number; failed: number; remaining: number };

// One-time backfill: re-fetches every existing GhlContact from the GHL API
// and re-runs extractAttribution, since the old extraction logic
// (unconditionally preferring lastAttributionSource) left most contacts
// without real ad attribution — see lib/ghl.ts. Paginated/resumable via
// offset so it can run across several calls instead of one long one.
export async function refreshGhlContacts(offset: number, limit: number): Promise<ContactRefreshResult> {
  const settings = await getSettings();
  if (!settings.ghlApiKey) {
    throw new Error("GHL API key not configured");
  }

  const totalCount = await prisma.ghlContact.count();
  const contacts = await prisma.ghlContact.findMany({
    skip: offset,
    take: limit,
    orderBy: { id: "asc" },
    select: { id: true },
  });

  let updated = 0;
  let failed = 0;

  for (const { id } of contacts) {
    try {
      const contact = await getGhlContact(id, settings.ghlApiKey);
      const attribution = extractAttribution(contact);
      // Explicit nulls (not undefined) so a contact whose new extraction
      // finds nothing actually clears any stale/wrong value from before,
      // rather than leaving it untouched.
      await prisma.ghlContact.update({
        where: { id },
        data: {
          email: contact?.email ?? null,
          phone: contact?.phone ?? null,
          fbclid: attribution.fbclid ?? null,
          utmSource: attribution.utmSource ?? null,
          utmMedium: attribution.utmMedium ?? null,
          utmCampaign: attribution.utmCampaign ?? null,
          utmContent: attribution.utmContent ?? null,
          utmTerm: attribution.utmTerm ?? null,
          adId: attribution.adId ?? null,
          adsetId: attribution.adsetId ?? null,
          campaignId: attribution.campaignId ?? null,
        },
      });
      updated += 1;
    } catch (err) {
      console.error(`Contact refresh failed for ${id}`, err);
      failed += 1;
    }
  }

  const remaining = Math.max(0, totalCount - (offset + contacts.length));

  return { processed: contacts.length, updated, failed, remaining };
}
