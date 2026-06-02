-- Create AiKnowledgeMaintenanceTask table for tracking knowledge maintenance lifecycle.
CREATE TABLE "AiKnowledgeMaintenanceTask" (
  "id" TEXT NOT NULL,
  "knowledgeId" TEXT NOT NULL,
  "taskType" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'P3',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "dedupeKey" TEXT NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiKnowledgeMaintenanceTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiKnowledgeMaintenanceTask_dedupeKey_key" UNIQUE ("dedupeKey"),
  CONSTRAINT "AiKnowledgeMaintenanceTask_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "AiKnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AiKnowledgeMaintenanceTask_knowledgeId_createdAt_idx" ON "AiKnowledgeMaintenanceTask"("knowledgeId", "createdAt");
CREATE INDEX "AiKnowledgeMaintenanceTask_status_priority_idx" ON "AiKnowledgeMaintenanceTask"("status", "priority");
CREATE INDEX "AiKnowledgeMaintenanceTask_taskType_status_idx" ON "AiKnowledgeMaintenanceTask"("taskType", "status");
