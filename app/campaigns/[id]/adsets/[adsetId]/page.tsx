import Link from "next/link";
import { notFound } from "next/navigation";
import NavBar from "../../../../dashboard/NavBar";
import DateRangePicker from "../../../../dashboard/DateRangePicker";
import HierarchyTable from "../../../HierarchyTable";
import { getAdSummaries, getAdSetName, getCampaignName } from "@/lib/campaignQueries";
import { getEarliestDataDate } from "@/lib/dashboardQueries";
import { getSettings } from "@/lib/settings";
import { resolveRange, type RangePreset } from "@/lib/dateRanges";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function AdSetDetailPage({
  params,
  searchParams,
}: {
  params: { id: string; adsetId: string };
  searchParams: { range?: string; since?: string; until?: string };
}) {
  const adSet = await getAdSetName(params.adsetId);
  if (!adSet) notFound();
  const campaignName = await getCampaignName(params.id);

  const settings = await getSettings();
  const timeZone = settings.reportingTimezone || DEFAULT_TIMEZONE;
  const earliestDataDate = (await getEarliestDataDate()) ?? new Date();

  const preset = (searchParams.range ?? "last7") as RangePreset;
  const resolved = resolveRange(preset, timeZone, earliestDataDate, searchParams.since, searchParams.until);

  const ads = await getAdSummaries(params.adsetId, resolved.since, resolved.until);

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center gap-1.5 text-sm text-ink-400">
          <Link href="/campaigns" className="hover:text-ink-900">
            Campaigns
          </Link>
          <span>/</span>
          <Link href={`/campaigns/${params.id}`} className="hover:text-ink-900">
            {campaignName ?? params.id}
          </Link>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{adSet.name}</h1>
            <p className="mt-1 text-sm text-ink-400">
              {resolved.label} · {ads.length} ads
            </p>
          </div>
          <DateRangePicker
            currentPreset={preset}
            currentLabel={resolved.label}
            basePath={`/campaigns/${params.id}/adsets/${params.adsetId}`}
          />
        </div>

        <div className="mt-6 section-card overflow-x-auto">
          <HierarchyTable rows={ads} nameLabel="Ad" />
        </div>
      </main>
    </div>
  );
}
