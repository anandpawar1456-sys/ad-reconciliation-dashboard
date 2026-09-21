"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ReviewActions({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function setStatus(status: "CONFIRMED" | "DISMISSED") {
    setBusy(true);
    await fetch(`/api/unmatched/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setStatus("CONFIRMED")}
        disabled={busy}
        className="rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-500/20 disabled:opacity-50"
      >
        Confirm gap
      </button>
      <button
        onClick={() => setStatus("DISMISSED")}
        disabled={busy}
        className="rounded-xl bg-ink-900/5 px-3 py-1.5 text-xs font-semibold text-ink-500 transition hover:bg-ink-900/10 disabled:opacity-50"
      >
        Dismiss
      </button>
    </div>
  );
}
