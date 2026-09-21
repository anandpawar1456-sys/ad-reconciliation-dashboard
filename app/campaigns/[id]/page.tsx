import Link from "next/link";
import { notFound } from "next/navigation";
import NavBar from "../../dashboard/NavBar";
import DateRangePicker from "../../dashboard/DateRangePicker";
import HierarchyTable from "../HierarchyTable";
import { getAdSetSummaries, getCampaignName } from "@/lib/campaignQueries";
import { getEarliestDataDate } from "@/lib/dashboardQueries";
import { getSettings } from "@/lib/settings";
import { resolveRange, type RangePreset } from "@/lib/dateRanges";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { range?: string; since?: string; until?: string };
}) {
  const campaignName = await getCampaignName(params.id);
  if (!campaignName) notFound();

  const settings = await getSettings();
  const timeZone = settings.reportingTimezone || DEFAULT_TIMEZONE;
  const earliestDataDate = (await getEarliestDataDate()) ?? new Date();

  const preset = (searchParams.range ?? "last7") as RangePreset;
  const resolved = resolveRange(preset, timeZone, earliestDataDate, searchParams.since, searchParams.until);

  const adSets = await getAdSetSummaries(params.id, resolved.since, resolved.until);

  const dateParams: Record<string, string> = { range: preset };
  if (searchParams.since) dateParams.since = searchParams.since;
  if (searchParams.until) dateParams.until = searchParams.until;

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link href="/campaigns" className="text-sm text-ink-400 hover:text-ink-900">
          ← Campaigns
        </Link>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{campaignName}</h1>
            <p className="mt-1 text-sm text-ink-400">
              {resolved.label} · {adSets.length} ad sets
            </p>
          </div>
          <DateRangePicker currentPreset={preset} currentLabel={resolved.label} basePath={`/campaigns/${params.id}`} />
        </div>

        <div className="mt-6 section-card overflow-x-auto">
          <HierarchyTable
            rows={adSets}
            nameLabel="Ad Set"
            linkFor={(id) => `/campaigns/${params.id}/adsets/${id}?${new URLSearchParams(dateParams).toString()}`}
          />
        </div>
      </main>
    </div>
  );
}
