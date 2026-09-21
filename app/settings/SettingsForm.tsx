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
    <form onSubmit={handleSubmit} className="space-y-6">
      <Section title="GoHighLevel" accent="from-indigo-400 to-blue-500">
        <Field
          label="API Key"
          hint={initial.ghlApiKeyMasked ? `Currently saved: ${initial.ghlApiKeyMasked}` : "Not set yet"}
        >
          <input
            type="password"
            value={ghlApiKey}
            onChange={(e) => setGhlApiKey(e.target.value)}
            placeholder="Leave blank to keep current key"
            className="field-input"
          />
        </Field>

        <Field label="Location ID">
          <input
            type="text"
            value={ghlLocationId}
            onChange={(e) => setGhlLocationId(e.target.value)}
            className="field-input"
          />
        </Field>
      </Section>

      <Section title="Meta Ads" accent="from-fuchsia-400 to-pink-500">
        <Field
          label="Access Token"
          hint={initial.metaAccessTokenMasked ? `Currently saved: ${initial.metaAccessTokenMasked}` : "Not set yet"}
        >
          <input
            type="password"
            value={metaAccessToken}
            onChange={(e) => setMetaAccessToken(e.target.value)}
            placeholder="Leave blank to keep current token"
            className="field-input"
          />
        </Field>

        <Field label="Ad Account ID" hint="Format: act_1234567890">
          <input
            type="text"
            value={metaAdAccountId}
            onChange={(e) => setMetaAdAccountId(e.target.value)}
            className="field-input"
          />
        </Field>
      </Section>

      <Section title="Alerts" accent="from-rose-400 to-orange-500">
        <Field label="Gap alert threshold (%)">
          <input
            type="number"
            min="0"
            step="0.5"
            value={alertThresholdPercent}
            onChange={(e) => setAlertThresholdPercent(e.target.value)}
            className="field-input"
          />
        </Field>

        <Field label="Alert email">
          <input
            type="email"
            value={alertEmail}
            onChange={(e) => setAlertEmail(e.target.value)}
            className="field-input"
          />
        </Field>
      </Section>

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={status === "saving"} className="btn-primary">
          {status === "saving" ? "Saving…" : "Save settings"}
        </button>
        {status === "saved" && (
          <span className="text-sm font-medium text-emerald-500">Saved</span>
        )}
        {status === "error" && (
          <span className="text-sm font-medium text-rose-500">Failed to save. Try again.</span>
        )}
      </div>
    </form>
  );
}

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="section-card">
      <div className="flex items-center gap-2.5">
        <div className={`h-2.5 w-2.5 rounded-full bg-gradient-to-br ${accent}`} />
        <span className="text-sm font-semibold text-ink-900">{title}</span>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

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
      <span className="field-label">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
