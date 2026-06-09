-- AlterTable
ALTER TABLE "AiKnowledgeCluster" ADD COLUMN "autoApprovalReason" TEXT,
ADD COLUMN "promotedKnowledgeId" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'TRACKING';

-- AlterTable
ALTER TABLE "AiKnowledgeEntry" ADD COLUMN "askCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "autoApprovalReason" TEXT,
ADD COLUMN "resolvedSessionCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "sourceClusterId" TEXT,
ADD COLUMN "sourceSessionIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "AiKnowledgeEntry_sourceClusterId_idx" ON "AiKnowledgeEntry"("sourceClusterId");
