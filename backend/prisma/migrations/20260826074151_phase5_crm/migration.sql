-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('PROSPECTING', 'QUALIFICATION', 'NEEDS_ANALYSIS', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SIGNED', 'ACTIVE', 'EXPIRED', 'TERMINATED');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'PROPOSAL_SENT';

-- AlterEnum
ALTER TYPE "CustomerStatus" ADD VALUE 'CHURNED';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "source" "LeadSource" NOT NULL DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD';

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "opportunityCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" TEXT,
    "leadId" TEXT,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'PROSPECTING',
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "probabilityPercent" SMALLINT,
    "expectedCloseDate" DATE,
    "assignedToId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "activityAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT,
    "userId" TEXT NOT NULL,
    "leadId" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opportunityId" TEXT,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "contractCode" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "value" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "signedAt" TIMESTAMPTZ(6),
    "signedById" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_opportunityCode_key" ON "Opportunity"("opportunityCode");

-- CreateIndex
CREATE INDEX "Opportunity_opportunityCode_idx" ON "Opportunity"("opportunityCode");

-- CreateIndex
CREATE INDEX "Opportunity_name_idx" ON "Opportunity"("name");

-- CreateIndex
CREATE INDEX "Opportunity_stage_idx" ON "Opportunity"("stage");

-- CreateIndex
CREATE INDEX "Opportunity_customerId_idx" ON "Opportunity"("customerId");

-- CreateIndex
CREATE INDEX "Opportunity_leadId_idx" ON "Opportunity"("leadId");

-- CreateIndex
CREATE INDEX "Opportunity_assignedToId_idx" ON "Opportunity"("assignedToId");

-- CreateIndex
CREATE INDEX "Opportunity_expectedCloseDate_idx" ON "Opportunity"("expectedCloseDate");

-- CreateIndex
CREATE INDEX "Opportunity_createdAt_idx" ON "Opportunity"("createdAt");

-- CreateIndex
CREATE INDEX "Activity_userId_idx" ON "Activity"("userId");

-- CreateIndex
CREATE INDEX "Activity_leadId_idx" ON "Activity"("leadId");

-- CreateIndex
CREATE INDEX "Activity_customerId_idx" ON "Activity"("customerId");

-- CreateIndex
CREATE INDEX "Activity_opportunityId_idx" ON "Activity"("opportunityId");

-- CreateIndex
CREATE INDEX "Activity_type_idx" ON "Activity"("type");

-- CreateIndex
CREATE INDEX "Activity_activityAt_idx" ON "Activity"("activityAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractCode_key" ON "Contract"("contractCode");

-- CreateIndex
CREATE INDEX "Contract_contractCode_idx" ON "Contract"("contractCode");

-- CreateIndex
CREATE INDEX "Contract_customerId_idx" ON "Contract"("customerId");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE INDEX "Contract_startDate_endDate_idx" ON "Contract"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Contract_createdAt_idx" ON "Contract"("createdAt");

-- CreateIndex
CREATE INDEX "Customer_source_idx" ON "Customer"("source");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
