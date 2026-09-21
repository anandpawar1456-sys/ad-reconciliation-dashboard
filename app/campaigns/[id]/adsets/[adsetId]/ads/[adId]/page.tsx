import Link from "next/link";
import { notFound } from "next/navigation";
import NavBar from "../../../../../../dashboard/NavBar";
import DateRangePicker from "../../../../../../dashboard/DateRangePicker";
import HierarchyTable from "../../../../../HierarchyTable";
import { getAdSummaries, getAdName, getAdSetName, getCampaignName, getAdCustomers } from "@/lib/campaignQueries";
import { getEarliestDataDate } from "@/lib/dashboardQueries";
import { getSettings } from "@/lib/settings";
import { resolveRange, type RangePreset } from "@/lib/dateRanges";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { formatCurrency } from "@/lib/format";
import { FUNNEL_STAGE_LABELS, type FunnelStage } from "@/lib/funnelStages";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-600",
  pending: "bg-amber-50 text-amber-600",
};

export default async function AdDetailPage({
  params,
  searchParams,
}: {
  params: { id: string; adsetId: string; adId: string };
  searchParams: { range?: string; since?: string; until?: string };
}) {
  const ad = await getAdName(params.adId);
  if (!ad) notFound();
  const adSet = await getAdSetName(params.adsetId);
  const campaignName = await getCampaignName(params.id);

  const settings = await getSettings();
  const timeZone = settings.reportingTimezone || DEFAULT_TIMEZONE;
  const earliestDataDate = (await getEarliestDataDate()) ?? new Date();

  const preset = (searchParams.range ?? "last7") as RangePreset;
  const resolved = resolveRange(preset, timeZone, earliestDataDate, searchParams.since, searchParams.until);

  const [adSummaries, customers] = await Promise.all([
    getAdSummaries(params.adsetId, resolved.since, resolved.until),
    getAdCustomers(params.adId, resolved.since, resolved.until),
  ]);
  const summaryRow = adSummaries.filter((a) => a.id === params.adId);

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-ink-400">
          <Link href="/campaigns" className="hover:text-ink-900">
            Campaigns
          </Link>
          <span>/</span>
          <Link href={`/campaigns/${params.id}`} className="hover:text-ink-900">
            {campaignName ?? params.id}
          </Link>
          <span>/</span>
          <Link href={`/campaigns/${params.id}/adsets/${params.adsetId}`} className="hover:text-ink-900">
            {adSet?.name ?? params.adsetId}
          </Link>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{ad.name}</h1>
            <p className="mt-1 text-sm text-ink-400">
              {resolved.label} · {customers.length} customer{customers.length === 1 ? "" : "s"}
            </p>
          </div>
          <DateRangePicker
            currentPreset={preset}
            currentLabel={resolved.label}
            basePath={`/campaigns/${params.id}/adsets/${params.adsetId}/ads/${params.adId}`}
          />
        </div>

        <div className="mt-6 section-card overflow-x-auto">
          <HierarchyTable rows={summaryRow} nameLabel="Ad" />
        </div>

        <h2 className="mt-10 text-lg font-bold tracking-tight text-ink-900">Customers</h2>
        <p className="mt-1 text-sm text-ink-400">GHL orders attributed to this ad via UTM/ad_id, {resolved.label.toLowerCase()}.</p>

        <div className="mt-4 section-card overflow-x-auto">
          {customers.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-400">No customers attributed to this ad in this range.</p>
          ) : (
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-ink-900/10 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Customer</th>
                  <th className="py-3 pr-4">Product</th>
                  <th className="py-3 pr-4">Funnel Stage</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.orderId} className="border-b border-ink-900/5 last:border-0 hover:bg-ink-900/[0.02]">
                    <td className="py-3 pr-4 text-ink-700">
                      {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
                        c.occurredAt
                      )}
                    </td>
                    <td className="py-3 pr-4 font-medium text-ink-900">{c.email ?? c.phone ?? c.contactId}</td>
                    <td className="py-3 pr-4 text-ink-700">{c.productName ?? "—"}</td>
                    <td className="py-3 pr-4 text-ink-700">
                      {FUNNEL_STAGE_LABELS[c.funnelStage as FunnelStage] ?? c.funnelStage}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          STATUS_STYLES[c.status] ?? "bg-ink-900/5 text-ink-600"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 font-semibold text-ink-900">{formatCurrency(c.amount)}</td>
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
