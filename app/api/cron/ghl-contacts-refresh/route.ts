import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cronAuth";
import { refreshGhlContacts } from "@/lib/ghlContactRefresh";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One-time (or occasional) backfill — call with ?offset=N&limit=M,
// repeating with increasing offset until "remaining" is 0. See
// lib/ghlContactRefresh.ts for why this exists.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const offset = Number(req.nextUrl.searchParams.get("offset") ?? "0");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "100");

  try {
    const result = await refreshGhlContacts(
      Number.isFinite(offset) ? offset : 0,
      Number.isFinite(limit) ? limit : 100
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
