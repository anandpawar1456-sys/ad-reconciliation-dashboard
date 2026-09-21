import NavBar from "../dashboard/NavBar";
import { getUnmatchedTransactions } from "@/lib/dashboardQueries";
import { formatCurrency, formatDate } from "@/lib/format";
import ReviewActions from "./ReviewActions";

export const dynamic = "force-dynamic";

export default async function MissingTransactionsPage() {
  const items = await getUnmatchedTransactions();

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">Missing Transactions</h1>
        <p className="mt-2 text-ink-400">
          GHL orders that look Meta-driven (utm_source=meta or an fbclid was captured) but
          couldn&apos;t be tied to a specific ad — worth a manual look.
        </p>

        <div className="mt-8 space-y-3">
          {items.length === 0 ? (
            <div className="section-card py-12 text-center">
              <div className="mx-auto h-10 w-10 rounded-2xl bg-gradient-to-br from-rose-400 to-orange-500 shadow-sm" />
              <p className="mt-4 font-medium text-ink-900">Nothing needs review</p>
              <p className="mt-1 text-sm text-ink-400">
                Every Meta-driven order so far has a clean ad attribution.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="section-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-ink-900">
                      {formatCurrency(Number(item.ghlOrder.amount))} — {item.ghlOrder.productName ?? "Unnamed product"}
                    </div>
                    <div className="mt-1 text-sm text-ink-500">
                      {item.ghlOrder.contact?.email ?? "Unknown contact"} ·{" "}
                      {formatDate(item.ghlOrder.occurredAt)}
                    </div>
                    <div className="mt-1 text-xs text-ink-400">
                      utm_source: {item.ghlOrder.contact?.utmSource ?? "—"} · fbclid captured:{" "}
                      {item.ghlOrder.contact?.fbclid ? "yes" : "no"}
                    </div>
                  </div>
                  <ReviewActions id={item.id} />
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
