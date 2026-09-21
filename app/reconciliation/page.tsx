import NavBar from "../dashboard/NavBar";
import { getDailyReconciliation } from "@/lib/dashboardQueries";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReconciliationPage() {
  const rows = await getDailyReconciliation(30);

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-14">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">Daily Reconciliation</h1>
        <p className="mt-2 text-ink-400">
          GoHighLevel revenue vs Meta&apos;s reported revenue, last 30 days. A positive gap means
          GHL shows more real revenue than Meta reported for that day.
        </p>

        <div className="mt-8 section-card overflow-x-auto">
          {rows.length === 0 ? (
            <EmptyState />
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-ink-900/10 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">GHL Revenue</th>
                  <th className="py-3 pr-4">GHL Txns</th>
                  <th className="py-3 pr-4">Meta Revenue</th>
                  <th className="py-3 pr-4">Meta Purchases</th>
                  <th className="py-3 pr-4">Gap ($)</th>
                  <th className="py-3">Gap (%)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const gapAmount = Number(row.gapAmount);
                  const gapPercent = Number(row.gapPercent);
                  const positive = gapAmount > 0;
                  return (
                    <tr key={row.date.toISOString()} className="border-b border-ink-900/5 last:border-0">
                      <td className="py-3 pr-4 font-medium text-ink-900">{formatDate(row.date)}</td>
                      <td className="py-3 pr-4 text-ink-700">{formatCurrency(Number(row.ghlRevenue))}</td>
                      <td className="py-3 pr-4 text-ink-700">{row.ghlTransactions}</td>
                      <td className="py-3 pr-4 text-ink-700">{formatCurrency(Number(row.metaRevenue))}</td>
                      <td className="py-3 pr-4 text-ink-700">{row.metaPurchases}</td>
                      <td className={`py-3 pr-4 font-semibold ${positive ? "text-orange-500" : "text-ink-700"}`}>
                        {formatCurrency(gapAmount)}
                      </td>
                      <td className={`py-3 font-semibold ${positive ? "text-orange-500" : "text-ink-700"}`}>
                        {gapPercent.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-400 to-blue-500 shadow-sm" />
      <p className="mt-4 font-medium text-ink-900">No reconciliation data yet</p>
      <p className="mt-1 text-sm text-ink-400">
        This fills in once GHL orders and Meta insights start syncing.
      </p>
    </div>
  );
}
