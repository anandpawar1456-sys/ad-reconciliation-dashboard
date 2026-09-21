import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function pick(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

// Called by public/track.js from visitor browsers on funnel pages, which
// live on a different domain than this app — no auth, CORS-open, and
// tolerant of malformed bodies since it's fed by client-side JS.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
  }

  const visitorId = pick(body.visitorId);
  if (!visitorId) {
    return NextResponse.json({ error: "Missing visitorId" }, { status: 400, headers: CORS_HEADERS });
  }

  const data = {
    fbclid: pick(body.fbclid),
    utmSource: pick(body.utm_source),
    utmMedium: pick(body.utm_medium),
    utmCampaign: pick(body.utm_campaign),
    utmContent: pick(body.utm_content),
    utmTerm: pick(body.utm_term),
    adId: pick(body.ad_id),
    adsetId: pick(body.adset_id),
    campaignId: pick(body.campaign_id),
    landingUrl: pick(body.landingUrl),
    referrer: pick(body.referrer),
  };

  await prisma.clickEvent.upsert({
    where: { visitorId },
    create: { visitorId, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
