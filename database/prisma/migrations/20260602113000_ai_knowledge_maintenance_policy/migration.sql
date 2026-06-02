-- Add per-knowledge maintenance lifecycle and route policy gates.
CREATE TYPE "AiKnowledgeMaintenanceStatus" AS ENUM (
  'HEALTHY',
  'STALE_REVIEW',
  'LOW_QUALITY_REVIEW',
  'DUPLICATE_REVIEW',
  'SECURITY_SUSPENDED',
  'ARCHIVED'
);

ALTER TABLE "AiKnowledgeEntry"
  ADD COLUMN "maintenanceStatus" "AiKnowledgeMaintenanceStatus" NOT NULL DEFAULT 'HEALTHY',
  ADD COLUMN "retrievalEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "directAnswerEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "agentInjectEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "AiKnowledgeEntry_maintenanceStatus_retrievalEnabled_idx"
  ON "AiKnowledgeEntry"("maintenanceStatus", "retrievalEnabled");
