-- AlterTable
ALTER TABLE "MetaAdSet" ADD COLUMN     "dailyBudget" DECIMAL(12,2),
ADD COLUMN     "lifetimeBudget" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "MetaCampaign" ADD COLUMN     "dailyBudget" DECIMAL(12,2),
ADD COLUMN     "lifetimeBudget" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "BudgetChange" (
    "id" TEXT NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL,
    "level" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "objectName" TEXT NOT NULL,
    "campaignId" TEXT,
    "budgetType" TEXT NOT NULL,
    "oldBudget" DECIMAL(12,2) NOT NULL,
    "newBudget" DECIMAL(12,2) NOT NULL,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BudgetChange_objectId_eventTime_idx" ON "BudgetChange"("objectId", "eventTime");

-- CreateIndex
CREATE INDEX "BudgetChange_eventTime_idx" ON "BudgetChange"("eventTime");

-- CreateIndex
CREATE INDEX "BudgetChange_campaignId_idx" ON "BudgetChange"("campaignId");

