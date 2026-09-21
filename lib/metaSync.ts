import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { fetchMetaInsights } from "@/lib/meta";
import { computeRollupRange } from "@/lib/rollup";

export type MetaSyncResult = { rows: number; since: string; until: string; rollupDays: number };

// One call = one Meta Insights API request (paginated internally by
// fetchMetaInsights) for the given [since, until] range. Used both by the
// routine hourly/daily sync (a few days' lookback) and, called with an
// explicit wider range, for a one-time historical backfill — still just a
// single API call per invocation, not repeated polling.
export async function syncMetaInsights(since: string, until: string): Promise<MetaSyncResult> {
  const settings = await getSettings();
  if (!settings.metaAccessToken || !settings.metaAdAccountId) {
    throw new Error("Meta not configured");
  }

  const rows = await fetchMetaInsights({
    accessToken: settings.metaAccessToken,
    adAccountId: settings.metaAdAccountId,
    since,
    until,
  });

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
        rawPayload: row as unknown as object,
      },
    });
  }

  await prisma.integrationSettings.update({
    where: { id: 1 },
    data: { lastMetaSyncAt: new Date() },
  });

  const rollupDays = await computeRollupRange(new Date(since), new Date(until));

  return { rows: rows.length, since, until, rollupDays };
}
