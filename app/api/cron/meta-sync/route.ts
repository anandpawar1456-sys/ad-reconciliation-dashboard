import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cronAuth";
import { syncMetaInsights, getDefaultMetaRange } from "@/lib/metaSync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Pass explicit ?since=YYYY-MM-DD&until=YYYY-MM-DD for a one-off historical
// backfill — still a single Meta API call, not repeated polling.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sinceParam = req.nextUrl.searchParams.get("since");
  const untilParam = req.nextUrl.searchParams.get("until");
  const defaults = sinceParam && untilParam ? null : await getDefaultMetaRange();
  const since = sinceParam ?? defaults!.since;
  const until = untilParam ?? defaults!.until;

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
