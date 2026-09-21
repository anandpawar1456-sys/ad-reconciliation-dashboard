import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedCron } from "@/lib/cronAuth";
import { getSettings } from "@/lib/settings";
import { sendGapAlertEmail } from "@/lib/email";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "https://ad-reconciliation-dashboard.vercel.app/reconciliation";

// Checks the most recently computed day's gap against the configured
// threshold and emails once if it's breached. Guards against sending twice
// for the same date if this ever runs more than once in a day.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getSettings();
  if (!settings.alertEmail) {
    return NextResponse.json({ ok: false, reason: "No alert email configured" });
  }

  const latest = await prisma.dailyReconciliation.findFirst({ orderBy: { date: "desc" } });
  if (!latest) {
    return NextResponse.json({ ok: false, reason: "No reconciliation data yet" });
  }

  const alreadySentForThisDate =
    settings.lastAlertSentForDate && settings.lastAlertSentForDate.getTime() === latest.date.getTime();
  if (alreadySentForThisDate) {
    return NextResponse.json({ ok: true, sent: false, reason: "Already alerted for this date" });
  }

  const gapPercent = Number(latest.gapPercent);
  const threshold = Number(settings.alertThresholdPercent);

  if (Math.abs(gapPercent) < threshold) {
    return NextResponse.json({ ok: true, sent: false, gapPercent, threshold });
  }

  await sendGapAlertEmail({
    to: settings.alertEmail,
    date: formatDate(latest.date),
    ghlRevenue: Number(latest.ghlRevenue),
    metaRevenue: Number(latest.metaRevenue),
    gapAmount: Number(latest.gapAmount),
    gapPercent,
    thresholdPercent: threshold,
    dashboardUrl: DASHBOARD_URL,
  });

  await prisma.integrationSettings.update({
    where: { id: 1 },
    data: { lastAlertSentForDate: latest.date },
  });

  return NextResponse.json({ ok: true, sent: true, gapPercent, threshold });
}
