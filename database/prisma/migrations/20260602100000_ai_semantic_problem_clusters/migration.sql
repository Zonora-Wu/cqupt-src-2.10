-- AlterTable
ALTER TABLE "AiProblemSession" ADD COLUMN "canonicalKey" TEXT,
ADD COLUMN "canonicalProblemJson" JSONB,
ADD COLUMN "clusterDecision" TEXT,
ADD COLUMN "clusterDecisionReason" TEXT,
ADD COLUMN "clusterDecisionScore" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "AiKnowledgeCluster" ADD COLUMN "canonicalKey" TEXT,
ADD COLUMN "canonicalProblemJson" JSONB,
ADD COLUMN "mergeReviewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "variantCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "AiProblemSession_canonicalKey_status_idx" ON "AiProblemSession"("canonicalKey", "status");

-- CreateIndex
CREATE INDEX "AiKnowledgeCluster_aiSpace_canonicalKey_idx" ON "AiKnowledgeCluster"("aiSpace", "canonicalKey");
