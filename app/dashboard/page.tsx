import NavBar from "./NavBar";

const UPCOMING_SECTIONS = [
  {
    title: "Daily Reconciliation",
    detail: "GHL vs Meta revenue/transactions, gap $ and %.",
    accent: "from-indigo-400 to-blue-500",
  },
  {
    title: "True ROAS",
    detail: "Reported vs corrected ROAS per ad/ad set/campaign.",
    accent: "from-violet-400 to-purple-500",
  },
  {
    title: "Funnel Breakdown",
    detail: "Revenue and transactions by funnel stage.",
    accent: "from-fuchsia-400 to-pink-500",
  },
  {
    title: "Missing Transactions",
    detail: "GHL orders with no matching Meta purchase event.",
    accent: "from-rose-400 to-orange-500",
  },
];

export default function DashboardPage() {
  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          Overview
        </h1>
        <p className="mt-2 text-ink-400">
          Ingestion and the matching engine aren&apos;t live yet — these
          panels will populate once GHL and Meta data start flowing in.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {UPCOMING_SECTIONS.map((section) => (
            <div key={section.title} className="section-card group">
              <div
                className={`h-9 w-9 rounded-xl bg-gradient-to-br ${section.accent} shadow-sm transition group-hover:shadow-glow`}
              />
              <div className="mt-4 font-semibold text-ink-900">{section.title}</div>
              <div className="mt-1 text-sm text-ink-400">{section.detail}</div>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink-900/5 px-2.5 py-1 text-xs font-medium text-ink-500">
                <span className="h-1.5 w-1.5 rounded-full bg-ink-400" />
                Waiting on data
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
