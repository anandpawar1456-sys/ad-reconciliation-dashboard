import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings, maskSecret } from "@/lib/settings";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({
    ghlApiKey: maskSecret(settings.ghlApiKey),
    ghlLocationId: settings.ghlLocationId ?? "",
    metaAccessToken: maskSecret(settings.metaAccessToken),
    metaAdAccountId: settings.metaAdAccountId ?? "",
    alertThresholdPercent: Number(settings.alertThresholdPercent),
    alertEmail: settings.alertEmail ?? "",
    lastGhlSyncAt: settings.lastGhlSyncAt,
    lastMetaSyncAt: settings.lastMetaSyncAt,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const threshold =
    body.alertThresholdPercent !== undefined && body.alertThresholdPercent !== ""
      ? Number(body.alertThresholdPercent)
      : undefined;

  await updateSettings({
    ghlApiKey: typeof body.ghlApiKey === "string" ? body.ghlApiKey.trim() : undefined,
    ghlLocationId: typeof body.ghlLocationId === "string" ? body.ghlLocationId.trim() : undefined,
    metaAccessToken: typeof body.metaAccessToken === "string" ? body.metaAccessToken.trim() : undefined,
    metaAdAccountId: typeof body.metaAdAccountId === "string" ? body.metaAdAccountId.trim() : undefined,
    alertEmail: typeof body.alertEmail === "string" ? body.alertEmail.trim() : undefined,
    alertThresholdPercent: threshold,
  });

  return NextResponse.json({ ok: true });
}
