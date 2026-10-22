import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getUtcRangeForLabels, toLocalDateLabel, DEFAULT_TIMEZONE } from "@/lib/timezone";
import { notExcludedCampaignName } from "@/lib/excludedCampaigns";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 3;
// Budgets are usually changed right after midnight; a change made before this
// local hour affects (nearly) that whole day, so the "after" window starts on
// the change day itself. Later changes start the next day.
const SAME_DAY_CUTOFF_HOUR = 6;

export type WindowStats = {
  days: number; // completed days with data in the window (max 3)
  spend: number;
  avgDailySpend: number | null;
  trueRevenue: number;
  trueRoas: number | null;
  purchases: number;
  cpa: number | null;
};

export type BudgetChangeView = {
  id: string;
  at: Date;
  level: "adset" | "campaign";
  objectId: string;
  objectName: string;
  campaignId: string | null;
  campaignName: string | null;
  budgetType: "daily" | "lifetime";
  oldBudget: number;
  newBudget: number;
  changePercent: number;
  direction: "raise" | "cut";
  oldBudgetLastedDays: number | null; // how long the old budget was in place (null = no earlier change on record)
  nextChangeInAfterWindowAt: Date | null; // another change landed inside the 3 "after" days, so the result is mixed
  before: WindowStats;
  after: WindowStats;
};

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

function emptyStats(): WindowStats {
  return { days: 0, spend: 0, avgDailySpend: null, trueRevenue: 0, trueRoas: null, purchases: 0, cpa: null };
}

function localHour(d: Date, timeZone: string): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false }).format(d)) % 24;
}

