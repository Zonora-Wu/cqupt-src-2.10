-- AlterEnum
ALTER TYPE "AiRetestMode" ADD VALUE IF NOT EXISTS 'HERMES_DIRECT';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AI_RETEST_DIRECT_PROPOSAL_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AI_RETEST_DIRECT_PROPOSAL_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AI_RETEST_DIRECT_STARTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AI_RETEST_DIRECT_EVENT_RECORDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AI_RETEST_DIRECT_FINISHED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AI_RETEST_DIRECT_BLOCKED';

-- CreateTable
CREATE TABLE "AiVulnerabilityRetestDirectSession" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "proposalJson" JSONB NOT NULL,
    "proposalHash" TEXT NOT NULL,
    "impactScopeJson" JSONB,
    "riskSummary" TEXT,
    "policySnapshot" JSONB,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmationText" TEXT,
    "acknowledgedRisks" BOOLEAN NOT NULL DEFAULT false,
    "hermesSessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROPOSAL_CREATED',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiVulnerabilityRetestDirectSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiVulnerabilityRetestDirectSession_jobId_key" ON "AiVulnerabilityRetestDirectSession"("jobId");

-- CreateIndex
CREATE INDEX "AiVulnerabilityRetestDirectSession_status_createdAt_idx" ON "AiVulnerabilityRetestDirectSession"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AiVulnerabilityRetestDirectSession_confirmedById_idx" ON "AiVulnerabilityRetestDirectSession"("confirmedById");

-- CreateIndex
CREATE INDEX "AiVulnerabilityRetestDirectSession_proposalHash_idx" ON "AiVulnerabilityRetestDirectSession"("proposalHash");

-- AddForeignKey
ALTER TABLE "AiVulnerabilityRetestDirectSession" ADD CONSTRAINT "AiVulnerabilityRetestDirectSession_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AiVulnerabilityRetestJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiVulnerabilityRetestDirectSession" ADD CONSTRAINT "AiVulnerabilityRetestDirectSession_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
