import Link from "next/link";
import LogoutButton from "./LogoutButton";

const UPCOMING_SECTIONS = [
  { title: "Daily Reconciliation", detail: "GHL vs Meta revenue/transactions, gap $ and %." },
  { title: "True ROAS", detail: "Reported vs corrected ROAS per ad/ad set/campaign." },
  { title: "Funnel Breakdown", detail: "Revenue and transactions by funnel stage." },
  { title: "Missing Transactions", detail: "GHL orders with no matching Meta purchase event." },
  { title: "Settings", detail: "GHL/Meta API keys, alert threshold, product-to-funnel-stage mapping." },
];

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ad Reconciliation Dashboard</h1>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/settings" className="text-slate-400 hover:text-slate-200">
            Settings
          </Link>
          <LogoutButton />
        </div>
      </div>
      <p className="mt-2 text-slate-400">
        Project scaffold is up. Data pages below will fill in as ingestion and
        the matching engine come online.
      </p>
      <ul className="mt-8 space-y-3">
        {UPCOMING_SECTIONS.map((section) => (
          <li key={section.title} className="rounded-lg border border-slate-800 p-4">
            <div className="font-medium">{section.title}</div>
            <div className="text-sm text-slate-400">{section.detail}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
