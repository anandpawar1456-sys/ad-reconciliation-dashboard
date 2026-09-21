-- CreateTable
CREATE TABLE "MetaAdSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "effectiveStatus" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaAdSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAd" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "adsetId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "effectiveStatus" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaAd_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetaAdSet_campaignId_idx" ON "MetaAdSet"("campaignId");

-- CreateIndex
CREATE INDEX "MetaAdSet_status_idx" ON "MetaAdSet"("status");

-- CreateIndex
CREATE INDEX "MetaAd_adsetId_idx" ON "MetaAd"("adsetId");

-- CreateIndex
CREATE INDEX "MetaAd_campaignId_idx" ON "MetaAd"("campaignId");

-- CreateIndex
CREATE INDEX "MetaAd_status_idx" ON "MetaAd"("status");
