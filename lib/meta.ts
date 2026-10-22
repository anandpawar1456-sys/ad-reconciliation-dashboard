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

  // One request PER DAY, not one for the whole range. For a multi-day range
  // with time_increment=1, Meta's API returns full spend only for the LAST day
  // of the range and near-zero spend for the earlier days (e.g. Oct 20 came
  // back as $1.27 inside an Oct 18-21 request but $375.94 on its own), which
  // made every sync overwrite good data with bad. Single-day requests are
  // correct, so loop over the days.
  const rows: MetaInsightRow[] = [];
  for (const day of eachDay(since, until)) {
    const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/insights`);
    url.searchParams.set("level", "ad");
    url.searchParams.set("time_increment", "1");
    url.searchParams.set("time_range", JSON.stringify({ since: day, until: day }));
    url.searchParams.set("fields", fields);
    url.searchParams.set("limit", "500");
    url.searchParams.set("access_token", accessToken);

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
  }

  return rows;
}

// Every YYYY-MM-DD from `since` to `until`, inclusive.
function eachDay(since: string, until: string): string[] {
  const days: string[] = [];
  for (let t = Date.parse(`${since}T00:00:00Z`); t <= Date.parse(`${until}T00:00:00Z`); t += 24 * 60 * 60 * 1000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
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
  dailyBudget: number | null; // dollars; null when the budget lives on the ad sets
  lifetimeBudget: number | null;
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
  url.searchParams.set("fields", "id,name,status,effective_status,objective,daily_budget,lifetime_budget");
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
        dailyBudget: minorToDollars(item.daily_budget),
        lifetimeBudget: minorToDollars(item.lifetime_budget),
      });
    }

    nextUrl = json.paging?.next ?? null;
  }

  return rows;
}

export type MetaAdSetRow = {
  id: string;
  name: string;
  campaignId: string;
  status: string;
  effectiveStatus: string;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
};
export type MetaAdRow = { id: string; name: string; adsetId: string; campaignId: string; status: string; effectiveStatus: string };

// Account-level list calls (not per-campaign/per-adset — one call each
// covers the whole account), bundled into the same sync invocation as
// campaigns/insights, not a new polling pattern.
export async function fetchMetaAdSets(params: { accessToken: string; adAccountId: string }): Promise<MetaAdSetRow[]> {
  const { accessToken, adAccountId } = params;
  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/adsets`);
  url.searchParams.set("fields", "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget");
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
        dailyBudget: minorToDollars(item.daily_budget),
        lifetimeBudget: minorToDollars(item.lifetime_budget),
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

// Meta reports budgets in the account currency's minor unit (cents for USD),
// as strings; "0"/missing means no budget at that level.
function minorToDollars(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n / 100 : null;
}

export type MetaBudgetChangeRow = {
  id: string;
  eventTime: Date;
  level: "adset" | "campaign";
  objectId: string;
  objectName: string;
  budgetType: "daily" | "lifetime";
  oldBudget: number;
  newBudget: number;
  actor: string | null;
};

// Budget raises/cuts from the ad account's activity log
// (/act_<id>/activities). Only update_ad_set_budget and update_campaign_budget
// are real changes; the *_scheduling_state events are toggles and ignored.
// Each event carries the old and new amount in cents.
export async function fetchMetaBudgetChanges(params: {
  accessToken: string;
  adAccountId: string;
  since: Date;
}): Promise<MetaBudgetChangeRow[]> {
  const { accessToken, adAccountId, since } = params;
  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/activities`);
  url.searchParams.set("fields", "event_type,object_name,object_id,event_time,actor_name,extra_data");
  url.searchParams.set("since", String(Math.floor(since.getTime() / 1000)));
  url.searchParams.set("limit", "500");
  url.searchParams.set("access_token", accessToken);

  const rows: MetaBudgetChangeRow[] = [];
  let nextUrl: string | null = url.toString();
  while (nextUrl) {
    const res: Response = await fetch(nextUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`Meta activities fetch failed (${res.status}): ${await res.text()}`);
    const json = await res.json();

    for (const item of json.data ?? []) {
      const level = item.event_type === "update_ad_set_budget" ? "adset" : item.event_type === "update_campaign_budget" ? "campaign" : null;
      if (!level) continue;
      let extra: { old_value?: { old_value?: number }; new_value?: { new_value?: number; additional_value?: string } };
      try {
        extra = JSON.parse(item.extra_data);
      } catch {
        continue;
      }
      const oldCents = Number(extra.old_value?.old_value);
      const newCents = Number(extra.new_value?.new_value);
      if (!Number.isFinite(oldCents) || !Number.isFinite(newCents)) continue;

      const eventTime = new Date(String(item.event_time).replace(/([+-]\d\d)(\d\d)$/, "$1:$2"));
      rows.push({
        id: `${item.object_id}:${Math.floor(eventTime.getTime() / 1000)}:${item.event_type}`,
        eventTime,
        level,
        objectId: String(item.object_id),
        objectName: item.object_name ?? "",
        budgetType: String(extra.new_value?.additional_value ?? "").toLowerCase().includes("lifetime") ? "lifetime" : "daily",
        oldBudget: oldCents / 100,
        newBudget: newCents / 100,
        actor: item.actor_name ?? null,
      });
    }
    nextUrl = json.paging?.next ?? null;
  }
  return rows;
}
