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

// Verified against a real GET /contacts/{id} response (2026-09-21):
// GHL's own click capture lands on the contact as `attributionSource`
// (first touch) and `lastAttributionSource` (most recent touch — used
// here, matching our last-click default model). It gives fbclid, UTM
// fields, and a direct Meta `adId`, but has no adset/campaign id fields of
// its own — those come through as `adset_id` and `utm_id` (mapped from
// Meta's {{campaign.id}}) query params on the captured landing URL instead,
// so we parse them out of `url`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractAttribution(contact: any): GhlAttribution {
  const source = contact?.lastAttributionSource ?? contact?.attributionSource ?? {};
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
