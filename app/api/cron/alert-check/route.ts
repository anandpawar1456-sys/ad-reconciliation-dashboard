import { NextResponse } from "next/server";

// Vercel Cron target: checks the latest DailyReconciliation gap percent
// against IntegrationSettings.alertThresholdPercent and emails alertEmail
// if breached. Implemented in the alerting step.
export async function GET() {
  return NextResponse.json({ ok: true, todo: "alert check not yet implemented" });
}
