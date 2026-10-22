import { getSettings } from "@/lib/settings";
import { RANGE_PRESETS, resolveRange, type RangePreset } from "@/lib/dateRanges";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import {
  getOverviewData,
  getEarliestDataDate,
  getYesterdaySnapshot,
  getAdAttributionTotals,
  getFunnelsBreakdown,
  getDailyReconciliation,
  getUnmatchedTransactions,
} from "@/lib/dashboardQueries";
import { getCampaignSummaries, getAdSetSummaries, getAdSummaries, type HierarchySummary } from "@/lib/campaignQueries";
import { searchAds, getAdHistory } from "@/lib/adLookup";
import { getDuplicateRows, groupDuplicates } from "@/lib/duplicates";
import { getOrganicBreakdown } from "@/lib/organic";
import { getGhlFunnelStepNames } from "@/lib/ghl";
import { formatLabelDate } from "@/lib/format";

// Everything here is READ-ONLY and PRIVACY-SAFE: no emails, phone numbers,
// names, contact ids or order ids ever leave this file. Customers appear only
// as anonymous labels ("Customer 1") that are stable within one response.

export const SERVER_INSTRUCTIONS = `Live data from a personal Ad Reconciliation Dashboard that reconciles Meta Ads with GoHighLevel (GHL) sales for US campaigns. All money is USD. Dates are in the account timezone (America/Los_Angeles).

Definitions:
- GHL revenue = real completed sales in GoHighLevel. Meta revenue = what Meta's pixel reported. Meta can under-report.
- Recovered revenue = GHL sales confirmed for an ad (by ad_id / UTM) that Meta did not report. True revenue = Meta revenue + recovered. True ROAS = true revenue / ad spend. CPA = ad spend / Meta purchases.
- Organic sales = GHL sales Meta cannot claim: customers with no Meta click evidence (email/direct), or orders placed more than 7 days after the customer's first purchase (Meta's 7-day click window). Back-to-back and same-day upsells stay with the ad. Organic is kept out of every ad's numbers and out of the gap.
- Gap = Meta-driven GHL revenue minus Meta-reported revenue.
- Duplicate = same customer, same funnel step (product) and same amount charged again within 24 hours. The first charge is the real sale.
- Excluded from everything: the India "Moto" campaigns (sold on a separate WordPress site) and the owner's own test purchases.
- Customer identities are deliberately hidden.
Data freshness: GHL orders sync about every 15 minutes, Meta ad data hourly. Call data_status to see the last sync times.`;

type Json = Record<string, unknown>;
type ToolDef = { name: string; description: string; inputSchema: Json; handler: (args: Json) => Promise<unknown> };

const r2 = (n: number) => Math.round(n * 100) / 100;
const day = (d: Date) => d.toISOString().slice(0, 10);
const nz = (n: number | null | undefined) => (n === null || n === undefined ? null : r2(n));

const RANGE_VALUES = RANGE_PRESETS.filter((p) => p.value !== "custom").map((p) => p.value);

const rangeProps = {
  range: {
    type: "string",
    enum: RANGE_VALUES,
    description: "Date range preset. Default last7. Ignored if since and until are both given.",
  },
  since: { type: "string", description: "Custom range start, YYYY-MM-DD (use together with until)." },
  until: { type: "string", description: "Custom range end, YYYY-MM-DD (inclusive)." },
};

async function resolveArgs(args: Json) {
  const settings = await getSettings();
  const tz = settings.reportingTimezone || DEFAULT_TIMEZONE;
  const earliest = (await getEarliestDataDate()) ?? new Date();
  const since = typeof args.since === "string" ? args.since : undefined;
  const until = typeof args.until === "string" ? args.until : undefined;
  let preset = (typeof args.range === "string" ? args.range : "last7") as RangePreset;
  if (since && until) preset = "custom";
  if (!RANGE_PRESETS.some((p) => p.value === preset)) throw new Error(`Unknown range "${preset}". Use one of: ${RANGE_VALUES.join(", ")}`);
  if (preset === "custom" && (!since || !until || isNaN(Date.parse(since)) || isNaN(Date.parse(until)))) {
    throw new Error("Custom ranges need both since and until as YYYY-MM-DD.");
  }
  const resolved = resolveRange(preset, tz, earliest, since, until);
  return {
    settings,
    tz,
    since: resolved.since,
    until: resolved.until,
    period: { range: preset, label: resolved.label, since: day(resolved.since), until: day(resolved.until) },
  };
}

