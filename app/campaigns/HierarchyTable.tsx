import Link from "next/link";
import { formatCurrency, formatRoas } from "@/lib/format";
import StatusBadge from "./StatusBadge";
import type { HierarchySummary } from "@/lib/campaignQueries";

// The one table used at every drill-down level (campaigns, ad sets within
// a campaign, ads within an ad set) — same columns, same look, like Ads
// Manager's own table rather than a stat-tile summary.
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
      acc.trueRevenue += r.trueRevenue;
      acc.profit += r.profit;
      acc.purchases += r.purchases;
      acc.impressions += r.impressions;
      acc.clicks += r.clicks;
      return acc;
    },
    { spend: 0, metaRevenue: 0, trueRevenue: 0, profit: 0, purchases: 0, impressions: 0, clicks: 0 }
  );
  const totalMetaRoas = totals.spend > 0 ? totals.metaRevenue / totals.spend : null;
  const totalTrueRoas = totals.spend > 0 ? totals.trueRevenue / totals.spend : null;
  const totalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-ink-400">No data in this range.</p>;
  }

  return (
    <table className="w-full min-w-[920px] text-sm">
      <thead>
        <tr className="border-b border-ink-900/10 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
          <th className="py-3 pr-4">{nameLabel}</th>
          <th className="py-3 pr-4">Status</th>
          <th className="py-3 pr-4">Spend</th>
          <th className="py-3 pr-4">Meta ROAS</th>
          <th className="py-3 pr-4">True ROAS</th>
          <th className="py-3 pr-4">Profit / Loss</th>
          <th className="py-3 pr-4">CTR</th>
          <th className="py-3">Purchases</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
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
            <td className="py-3 pr-4 text-ink-700">{formatRoas(r.metaRoas)}</td>
            <td className={`py-3 pr-4 font-semibold ${r.recoveredRevenue > 0 ? "text-emerald-500" : "text-ink-900"}`}>
              {formatRoas(r.trueRoas)}
            </td>
            <td className={`py-3 pr-4 font-semibold ${r.profit >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {r.profit >= 0 ? "+" : "−"}
              {formatCurrency(Math.abs(r.profit))}
            </td>
            <td className="py-3 pr-4 text-ink-700">{r.ctr.toFixed(2)}%</td>
            <td className="py-3 text-ink-700">{r.purchases}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-ink-900/10 text-left font-semibold">
          <td className="py-3 pr-4 text-ink-900">Total</td>
          <td className="py-3 pr-4" />
          <td className="py-3 pr-4 text-ink-900">{formatCurrency(totals.spend)}</td>
          <td className="py-3 pr-4 text-ink-900">{formatRoas(totalMetaRoas)}</td>
          <td className="py-3 pr-4 text-ink-900">{formatRoas(totalTrueRoas)}</td>
          <td className={`py-3 pr-4 ${totals.profit >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            {totals.profit >= 0 ? "+" : "−"}
            {formatCurrency(Math.abs(totals.profit))}
          </td>
          <td className="py-3 pr-4 text-ink-900">{totalCtr.toFixed(2)}%</td>
          <td className="py-3 text-ink-900">{totals.purchases}</td>
        </tr>
      </tfoot>
    </table>
  );
}
