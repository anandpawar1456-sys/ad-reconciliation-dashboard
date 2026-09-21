import { NextRequest } from "next/server";

// Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically on cron
// invocations once CRON_SECRET is set as a project env var. If it's unset
// (e.g. local dev), we don't block the request.
export function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
