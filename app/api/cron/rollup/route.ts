import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cronAuth";

// Vercel Cron target: recomputes DailyReconciliation and AdAttribution from
// raw GhlOrder/GhlContact/MetaInsight rows. Implemented in the matching-
// engine step.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, todo: "rollup not yet implemented" });
}
