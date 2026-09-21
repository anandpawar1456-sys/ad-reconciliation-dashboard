// The precise 6-stage breakdown (FRONT_END / ORDER_BUMP_1-2 / UPSELL_1-3)
// needs each GHL funnel step mapped by hand — GHL's order data alone
// doesn't say which numbered upsell/bump a step is. Until that mapping
// exists, orders are bucketed by the coarser signal GHL's order API does
// give us directly (order.sourceSubType) — see lib/ghlSync.ts.
export const FUNNEL_STAGES = [
  "FRONT_END",
  "ORDER_BUMP_1",
  "ORDER_BUMP_2",
  "UPSELL_1",
  "UPSELL_2",
  "UPSELL_3",
] as const;

export type FunnelStage =
  | (typeof FUNNEL_STAGES)[number]
  | "FRONT_END_BUNDLE"
  | "UPSELL"
  | "UNKNOWN";

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  FRONT_END: "Front End",
  ORDER_BUMP_1: "Order Bump 1",
  ORDER_BUMP_2: "Order Bump 2",
  UPSELL_1: "Upsell 1",
  UPSELL_2: "Upsell 2",
  UPSELL_3: "Upsell 3",
  FRONT_END_BUNDLE: "Front End + Bumps (bundled)",
  UPSELL: "Upsell (unnumbered)",
  UNKNOWN: "Unknown",
};
