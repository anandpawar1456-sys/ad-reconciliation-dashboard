import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { fetchMetaInsights, fetchMetaCampaigns, fetchMetaAdSets, fetchMetaAds } from "@/lib/meta";
import { computeRollupRange } from "@/lib/rollup";

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

  for (const row of rows) {
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
  }

  for (const campaign of campaigns) {
    await prisma.metaCampaign.upsert({
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
    });
  }

  for (const adset of adsets) {
    await prisma.metaAdSet.upsert({
      where: { id: adset.id },
      create: { id: adset.id, name: adset.name, campaignId: adset.campaignId, status: adset.status, effectiveStatus: adset.effectiveStatus },
      update: { name: adset.name, campaignId: adset.campaignId, status: adset.status, effectiveStatus: adset.effectiveStatus },
    });
  }

  for (const ad of ads) {
    await prisma.metaAd.upsert({
      where: { id: ad.id },
      create: { id: ad.id, name: ad.name, adsetId: ad.adsetId, campaignId: ad.campaignId, status: ad.status, effectiveStatus: ad.effectiveStatus },
      update: { name: ad.name, adsetId: ad.adsetId, campaignId: ad.campaignId, status: ad.status, effectiveStatus: ad.effectiveStatus },
    });
  }

  await prisma.integrationSettings.update({
    where: { id: 1 },
    data: { lastMetaSyncAt: new Date() },
  });

  const rollupDays = await computeRollupRange(new Date(since), new Date(until));

  return { rows: rows.length, campaigns: campaigns.length, adsets: adsets.length, ads: ads.length, since, until, rollupDays };
}
