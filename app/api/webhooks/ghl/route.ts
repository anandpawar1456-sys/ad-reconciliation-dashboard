import { NextRequest, NextResponse } from "next/server";

// GoHighLevel calls this URL on order/opportunity events. Built out in the
// ingestion step — for now it just accepts and acknowledges so the endpoint
// can be registered in GHL ahead of time.
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // TODO: parse contact + order/opportunity fields, upsert GhlContact and
  // GhlOrder via prisma.
  return NextResponse.json({ received: true });
}
