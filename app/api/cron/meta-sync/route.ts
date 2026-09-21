import { NextResponse } from "next/server";

// Vercel Cron target: pulls the previous day's insights from the Meta
// Marketing API at campaign/adset/ad level and upserts MetaInsight rows.
// Implemented in the ingestion step.
export async function GET() {
  return NextResponse.json({ ok: true, todo: "meta insights sync not yet implemented" });
}
