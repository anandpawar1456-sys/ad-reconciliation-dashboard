const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

// Minimal shape of what we read off a GHL contact — the real object has
// many more fields we don't use.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getGhlContact(contactId: string, apiKey: string): Promise<any> {
  const res = await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: GHL_API_VERSION,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`GHL contact fetch failed (${res.status}): ${await res.text()}`);
  }

  const json = await res.json();
  return json.contact ?? json;
}

export type GhlAttribution = {
  fbclid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  adId?: string;
  adsetId?: string;
  campaignId?: string;
};

// Verified against real GET /contacts/{id} responses: GHL's own click
// capture lands on the contact as `attributionSource` (first touch) and
// `lastAttributionSource` (most recent touch). Critically, for most
// contacts here `lastAttributionSource` is NOT another ad click — it's the
// internal checkout/order-form page load itself (sessionSource:
// "Referral", referrer: leadconnectorhq.com, no UTMs, no fbclid), which
// silently overwrites the real ad attribution that only survives in the
// original `attributionSource`. Preferring last-touch unconditionally (the
// original implementation) meant only contacts whose LAST touch happened
// to also be an ad click kept their attribution — everyone else lost it
// entirely. Now: use last-touch only when it actually carries ad signal
// (fbclid or utmSource present), otherwise fall back to first-touch.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractAttribution(contact: any): GhlAttribution {
  const last = contact?.lastAttributionSource ?? {};
  const first = contact?.attributionSource ?? {};
  const source = last.fbclid || last.utmSource ? last : first;
  const urlParams = parseQueryParams(source.url);

  return {
    fbclid: source.fbclid ?? urlParams.fbclid,
    utmSource: source.utmSource,
    utmMedium: source.utmMedium,
    utmCampaign: source.campaign,
    utmContent: source.utmContent,
    utmTerm: source.utmTerm,
    adId: source.adId ?? urlParams.ad_id,
    adsetId: urlParams.adset_id,
    campaignId: urlParams.utm_id ?? urlParams.campaign_id,
  };
}

function parseQueryParams(url: string | undefined): Record<string, string> {
  if (!url) return {};
  try {
    return Object.fromEntries(new URL(url).searchParams.entries());
  } catch {
    return {};
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GhlOrderRow = {
  id: string;
  contactId: string;
  amount: number;
  currency: string;
  status: string; // observed values: "completed" (paid), "pending" (unpaid)
  createdAt: string;
  sourceType?: string;
  sourceSubType?: string; // observed: "upsell", "one_step_order_form"
  sourceName?: string;
  sourceStepId?: string;
  sourcePageId?: string;
  raw: unknown;
};

// GET /payments/orders. Confirmed against the real account: offset-based
// pagination works (?offset=N), the response includes totalCount, and
// there's no line-item detail in the list view — just counts
// (totalProducts). Newest orders come first.
export async function listGhlOrders(
  apiKey: string,
  locationId: string,
  params: { limit: number; offset: number }
): Promise<{ data: GhlOrderRow[]; totalCount: number }> {
  const url = new URL(`${GHL_API_BASE}/payments/orders`);
  url.searchParams.set("altId", locationId);
  url.searchParams.set("altType", "location");
  url.searchParams.set("limit", String(params.limit));
  url.searchParams.set("offset", String(params.offset));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}`, Version: GHL_API_VERSION },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`GHL orders fetch failed (${res.status}): ${await res.text()}`);
  }

  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: GhlOrderRow[] = (json.data ?? []).map((o: any) => ({
    id: o._id,
    contactId: o.contactId,
    amount: Number(o.amount ?? 0),
    currency: o.currency ?? "USD",
    status: o.status,
    createdAt: o.createdAt,
    sourceType: o.sourceType,
    sourceSubType: o.sourceSubType,
    sourceName: o.sourceName,
    sourceStepId: o.sourceMeta?.stepId,
    sourcePageId: o.sourceMeta?.pageId,
    raw: o,
  }));

  return { data, totalCount: json.totalCount ?? 0 };
}
