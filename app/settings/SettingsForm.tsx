"use client";

import { useState } from "react";

type InitialSettings = {
  ghlApiKeyMasked: string;
  ghlLocationId: string;
  metaAccessTokenMasked: string;
  metaAdAccountId: string;
  alertThresholdPercent: number;
  alertEmail: string;
};

export default function SettingsForm({ initial }: { initial: InitialSettings }) {
  const [ghlApiKey, setGhlApiKey] = useState("");
  const [ghlLocationId, setGhlLocationId] = useState(initial.ghlLocationId);
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaAdAccountId, setMetaAdAccountId] = useState(initial.metaAdAccountId);
  const [alertThresholdPercent, setAlertThresholdPercent] = useState(
    String(initial.alertThresholdPercent)
  );
  const [alertEmail, setAlertEmail] = useState(initial.alertEmail);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");

    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ghlApiKey: ghlApiKey || undefined,
        ghlLocationId,
        metaAccessToken: metaAccessToken || undefined,
        metaAdAccountId,
        alertThresholdPercent,
        alertEmail,
      }),
    });

    if (res.ok) {
      setGhlApiKey("");
      setMetaAccessToken("");
      setStatus("saved");
    } else {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <fieldset className="space-y-4 rounded-lg border border-slate-800 p-4">
        <legend className="px-1 text-sm font-medium text-slate-300">GoHighLevel</legend>

        <Field label="API Key" hint={initial.ghlApiKeyMasked ? `Currently saved: ${initial.ghlApiKeyMasked}` : "Not set yet"}>
          <input
            type="password"
            value={ghlApiKey}
            onChange={(e) => setGhlApiKey(e.target.value)}
            placeholder="Leave blank to keep current key"
            className={inputClass}
          />
        </Field>

        <Field label="Location ID">
          <input
            type="text"
            value={ghlLocationId}
            onChange={(e) => setGhlLocationId(e.target.value)}
            className={inputClass}
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-slate-800 p-4">
        <legend className="px-1 text-sm font-medium text-slate-300">Meta Ads</legend>

        <Field
          label="Access Token"
          hint={initial.metaAccessTokenMasked ? `Currently saved: ${initial.metaAccessTokenMasked}` : "Not set yet"}
        >
          <input
            type="password"
            value={metaAccessToken}
            onChange={(e) => setMetaAccessToken(e.target.value)}
            placeholder="Leave blank to keep current token"
            className={inputClass}
          />
        </Field>

        <Field label="Ad Account ID" hint="Format: act_1234567890">
          <input
            type="text"
            value={metaAdAccountId}
            onChange={(e) => setMetaAdAccountId(e.target.value)}
            className={inputClass}
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-slate-800 p-4">
        <legend className="px-1 text-sm font-medium text-slate-300">Alerts</legend>

        <Field label="Gap alert threshold (%)">
          <input
            type="number"
            min="0"
            step="0.5"
            value={alertThresholdPercent}
            onChange={(e) => setAlertThresholdPercent(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Alert email">
          <input
            type="email"
            value={alertEmail}
            onChange={(e) => setAlertEmail(e.target.value)}
            className={inputClass}
          />
        </Field>
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
        >
          {status === "saving" ? "Saving..." : "Save settings"}
        </button>
        {status === "saved" && <span className="text-sm text-emerald-400">Saved.</span>}
        {status === "error" && <span className="text-sm text-red-400">Failed to save. Try again.</span>}
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-slate-500";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm text-slate-300">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
