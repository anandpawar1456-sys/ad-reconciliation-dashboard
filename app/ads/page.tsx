import Link from "next/link";
import { redirect } from "next/navigation";
import NavBar from "../dashboard/NavBar";
import StatusBadge from "../campaigns/StatusBadge";
import { searchAds } from "@/lib/adLookup";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdLookupPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? "").trim();
  const results = q ? await searchAds(q) : [];

  // An exact ad id (or a single match) goes straight to that ad's history.
  const exact = results.find((r) => r.adId === q);
  if (exact || (q && results.length === 1)) redirect(`/ads/${(exact ?? results[0]).adId}`);

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">Ad Lookup</h1>
        <p className="mt-2 text-ink-400">
          Paste an ad ID (or part of an ad name) to see that creative&apos;s whole history — Meta spend and purchases, GHL
          sales tied to it by ad ID or UTM, CPA, and whether to keep or kill it.
        </p>

        <form action="/ads" method="get" className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            name="q"
            defaultValue={q}
            placeholder="Ad ID, e.g. 120250097711340107, or ad name"
            className="field-input flex-1"
            autoFocus
          />
          <button type="submit" className="btn-primary sm:w-40">
            Look up
          </button>
        </form>

        {q && results.length === 0 && (
          <div className="mt-6 section-card py-10 text-center">
            <p className="font-medium text-ink-900">No ads match &ldquo;{q}&rdquo;</p>
            <p className="mt-1 text-sm text-ink-400">Check the ID, or try part of the ad name.</p>
          </div>
        )}

        {results.length > 1 && (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-ink-400">{results.length} matches — pick one:</p>
            {results.map((r) => (
              <Link key={r.adId} href={`/ads/${r.adId}`} className="section-card block transition hover:shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-ink-900">{r.name}</span>
                  <span className="flex items-center gap-3 text-sm">
                    <StatusBadge status={r.effectiveStatus} />
                    <span className="font-semibold text-ink-900">{formatCurrency(r.spend)}</span>
                  </span>
                </div>
                <div className="mt-1 text-xs text-ink-400">
                  {r.campaignName ?? "—"} · {r.adsetName ?? "—"} · {r.adId}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
