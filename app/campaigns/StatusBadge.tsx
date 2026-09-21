export default function StatusBadge({ status }: { status: string }) {
  const active = status === "ACTIVE";
  const paused = status.includes("PAUSED");
  const color = active
    ? "bg-emerald-500/10 text-emerald-600"
    : paused
      ? "bg-amber-500/10 text-amber-600"
      : "bg-ink-900/5 text-ink-500";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{status.replaceAll("_", " ")}</span>;
}
