import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = ["CONFIRMED", "DISMISSED", "NEEDS_REVIEW"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const status = body?.status;

  if (typeof status !== "string" || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  await prisma.unmatchedTransaction.update({
    where: { id: params.id },
    data: { status, reviewedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
