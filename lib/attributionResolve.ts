import { prisma } from "@/lib/prisma";
import { inferContactsFromMetaDeficits } from "@/lib/attributionInfer";

type AdRow = { id: string; name: string; adsetId: string; campaignId: string };

export type MetaIndex = {
  adById: Map<string, AdRow>;
  adsByName: Map<string, AdRow[]>;
  adsetNameById: Map<string, string>;
};

type ContactAttrFields = {
  adId: string | null;
  adsetId: string | null;
  campaignId: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
};

const NUMERIC_ID = /^\d{12,}$/;

// UTM values arrive URL-encoded ("Batch10+(2)") and with inconsistent
// casing/spacing, so compare on a normalized form.
function norm(value: string | null | undefined): string {
  return (value ?? "").replace(/\+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

export async function loadMetaIndex(): Promise<MetaIndex> {
  const [ads, adsets] = await Promise.all([prisma.metaAd.findMany(), prisma.metaAdSet.findMany()]);
  const adById = new Map<string, AdRow>();
  const adsByName = new Map<string, AdRow[]>();
  for (const a of ads) {
    const row = { id: a.id, name: a.name, adsetId: a.adsetId, campaignId: a.campaignId };
    adById.set(a.id, row);
    const key = norm(a.name);
    const list = adsByName.get(key) ?? [];
    list.push(row);
    adsByName.set(key, list);
  }
  return { adById, adsByName, adsetNameById: new Map(adsets.map((s) => [s.id, norm(s.name)])) };
}

// For contacts GHL captured no ad_id for. Two fallbacks, both only ever
// filling gaps (never overriding a value GHL did capture):
//  1. The UTM fields sometimes carry raw Meta ids (utm_campaign/content/
//     term = campaign/adset/ad id) — match those against known ads.
//  2. utm_content is the ad NAME (and utm_campaign/utm_term the adset or
//     campaign name). Accept a match only when it narrows to exactly one
//     ad, using the captured campaign id and adset name to disambiguate —
//     an ambiguous name is left unattributed rather than guessed.
export function resolveFromMeta(index: MetaIndex, c: ContactAttrFields): AdRow | null {
  if (c.adId) return null;

  for (const candidate of [c.utmTerm, c.utmContent, c.utmCampaign]) {
    const id = (candidate ?? "").trim();
    if (NUMERIC_ID.test(id)) {
      const hit = index.adById.get(id);
      if (hit) return hit;
    }
  }

  const adName = norm(c.utmContent);
  if (!adName) return null;
  let pool = index.adsByName.get(adName) ?? [];
  if (pool.length > 1 && c.campaignId) pool = pool.filter((a) => a.campaignId === c.campaignId);
  if (pool.length > 1 && c.adsetId) pool = pool.filter((a) => a.adsetId === c.adsetId);
  if (pool.length > 1) {
    const adsetNames = new Set([norm(c.utmCampaign), norm(c.utmTerm)].filter(Boolean));
    const narrowed = pool.filter((a) => adsetNames.has(index.adsetNameById.get(a.adsetId) ?? "\u0000"));
    if (narrowed.length > 0) pool = narrowed;
  }
  return pool.length === 1 ? pool[0] : null;
}

// DB-only (no GHL/Meta API calls): fills adId/adsetId/campaignId on every
// contact that has none, and returns the ids it changed so the caller can
// re-roll up the affected days.
export async function resolveUnattributedContacts(): Promise<string[]> {
  const [index, contacts] = await Promise.all([
    loadMetaIndex(),
    prisma.ghlContact.findMany({
      where: { adId: null },
      select: { id: true, adId: true, adsetId: true, campaignId: true, utmCampaign: true, utmContent: true, utmTerm: true },
    }),
  ]);

  const changed: Array<{ id: string; hit: AdRow; adsetId: string | null; campaignId: string | null }> = [];
  for (const c of contacts) {
    const hit = resolveFromMeta(index, c);
    if (hit) changed.push({ id: c.id, hit, adsetId: c.adsetId, campaignId: c.campaignId });
  }

  const CHUNK = 25;
  for (let i = 0; i < changed.length; i += CHUNK) {
    await Promise.all(
      changed.slice(i, i + CHUNK).map((c) =>
        prisma.ghlContact.update({
          where: { id: c.id },
          data: {
            adId: c.hit.id,
            adsetId: c.adsetId ?? c.hit.adsetId,
            campaignId: c.campaignId ?? c.hit.campaignId,
          },
        })
      )
    );
  }

  // Then, for buyers who arrived with no tracking at all, match what Meta
  // credited an ad against that day's unattributed GHL orders.
  const inferred = await inferContactsFromMetaDeficits();

  return [...changed.map((c) => c.id), ...inferred];
}
