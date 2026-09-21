import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cronAuth";
import { syncGhlOrders } from "@/lib/ghlSync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Polls GET /payments/orders instead of relying on a GHL workflow webhook
// (that action is billed per-execution on this account's plan). Default
// call covers the most recent 100 orders — plenty of headroom between
// polls at this account's volume. Pass ?pages=N to pull further back (e.g.
// for a one-time historical backfill); each page is 100 orders.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pages = Number(req.nextUrl.searchParams.get("pages") ?? "1");

  try {
    const result = await syncGhlOrders({ pages: Number.isFinite(pages) && pages > 0 ? pages : 1 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
