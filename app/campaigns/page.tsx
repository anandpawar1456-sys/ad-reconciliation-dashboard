import Link from "next/link";
import NavBar from "../dashboard/NavBar";
import DateRangePicker from "../dashboard/DateRangePicker";
import HierarchyTable from "./HierarchyTable";
import CpaChart from "./CpaChart";
import { getCampaignSummaries, getCpaTrend } from "@/lib/campaignQueries";
import { getEarliestDataDate } from "@/lib/dashboardQueries";
import { getSettings } from "@/lib/settings";
import { resolveRange, type RangePreset } from "@/lib/dateRanges";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { formatCpa } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "other", label: "Other" },
] as const;

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: { status?: string; range?: string; since?: string; until?: string };
}) {
  const settings = await getSettings();
  const timeZone = settings.reportingTimezone || DEFAULT_TIMEZONE;
  const earliestDataDate = (await getEarliestDataDate()) ?? new Date();

  const preset = (searchParams.range ?? "last7") as RangePreset;
  const resolved = resolveRange(preset, timeZone, earliestDataDate, searchParams.since, searchParams.until);

  const campaigns = await getCampaignSummaries(resolved.since, resolved.until);
  const cpaTrend = await getCpaTrend(resolved.since, resolved.until);
  const cpaPoints = cpaTrend.map((p) => ({ label: formatShortDate(p.date), cpa: p.cpa }));
  const overallCpa =
    cpaTrend.reduce((sum, p) => sum + p.purchases, 0) > 0
      ? cpaTrend.reduce((sum, p) => sum + p.spend, 0) / cpaTrend.reduce((sum, p) => sum + p.purchases, 0)
      : null;

  const status = searchParams.status ?? "all";
  const filtered = campaigns.filter((c) => {
    if (status === "all") return true;
    if (status === "active") return c.effectiveStatus === "ACTIVE";
    if (status === "paused") return c.effectiveStatus.includes("PAUSED");
    return c.effectiveStatus !== "ACTIVE" && !c.effectiveStatus.includes("PAUSED");
  });

  const dateParams: Record<string, string> = { range: preset };
  if (searchParams.since) dateParams.since = searchParams.since;
  if (searchParams.until) dateParams.until = searchParams.until;

  function statusLinkHref(statusValue: string): string {
    const params = new URLSearchParams(dateParams);
    if (statusValue !== "all") params.set("status", statusValue);
    return `/campaigns?${params.toString()}`;
  }

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">Campaigns</h1>
            <p className="mt-1 text-sm text-ink-400">
              {resolved.label} · {filtered.length} campaigns
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-2xl border border-ink-900/10 bg-white/80 p-1 shadow-sm">
              {STATUS_FILTERS.map((f) => (
                <Link
                  key={f.value}
                  href={statusLinkHref(f.value)}
                  className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                    status === f.value ? "bg-aurora-blue text-white" : "text-ink-600 hover:bg-ink-900/5"
                  }`}
                >
                  {f.label}
                </Link>
              ))}
            </div>
            <DateRangePicker currentPreset={preset} currentLabel={resolved.label} basePath="/campaigns" />
          </div>
        </div>

        <div className="mt-6 section-card">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink-900">CPA Trend</span>
            <span className="text-xs text-ink-400">Avg CPA: {formatCpa(overallCpa)}</span>
          </div>
          <div className="mt-3">
            <CpaChart points={cpaPoints} />
          </div>
        </div>

        <div className="mt-6 section-card overflow-x-auto">
          <HierarchyTable
            rows={filtered}
            nameLabel="Campaign"
            linkBase="/campaigns"
            linkQuery={new URLSearchParams(dateParams).toString()}
          />
        </div>
      </main>
    </div>
  );
}

function formatShortDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d);
}
