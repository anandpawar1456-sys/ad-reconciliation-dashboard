import { NextResponse } from "next/server";

// Vercel Cron target: recomputes DailyReconciliation and AdAttribution from
// raw GhlOrder/GhlContact/MetaInsight rows. Implemented in the matching-
// engine step.
export async function GET() {
  return NextResponse.json({ ok: true, todo: "rollup not yet implemented" });
}
