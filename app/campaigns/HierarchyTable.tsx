import Link from "next/link";
import { formatCurrency, formatRoas } from "@/lib/format";
import StatusBadge from "./StatusBadge";
import type { HierarchySummary } from "@/lib/campaignQueries";

// The one table used at every drill-down level (campaigns, ad sets within
// a campaign, ads within an ad set) — same columns, same look, like Ads
// Manager's own table rather than a stat-tile summary. Column set matches
// what /true-roas shows (Spend, Meta Revenue, Reported ROAS, Recovered,
// True Revenue, True ROAS) plus the extra fields specific to this view
// (Status, GHL/Meta P/L, CTR, Purchases, Unique Link Clicks).
export default function HierarchyTable({
  rows,
  nameLabel,
  linkFor,
}: {
  rows: HierarchySummary[];
  nameLabel: string;
  linkFor?: (id: string) => string;
}) {
  const totals = rows.reduce(
    (acc, r) => {
      acc.spend += r.spend;
      acc.metaRevenue += r.metaRevenue;
      acc.recoveredRevenue += r.recoveredRevenue;
      acc.trueRevenue += r.trueRevenue;
      acc.ghlProfit += r.ghlProfit;
      acc.metaProfit += r.metaProfit;
      acc.purchases += r.purchases;
      acc.impressions += r.impressions;
      acc.clicks += r.clicks;
      acc.uniqueLinkClicks += r.uniqueLinkClicks;
      return acc;
    },
    {
      spend: 0,
      metaRevenue: 0,
      recoveredRevenue: 0,
      trueRevenue: 0,
      ghlProfit: 0,
      metaProfit: 0,
      purchases: 0,
      impressions: 0,
      clicks: 0,
      uniqueLinkClicks: 0,
    }
  );
  const totalMetaRoas = totals.spend > 0 ? totals.metaRevenue / totals.spend : null;
  const totalTrueRoas = totals.spend > 0 ? totals.trueRevenue / totals.spend : null;
  const totalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-ink-400">No data in this range.</p>;
  }

  return (
    <table className="w-full min-w-[1520px] text-sm">
      <thead>
        <tr className="border-b border-ink-900/10 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
          <th className="py-3 pr-4">{nameLabel}</th>
          <th className="py-3 pr-4">Status</th>
          <th className="py-3 pr-4">Spend</th>
          <th className="py-3 pr-4">Meta Revenue</th>
          <th className="py-3 pr-4">Reported ROAS</th>
          <th className="py-3 pr-4">Recovered</th>
          <th className="py-3 pr-4">True Revenue</th>
          <th className="py-3 pr-4">True ROAS</th>
          <th className="py-3 pr-4">GHL P/L</th>
          <th className="py-3 pr-4">Meta P/L</th>
          <th className="py-3 pr-4">CTR</th>
          <th className="py-3 pr-4">Purchases</th>
          <th className="py-3">Unique Link Clicks</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const lift = r.recoveredRevenue > 0;
          return (
            <tr key={r.id} className="border-b border-ink-900/5 last:border-0 hover:bg-ink-900/[0.02]">
              <td className="py-3 pr-4">
                {linkFor ? (
                  <Link href={linkFor(r.id)} className="font-medium text-ink-900 hover:underline">
                    {r.name}
                  </Link>
                ) : (
                  <span className="font-medium text-ink-900">{r.name}</span>
                )}
              </td>
              <td className="py-3 pr-4">
                <StatusBadge status={r.effectiveStatus} />
              </td>
              <td className="py-3 pr-4 text-ink-700">{formatCurrency(r.spend)}</td>
              <td className="py-3 pr-4 text-ink-700">{formatCurrency(r.metaRevenue)}</td>
              <td className="py-3 pr-4 text-ink-700">{formatRoas(r.metaRoas)}</td>
              <td className={`py-3 pr-4 font-semibold ${lift ? "text-emerald-500" : "text-ink-400"}`}>
                {lift ? `+${formatCurrency(r.recoveredRevenue)}` : "—"}
              </td>
              <td className="py-3 pr-4 font-medium text-ink-900">{formatCurrency(r.trueRevenue)}</td>
              <td className={`py-3 pr-4 font-semibold ${lift ? "text-emerald-500" : "text-ink-900"}`}>
                {formatRoas(r.trueRoas)}
              </td>
              <td className={`py-3 pr-4 font-semibold ${r.ghlProfit >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {r.ghlProfit >= 0 ? "+" : "−"}
                {formatCurrency(Math.abs(r.ghlProfit))}
              </td>
              <td className={`py-3 pr-4 ${r.metaProfit >= 0 ? "text-emerald-500/70" : "text-rose-500/70"}`}>
                {r.metaProfit >= 0 ? "+" : "−"}
                {formatCurrency(Math.abs(r.metaProfit))}
              </td>
              <td className="py-3 pr-4 text-ink-700">{r.ctr.toFixed(2)}%</td>
              <td className="py-3 pr-4 text-ink-700">{r.purchases}</td>
              <td className="py-3 text-ink-700">{r.uniqueLinkClicks.toLocaleString()}</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-ink-900/10 text-left font-semibold">
          <td className="py-3 pr-4 text-ink-900">Total</td>
          <td className="py-3 pr-4" />
          <td className="py-3 pr-4 text-ink-900">{formatCurrency(totals.spend)}</td>
          <td className="py-3 pr-4 text-ink-900">{formatCurrency(totals.metaRevenue)}</td>
          <td className="py-3 pr-4 text-ink-900">{formatRoas(totalMetaRoas)}</td>
          <td className="py-3 pr-4 text-emerald-500">
            {totals.recoveredRevenue > 0 ? `+${formatCurrency(totals.recoveredRevenue)}` : "—"}
          </td>
          <td className="py-3 pr-4 text-ink-900">{formatCurrency(totals.trueRevenue)}</td>
          <td className="py-3 pr-4 text-ink-900">{formatRoas(totalTrueRoas)}</td>
          <td className={`py-3 pr-4 ${totals.ghlProfit >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            {totals.ghlProfit >= 0 ? "+" : "−"}
            {formatCurrency(Math.abs(totals.ghlProfit))}
          </td>
          <td className={`py-3 pr-4 ${totals.metaProfit >= 0 ? "text-emerald-500/70" : "text-rose-500/70"}`}>
            {totals.metaProfit >= 0 ? "+" : "−"}
            {formatCurrency(Math.abs(totals.metaProfit))}
          </td>
          <td className="py-3 pr-4 text-ink-900">{totalCtr.toFixed(2)}%</td>
          <td className="py-3 pr-4 text-ink-900">{totals.purchases}</td>
          <td className="py-3 text-ink-900">{totals.uniqueLinkClicks.toLocaleString()}</td>
        </tr>
      </tfoot>
    </table>
  );
}
