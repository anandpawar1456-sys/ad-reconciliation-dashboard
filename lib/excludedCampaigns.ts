// Campaigns whose names contain any of these (case-insensitive) are not part
// of the US/GHL funnel — the Moto campaigns sell on a separate WordPress
// site for India, so their Meta purchases never appear in GHL and would
// otherwise pollute the gap, spend, ROAS and CPA numbers.
export const EXCLUDED_CAMPAIGN_KEYWORDS = ["moto"];

export function isExcludedCampaignName(name: string | null | undefined): boolean {
  const lower = (name ?? "").toLowerCase();
  return EXCLUDED_CAMPAIGN_KEYWORDS.some((k) => lower.includes(k));
}

// Prisma `where` fragment for models with a campaignName column.
export const notExcludedCampaignName = {
  NOT: EXCLUDED_CAMPAIGN_KEYWORDS.map((k) => ({ campaignName: { contains: k, mode: "insensitive" as const } })),
};
