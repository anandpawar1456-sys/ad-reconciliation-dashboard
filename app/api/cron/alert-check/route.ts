import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cronAuth";

// Vercel Cron target: checks the latest DailyReconciliation gap percent
// against IntegrationSettings.alertThresholdPercent and emails alertEmail
// if breached. Implemented in the alerting step.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, todo: "alert check not yet implemented" });
}