function campaignRow(r: HierarchySummary) {
  return {
    id: r.id,
    name: r.name,
    status: r.effectiveStatus,
    spend: r2(r.spend),
    metaRevenue: r2(r.metaRevenue),
    metaRoas: nz(r.metaRoas),
    recoveredRevenue: r2(r.recoveredRevenue),
    trueRevenue: r2(r.trueRevenue),
    trueRoas: nz(r.trueRoas),
    ghlRevenue: r2(r.ghlRevenue),
    ghlProfit: r2(r.ghlProfit),
    metaPurchases: r.purchases,
    cpa: nz(r.cpa),
    ctrPercent: r2(r.ctr),
    impressions: r.impressions,
    uniqueLinkClicks: r.uniqueLinkClicks,
  };
}

export const TOOLS: ToolDef[] = [
  {
    name: "data_status",
    description: "When Meta and GHL data were last synced, the reporting timezone, and how the metrics are defined. Call this first if freshness matters.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => {
      const s = await getSettings();
      return {
        lastMetaSync: s.lastMetaSyncAt,
        lastGhlSync: s.lastGhlSyncAt,
        timezone: s.reportingTimezone || DEFAULT_TIMEZONE,
        syncSchedule: "GHL orders about every 15 minutes, Meta ad data about hourly",
        definitions: SERVER_INSTRUCTIONS,
      };
    },
  },
  {
    name: "yesterday_summary",
    description:
      "Yesterday's headline numbers: profit (and change vs the day before), revenue, ad spend, true ROAS, orders, CPA, recovered revenue, and the best-performing ad.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => {
      const settings = await getSettings();
      const y = await getYesterdaySnapshot(settings.reportingTimezone || DEFAULT_TIMEZONE);
      return {
        date: day(y.dateLabel),
        hasData: y.hasData,
        profit: r2(y.profit),
        profitChangeVsDayBefore: y.previousProfit === null ? null : r2(y.profit - y.previousProfit),
        ghlRevenue: r2(y.ghlRevenue),
        ghlOrders: y.ghlOrders,
        adSpend: r2(y.metaSpend),
        metaReportedRevenue: r2(y.metaRevenue),
        metaPurchases: y.metaPurchases,
        recoveredRevenue: r2(y.recoveredRevenue),
        trueRoas: nz(y.trueRoas),
        cpa: nz(y.cpa),
        bestAd: y.bestAd
          ? { adId: y.bestAd.adId, name: y.bestAd.name, profit: r2(y.bestAd.profit), trueRoas: nz(y.bestAd.trueRoas), spend: r2(y.bestAd.metaSpend) }
          : null,
        last7DaysProfitTrend: y.trends.profit.map(r2),
      };
    },
  },
  {
    name: "overview",
    description:
      "Account totals for a date range: GHL revenue, organic sales, Meta-reported revenue, ad spend, gap, true ROAS, profit, CPA, plus a daily series. Use for 'how are we doing' questions.",
    inputSchema: { type: "object", properties: rangeProps, additionalProperties: false },
    handler: async (args) => {
      const { since, until, period } = await resolveArgs(args);
      const d = await getOverviewData(since, until);
      const t = d.totals;
      return {
        period,
        totals: {
          ghlRevenue: r2(t.ghlRevenue),
          ghlOrders: t.ghlTransactions,
          organicSales: r2(t.ghlOtherRevenue),
          metaDrivenGhlRevenue: r2(t.ghlMetaRevenue),
          metaReportedRevenue: r2(t.metaRevenue),
          metaPurchases: t.metaPurchases,
          adSpend: r2(t.metaSpend),
          gap: r2(t.gapAmount),
          gapPercent: r2(t.gapPercent),
          trueRevenue: r2(t.trueRevenue),
          trueRoas: nz(t.avgTrueRoas),
          profit: r2(t.ghlRevenue - t.metaSpend),
          cpa: t.metaPurchases > 0 ? r2(t.metaSpend / t.metaPurchases) : null,
        },
        daily: d.series.map((p) => ({
          date: day(p.date),
          ghlRevenue: r2(p.ghlRevenue),
          metaRevenue: r2(p.metaRevenue),
          adSpend: r2(p.metaSpend),
        })),
      };
    },
  },
  {
    name: "campaigns",
    description:
      "Campaign, ad set or ad performance table for a date range (like Ads Manager): spend, Meta revenue, reported ROAS, recovered revenue, true revenue, true ROAS, GHL profit, purchases, CPA, CTR. level=campaign lists campaigns; level=adset needs parent_id=<campaign id>; level=ad needs parent_id=<ad set id>. Sorted by spend.",
    inputSchema: {
      type: "object",
      properties: {
        level: { type: "string", enum: ["campaign", "adset", "ad"], description: "Default campaign." },
        parent_id: { type: "string", description: "Campaign id (for level=adset) or ad set id (for level=ad)." },
        status: { type: "string", enum: ["all", "active", "paused"], description: "Default all." },
        include_zero_spend: { type: "boolean", description: "Include rows with no spend in the range. Default false." },
        limit: { type: "number", description: "Max rows. Default 25." },
        ...rangeProps,
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const { since, until, period } = await resolveArgs(args);
      const level = (args.level as string) ?? "campaign";
      const parent = args.parent_id as string | undefined;
      if (level !== "campaign" && !parent) throw new Error(`level=${level} needs parent_id.`);
      let rows =
        level === "campaign"
          ? await getCampaignSummaries(since, until)
          : level === "adset"
            ? await getAdSetSummaries(parent as string, since, until)
            : await getAdSummaries(parent as string, since, until);

      const status = (args.status as string) ?? "all";
      if (status === "active") rows = rows.filter((r) => r.effectiveStatus === "ACTIVE");
      if (status === "paused") rows = rows.filter((r) => r.effectiveStatus.includes("PAUSED"));
      if (!args.include_zero_spend) rows = rows.filter((r) => r.spend > 0 || r.recoveredRevenue > 0 || r.ghlRevenue > 0);
      const limit = Math.min(Math.max(Number(args.limit) || 25, 1), 100);

      const totals = rows.reduce(
        (a, r) => ({ spend: a.spend + r.spend, trueRevenue: a.trueRevenue + r.trueRevenue, purchases: a.purchases + r.purchases }),
        { spend: 0, trueRevenue: 0, purchases: 0 }
      );
      return {
        period,
        level,
        totalRows: rows.length,
        totals: {
          spend: r2(totals.spend),
          trueRevenue: r2(totals.trueRevenue),
          trueRoas: totals.spend > 0 ? r2(totals.trueRevenue / totals.spend) : null,
          cpa: totals.purchases > 0 ? r2(totals.spend / totals.purchases) : null,
        },
        rows: rows.slice(0, limit).map(campaignRow),
      };
    },
  },
  {
    name: "ad_lookup",
    description:
      "Full history of one ad (or search by name): lifetime and last-7-day spend, Meta purchases/revenue, GHL sales tied to the ad, true ROAS, profit, both CPAs, day-by-day table, and a keep/watch/kill verdict. query = ad ID or part of the ad name. If several ads match, returns the list to choose from.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Ad ID, or part of the ad name." } },
      required: ["query"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const query = String(args.query ?? "").trim();
      if (!query) throw new Error("query is required.");
      const matches = await searchAds(query);
      const exact = matches.find((m) => m.adId === query);
      if (!exact && matches.length !== 1) {
        return {
          matches: matches.map((m) => ({ adId: m.adId, name: m.name, campaign: m.campaignName, adSet: m.adsetName, status: m.effectiveStatus, lifetimeSpend: r2(m.spend) })),
          note: matches.length === 0 ? "No ads matched." : "Several ads matched. Call ad_lookup again with one adId.",
        };
      }
      const h = await getAdHistory((exact ?? matches[0]).adId);
      if (!h) return { note: "No data for that ad." };
      const totals = (t: typeof h.lifetime) => ({
        spend: r2(t.spend),
        metaPurchases: t.metaPurchases,
        metaRevenue: r2(t.metaRevenue),
        ghlOrdersTiedToAd: t.ghlOrders,
        ghlRevenueTiedToAd: r2(t.ghlRevenue),
        recoveredRevenue: r2(t.recoveredRevenue),
        trueRevenue: r2(t.trueRevenue),
        trueRoas: nz(t.trueRoas),
        metaRoas: nz(t.metaRoas),
        profit: r2(t.profit),
        cpaMetaPurchases: nz(t.metaCpa),
        cpaGhlOrders: nz(t.ghlCpa),
      });
      return {
        adId: h.adId,
        name: h.name,
        status: h.status,
        campaign: h.campaignName,
        adSet: h.adsetName,
        firstSpendDate: h.firstDate ? day(h.firstDate) : null,
        lastSpendDate: h.lastDate ? day(h.lastDate) : null,
        daysWithSpend: h.activeDays,
        verdict: h.verdict,
        lifetime: totals(h.lifetime),
        last7Days: totals(h.last7),
        daily: h.daily.map((d) => ({
          date: day(d.date),
          spend: r2(d.spend),
          metaPurchases: d.metaPurchases,
          metaRevenue: r2(d.metaRevenue),
          ghlOrders: d.ghlOrders,
          ghlRevenue: r2(d.ghlRevenue),
          trueRevenue: r2(d.trueRevenue),
          trueRoas: d.spend > 0 ? r2(d.trueRevenue / d.spend) : null,
        })),
      };
    },
  },
  {
    name: "true_roas_ads",
    description: "Ads ranked by true revenue for a date range, with spend, Meta revenue, recovered revenue and true ROAS per ad. Good for 'which creatives should I scale or kill'.",
    inputSchema: { type: "object", properties: { limit: { type: "number", description: "Max ads. Default 30." }, ...rangeProps }, additionalProperties: false },
    handler: async (args) => {
      const { since, until, period } = await resolveArgs(args);
      const ads = await getAdAttributionTotals(since, until);
      const limit = Math.min(Math.max(Number(args.limit) || 30, 1), 100);
      return {
        period,
        totalAds: ads.length,
        ads: ads.slice(0, limit).map((a) => ({
          adId: a.adId,
          name: a.adName,
          spend: r2(a.metaSpend),
          metaRevenue: r2(a.metaRevenue),
          metaRoas: nz(a.metaRoas),
          ghlRevenue: r2(a.ghlRevenue),
          recoveredRevenue: r2(a.recoveredRevenue),
          trueRevenue: r2(a.trueRevenue),
          trueRoas: nz(a.trueRoas),
        })),
      };
    },
  },
  {
    name: "funnels",
    description: "GHL revenue and order counts by funnel and funnel step (Checkout, Upsell 1, Upsell 2, ...) for a date range.",
    inputSchema: { type: "object", properties: rangeProps, additionalProperties: false },
    handler: async (args) => {
      const { settings, since, until, period } = await resolveArgs(args);
      const [funnels, names] = await Promise.all([
        getFunnelsBreakdown(since, until),
        settings.ghlApiKey && settings.ghlLocationId ? getGhlFunnelStepNames(settings.ghlApiKey, settings.ghlLocationId) : Promise.resolve(new Map()),
      ]);
      return {
        period,
        funnels: funnels.map((f) => ({
          funnel: f.funnelName,
          revenue: r2(f.revenue),
          orders: f.transactions,
          steps: f.steps.map((s) => ({
            step: (s.stepId ? names.get(s.stepId)?.stepName : undefined) ?? (s.stepId ? `Step ${s.stepId.slice(0, 8)}` : "Unknown"),
            revenue: r2(s.revenue),
            orders: s.transactions,
          })),
        })),
      };
    },
  },
  {
    name: "organic_sales",
    description:
      "Organic sales (GHL sales Meta cannot claim) for a date range: totals, split by reason (no Meta click evidence vs returning customer after 7 days), and a list of the organic orders without any customer identity.",
    inputSchema: { type: "object", properties: { limit: { type: "number", description: "Max orders listed. Default 30." }, ...rangeProps }, additionalProperties: false },
    handler: async (args) => {
      const { settings, since, until, period } = await resolveArgs(args);
      const b = await getOrganicBreakdown(since, until);
      const names = settings.ghlApiKey && settings.ghlLocationId ? await getGhlFunnelStepNames(settings.ghlApiKey, settings.ghlLocationId) : new Map();
      const limit = Math.min(Math.max(Number(args.limit) || 30, 1), 100);
      return {
        period,
        totalGhlRevenue: r2(b.totalRevenue),
        metaDrivenRevenue: r2(b.metaRevenue),
        organicRevenue: r2(b.organicRevenue),
        organicShareOfRevenuePercent: b.totalRevenue > 0 ? r2((b.organicRevenue / b.totalRevenue) * 100) : 0,
        organicOrders: b.organicOrders,
        byReason: {
          noMetaClickEvidence: { orders: b.byReason.no_meta_signal.orders, revenue: r2(b.byReason.no_meta_signal.revenue) },
          returningCustomerAfter7Days: {
            orders: b.byReason.returning_customer_after_7_days.orders,
            revenue: r2(b.byReason.returning_customer_after_7_days.revenue),
          },
        },
        recentOrganicOrders: b.orders.slice(0, limit).map((o) => ({
          date: o.at.toISOString(),
          amount: r2(o.amount),
          funnel: o.funnelName,
          step: (o.stepId ? names.get(o.stepId)?.stepName : undefined) ?? null,
          reason: o.reason,
          daysAfterFirstPurchase: o.daysAfterFirstPurchase,
        })),
      };
    },
  },
  {
    name: "duplicates",
    description:
      "Duplicate charges in a date range: the same customer charged for the same product (funnel step) at the same price again within 24 hours. Customers are anonymous labels. Shows how much extra was charged.",
    inputSchema: { type: "object", properties: { limit: { type: "number", description: "Max duplicate groups listed. Default 40." }, ...rangeProps }, additionalProperties: false },
    handler: async (args) => {
      const { settings, since, until, period } = await resolveArgs(args);
      const rows = await getDuplicateRows(since, until);
      const groups = groupDuplicates(rows);
      const names = settings.ghlApiKey && settings.ghlLocationId ? await getGhlFunnelStepNames(settings.ghlApiKey, settings.ghlLocationId) : new Map();
      const labels = new Map<string, string>();
      const label = (id: string) => {
        if (!labels.has(id)) labels.set(id, `Customer ${labels.size + 1}`);
        return labels.get(id) as string;
      };
      const limit = Math.min(Math.max(Number(args.limit) || 40, 1), 100);
      return {
        period,
        repeatCharges: rows.length,
        customersAffected: new Set(rows.map((r) => r.contactId)).size,
        extraCharged: r2(rows.reduce((s, r) => s + r.amount, 0)),
        groups: groups.slice(0, limit).map((g) => ({
          customer: label(g.contactId),
          product: (g.stepId ? names.get(g.stepId)?.stepName : undefined) ?? g.funnelName ?? "Order",
          amountEach: r2(g.amount),
          timesCharged: g.repeats.length + 1,
          extraCharged: r2(g.extraCharged),
          originalAt: g.originalAt.toISOString(),
          repeatsAt: g.repeats.map((r) => ({ at: r.at.toISOString(), minutesAfterOriginal: r.minutesAfterOriginal })),
        })),
      };
    },
  },
  {
    name: "daily_reconciliation",
    description: "Day-by-day GHL revenue vs Meta-reported revenue (orders, purchases, gap) for the last N days.",
    inputSchema: { type: "object", properties: { days: { type: "number", description: "How many days back. Default 14, max 90." } }, additionalProperties: false },
    handler: async (args) => {
      const days = Math.min(Math.max(Number(args.days) || 14, 1), 90);
      const rows = await getDailyReconciliation(days);
      return {
        days,
        note: "gap here is total GHL revenue minus Meta revenue; organic sales are NOT removed (use overview for the like-for-like gap).",
        rows: rows.map((r) => ({
          date: formatLabelDate(r.date),
          ghlRevenue: r2(Number(r.ghlRevenue)),
          ghlOrders: r.ghlTransactions,
          metaRevenue: r2(Number(r.metaRevenue)),
          metaPurchases: r.metaPurchases,
          gap: r2(Number(r.gapAmount)),
        })),
      };
    },
  },
  {
    name: "missing_transactions",
    description: "GHL orders that look Meta-driven (utm source meta or a Meta click id) but could not be tied to a specific ad. No customer details.",
    inputSchema: { type: "object", properties: { limit: { type: "number", description: "Max rows. Default 30." } }, additionalProperties: false },
    handler: async (args) => {
      const limit = Math.min(Math.max(Number(args.limit) || 30, 1), 100);
      const rows = await getUnmatchedTransactions();
      return {
        totalNeedingReview: rows.length,
        totalAmount: r2(rows.reduce((s, r) => s + Number(r.ghlOrder.amount), 0)),
        rows: rows.slice(0, limit).map((r) => ({
          date: r.ghlOrder.occurredAt.toISOString(),
          amount: r2(Number(r.ghlOrder.amount)),
          funnel: r.ghlOrder.sourceName,
          utmSource: r.ghlOrder.contact?.utmSource ?? null,
          hasMetaClickId: !!r.ghlOrder.contact?.fbclid,
          reason: r.reason,
        })),
      };
    },
  },
];
