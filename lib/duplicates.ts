import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getUtcRangeForLabels, toLocalDateLabel, DEFAULT_TIMEZONE } from "@/lib/timezone";
import { notExcludedCustomer } from "@/lib/excludedCampaigns";

const HOUR_MS = 60 * 60 * 1000;

// A repeat of the same purchase: same customer, same funnel step and same
// amount, within this window of the previous one. Buying a different step
// (e.g. front end then an upsell) or the same thing weeks later is not a
// duplicate. Duplicate charges and double checkout submits happen within
// minutes, so a day is generous.
export const DUPLICATE_WINDOW_MS = 24 * HOUR_MS;

type DupInput = { id: string; contactId: string; amount: number; sourceStepId: string | null; occurredAt: Date };

// Returns, for every order that repeats an earlier one, the id and time of
// the ORIGINAL (first) order in its chain. The original itself is never
// flagged — it's the legitimate sale.
export function markDuplicates(orders: DupInput[]): Map<string, { originalId: string; originalAt: Date }> {
  const sorted = [...orders].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const last = new Map<string, { id: string; at: Date; originalId: string; originalAt: Date }>();
  const dups = new Map<string, { originalId: string; originalAt: Date }>();

  for (const o of sorted) {
    const key = `${o.contactId}|${o.sourceStepId ?? ""}|${o.amount}`;
    const prev = last.get(key);
    if (prev && o.occurredAt.getTime() - prev.at.getTime() <= DUPLICATE_WINDOW_MS) {
      dups.set(o.id, { originalId: prev.originalId, originalAt: prev.originalAt });
      last.set(key, { id: o.id, at: o.occurredAt, originalId: prev.originalId, originalAt: prev.originalAt });
    } else {
      last.set(key, { id: o.id, at: o.occurredAt, originalId: o.id, originalAt: o.occurredAt });
    }
  }
  return dups;
}

export type DuplicateRow = {
  orderId: string;
  contactId: string;
  email: string | null;
  phone: string | null;
  amount: number;
  funnelName: string | null;
  stepId: string | null;
  at: Date;
  originalAt: Date;
  minutesAfterOriginal: number;
  dayKey: string; // YYYY-MM-DD in the reporting timezone
  monthKey: string; // YYYY-MM
};

// All duplicate orders whose own time falls inside the label-date range.
// Looks back an extra window before the range start so a repeat on day one
// is still matched to an original from the day before.
export async function getDuplicateRows(since: Date, until: Date): Promise<DuplicateRow[]> {
  const settings = await getSettings();
  const timeZone = settings.reportingTimezone || DEFAULT_TIMEZONE;
  const range = getUtcRangeForLabels(since, until, timeZone);

  const orders = await prisma.ghlOrder.findMany({
    where: {
      ...notExcludedCustomer,
      status: "completed",
      occurredAt: { gte: new Date(range.start.getTime() - DUPLICATE_WINDOW_MS), lt: range.end },
    },
    include: { contact: { select: { email: true, phone: true } } },
  });

  const dups = markDuplicates(
    orders.map((o) => ({
      id: o.id,
      contactId: o.contactId,
      amount: Number(o.amount),
      sourceStepId: o.sourceStepId,
      occurredAt: o.occurredAt,
    }))
  );

  return orders
    .filter((o) => dups.has(o.id) && o.occurredAt >= range.start)
    .map((o) => {
      const d = dups.get(o.id)!;
      const label = toLocalDateLabel(o.occurredAt, timeZone).toISOString().slice(0, 10);
      return {
        orderId: o.id,
        contactId: o.contactId,
        email: o.contact?.email ?? null,
        phone: o.contact?.phone ?? null,
        amount: Number(o.amount),
        funnelName: o.sourceName,
        stepId: o.sourceStepId,
        at: o.occurredAt,
        originalAt: d.originalAt,
        minutesAfterOriginal: Math.max(0, Math.round((o.occurredAt.getTime() - d.originalAt.getTime()) / 60000)),
        dayKey: label,
        monthKey: label.slice(0, 7),
      };
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}
