const META_API_VERSION = "v21.0";

// Meta reports purchases as multiple overlapping action types for the same
// underlying conversions (e.g. "omni_purchase" is the omnichannel rollup of
// "purchase"). Summing all of them would double count, so we pick the
// first match by priority rather than adding them up.
const PURCHASE_ACTION_PRIORITY = [
  "omni_purchase",
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
];

type MetaActionEntry = { action_type: string; value: string };

export type MetaInsightRow = {
  date: string; // YYYY-MM-DD
  level: "ad";
  campaignId: string;
  campaignName?: string;
  adsetId?: string;
  adsetName?: string;
  adId?: string;
  adName?: string;
  spend: number;
  purchases: number;
  purchaseValue: number;
  impressions: number;
  clicks: number;
  ctr: number; // percent, as Meta reports it
  frequency: number;
  reach: number;
  uniqueLinkClicks: number;
};

export async function fetchMetaInsights(params: {
  accessToken: string;
  adAccountId: string; // must include the "act_" prefix
  since: string; // YYYY-MM-DD
  until: string; // YYYY-MM-DD
}): Promise<MetaInsightRow[]> {
  const { accessToken, adAccountId, since, until } = params;

  // Extra fields (impressions/clicks/ctr/frequency/reach) ride along on the
  // same call — no change in how often we call Meta, just more of what
  // each call returns.
  const fields = [
    "campaign_id",
    "campaign_name",
    "adset_id",
    "adset_name",
    "ad_id",
    "ad_name",
    "spend",
    "actions",
    "action_values",
    "date_start",
    "impressions",
    "clicks",
    "ctr",
    "frequency",
    "reach",
    "unique_inline_link_clicks",
  ].join(",");

  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/insights`);
  url.searchParams.set("level", "ad");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("time_range", JSON.stringify({ since, until }));
  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", "500");
  url.searchParams.set("access_token", accessToken);

  const rows: MetaInsightRow[] = [];
  let nextUrl: string | null = url.toString();

  while (nextUrl) {
    const res: Response = await fetch(nextUrl, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Meta insights fetch failed (${res.status}): ${await res.text()}`);
    }
    const json = await res.json();

    for (const item of json.data ?? []) {
      rows.push({
        date: item.date_start,
        level: "ad",
        campaignId: item.campaign_id,
        campaignName: item.campaign_name,
        adsetId: item.adset_id,
        adsetName: item.adset_name,
        adId: item.ad_id,
        adName: item.ad_name,
        spend: Number(item.spend ?? 0),
        purchases: pickByPriority(item.actions, PURCHASE_ACTION_PRIORITY),
        purchaseValue: pickByPriority(item.action_values, PURCHASE_ACTION_PRIORITY),
        impressions: Number(item.impressions ?? 0),
        clicks: Number(item.clicks ?? 0),
        ctr: Number(item.ctr ?? 0),
        frequency: Number(item.frequency ?? 0),
        reach: Number(item.reach ?? 0),
        uniqueLinkClicks: Number(item.unique_inline_link_clicks ?? 0),
      });
    }

    nextUrl = json.paging?.next ?? null;
  }

  return rows;
}

function pickByPriority(entries: MetaActionEntry[] | undefined, priority: string[]): number {
  if (!entries) return 0;
  for (const actionType of priority) {
    const match = entries.find((e) => e.action_type === actionType);
    if (match) return Number(match.value ?? 0);
  }
  return 0;
}

export type MetaCampaignRow = {
  id: string;
  name: string;
  status: string; // ACTIVE | PAUSED | DELETED | ARCHIVED
  effectiveStatus: string; // e.g. ACTIVE, PAUSED, CAMPAIGN_PAUSED, ADSET_PAUSED
  objective?: string;
};

// A separate endpoint from insights — the campaign's own object, for its
// current status. Called once per sync alongside fetchMetaInsights, not on
// its own separate schedule.
export async function fetchMetaCampaigns(params: {
  accessToken: string;
  adAccountId: string;
}): Promise<MetaCampaignRow[]> {
  const { accessToken, adAccountId } = params;

  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/campaigns`);
  url.searchParams.set("fields", "id,name,status,effective_status,objective");
  url.searchParams.set("limit", "200");
  url.searchParams.set("access_token", accessToken);

  const rows: MetaCampaignRow[] = [];
  let nextUrl: string | null = url.toString();

  while (nextUrl) {
    const res: Response = await fetch(nextUrl, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Meta campaigns fetch failed (${res.status}): ${await res.text()}`);
    }
    const json = await res.json();

    for (const item of json.data ?? []) {
      rows.push({
        id: item.id,
        name: item.name,
        status: item.status,
        effectiveStatus: item.effective_status,
        objective: item.objective,
      });
    }

    nextUrl = json.paging?.next ?? null;
  }

  return rows;
}

export type MetaAdSetRow = { id: string; name: string; campaignId: string; status: string; effectiveStatus: string };
export type MetaAdRow = { id: string; name: string; adsetId: string; campaignId: string; status: string; effectiveStatus: string };

// Account-level list calls (not per-campaign/per-adset — one call each
// covers the whole account), bundled into the same sync invocation as
// campaigns/insights, not a new polling pattern.
export async function fetchMetaAdSets(params: { accessToken: string; adAccountId: string }): Promise<MetaAdSetRow[]> {
  const { accessToken, adAccountId } = params;
  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/adsets`);
  url.searchParams.set("fields", "id,name,campaign_id,status,effective_status");
  url.searchParams.set("limit", "500");
  url.searchParams.set("access_token", accessToken);

  const rows: MetaAdSetRow[] = [];
  let nextUrl: string | null = url.toString();
  while (nextUrl) {
    const res: Response = await fetch(nextUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`Meta adsets fetch failed (${res.status}): ${await res.text()}`);
    const json = await res.json();
    for (const item of json.data ?? []) {
      rows.push({
        id: item.id,
        name: item.name,
        campaignId: item.campaign_id,
        status: item.status,
        effectiveStatus: item.effective_status,
      });
    }
    nextUrl = json.paging?.next ?? null;
  }
  return rows;
}

export async function fetchMetaAds(params: { accessToken: string; adAccountId: string }): Promise<MetaAdRow[]> {
  const { accessToken, adAccountId } = params;
  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/ads`);
  url.searchParams.set("fields", "id,name,adset_id,campaign_id,status,effective_status");
  url.searchParams.set("limit", "500");
  url.searchParams.set("access_token", accessToken);

  const rows: MetaAdRow[] = [];
  let nextUrl: string | null = url.toString();
  while (nextUrl) {
    const res: Response = await fetch(nextUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`Meta ads fetch failed (${res.status}): ${await res.text()}`);
    const json = await res.json();
    for (const item of json.data ?? []) {
      rows.push({
        id: item.id,
        name: item.name,
        adsetId: item.adset_id,
        campaignId: item.campaign_id,
        status: item.status,
        effectiveStatus: item.effective_status,
      });
    }
    nextUrl = json.paging?.next ?? null;
  }
  return rows;
}
