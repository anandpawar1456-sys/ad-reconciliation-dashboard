-- AlterTable
ALTER TABLE "MetaInsight" ADD COLUMN     "clicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ctr" DECIMAL(8,4) NOT NULL DEFAULT 0,
ADD COLUMN     "frequency" DECIMAL(8,4) NOT NULL DEFAULT 0,
ADD COLUMN     "impressions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reach" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MetaCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "effectiveStatus" TEXT NOT NULL,
    "objective" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetaCampaign_status_idx" ON "MetaCampaign"("status");