// Budget changes whose time falls inside the label-date range, each with
// spend / true ROAS / CPA for the 3 completed days before versus the 3 days
// after. `objectIds` limits to specific ad sets/campaigns; `campaignId`
// limits to one campaign and its ad sets.
export async function getBudgetChanges(opts: {
  since: Date;
  until: Date;
  objectIds?: string[];
  campaignId?: string;
  limit?: number;
}): Promise<BudgetChangeView[]> {
  const settings = await getSettings();
  const timeZone = settings.reportingTimezone || DEFAULT_TIMEZONE;
  const range = getUtcRangeForLabels(opts.since, opts.until, timeZone);

  const rows = await prisma.budgetChange.findMany({
    where: {
      eventTime: { gte: range.start, lt: range.end },
      ...(opts.objectIds ? { objectId: { in: opts.objectIds } } : {}),
      ...(opts.campaignId ? { OR: [{ campaignId: opts.campaignId }, { objectId: opts.campaignId }] } : {}),
    },
    orderBy: { eventTime: "desc" },
    take: opts.limit ?? 60,
  });
  if (rows.length === 0) return [];

  // Full history for these objects, to know how long each old budget lasted.
  const objectIds = [...new Set(rows.map((r) => r.objectId))];
  const history = await prisma.budgetChange.findMany({
    where: { objectId: { in: objectIds } },
    select: { objectId: true, eventTime: true },
    orderBy: { eventTime: "asc" },
  });
  const timesByObject = new Map<string, Date[]>();
  for (const h of history) timesByObject.set(h.objectId, [...(timesByObject.get(h.objectId) ?? []), h.eventTime]);

  const campaignIds = [...new Set(rows.map((r) => r.campaignId).filter((c): c is string => !!c))];
  const campaigns = await prisma.metaCampaign.findMany({ where: { id: { in: campaignIds } }, select: { id: true, name: true } });
  const campaignName = new Map(campaigns.map((c) => [c.id, c.name]));

  // Window boundaries (label dates) per change.
  const today = toLocalDateLabel(new Date(), timeZone);
  const lastCompleteDay = addDays(today, -1);
  const plans = rows.map((r) => {
    const day = toLocalDateLabel(r.eventTime, timeZone);
    const afterStart = localHour(r.eventTime, timeZone) < SAME_DAY_CUTOFF_HOUR ? day : addDays(day, 1);
    return { r, beforeStart: addDays(afterStart, -WINDOW_DAYS), afterStart };
  });

  const minDate = new Date(Math.min(...plans.map((p) => p.beforeStart.getTime())));
  const maxDate = new Date(Math.max(...plans.map((p) => addDays(p.afterStart, WINDOW_DAYS - 1).getTime())));
  const adsetIds = rows.filter((r) => r.level === "adset").map((r) => r.objectId);
  const campIds = rows.filter((r) => r.level === "campaign").map((r) => r.objectId);
  const scope = [
    ...(adsetIds.length ? [{ adsetId: { in: adsetIds } }] : []),
    ...(campIds.length ? [{ campaignId: { in: campIds } }] : []),
  ];

  const [insights, attribution] = await Promise.all([
    prisma.metaInsight.findMany({
      where: { level: "ad", date: { gte: minDate, lte: maxDate }, OR: scope, ...notExcludedCampaignName },
      select: { date: true, adsetId: true, campaignId: true, spend: true, purchases: true },
    }),
    prisma.adAttribution.findMany({
      where: { date: { gte: minDate, lte: maxDate }, OR: scope },
      select: { date: true, adsetId: true, campaignId: true, trueRevenue: true },
    }),
  ]);

  type Day = { spend: number; purchases: number; trueRevenue: number };
  const daily = new Map<string, Day>(); // `${level}:${id}:${date}`
  const bucket = (key: string) => {
    let d = daily.get(key);
    if (!d) daily.set(key, (d = { spend: 0, purchases: 0, trueRevenue: 0 }));
    return d;
  };
  for (const i of insights) {
    const iso = i.date.toISOString();
    if (i.adsetId) {
      const b = bucket(`adset:${i.adsetId}:${iso}`);
      b.spend += Number(i.spend);
      b.purchases += i.purchases;
    }
    const c = bucket(`campaign:${i.campaignId}:${iso}`);
    c.spend += Number(i.spend);
    c.purchases += i.purchases;
  }
  for (const a of attribution) {
    const iso = a.date.toISOString();
    if (a.adsetId) bucket(`adset:${a.adsetId}:${iso}`).trueRevenue += Number(a.trueRevenue);
    if (a.campaignId) bucket(`campaign:${a.campaignId}:${iso}`).trueRevenue += Number(a.trueRevenue);
  }

  const windowStats = (level: string, id: string, start: Date): WindowStats => {
    const s = emptyStats();
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const date = addDays(start, i);
      if (date > lastCompleteDay) continue; // today is still partial
      s.days += 1;
      const d = daily.get(`${level}:${id}:${date.toISOString()}`);
      if (!d) continue;
      s.spend += d.spend;
      s.purchases += d.purchases;
      s.trueRevenue += d.trueRevenue;
    }
    s.avgDailySpend = s.days > 0 ? s.spend / s.days : null;
    s.trueRoas = s.spend > 0 ? s.trueRevenue / s.spend : null;
    s.cpa = s.purchases > 0 ? s.spend / s.purchases : null;
    return s;
  };

  return plans.map(({ r, beforeStart, afterStart }) => {
    const oldB = Number(r.oldBudget);
    const newB = Number(r.newBudget);
    const times = timesByObject.get(r.objectId) ?? [];
    const idx = times.findIndex((t) => t.getTime() === r.eventTime.getTime());
    const prev = idx > 0 ? times[idx - 1] : null;
    const next = idx >= 0 && idx < times.length - 1 ? times[idx + 1] : null;
    const afterEnd = addDays(afterStart, WINDOW_DAYS).getTime();
    return {
      id: r.id,
      at: r.eventTime,
      level: r.level as "adset" | "campaign",
      objectId: r.objectId,
      objectName: r.objectName,
      campaignId: r.campaignId,
      campaignName: r.campaignId ? campaignName.get(r.campaignId) ?? null : null,
      budgetType: r.budgetType as "daily" | "lifetime",
      oldBudget: oldB,
      newBudget: newB,
      changePercent: oldB > 0 ? ((newB - oldB) / oldB) * 100 : 0,
      direction: newB >= oldB ? "raise" : "cut",
      oldBudgetLastedDays: prev ? Math.max(0, Math.round((r.eventTime.getTime() - prev.getTime()) / DAY_MS)) : null,
      nextChangeInAfterWindowAt: next && next.getTime() < afterEnd ? next : null,
      before: windowStats(r.level, r.objectId, beforeStart),
      after: windowStats(r.level, r.objectId, afterStart),
    };
  });
}

