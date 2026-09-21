import Link from "next/link";
import { getSettings, maskSecret } from "@/lib/settings";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-200">
        ← Dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Settings</h1>
      <p className="mt-2 text-sm text-slate-400">
        Paste in your GoHighLevel and Meta credentials so ingestion can pull
        data automatically. Keys are stored only in your database, never
        exposed to the browser after saving.
      </p>

      <div className="mt-8">
        <SettingsForm
          initial={{
            ghlApiKeyMasked: maskSecret(settings.ghlApiKey),
            ghlLocationId: settings.ghlLocationId ?? "",
            metaAccessTokenMasked: maskSecret(settings.metaAccessToken),
            metaAdAccountId: settings.metaAdAccountId ?? "",
            alertThresholdPercent: Number(settings.alertThresholdPercent),
            alertEmail: settings.alertEmail ?? "",
          }}
        />
      </div>
    </main>
  );
}
