import NavBar from "../dashboard/NavBar";
import { getAdAttributionTotals } from "@/lib/dashboardQueries";
import { formatCurrency, formatRoas } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TrueRoasPage() {
  const ads = await getAdAttributionTotals(30);

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-14">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">True ROAS</h1>
        <p className="mt-2 text-ink-400">
          Meta&apos;s reported ROAS next to a corrected true ROAS that adds in GHL revenue
          confirmed for that ad but missing from Meta&apos;s own reporting. Last 30 days.
        </p>

        <div className="mt-8 section-card overflow-x-auto">
          {ads.length === 0 ? (
            <EmptyState />
          ) : (
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-ink-900/10 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <th className="py-3 pr-4">Ad</th>
                  <th className="py-3 pr-4">Spend</th>
                  <th className="py-3 pr-4">Meta Revenue</th>
                  <th className="py-3 pr-4">Reported ROAS</th>
                  <th className="py-3 pr-4">Recovered</th>
                  <th className="py-3 pr-4">True Revenue</th>
                  <th className="py-3">True ROAS</th>
                </tr>
              </thead>
              <tbody>
                {ads.map((ad) => {
                  const lift = ad.recoveredRevenue > 0;
                  return (
                    <tr key={ad.adId} className="border-b border-ink-900/5 last:border-0">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-ink-900">{ad.adName ?? ad.adId}</div>
                        <div className="text-xs text-ink-400">{ad.adId}</div>
                      </td>
                      <td className="py-3 pr-4 text-ink-700">{formatCurrency(ad.metaSpend)}</td>
                      <td className="py-3 pr-4 text-ink-700">{formatCurrency(ad.metaRevenue)}</td>
                      <td className="py-3 pr-4 text-ink-700">{formatRoas(ad.metaRoas)}</td>
                      <td className={`py-3 pr-4 font-semibold ${lift ? "text-emerald-500" : "text-ink-400"}`}>
                        {lift ? `+${formatCurrency(ad.recoveredRevenue)}` : "—"}
                      </td>
                      <td className="py-3 pr-4 font-medium text-ink-900">{formatCurrency(ad.trueRevenue)}</td>
                      <td className={`py-3 font-bold ${lift ? "text-emerald-500" : "text-ink-900"}`}>
                        {formatRoas(ad.trueRoas)}
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
      <div className="mx-auto h-10 w-10 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-500 shadow-sm" />
      <p className="mt-4 font-medium text-ink-900">No ad attribution data yet</p>
      <p className="mt-1 text-sm text-ink-400">
        This fills in once GHL orders are linked to ads and Meta insights sync.
      </p>
    </div>
  );
}
