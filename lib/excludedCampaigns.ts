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

// Test/owner purchases aren't real customers — their orders are left out of
// every GHL revenue, funnel, transaction and attribution calculation.
export const EXCLUDED_CUSTOMER_EMAILS = ["anandpawar1456@gmail.com"];

// Prisma `where` fragment for GhlOrder queries. The explicit `email: null`
// branch matters: SQL's NOT(NULL) is NULL, so a plain NOT filter would
// silently drop every order whose contact has no email.
export const notExcludedCustomer = {
  AND: [
    {
      OR: [
        { contact: { email: null } },
        {
          contact: {
            NOT: { OR: EXCLUDED_CUSTOMER_EMAILS.map((e) => ({ email: { equals: e, mode: "insensitive" as const } })) },
          },
        },
      ],
    },
  ],
};
