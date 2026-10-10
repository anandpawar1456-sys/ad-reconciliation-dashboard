import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { syncGhlOrders } from "@/lib/ghlSync";
import { syncMetaInsights, getDefaultMetaRange } from "@/lib/metaSync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The hourly/frequent trigger, called by the scheduled GitHub Actions
// workflow (Vercel's Hobby plan only allows one cron run per day). It takes
// no input and returns no data, so it's safe to leave unauthenticated — but
// each job is throttled by its own last-run timestamp, so hammering the URL
// can't burn through Meta/GHL API rate limits.
const MIN_INTERVAL_MS = { ghl: 8 * 60 * 1000, meta: 40 * 60 * 1000 } as const;

export async function GET(req: NextRequest) {
  const job = req.nextUrl.searchParams.get("job");
  if (job !== "ghl" && job !== "meta") {
    return NextResponse.json({ ok: false, error: "job must be ghl or meta" }, { status: 400 });
  }

  const settings = await getSettings();
  const lastRun = job === "ghl" ? settings.lastGhlSyncAt : settings.lastMetaSyncAt;
  if (lastRun && Date.now() - lastRun.getTime() < MIN_INTERVAL_MS[job]) {
    return NextResponse.json({ ok: true, skipped: "ran recently", lastRun });
  }

  try {
    if (job === "ghl") {
      const result = await syncGhlOrders({ pages: 1 });
      return NextResponse.json({ ok: true, job, ...result });
    }
    const { since, until } = await getDefaultMetaRange();
    const result = await syncMetaInsights(since, until);
    return NextResponse.json({ ok: true, job, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, job, error: message }, { status: 500 });
  }
}
