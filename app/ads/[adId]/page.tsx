import Link from "next/link";
import { notFound } from "next/navigation";
import NavBar from "../../dashboard/NavBar";
import StatusBadge from "../../campaigns/StatusBadge";
import { getAdHistory, type AdTotals, type Verdict } from "@/lib/adLookup";
import { formatCurrency, formatRoas, formatCpa, formatLabelDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const VERDICT_STYLES: Record<Verdict["level"], string> = {
  keep: "bg-emerald-50 text-emerald-700 border-emerald-200",
  watch: "bg-amber-50 text-amber-700 border-amber-200",
  kill: "bg-rose-50 text-rose-700 border-rose-200",
  nodata: "bg-ink-900/5 text-ink-600 border-ink-900/10",
};

export default async function AdHistoryPage({ params }: { params: { adId: string } }) {
  const ad = await getAdHistory(params.adId);
  if (!ad) notFound();

  const L = ad.lifetime;
  const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Link href="/ads" className="text-sm text-ink-400 hover:text-ink-900">
          ← Ad Lookup
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-extrabold tracking-tight text-ink-900">{ad.name}</h1>
            <p className="mt-1 break-words text-sm text-ink-400">
              {ad.campaignName ?? "Unknown campaign"} · {ad.adsetName ?? "Unknown ad set"} · ID {ad.adId}
            </p>
            <p className="mt-1 text-xs text-ink-400">
              {ad.firstDate
                ? `Spent on ${ad.activeDays} day${ad.activeDays === 1 ? "" : "s"}, ${dateFmt.format(ad.firstDate)} – ${dateFmt.format(ad.lastDate as Date)}`
                : "No spend recorded yet"}
            </p>
          </div>
          <StatusBadge status={ad.status} />
        </div>

        <div className={`mt-5 rounded-2xl border p-4 ${VERDICT_STYLES[ad.verdict.level]}`}>
          <div className="text-lg font-extrabold">{ad.verdict.label}</div>
          <ul className="mt-1 space-y-0.5 text-sm">
            {ad.verdict.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Tile label="Spend" value={formatCurrency(L.spend)} />
          <Tile label="Meta revenue" value={formatCurrency(L.metaRevenue)} sub={`${L.metaPurchases} purchases · ${formatRoas(L.metaRoas)}`} />
          <Tile label="GHL sales (this ad)" value={formatCurrency(L.ghlRevenue)} sub={`${L.ghlOrders} orders`} />
          <Tile label="True revenue" value={formatCurrency(L.trueRevenue)} sub={`+${formatCurrency(L.recoveredRevenue)} recovered`} />
          <Tile label="True ROAS" value={formatRoas(L.trueRoas)} />
          <Tile
            label={L.profit >= 0 ? "Profit" : "Loss"}
            value={formatCurrency(Math.abs(L.profit))}
            tone={L.profit >= 0 ? "good" : "bad"}
          />
          <Tile label="CPA (Meta purchases)" value={formatCpa(L.metaCpa)} />
          <Tile label="CPA (GHL orders)" value={formatCpa(L.ghlCpa)} />
        </div>

        <div className="mt-5 section-card overflow-x-auto">
          <h2 className="text-sm font-semibold text-ink-900">Lifetime vs last 7 days</h2>
          <table className="mt-3 w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-ink-900/10 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                <th className="py-2 pr-4" />
                <th className="py-2 pr-4">Spend</th>
                <th className="py-2 pr-4">True revenue</th>
                <th className="py-2 pr-4">True ROAS</th>
                <th className="py-2 pr-4">CPA (Meta)</th>
                <th className="py-2">CPA (GHL)</th>
              </tr>
            </thead>
            <tbody>
              <CompareRow label="Lifetime" t={L} />
              <CompareRow label="Last 7 days" t={ad.last7} />
            </tbody>
          </table>
        </div>

        <div className="mt-5 section-card overflow-x-auto">
          <h2 className="text-sm font-semibold text-ink-900">Day by day</h2>
          {ad.daily.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">No daily data yet.</p>
          ) : (
            <table className="mt-3 w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-ink-900/10 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Spend</th>
                  <th className="py-2 pr-4">Meta purch.</th>
                  <th className="py-2 pr-4">Meta rev.</th>
                  <th className="py-2 pr-4">GHL orders</th>
                  <th className="py-2 pr-4">GHL rev.</th>
                  <th className="py-2 pr-4">True ROAS</th>
                  <th className="py-2">CPA</th>
                </tr>
              </thead>
              <tbody>
                {[...ad.daily].reverse().map((d) => (
                  <tr key={d.date.toISOString()} className="border-b border-ink-900/5 last:border-0">
                    <td className="py-2 pr-4 font-medium text-ink-900">{formatLabelDate(d.date)}</td>
                    <td className="py-2 pr-4 text-ink-700">{formatCurrency(d.spend)}</td>
                    <td className="py-2 pr-4 text-ink-700">{d.metaPurchases}</td>
                    <td className="py-2 pr-4 text-ink-700">{formatCurrency(d.metaRevenue)}</td>
                    <td className="py-2 pr-4 text-ink-700">{d.ghlOrders}</td>
                    <td className="py-2 pr-4 text-ink-700">{formatCurrency(d.ghlRevenue)}</td>
                    <td className="py-2 pr-4 font-semibold text-ink-900">{formatRoas(d.spend > 0 ? d.trueRevenue / d.spend : null)}</td>
                    <td className="py-2 text-ink-700">{formatCpa(d.metaPurchases > 0 ? d.spend / d.metaPurchases : null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-5 section-card overflow-x-auto">
          <h2 className="text-sm font-semibold text-ink-900">Customers who bought from this ad</h2>
          <p className="mt-1 text-xs text-ink-400">
            GHL orders tied to this ad by the ad_id URL parameter, or matched from UTM ids/names. Latest 50.
          </p>
          {ad.customers.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">No GHL sales attributed to this ad.</p>
          ) : (
            <table className="mt-3 w-full min-w-[560px] text-sm">
              <tbody>
                {ad.customers.map((c) => (
                  <tr key={c.orderId} className="border-b border-ink-900/5 last:border-0">
                    <td className="py-2 pr-4 text-ink-400">
                      {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(c.when)}
                    </td>
                    <td className="py-2 pr-4 font-medium text-ink-900">{c.email ?? "Unknown contact"}</td>
                    <td className="py-2 pr-4 text-ink-700">{c.funnel ?? "—"}</td>
                    <td className="py-2 text-right font-semibold text-ink-900">{formatCurrency(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {ad.campaignId && ad.adsetId && (
          <p className="mt-5 text-sm">
            <Link
              href={`/campaigns/${ad.campaignId}/adsets/${ad.adsetId}`}
              className="font-medium text-indigo-600 hover:underline"
            >
              View this ad&apos;s ad set in Campaigns →
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="section-card">
      <div
        className={`text-xl font-extrabold tracking-tight ${
          tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : "text-ink-900"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-400">{sub}</div>}
    </div>
  );
}

function CompareRow({ label, t }: { label: string; t: AdTotals }) {
  return (
    <tr className="border-b border-ink-900/5 last:border-0">
      <td className="py-2 pr-4 font-medium text-ink-900">{label}</td>
      <td className="py-2 pr-4 text-ink-700">{formatCurrency(t.spend)}</td>
      <td className="py-2 pr-4 text-ink-700">{formatCurrency(t.trueRevenue)}</td>
      <td className="py-2 pr-4 font-semibold text-ink-900">{formatRoas(t.trueRoas)}</td>
      <td className="py-2 pr-4 text-ink-700">{formatCpa(t.metaCpa)}</td>
      <td className="py-2 text-ink-700">{formatCpa(t.ghlCpa)}</td>
    </tr>
  );
}
