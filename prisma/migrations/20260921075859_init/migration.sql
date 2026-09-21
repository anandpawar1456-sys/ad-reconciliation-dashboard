-- CreateTable
CREATE TABLE "GhlContact" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "visitorId" TEXT,
    "fbclid" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "adId" TEXT,
    "adsetId" TEXT,
    "campaignId" TEXT,
    "firstSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GhlContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickEvent" (
    "visitorId" TEXT NOT NULL,
    "fbclid" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "adId" TEXT,
    "adsetId" TEXT,
    "campaignId" TEXT,
    "landingUrl" TEXT,
    "referrer" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickEvent_pkey" PRIMARY KEY ("visitorId")
);

-- CreateTable
CREATE TABLE "GhlOrder" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "productId" TEXT,
    "productName" TEXT,
    "funnelStage" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "status" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GhlOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaInsight" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "level" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT,
    "adsetId" TEXT,
    "adsetName" TEXT,
    "adId" TEXT,
    "adName" TEXT,
    "spend" DECIMAL(12,2) NOT NULL,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "purchaseValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reportedRoas" DECIMAL(10,4),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReconciliation" (
    "date" TIMESTAMP(3) NOT NULL,
    "ghlRevenue" DECIMAL(12,2) NOT NULL,
    "ghlTransactions" INTEGER NOT NULL,
    "metaRevenue" DECIMAL(12,2) NOT NULL,
    "metaPurchases" INTEGER NOT NULL,
    "gapAmount" DECIMAL(12,2) NOT NULL,
    "gapPercent" DECIMAL(6,2) NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReconciliation_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "AdAttribution" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "adId" TEXT NOT NULL,
    "adsetId" TEXT,
    "campaignId" TEXT,
    "adName" TEXT,
    "metaSpend" DECIMAL(12,2) NOT NULL,
    "metaRevenue" DECIMAL(12,2) NOT NULL,
    "metaRoas" DECIMAL(10,4),
    "ghlRevenue" DECIMAL(12,2) NOT NULL,
    "recoveredRevenue" DECIMAL(12,2) NOT NULL,
    "trueRevenue" DECIMAL(12,2) NOT NULL,
    "trueRoas" DECIMAL(10,4),
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnmatchedTransaction" (
    "id" TEXT NOT NULL,
    "ghlOrderId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnmatchedTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "ghlApiKey" TEXT,
    "ghlLocationId" TEXT,
    "metaAccessToken" TEXT,
    "metaAdAccountId" TEXT,
    "alertThresholdPercent" DECIMAL(6,2) NOT NULL DEFAULT 10,
    "alertEmail" TEXT,
    "lastMetaSyncAt" TIMESTAMP(3),
    "lastGhlSyncAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFunnelMap" (
    "productId" TEXT NOT NULL,
    "productName" TEXT,
    "funnelStage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFunnelMap_pkey" PRIMARY KEY ("productId")
);

-- CreateIndex
CREATE INDEX "GhlContact_adId_idx" ON "GhlContact"("adId");

-- CreateIndex
CREATE INDEX "GhlContact_email_idx" ON "GhlContact"("email");

-- CreateIndex
CREATE INDEX "GhlContact_visitorId_idx" ON "GhlContact"("visitorId");

-- CreateIndex
CREATE INDEX "ClickEvent_adId_idx" ON "ClickEvent"("adId");

-- CreateIndex
CREATE INDEX "GhlOrder_occurredAt_idx" ON "GhlOrder"("occurredAt");

-- CreateIndex
CREATE INDEX "GhlOrder_contactId_idx" ON "GhlOrder"("contactId");

-- CreateIndex
CREATE INDEX "GhlOrder_funnelStage_idx" ON "GhlOrder"("funnelStage");

-- CreateIndex
CREATE INDEX "MetaInsight_date_idx" ON "MetaInsight"("date");

-- CreateIndex
CREATE INDEX "MetaInsight_adId_idx" ON "MetaInsight"("adId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaInsight_date_level_campaignId_adsetId_adId_key" ON "MetaInsight"("date", "level", "campaignId", "adsetId", "adId");

-- CreateIndex
CREATE INDEX "AdAttribution_date_idx" ON "AdAttribution"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AdAttribution_date_adId_key" ON "AdAttribution"("date", "adId");

-- CreateIndex
CREATE UNIQUE INDEX "UnmatchedTransaction_ghlOrderId_key" ON "UnmatchedTransaction"("ghlOrderId");

-- AddForeignKey
ALTER TABLE "GhlOrder" ADD CONSTRAINT "GhlOrder_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "GhlContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnmatchedTransaction" ADD CONSTRAINT "UnmatchedTransaction_ghlOrderId_fkey" FOREIGN KEY ("ghlOrderId") REFERENCES "GhlOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
