import { prisma } from "@/lib/prisma";
import type { IntegrationSettings } from "@prisma/client";

const SETTINGS_ID = 1;

export async function getSettings(): Promise<IntegrationSettings> {
  const existing = await prisma.integrationSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (existing) return existing;

  return prisma.integrationSettings.create({
    data: { id: SETTINGS_ID, alertThresholdPercent: 10 },
  });
}

export type SettingsUpdateInput = {
  ghlApiKey?: string;
  ghlLocationId?: string;
  metaAccessToken?: string;
  metaAdAccountId?: string;
  reportingTimezone?: string;
  alertThresholdPercent?: number;
  alertEmail?: string;
};

// Blank/omitted fields leave the existing stored value untouched, so
// re-saving the form doesn't wipe out a secret the user didn't retype.
export async function updateSettings(input: SettingsUpdateInput) {
  const data: Record<string, unknown> = {};

  if (input.ghlApiKey) data.ghlApiKey = input.ghlApiKey;
  if (input.ghlLocationId) data.ghlLocationId = input.ghlLocationId;
  if (input.metaAccessToken) data.metaAccessToken = input.metaAccessToken;
  if (input.metaAdAccountId) data.metaAdAccountId = input.metaAdAccountId;
  if (input.reportingTimezone) data.reportingTimezone = input.reportingTimezone;
  if (input.alertEmail) data.alertEmail = input.alertEmail;
  if (input.alertThresholdPercent !== undefined && !Number.isNaN(input.alertThresholdPercent)) {
    data.alertThresholdPercent = input.alertThresholdPercent;
  }

  await getSettings(); // ensure row exists

  return prisma.integrationSettings.update({
    where: { id: SETTINGS_ID },
    data,
  });
}

export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}
