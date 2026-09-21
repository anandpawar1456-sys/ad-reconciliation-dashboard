import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cronAuth";
import { syncMetaInsights } from "@/lib/metaSync";
import { toLocalDateLabel, DEFAULT_TIMEZONE } from "@/lib/timezone";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Pulls the last few days (not just yesterday) on every routine run, so a
// Meta purchase event that arrives late or gets corrected still gets
// picked up on the next sync instead of being permanently missed. Pass
// explicit ?since=YYYY-MM-DD&until=YYYY-MM-DD for a one-off historical
// backfill — still a single Meta API call, not repeated polling.
const LOOKBACK_DAYS = 3;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sinceParam = req.nextUrl.searchParams.get("since");
  const untilParam = req.nextUrl.searchParams.get("until");

  let since = sinceParam;
  let until = untilParam;

  if (!since || !until) {
    const settings = await getSettings();
    const timeZone = settings.reportingTimezone || DEFAULT_TIMEZONE;
    const todayLabel = toLocalDateLabel(new Date(), timeZone);
    const sinceLabel = new Date(todayLabel.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    until = formatDate(todayLabel);
    since = formatDate(sinceLabel);
  }

  try {
    const result = await syncMetaInsights(since, until);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Meta not configured") {
      return NextResponse.json({ ok: false, reason: message });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
