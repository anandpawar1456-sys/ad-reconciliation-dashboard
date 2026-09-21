export const FUNNEL_STAGES = [
  "FRONT_END",
  "ORDER_BUMP_1",
  "ORDER_BUMP_2",
  "UPSELL_1",
  "UPSELL_2",
  "UPSELL_3",
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number] | "UNKNOWN";

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  FRONT_END: "Front End",
  ORDER_BUMP_1: "Order Bump 1",
  ORDER_BUMP_2: "Order Bump 2",
  UPSELL_1: "Upsell 1",
  UPSELL_2: "Upsell 2",
  UPSELL_3: "Upsell 3",
  UNKNOWN: "Unknown",
};
