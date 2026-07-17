-- CreateEnum
CREATE TYPE "AiSkillLifecycleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'FAILED');
CREATE TYPE "AiSkillLifecycleOperation" AS ENUM ('CREATE', 'UPDATE');
CREATE TYPE "AiSkillLifecycleOrigin" AS ENUM ('ADMIN', 'AUTO_APPROVAL', 'MANUAL_REVIEW');

-- AlterTable
ALTER TABLE "AiSkill"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "roleScope" "AiKnowledgeRoleScope" NOT NULL DEFAULT 'ALL',
  ADD COLUMN "canonicalKey" TEXT,
  ADD COLUMN "sourceKnowledgeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "sourceClusterIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "lifecycleStatus" "AiSkillLifecycleStatus" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "contentSha256" TEXT,
  ADD COLUMN "installedPath" TEXT,
  ADD COLUMN "lastPublishedAt" TIMESTAMP(3),
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
  ADD COLUMN "syncError" TEXT,
  ADD COLUMN "metadata" JSONB;

ALTER TABLE "AiSkillCandidate"
  ADD COLUMN "operation" "AiSkillLifecycleOperation" NOT NULL DEFAULT 'CREATE',
  ADD COLUMN "origin" "AiSkillLifecycleOrigin" NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN "targetSkillId" TEXT,
  ADD COLUMN "sourceClusterId" TEXT,
  ADD COLUMN "decisionScore" DOUBLE PRECISION,
  ADD COLUMN "decisionReason" TEXT,
  ADD COLUMN "generationModel" TEXT,
  ADD COLUMN "contentSha256" TEXT;

-- CreateTable
CREATE TABLE "AiSkillRevision" (
  "id" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "candidateId" TEXT,
  "version" INTEGER NOT NULL,
  "operation" "AiSkillLifecycleOperation" NOT NULL,
  "content" TEXT NOT NULL,
  "contentSha256" TEXT NOT NULL,
  "sourceKnowledgeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceClusterIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "generationModel" TEXT,
  "decisionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiSkillRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiSkill_slug_key" ON "AiSkill"("slug");
CREATE INDEX "AiSkill_aiSpace_roleScope_lifecycleStatus_idx" ON "AiSkill"("aiSpace", "roleScope", "lifecycleStatus");
CREATE INDEX "AiSkill_canonicalKey_idx" ON "AiSkill"("canonicalKey");
CREATE INDEX "AiSkillCandidate_targetSkillId_idx" ON "AiSkillCandidate"("targetSkillId");
CREATE INDEX "AiSkillCandidate_origin_updatedAt_idx" ON "AiSkillCandidate"("origin", "updatedAt");
CREATE UNIQUE INDEX "AiSkillRevision_skillId_version_key" ON "AiSkillRevision"("skillId", "version");
CREATE INDEX "AiSkillRevision_candidateId_idx" ON "AiSkillRevision"("candidateId");
CREATE INDEX "AiSkillRevision_skillId_createdAt_idx" ON "AiSkillRevision"("skillId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiSkillCandidate" ADD CONSTRAINT "AiSkillCandidate_targetSkillId_fkey" FOREIGN KEY ("targetSkillId") REFERENCES "AiSkill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiSkillRevision" ADD CONSTRAINT "AiSkillRevision_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "AiSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSkillRevision" ADD CONSTRAINT "AiSkillRevision_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "AiSkillCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
