import Link from "next/link";
import NavBar from "../dashboard/NavBar";
import { getCampaignSummaries } from "@/lib/campaignQueries";
import { formatCurrency, formatRoas } from "@/lib/format";

export const dynamic = "force-dynamic";

const LOOKBACK_DAYS = 30;
const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "other", label: "Other" },
] as const;

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const until = new Date();
  const since = new Date(until.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const campaigns = await getCampaignSummaries(since, until);

  const status = searchParams.status ?? "all";
  const filtered = campaigns.filter((c) => {
    if (status === "all") return true;
    if (status === "active") return c.effectiveStatus === "ACTIVE";
    if (status === "paused") return c.effectiveStatus.includes("PAUSED");
    return c.effectiveStatus !== "ACTIVE" && !c.effectiveStatus.includes("PAUSED");
  });

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">Campaigns</h1>
            <p className="mt-1 text-sm text-ink-400">Last {LOOKBACK_DAYS} days · {filtered.length} campaigns</p>
          </div>
          <div className="flex items-center gap-1 rounded-2xl border border-ink-900/10 bg-white/80 p-1 shadow-sm">
            {STATUS_FILTERS.map((f) => (
              <Link
                key={f.value}
                href={`/campaigns${f.value === "all" ? "" : `?status=${f.value}`}`}
                className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                  status === f.value ? "bg-aurora-blue text-white" : "text-ink-600 hover:bg-ink-900/5"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-6 section-card overflow-x-auto">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-400">No campaigns in this range/status.</p>
          ) : (
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-ink-900/10 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <th className="py-3 pr-4">Campaign</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Spend</th>
                  <th className="py-3 pr-4">Meta ROAS</th>
                  <th className="py-3 pr-4">True ROAS</th>
                  <th className="py-3 pr-4">Recovered</th>
                  <th className="py-3 pr-4">CTR</th>
                  <th className="py-3">Purchases</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.campaignId} className="border-b border-ink-900/5 last:border-0 hover:bg-ink-900/[0.02]">
                    <td className="py-3 pr-4">
                      <Link href={`/campaigns/${c.campaignId}`} className="font-medium text-ink-900 hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={c.effectiveStatus} />
                    </td>
                    <td className="py-3 pr-4 text-ink-700">{formatCurrency(c.spend)}</td>
                    <td className="py-3 pr-4 text-ink-700">{formatRoas(c.metaRoas)}</td>
                    <td className={`py-3 pr-4 font-semibold ${c.recoveredRevenue > 0 ? "text-emerald-500" : "text-ink-900"}`}>
                      {formatRoas(c.trueRoas)}
                    </td>
                    <td className="py-3 pr-4 text-ink-700">
                      {c.recoveredRevenue > 0 ? `+${formatCurrency(c.recoveredRevenue)}` : "—"}
                    </td>
                    <td className="py-3 pr-4 text-ink-700">{c.ctr.toFixed(2)}%</td>
                    <td className="py-3 text-ink-700">{c.purchases}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "ACTIVE";
  const paused = status.includes("PAUSED");
  const color = active ? "bg-emerald-500/10 text-emerald-600" : paused ? "bg-amber-500/10 text-amber-600" : "bg-ink-900/5 text-ink-500";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{status.replaceAll("_", " ")}</span>;
}
