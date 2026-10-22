import { formatCurrency, formatRoas } from "@/lib/format";
import type { BudgetChangeView, WindowStats } from "@/lib/budget";

const money = (n: number) => formatCurrency(n).replace(/\.00$/, "");

function pctChange(before: number | null, after: number | null): number | null {
  return before !== null && after !== null && before > 0 ? ((after - before) / before) * 100 : null;
}

function Chip({ label, pct, goodWhenUp }: { label: string; pct: number | null; goodWhenUp: boolean }) {
  if (pct === null) return <span className="text-xs text-ink-400">{label} n/a</span>;
  const flat = Math.abs(pct) < 10;
  const good = goodWhenUp ? pct > 0 : pct < 0;
  const tone = flat ? "bg-ink-900/5 text-ink-500" : good ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${tone}`}>
      {label} {pct > 0 ? "+" : "-"}
      {Math.abs(Math.round(pct))}%
    </span>
  );
}

function Window({ w }: { w: WindowStats }) {
  if (w.days === 0) return <span className="text-xs text-ink-400">No completed days yet</span>;
  return (
    <div className="leading-snug">
      <div className="text-sm font-semibold text-ink-900">
        {w.avgDailySpend !== null ? `${money(w.avgDailySpend)}/day spend` : "-"}
      </div>
      <div className="text-xs text-ink-500">
        ROAS {formatRoas(w.trueRoas)} · CPA {w.cpa !== null ? formatCurrency(w.cpa) : "-"}
      </div>
      {w.days < 3 && <div className="text-[11px] font-semibold text-amber-600">{w.days} of 3 days so far</div>}
    </div>
  );
}

// Every budget raise/cut in the period, with the 3 days before vs the 3 days
// after, so it's clear whether a change helped or hurt.
export default function BudgetChanges({
  changes,
  periodLabel,
  timeZone,
}: {
  changes: BudgetChangeView[];
  periodLabel: string;
  timeZone: string;
}) {
  const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone });

  return (
    <div className="mt-6 section-card overflow-x-auto">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-extrabold text-ink-900">Budget changes</h2>
        <span className="text-sm font-semibold text-ink-400">
          {periodLabel} · {changes.length} change{changes.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-400">
        Spend, true ROAS and CPA for the 3 completed days before vs the 3 days after each change. A change made just
        after midnight counts its own day as &quot;after&quot;.
      </p>

      {changes.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-400">No budget changes in this range.</p>
      ) : (
        <table className="mt-3 w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-ink-900/10 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
              <th className="py-2 pr-4">When</th>
              <th className="py-2 pr-4">Changed</th>
              <th className="py-2 pr-4">Budget</th>
              <th className="py-2 pr-4">Before (3 days)</th>
              <th className="py-2 pr-4">After (3 days)</th>
              <th className="py-2">Result</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c) => {
              const raised = c.direction === "raise";
              const unit = c.budgetType === "daily" ? "/day" : " lifetime";
              return (
                <tr key={c.id} className="border-b border-ink-900/5 align-top last:border-0">
                  <td className="py-3 pr-4 text-ink-700">{when.format(c.at)}</td>
                  <td className="max-w-[260px] py-3 pr-4">
                    <div className="truncate font-semibold text-ink-900" title={c.objectName}>
                      {c.objectName}
                    </div>
                    <div className="truncate text-xs text-ink-400">
                      {c.level === "campaign" ? "Campaign" : `Ad set${c.campaignName ? ` · ${c.campaignName}` : ""}`}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="font-semibold text-ink-900">
                      {money(c.oldBudget)} → {money(c.newBudget)}
                      <span className="font-medium text-ink-400">{unit}</span>
                    </div>
                    <div className={`text-xs font-bold ${raised ? "text-emerald-600" : "text-rose-500"}`}>
                      {raised ? "▲ Raised" : "▼ Cut"} {Math.abs(Math.round(c.changePercent))}%
                    </div>
                    <div className="text-[11px] text-ink-400">
                      {c.oldBudgetLastedDays === null
                        ? "first change on record"
                        : `old budget lasted ${c.oldBudgetLastedDays} day${c.oldBudgetLastedDays === 1 ? "" : "s"}`}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <Window w={c.before} />
                  </td>
                  <td className="py-3 pr-4">
                    <Window w={c.after} />
                    {c.nextChangeInAfterWindowAt && (
                      <div className="mt-1 text-[11px] font-semibold text-amber-600">
                        Budget changed again {when.format(c.nextChangeInAfterWindowAt)}, so this result is mixed
                      </div>
                    )}
                  </td>
                  <td className="py-3">
                    {c.before.days > 0 && c.after.days > 0 ? (
                      <div className="flex flex-col items-start gap-1">
                        <Chip label="Spend" pct={pctChange(c.before.avgDailySpend, c.after.avgDailySpend)} goodWhenUp />
                        <Chip label="ROAS" pct={pctChange(c.before.trueRoas, c.after.trueRoas)} goodWhenUp />
                        <Chip label="CPA" pct={pctChange(c.before.cpa, c.after.cpa)} goodWhenUp={false} />
                      </div>
                    ) : (
                      <span className="text-xs text-ink-400">Waiting for more days</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
