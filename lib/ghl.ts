const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

// Minimal shape of what we read off a GHL contact — the real object has
// many more fields. `any` is intentional here: GHL's attribution field
// names have shifted across API versions and aren't worth hard-typing
// until we've seen a real payload.
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
};

// GHL exposes attribution on the contact as `attributionSource` (their
// built-in click/UTM capture, separate from our own tracking script). Exact
// key spelling has changed across GHL API versions, so this reads several
// possible variants defensively. VERIFY against a real contact payload
// once the API key is live (log `contact` in the webhook handler once) and
// adjust the key names here if GHL's actual response differs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractAttribution(contact: any): GhlAttribution {
  const src = contact?.attributionSource ?? contact?.lastAttributionSource ?? {};
  return {
    fbclid: src.fbclid ?? contact?.fbclid ?? undefined,
    utmSource: src.utmSource ?? src.source ?? undefined,
    utmMedium: src.utmMedium ?? src.medium ?? undefined,
    utmCampaign: src.utmCampaign ?? src.campaign ?? undefined,
    utmContent: src.utmContent ?? undefined,
    utmTerm: src.utmTerm ?? undefined,
  };
}
