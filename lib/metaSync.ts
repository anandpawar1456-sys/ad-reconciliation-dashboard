import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { fetchMetaInsights, fetchMetaCampaigns, fetchMetaAdSets, fetchMetaAds } from "@/lib/meta";
import { computeRollupRange } from "@/lib/rollup";
import { resolveUnattributedContacts } from "@/lib/attributionResolve";
import { toLocalDateLabel, DEFAULT_TIMEZONE } from "@/lib/timezone";

async function runInChunks<T>(items: T[], fn: (item: T) => Promise<unknown>, size = 25) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

export type MetaSyncResult = {
  rows: number;
  campaigns: number;
  adsets: number;
  ads: number;
  since: string;
  until: string;
  rollupDays: number;
};

// One call = one Meta Insights API request (paginated internally by
// fetchMetaInsights) for the given [since, until] range, plus one
// account-wide list call each for campaigns/adsets/ads status. Used both by
// the routine hourly/daily sync (a few days' lookback) and, called with an
// explicit wider range, for a one-time historical backfill — still a fixed
// small number of API calls per invocation, not repeated polling.
export async function syncMetaInsights(since: string, until: string): Promise<MetaSyncResult> {
  const settings = await getSettings();
  if (!settings.metaAccessToken || !settings.metaAdAccountId) {
    throw new Error("Meta not configured");
  }

  const [rows, campaigns, adsets, ads] = await Promise.all([
    fetchMetaInsights({
      accessToken: settings.metaAccessToken,
      adAccountId: settings.metaAdAccountId,
      since,
      until,
    }),
    fetchMetaCampaigns({
      accessToken: settings.metaAccessToken,
      adAccountId: settings.metaAdAccountId,
    }),
    fetchMetaAdSets({
      accessToken: settings.metaAccessToken,
      adAccountId: settings.metaAdAccountId,
    }),
    fetchMetaAds({
      accessToken: settings.metaAccessToken,
      adAccountId: settings.metaAdAccountId,
    }),
  ]);

  await runInChunks(rows, async (row) => {
    const adsetId = row.adsetId ?? "";
    const adId = row.adId ?? "";
    const reportedRoas = row.spend > 0 ? row.purchaseValue / row.spend : null;

    await prisma.metaInsight.upsert({
      where: {
        date_level_campaignId_adsetId_adId: {
          date: new Date(row.date),
          level: row.level,
          campaignId: row.campaignId,
          adsetId,
          adId,
        },
      },
      create: {
        date: new Date(row.date),
        level: row.level,
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        adsetId,
        adsetName: row.adsetName,
        adId,
        adName: row.adName,
        spend: row.spend,
        purchases: row.purchases,
        purchaseValue: row.purchaseValue,
        reportedRoas,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: row.ctr,
        frequency: row.frequency,
        reach: row.reach,
        uniqueLinkClicks: row.uniqueLinkClicks,
        rawPayload: row as unknown as object,
      },
      update: {
        campaignName: row.campaignName,
        adsetName: row.adsetName,
        adName: row.adName,
        spend: row.spend,
        purchases: row.purchases,
        purchaseValue: row.purchaseValue,
        reportedRoas,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: row.ctr,
        frequency: row.frequency,
        reach: row.reach,
        uniqueLinkClicks: row.uniqueLinkClicks,
        rawPayload: row as unknown as object,
      },
    });
  });

  // Hourly syncs re-list every campaign/ad set/ad, but almost none change
  // between runs — only write the ones that are new or whose name/status
  // moved (hundreds of sequential upserts would otherwise eat most of the
  // function's time budget).
  const [knownCampaigns, knownAdSets, knownAds] = await Promise.all([
    prisma.metaCampaign.findMany({ select: { id: true, name: true, status: true, effectiveStatus: true } }),
    prisma.metaAdSet.findMany({ select: { id: true, name: true, campaignId: true, status: true, effectiveStatus: true } }),
    prisma.metaAd.findMany({ select: { id: true, name: true, adsetId: true, campaignId: true, status: true, effectiveStatus: true } }),
  ]);
  const same = (a: Record<string, unknown> | undefined, b: Record<string, unknown>) =>
    !!a && Object.keys(b).every((k) => a[k] === b[k]);
  const campaignById = new Map(knownCampaigns.map((c) => [c.id, c]));
  const adSetById = new Map(knownAdSets.map((c) => [c.id, c]));
  const adById = new Map(knownAds.map((c) => [c.id, c]));

  const CHUNK = 25;
  async function inChunks<T>(items: T[], fn: (item: T) => Promise<unknown>) {
    for (let i = 0; i < items.length; i += CHUNK) await Promise.all(items.slice(i, i + CHUNK).map(fn));
  }

  await inChunks(
    campaigns.filter((c) => !same(campaignById.get(c.id), { name: c.name, status: c.status, effectiveStatus: c.effectiveStatus })),
    (campaign) =>
      prisma.metaCampaign.upsert({
        where: { id: campaign.id },
        create: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          effectiveStatus: campaign.effectiveStatus,
          objective: campaign.objective,
        },
        update: {
          name: campaign.name,
          status: campaign.status,
          effectiveStatus: campaign.effectiveStatus,
          objective: campaign.objective,
        },
      })
  );

  await inChunks(
    adsets.filter(
      (a) =>
        !same(adSetById.get(a.id), {
          name: a.name,
          campaignId: a.campaignId,
          status: a.status,
          effectiveStatus: a.effectiveStatus,
        })
    ),
    (adset) =>
      prisma.metaAdSet.upsert({
        where: { id: adset.id },
        create: { id: adset.id, name: adset.name, campaignId: adset.campaignId, status: adset.status, effectiveStatus: adset.effectiveStatus },
        update: { name: adset.name, campaignId: adset.campaignId, status: adset.status, effectiveStatus: adset.effectiveStatus },
      })
  );

  await inChunks(
    ads.filter(
      (a) =>
        !same(adById.get(a.id), {
          name: a.name,
          adsetId: a.adsetId,
          campaignId: a.campaignId,
          status: a.status,
          effectiveStatus: a.effectiveStatus,
        })
    ),
    (ad) =>
      prisma.metaAd.upsert({
        where: { id: ad.id },
        create: { id: ad.id, name: ad.name, adsetId: ad.adsetId, campaignId: ad.campaignId, status: ad.status, effectiveStatus: ad.effectiveStatus },
        update: { name: ad.name, adsetId: ad.adsetId, campaignId: ad.campaignId, status: ad.status, effectiveStatus: ad.effectiveStatus },
      })
  );

  await prisma.integrationSettings.update({
    where: { id: 1 },
    data: { lastMetaSyncAt: new Date() },
  });

  // New ads/ad sets just landed, so previously-unmatchable contacts (UTM ad
  // name -> ad) may now resolve — do that before rolling the days up.
  await resolveUnattributedContacts();

  const rollupDays = await computeRollupRange(new Date(since), new Date(until));

  return { rows: rows.length, campaigns: campaigns.length, adsets: adsets.length, ads: ads.length, since, until, rollupDays };
}

// The routine sync window: the last few days (not just today), so a
// purchase event Meta delivers late or corrects is picked up on the next
// run instead of being permanently missed.
const LOOKBACK_DAYS = 3;

export async function getDefaultMetaRange(): Promise<{ since: string; until: string }> {
  const settings = await getSettings();
  const todayLabel = toLocalDateLabel(new Date(), settings.reportingTimezone || DEFAULT_TIMEZONE);
  const sinceLabel = new Date(todayLabel.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  return { since: sinceLabel.toISOString().slice(0, 10), until: todayLabel.toISOString().slice(0, 10) };
}
