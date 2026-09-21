# Ad Reconciliation Dashboard

Personal, single-user tool that reconciles GoHighLevel revenue against Meta's
reported ad performance: daily gap tracking, true ROAS per ad (corrected for
revenue Meta's own reporting misses), funnel-stage breakdown, and a
missing-transaction finder. Deployed on Vercel.

## Status

Step 1 complete: project scaffold, database schema, and single-user auth.
No live data yet — ingestion, matching, and dashboard views come next.

## Architecture

- **Next.js (App Router)** on Vercel — pages + API routes + cron jobs in one app.
- **Postgres** (Vercel Postgres or Neon) via Prisma — see `prisma/schema.prisma`.
- **GoHighLevel** — source of truth for revenue, transactions, and funnel
  stage. A tracking script (added in a later step) writes `fbclid`/UTM/ad ids
  onto GHL contacts at opt-in via hidden form fields, so every order can be
  traced back to the ad that drove it without a separate matching table.
- **Meta Marketing API** — daily pull of reported spend/purchases/revenue per
  campaign/ad set/ad.
- **No Stripe integration** — GHL already tracks the real transactions.
- Vercel Cron drives three jobs daily: pull Meta insights, recompute
  reconciliation/attribution rollups, check the alert threshold.

## Data model (`prisma/schema.prisma`)

- `GhlContact` — a lead, enriched with the ad attribution data the tracking
  script captured at opt-in.
- `GhlOrder` — a transaction, linked to the contact that made it.
- `MetaInsight` — Meta's own daily reported numbers per campaign/ad set/ad.
- `DailyReconciliation` — derived, one row per day (what the reconciliation
  dashboard reads).
- `AdAttribution` — derived, one row per day per ad (reported vs true ROAS).
- `UnmatchedTransaction` — GHL orders with no matching Meta purchase event,
  for the missing-transaction finder; carries a manual review status.
- `IntegrationSettings` — single row holding API keys and the alert threshold.
- `ProductFunnelMap` — maps a GHL product id to a funnel stage
  (front end / order bump 1-2 / upsell 1-3); fill in once real product ids
  are visible in ingested orders.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, ADMIN_PASSWORD, AUTH_SECRET at minimum
npx prisma migrate dev --name init
npm run dev
```

Visit `http://localhost:3000` — it redirects to `/login`, then `/dashboard`
once signed in with `ADMIN_PASSWORD`.

## Deploying to Vercel

1. Push this repo to GitHub, import it into Vercel.
2. Add a Postgres database (Vercel Postgres or Neon) and copy its connection
   string into `DATABASE_URL`.
3. Set `ADMIN_PASSWORD`, `AUTH_SECRET` (any long random string), plus the GHL
   and Meta keys once you have them, as Vercel environment variables.
4. Run `npx prisma migrate deploy` against the production `DATABASE_URL`
   (locally, pointed at prod, or via a one-off Vercel deploy hook).
5. The three cron jobs in `vercel.json` start running automatically once
   deployed.

## Known open items (by design, not oversights)

- **Product → funnel stage mapping** is manual (`ProductFunnelMap` table) —
  GHL product ids aren't known until real orders start flowing in.
- **Attribution date rule**: corrected numbers are credited to the GHL
  order's `occurredAt` date, which may differ from the day Meta's own click/
  view attribution window assigns the purchase to. This is called out
  explicitly in the UI rather than silently reconciled.
- **Missing-transaction matching** (timestamp + amount) is heuristic — two
  orders of the same amount in the same window can be ambiguous, so matches
  are surfaced for manual confirmation rather than auto-resolved.
- **API keys are pasted, not OAuth** — intentional, since this is a
  single-user tool and real OAuth app review (Meta, GHL Marketplace) buys
  nothing here.
