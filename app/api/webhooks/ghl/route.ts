import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGhlContact, extractAttribution } from "@/lib/ghl";
import { getSettings } from "@/lib/settings";

function pick(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

// Expected payload, set up as a "Webhook" action on a GHL workflow
// (trigger: order submitted / payment received / opportunity won — whatever
// fires when a sale actually happens in your funnel). Configure the
// workflow's webhook action to send this exact JSON shape using GHL's merge
// tag picker:
//
//   {
//     "contact_id": "{{contact.id}}",
//     "order_id": "{{order.id}}",       // any stable unique id for the transaction
//     "amount": {{order.total}},
//     "currency": "USD",
//     "product_id": "{{order.product_id}}",
//     "product_name": "{{order.product_name}}",
//     "status": "paid",
//     "occurred_at": "{{order.created_at}}"
//   }
//
// Exact merge tag names depend on which trigger you use (order vs
// opportunity) — check the merge tag picker in your workflow's webhook
// action and adjust to match. contact_id/order_id/amount are the only
// required fields; everything else is best-effort.
//
// We deliberately keep this payload minimal and re-fetch the contact from
// the GHL API for canonical email/attribution data, rather than trusting
// the webhook body to carry it reliably.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const contactId = pick(body.contact_id);
  const orderId = pick(body.order_id);
  const amount = Number(body.amount);

  if (!contactId || !orderId || !Number.isFinite(amount)) {
    return NextResponse.json(
      { error: "Missing required fields: contact_id, order_id, amount" },
      { status: 400 }
    );
  }

  const settings = await getSettings();

  let email: string | undefined;
  let phone: string | undefined;
  let attribution: ReturnType<typeof extractAttribution> = {};

  if (settings.ghlApiKey) {
    try {
      const contact = await getGhlContact(contactId, settings.ghlApiKey);
      email = pick(contact?.email);
      phone = pick(contact?.phone);
      attribution = extractAttribution(contact);
    } catch (err) {
      console.error("GHL contact fetch failed", err);
    }
  }

  await prisma.ghlContact.upsert({
    where: { id: contactId },
    create: { id: contactId, email, phone, ...attribution },
    update: { email, phone, ...attribution },
  });

  await prisma.ghlOrder.upsert({
    where: { id: orderId },
    create: {
      id: orderId,
      contactId,
      amount,
      currency: pick(body.currency) ?? "USD",
      productId: pick(body.product_id),
      productName: pick(body.product_name),
      status: pick(body.status) ?? "paid",
      occurredAt: pick(body.occurred_at) ? new Date(body.occurred_at as string) : new Date(),
      rawPayload: body,
    },
    update: {
      amount,
      currency: pick(body.currency) ?? "USD",
      productId: pick(body.product_id),
      productName: pick(body.product_name),
      status: pick(body.status) ?? "paid",
      rawPayload: body,
    },
  });

  await prisma.integrationSettings.update({
    where: { id: 1 },
    data: { lastGhlSyncAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