export type BudgetStatus = {
  amount: number;
  type: "daily" | "lifetime";
  source: "campaign" | "adset" | "adsets"; // adsets = sum of the campaign's active ad set budgets
  lastChangeAt: string | null;
  lastChangeFrom: number | null;
  lastChangeTo: number | null;
  unchangedDays: number | null; // null = no change on record
};

// Current budget for every campaign and ad set, plus when it last changed.
// CBO campaigns have their own budget; for ad-set-budget campaigns the
// campaign figure is the sum of its ACTIVE ad sets' daily budgets and its
// "last change" is the most recent change among those ad sets.
export async function getBudgetStatuses(): Promise<Map<string, BudgetStatus>> {
  const [campaigns, adsets, latest] = await Promise.all([
    prisma.metaCampaign.findMany({ select: { id: true, dailyBudget: true, lifetimeBudget: true } }),
    prisma.metaAdSet.findMany({ select: { id: true, campaignId: true, effectiveStatus: true, dailyBudget: true, lifetimeBudget: true } }),
    prisma.budgetChange.findMany({
      select: { objectId: true, campaignId: true, level: true, eventTime: true, oldBudget: true, newBudget: true },
      orderBy: { eventTime: "desc" },
    }),
  ]);

  const lastByObject = new Map<string, (typeof latest)[number]>();
  const lastByCampaignViaAdsets = new Map<string, (typeof latest)[number]>();
  for (const c of latest) {
    if (!lastByObject.has(c.objectId)) lastByObject.set(c.objectId, c);
    if (c.level === "adset" && c.campaignId && !lastByCampaignViaAdsets.has(c.campaignId)) lastByCampaignViaAdsets.set(c.campaignId, c);
  }

  const now = Date.now();
  const withChange = (base: Omit<BudgetStatus, "lastChangeAt" | "lastChangeFrom" | "lastChangeTo" | "unchangedDays">, c?: (typeof latest)[number]): BudgetStatus => ({
    ...base,
    lastChangeAt: c ? c.eventTime.toISOString() : null,
    lastChangeFrom: c ? Number(c.oldBudget) : null,
    lastChangeTo: c ? Number(c.newBudget) : null,
    unchangedDays: c ? Math.max(0, Math.floor((now - c.eventTime.getTime()) / DAY_MS)) : null,
  });

  const out = new Map<string, BudgetStatus>();

  for (const a of adsets) {
    const daily = a.dailyBudget ? Number(a.dailyBudget) : null;
    const lifetime = a.lifetimeBudget ? Number(a.lifetimeBudget) : null;
    if (daily === null && lifetime === null) continue;
    out.set(a.id, withChange({ amount: (daily ?? lifetime) as number, type: daily !== null ? "daily" : "lifetime", source: "adset" }, lastByObject.get(a.id)));
  }

  const activeAdsetBudget = new Map<string, number>();
  for (const a of adsets) {
    if (a.effectiveStatus === "ACTIVE" && a.dailyBudget) {
      activeAdsetBudget.set(a.campaignId, (activeAdsetBudget.get(a.campaignId) ?? 0) + Number(a.dailyBudget));
    }
  }

  for (const c of campaigns) {
    const daily = c.dailyBudget ? Number(c.dailyBudget) : null;
    const lifetime = c.lifetimeBudget ? Number(c.lifetimeBudget) : null;
    if (daily !== null || lifetime !== null) {
      out.set(c.id, withChange({ amount: (daily ?? lifetime) as number, type: daily !== null ? "daily" : "lifetime", source: "campaign" }, lastByObject.get(c.id)));
    } else if (activeAdsetBudget.has(c.id)) {
      out.set(c.id, withChange({ amount: activeAdsetBudget.get(c.id) as number, type: "daily", source: "adsets" }, lastByCampaignViaAdsets.get(c.id)));
    }
  }
  return out;
}
