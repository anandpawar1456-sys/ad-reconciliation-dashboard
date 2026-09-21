import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cronAuth";
import { computeRollupRange } from "@/lib/rollup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOOKBACK_DAYS = 7;

// Catch-all safety net: the GHL webhook recomputes its own day immediately,
// and meta-sync recomputes its own pulled range — this just re-covers the
// last week on a schedule in case either of those was ever missed.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const until = new Date();
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const days = await computeRollupRange(since, until);

  return NextResponse.json({ ok: true, rollupDays: days });
}
