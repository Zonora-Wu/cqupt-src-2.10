-- AlterEnum
ALTER TYPE "AiRetestJobStatus" ADD VALUE IF NOT EXISTS 'DIRECT_PLAN_REVIEW';
ALTER TYPE "AiRetestJobStatus" ADD VALUE IF NOT EXISTS 'DIRECT_RUNNING';
ALTER TYPE "AiRetestJobStatus" ADD VALUE IF NOT EXISTS 'DIRECT_ACTION_REVIEW';

-- CreateEnum
CREATE TYPE "AiRetestDirectActionStatus" AS ENUM (
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'EXECUTING',
    'SUCCEEDED',
    'FAILED',
    'BLOCKED',
    'EXPIRED'
);

-- CreateEnum
CREATE TYPE "AiRetestCredentialType" AS ENUM (
    'USERNAME_PASSWORD',
    'COOKIE',
    'BEARER_TOKEN',
    'CUSTOM_HEADERS',
    'CLIENT_CERT_REFERENCE',
    'INTERACTIVE_OTP'
);

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AI_RETEST_DIRECT_ACTION_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AI_RETEST_DIRECT_ACTION_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AI_RETEST_DIRECT_ACTION_REJECTED';

-- AlterTable
ALTER TABLE "AiVulnerabilityRetestDirectSession"
    ADD COLUMN "approvedTargetScope" JSONB,
    ADD COLUMN "approvedToolClasses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "targetScopeHash" TEXT;

-- CreateTable
CREATE TABLE "AiVulnerabilityRetestDirectAction" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "actionType" TEXT NOT NULL,
    "target" TEXT,
    "targetScopeHash" TEXT,
    "commandPreview" TEXT,
    "commandHash" TEXT NOT NULL,
    "riskLevel" "AiRetestRiskLevel" NOT NULL,
    "riskSummary" TEXT NOT NULL,
    "expectedImpact" TEXT,
    "rollbackPlan" TEXT,
    "status" "AiRetestDirectActionStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "resultSummary" JSONB,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiVulnerabilityRetestDirectAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiVulnerabilityRetestCredential" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "credentialType" "AiRetestCredentialType" NOT NULL,
    "encryptedPayload" BYTEA NOT NULL,
    "encryptionKeyId" TEXT NOT NULL,
    "targetScope" JSONB NOT NULL,
    "allowedUses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "destroyedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiVulnerabilityRetestCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiVulnerabilityRetestDirectSession_targetScopeHash_idx"
    ON "AiVulnerabilityRetestDirectSession"("targetScopeHash");

CREATE UNIQUE INDEX "AiVulnerabilityRetestDirectAction_sessionId_sequence_key"
    ON "AiVulnerabilityRetestDirectAction"("sessionId", "sequence");
CREATE INDEX "AiVulnerabilityRetestDirectAction_sessionId_status_idx"
    ON "AiVulnerabilityRetestDirectAction"("sessionId", "status");
CREATE INDEX "AiVulnerabilityRetestDirectAction_approvedById_idx"
    ON "AiVulnerabilityRetestDirectAction"("approvedById");
CREATE INDEX "AiVulnerabilityRetestDirectAction_commandHash_idx"
    ON "AiVulnerabilityRetestDirectAction"("commandHash");
CREATE INDEX "AiVulnerabilityRetestDirectAction_expiresAt_idx"
    ON "AiVulnerabilityRetestDirectAction"("expiresAt");

CREATE INDEX "AiVulnerabilityRetestCredential_jobId_expiresAt_idx"
    ON "AiVulnerabilityRetestCredential"("jobId", "expiresAt");
CREATE INDEX "AiVulnerabilityRetestCredential_createdById_idx"
    ON "AiVulnerabilityRetestCredential"("createdById");
CREATE INDEX "AiVulnerabilityRetestCredential_destroyedAt_idx"
    ON "AiVulnerabilityRetestCredential"("destroyedAt");

-- AddForeignKey
ALTER TABLE "AiVulnerabilityRetestDirectAction"
    ADD CONSTRAINT "AiVulnerabilityRetestDirectAction_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "AiVulnerabilityRetestDirectSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiVulnerabilityRetestDirectAction"
    ADD CONSTRAINT "AiVulnerabilityRetestDirectAction_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiVulnerabilityRetestCredential"
    ADD CONSTRAINT "AiVulnerabilityRetestCredential_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "AiVulnerabilityRetestJob"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiVulnerabilityRetestCredential"
    ADD CONSTRAINT "AiVulnerabilityRetestCredential_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
