import Link from "next/link";
import NavBar from "./NavBar";
import { getDailyReconciliation, getUnmatchedTransactions } from "@/lib/dashboardQueries";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    href: "/reconciliation",
    title: "Daily Reconciliation",
    detail: "GHL vs Meta revenue/transactions, gap $ and %.",
    accent: "from-indigo-400 to-blue-500",
  },
  {
    href: "/true-roas",
    title: "True ROAS",
    detail: "Reported vs corrected ROAS per ad.",
    accent: "from-violet-400 to-purple-500",
  },
  {
    href: "/funnel",
    title: "Funnel Breakdown",
    detail: "Revenue and transactions by funnel stage.",
    accent: "from-fuchsia-400 to-pink-500",
  },
  {
    href: "/missing-transactions",
    title: "Missing Transactions",
    detail: "GHL orders with no matching ad attribution.",
    accent: "from-rose-400 to-orange-500",
  },
];

export default async function DashboardPage() {
  const [recent, unmatched] = await Promise.all([
    getDailyReconciliation(1),
    getUnmatchedTransactions(),
  ]);
  const today = recent[0];

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">Overview</h1>
        <p className="mt-2 text-ink-400">
          {today
            ? `Today: ${formatCurrency(Number(today.ghlRevenue))} GHL revenue vs ${formatCurrency(
                Number(today.metaRevenue)
              )} reported by Meta.`
            : "No reconciliation data yet — this fills in once GHL orders and Meta insights sync."}
          {unmatched.length > 0 && ` ${unmatched.length} order(s) need review.`}
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <Link key={section.href} href={section.href} className="section-card group block">
              <div
                className={`h-9 w-9 rounded-xl bg-gradient-to-br ${section.accent} shadow-sm transition group-hover:shadow-glow`}
              />
              <div className="mt-4 font-semibold text-ink-900">{section.title}</div>
              <div className="mt-1 text-sm text-ink-400">{section.detail}</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
