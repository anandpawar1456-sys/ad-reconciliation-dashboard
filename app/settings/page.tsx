import { getSettings, maskSecret } from "@/lib/settings";
import NavBar from "../dashboard/NavBar";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-2xl px-6 py-14">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">Settings</h1>
        <p className="mt-2 text-ink-400">
          Paste in your GoHighLevel and Meta credentials so ingestion can pull
          data automatically. Keys are stored only in your database, never
          exposed to the browser after saving.
        </p>

        <div className="mt-10">
          <SettingsForm
            initial={{
              ghlApiKeyMasked: maskSecret(settings.ghlApiKey),
              ghlLocationId: settings.ghlLocationId ?? "",
              metaAccessTokenMasked: maskSecret(settings.metaAccessToken),
              metaAdAccountId: settings.metaAdAccountId ?? "",
              reportingTimezone: settings.reportingTimezone,
              alertThresholdPercent: Number(settings.alertThresholdPercent),
              alertEmail: settings.alertEmail ?? "",
            }}
          />
        </div>
      </main>
    </div>
  );
}
