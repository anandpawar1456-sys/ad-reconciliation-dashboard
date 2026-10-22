"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatRoas, formatCpa } from "@/lib/format";
import StatusBadge from "./StatusBadge";
import type { HierarchySummary } from "@/lib/campaignQueries";
import type { BudgetStatus } from "@/lib/budget";

// The one table used at every drill-down level (campaigns, ad sets within
// a campaign, ads within an ad set) — same columns, same look, like Ads
// Manager's own table rather than a stat-tile summary. Column set matches
// what /true-roas shows (Spend, Meta Revenue, Reported ROAS, Recovered,
// True Revenue, True ROAS) plus the extra fields specific to this view
// (Status, GHL/Meta P/L, CTR, Purchases, Unique Link Clicks). Rows are
// selectable (checkbox, highlighted) with a toggle to filter down to just
// the selected ones — selection is per-page-view only, not persisted.
export default function HierarchyTable({
  rows,
  nameLabel,
  linkBase,
  linkQuery,
}: {
  rows: HierarchySummary[];
  nameLabel: string;
  // Plain strings, not a function — Server Components can't pass functions
  // to Client Components. href per row = `${linkBase}/${id}?${linkQuery}`.
  linkBase?: string;
  linkQuery?: string;
}) {
  const linkFor = linkBase ? (id: string) => `${linkBase}/${id}${linkQuery ? `?${linkQuery}` : ""}` : undefined;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterToSelected, setFilterToSelected] = useState(false);

  // Guard against a stale filter: if every selected row gets unchecked
  // without hitting "Clear", filterToSelected can stay true with an empty
  // selection, which would otherwise render an empty, all-zero table with
  // no visible way back (the "N selected" banner disappears at 0).
  const visibleRows = filterToSelected && selected.size > 0 ? rows.filter((r) => selected.has(r.id)) : rows;

  const totals = useMemo(
    () =>
      visibleRows.reduce(
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
      ),
    [visibleRows]
  );
  const totalMetaRoas = totals.spend > 0 ? totals.metaRevenue / totals.spend : null;
  const totalTrueRoas = totals.spend > 0 ? totals.trueRevenue / totals.spend : null;
  const totalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const totalCpa = totals.purchases > 0 ? totals.spend / totals.purchases : null;
  const totalBudget = visibleRows.reduce((sum, r) => sum + (r.budget && r.budget.type === "daily" ? r.budget.amount : 0), 0);

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setFilterToSelected(false);
      return next;
    });
  }

  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-ink-400">No data in this range.</p>;
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-indigo-50 px-3 py-2 text-sm">
          <span className="font-medium text-ink-700">{selected.size} selected</span>
          <button
            onClick={() => setFilterToSelected((v) => !v)}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
              filterToSelected ? "bg-aurora-blue text-white" : "bg-white text-ink-700 hover:bg-ink-900/5"
            }`}
          >
            {filterToSelected ? "Showing selected only" : "Filter to selected rows"}
          </button>
          <button
            onClick={() => {
              setSelected(new Set());
              setFilterToSelected(false);
            }}
            className="text-xs font-medium text-ink-400 hover:text-ink-700"
          >
            Clear
          </button>
        </div>
      )}

      <table className="w-full min-w-[1800px] text-sm">
        <thead>
          <tr className="border-b border-ink-900/10 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
            <th className="py-3 pr-2 w-8" />
            <th className="py-3 pr-4">{nameLabel}</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 pr-4">Spend</th>
            <th className="py-3 pr-4">Budget</th>
            <th className="py-3 pr-4">Meta Revenue</th>
            <th className="py-3 pr-4">Reported ROAS</th>
            <th className="py-3 pr-4">Recovered</th>
            <th className="py-3 pr-4">True Revenue</th>
            <th className="py-3 pr-4">True ROAS</th>
            <th className="py-3 pr-4">GHL P/L</th>
            <th className="py-3 pr-4">Meta P/L</th>
            <th className="py-3 pr-4">CTR</th>
            <th className="py-3 pr-4">Purchases</th>
            <th className="py-3 pr-4">Unique Link Clicks</th>
            <th className="py-3">CPA</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((r) => {
            const lift = r.recoveredRevenue > 0;
            const isSelected = selected.has(r.id);
            return (
              <tr
                key={r.id}
                className={`border-b border-ink-900/5 last:border-0 ${
                  isSelected ? "bg-indigo-50/70" : "hover:bg-ink-900/[0.02]"
                }`}
              >
                <td className="py-3 pr-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleRow(r.id)}
                    className="h-4 w-4 rounded border-ink-900/20 accent-indigo-500"
                    aria-label={`Select ${r.name}`}
                  />
                </td>
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
                <td className="py-3 pr-4">
                  <BudgetCell b={r.budget} />
                </td>
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
                <td className="py-3 pr-4 text-ink-700">{r.uniqueLinkClicks.toLocaleString()}</td>
                <td className="py-3 text-ink-700">{formatCpa(r.cpa)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-ink-900/10 text-left font-semibold">
            <td className="py-3 pr-2" />
            <td className="py-3 pr-4 text-ink-900">Total</td>
            <td className="py-3 pr-4" />
            <td className="py-3 pr-4 text-ink-900">{formatCurrency(totals.spend)}</td>
            <td className="py-3 pr-4 text-ink-900">{totalBudget > 0 ? `${formatCurrency(totalBudget)}/day` : ""}</td>
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
            <td className="py-3 pr-4 text-ink-900">{totals.uniqueLinkClicks.toLocaleString()}</td>
            <td className="py-3 text-ink-900">{formatCpa(totalCpa)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const money = (n: number) => formatCurrency(n).replace(/\.00$/, "");

// Current budget with how long it has been the same, or what it just changed from.
function BudgetCell({ b }: { b: BudgetStatus | null }) {
  if (!b) return <span className="text-ink-400">-</span>;
  const unit = b.type === "daily" ? "/day" : " lifetime";
  const days = b.unchangedDays;
  const recentChange = days !== null && days <= 3 && b.lastChangeFrom !== null && b.lastChangeTo !== null;
  const raised = recentChange && (b.lastChangeTo as number) >= (b.lastChangeFrom as number);

  return (
    <div className="leading-tight">
      <div className="font-semibold text-ink-900">
        {money(b.amount)}
        <span className="font-medium text-ink-400">{unit}</span>
        {b.source === "adsets" && <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">ad sets</span>}
      </div>
      <div className={`mt-0.5 text-xs font-semibold ${recentChange ? (raised ? "text-emerald-600" : "text-rose-500") : "text-ink-400"}`}>
        {recentChange
          ? `${raised ? "▲" : "▼"} from ${money(b.lastChangeFrom as number)} · ${days === 0 ? "today" : `${days}d ago`}`
          : days !== null
            ? `same for ${days} day${days === 1 ? "" : "s"}`
            : "no change on record"}
      </div>
    </div>
  );
}
