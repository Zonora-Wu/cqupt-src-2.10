-- CreateTable
CREATE TABLE "AiKnowledgeCluster" (
    "id" TEXT NOT NULL,
    "aiSpace" "AiSpace" NOT NULL,
    "topicKey" TEXT NOT NULL,
    "representativeProblem" TEXT NOT NULL,
    "representativeResolution" TEXT,
    "resolvedSessionCount" INTEGER NOT NULL DEFAULT 0,
    "totalAskCount" INTEGER NOT NULL DEFAULT 0,
    "avgQualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgReuseScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgSafetyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duplicateRiskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "similarKnowledgeMatches" JSONB,
    "mergeSuggestion" TEXT,
    "lastResolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiKnowledgeCluster_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "AiProblemSession" ADD COLUMN "clusterId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AiKnowledgeCluster_aiSpace_topicKey_key" ON "AiKnowledgeCluster"("aiSpace", "topicKey");

-- CreateIndex
CREATE INDEX "AiKnowledgeCluster_aiSpace_updatedAt_idx" ON "AiKnowledgeCluster"("aiSpace", "updatedAt");

-- CreateIndex
CREATE INDEX "AiKnowledgeCluster_duplicateRiskScore_idx" ON "AiKnowledgeCluster"("duplicateRiskScore");

-- CreateIndex
CREATE INDEX "AiProblemSession_clusterId_idx" ON "AiProblemSession"("clusterId");

-- AddForeignKey
ALTER TABLE "AiProblemSession" ADD CONSTRAINT "AiProblemSession_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "AiKnowledgeCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
