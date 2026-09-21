import { Resend } from "resend";

// Uses Resend's shared onboarding@resend.dev sender, which works without
// verifying a domain but has weaker deliverability (more likely to land in
// spam). Swap ALERT_FROM_EMAIL for an address on a domain you've verified
// in Resend once this matters more than "good enough for now."
const FROM_EMAIL = process.env.ALERT_FROM_EMAIL ?? "Ad Reconciliation <onboarding@resend.dev>";

export async function sendGapAlertEmail(params: {
  to: string;
  date: string;
  ghlRevenue: number;
  metaRevenue: number;
  gapAmount: number;
  gapPercent: number;
  thresholdPercent: number;
  dashboardUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY env var is not set");
  }

  const resend = new Resend(apiKey);
  const { to, date, ghlRevenue, metaRevenue, gapAmount, gapPercent, thresholdPercent, dashboardUrl } = params;
  const direction = gapAmount > 0 ? "Meta under-reported" : "Meta over-reported";

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Attribution gap alert — ${date}: ${gapPercent.toFixed(1)}% (threshold ${thresholdPercent}%)`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <h2 style="margin-bottom: 4px;">Attribution gap alert</h2>
        <p style="color: #555; margin-top: 0;">${date}</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 6px 0; color: #666;">GHL revenue</td><td style="text-align: right; font-weight: 600;">$${ghlRevenue.toFixed(2)}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Meta reported revenue</td><td style="text-align: right; font-weight: 600;">$${metaRevenue.toFixed(2)}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Gap</td><td style="text-align: right; font-weight: 700; color: #d97706;">$${gapAmount.toFixed(2)} (${gapPercent.toFixed(1)}%)</td></tr>
        </table>
        <p style="color: #555;">${direction} by more than your ${thresholdPercent}% threshold.</p>
        <a href="${dashboardUrl}" style="display: inline-block; margin-top: 12px; padding: 10px 16px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px;">View dashboard</a>
      </div>
    `,
  });
}
