import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { fetchMetaInsights } from "@/lib/meta";
import { isAuthorizedCron } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Pulls the last few days (not just yesterday) on every run, so a Meta
// purchase event that arrives late or gets corrected still gets picked up
// on the next sync instead of being permanently missed.
const LOOKBACK_DAYS = 3;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getSettings();
  if (!settings.metaAccessToken || !settings.metaAdAccountId) {
    return NextResponse.json({ ok: false, reason: "Meta not configured" });
  }

  const until = formatDate(new Date());
  const since = formatDate(new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000));

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

  return NextResponse.json({ ok: true, rows: rows.length, since, until });
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
