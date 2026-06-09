-- CreateEnum
CREATE TYPE "AiKnowledgeCategory" AS ENUM ('VULNERABILITY_REPORTING', 'XSS', 'SQL_INJECTION', 'SSRF', 'FILE_UPLOAD', 'ACCESS_CONTROL', 'AUTHENTICATION', 'SECURITY_LEARNING', 'SRC_RULES', 'PLATFORM_USAGE', 'AUDITOR_REVIEW', 'ADMIN_ANALYTICS');

-- CreateEnum
CREATE TYPE "AiKnowledgeRoleScope" AS ENUM ('STUDENT', 'AUDITOR', 'ADMIN', 'ALL');

-- CreateEnum
CREATE TYPE "AiKnowledgeVisibility" AS ENUM ('PRIVATE', 'REVIEW_REQUIRED', 'PLATFORM_PUBLIC', 'ROLE_ONLY');

-- CreateEnum
CREATE TYPE "AiKnowledgeSensitivity" AS ENUM ('PUBLIC', 'INTERNAL', 'SENSITIVE', 'REJECTED');

-- CreateEnum
CREATE TYPE "AiKnowledgeStatus" AS ENUM ('CANDIDATE', 'AUTO_APPROVED', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED', 'PROMOTED_TO_SKILL');

-- CreateEnum
CREATE TYPE "AiKnowledgeSource" AS ENUM ('USER_CHAT', 'ADMIN_CREATED', 'DOC_IMPORT', 'SKILL_PROMOTION');

-- CreateEnum
CREATE TYPE "AiKnowledgeFeedbackValue" AS ENUM ('HELPFUL', 'UNHELPFUL', 'REPORT_ABUSE');

-- CreateEnum
CREATE TYPE "AiKnowledgeJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "AiSkillCandidateStatus" AS ENUM ('DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'INSTALLED', 'FAILED');

-- CreateTable
CREATE TABLE "AiKnowledgeEntry" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "canonicalQuestion" TEXT NOT NULL,
    "canonicalAnswer" TEXT NOT NULL,
    "summary" TEXT,
    "category" "AiKnowledgeCategory" NOT NULL,
    "tags" TEXT[],
    "roleScope" "AiKnowledgeRoleScope" NOT NULL,
    "visibility" "AiKnowledgeVisibility" NOT NULL,
    "sensitivity" "AiKnowledgeSensitivity" NOT NULL,
    "status" "AiKnowledgeStatus" NOT NULL DEFAULT 'CANDIDATE',
    "source" "AiKnowledgeSource" NOT NULL DEFAULT 'USER_CHAT',
    "sourceCallId" TEXT,
    "sourceUserId" TEXT,
    "sourceHash" TEXT NOT NULL,
    "sanitizedInputHash" TEXT,
    "similarityKey" TEXT,
    "embeddingModel" TEXT,
    "embeddingDimension" INTEGER,
    "embeddingJson" JSONB,
    "generalityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "safetyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "privacyRiskScore" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "educationalValueScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reuseValueScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "answerQualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platformRelevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "unhelpfulCount" INTEGER NOT NULL DEFAULT 0,
    "abuseReportCount" INTEGER NOT NULL DEFAULT 0,
    "promotedSkillId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "AiKnowledgeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiKnowledgeRevision" (
    "id" TEXT NOT NULL,
    "knowledgeId" TEXT NOT NULL,
    "editorId" TEXT,
    "title" TEXT NOT NULL,
    "canonicalQuestion" TEXT NOT NULL,
    "canonicalAnswer" TEXT NOT NULL,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiKnowledgeRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiKnowledgeHit" (
    "id" TEXT NOT NULL,
    "knowledgeId" TEXT NOT NULL,
    "userId" TEXT,
    "aiSpace" "AiSpace" NOT NULL,
    "questionHash" TEXT NOT NULL,
    "questionSummary" TEXT NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL,
    "route" TEXT NOT NULL,
    "usedInResponse" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiKnowledgeHit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiKnowledgeFeedback" (
    "id" TEXT NOT NULL,
    "knowledgeId" TEXT NOT NULL,
    "userId" TEXT,
    "value" "AiKnowledgeFeedbackValue" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiKnowledgeFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiKnowledgeCaptureJob" (
    "id" TEXT NOT NULL,
    "callId" TEXT,
    "userId" TEXT,
    "aiSpace" "AiSpace" NOT NULL,
    "questionSummary" TEXT NOT NULL,
    "answerSummary" TEXT NOT NULL,
    "questionHash" TEXT NOT NULL,
    "answerHash" TEXT NOT NULL,
    "status" "AiKnowledgeJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "processAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiKnowledgeCaptureJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSkillCandidate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceKnowledgeIds" TEXT[],
    "roleScope" "AiKnowledgeRoleScope" NOT NULL,
    "status" "AiSkillCandidateStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "installedPath" TEXT,
    "installError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSkillCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSkillInstallLog" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "operatorId" TEXT,
    "targetPath" TEXT NOT NULL,
    "containerPath" TEXT NOT NULL,
    "contentSha256" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSkillInstallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiKnowledgeEntry_sourceHash_key" ON "AiKnowledgeEntry"("sourceHash");

-- CreateIndex
CREATE INDEX "AiKnowledgeEntry_status_updatedAt_idx" ON "AiKnowledgeEntry"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "AiKnowledgeEntry_roleScope_status_idx" ON "AiKnowledgeEntry"("roleScope", "status");

-- CreateIndex
CREATE INDEX "AiKnowledgeEntry_category_status_idx" ON "AiKnowledgeEntry"("category", "status");

-- CreateIndex
CREATE INDEX "AiKnowledgeEntry_sourceCallId_idx" ON "AiKnowledgeEntry"("sourceCallId");

-- CreateIndex
CREATE INDEX "AiKnowledgeEntry_sourceUserId_idx" ON "AiKnowledgeEntry"("sourceUserId");

-- CreateIndex
CREATE INDEX "AiKnowledgeEntry_similarityKey_idx" ON "AiKnowledgeEntry"("similarityKey");

-- CreateIndex
CREATE INDEX "AiKnowledgeRevision_knowledgeId_createdAt_idx" ON "AiKnowledgeRevision"("knowledgeId", "createdAt");

-- CreateIndex
CREATE INDEX "AiKnowledgeRevision_editorId_idx" ON "AiKnowledgeRevision"("editorId");

-- CreateIndex
CREATE INDEX "AiKnowledgeHit_knowledgeId_createdAt_idx" ON "AiKnowledgeHit"("knowledgeId", "createdAt");

-- CreateIndex
CREATE INDEX "AiKnowledgeHit_userId_createdAt_idx" ON "AiKnowledgeHit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiKnowledgeHit_aiSpace_createdAt_idx" ON "AiKnowledgeHit"("aiSpace", "createdAt");

-- CreateIndex
CREATE INDEX "AiKnowledgeHit_questionHash_idx" ON "AiKnowledgeHit"("questionHash");

-- CreateIndex
CREATE INDEX "AiKnowledgeFeedback_knowledgeId_createdAt_idx" ON "AiKnowledgeFeedback"("knowledgeId", "createdAt");

-- CreateIndex
CREATE INDEX "AiKnowledgeFeedback_userId_createdAt_idx" ON "AiKnowledgeFeedback"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiKnowledgeCaptureJob_questionHash_key" ON "AiKnowledgeCaptureJob"("questionHash");

-- CreateIndex
CREATE INDEX "AiKnowledgeCaptureJob_status_processAfter_idx" ON "AiKnowledgeCaptureJob"("status", "processAfter");

-- CreateIndex
CREATE INDEX "AiKnowledgeCaptureJob_callId_idx" ON "AiKnowledgeCaptureJob"("callId");

-- CreateIndex
CREATE INDEX "AiKnowledgeCaptureJob_userId_createdAt_idx" ON "AiKnowledgeCaptureJob"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiKnowledgeCaptureJob_questionHash_idx" ON "AiKnowledgeCaptureJob"("questionHash");

-- CreateIndex
CREATE UNIQUE INDEX "AiSkillCandidate_name_key" ON "AiSkillCandidate"("name");

-- CreateIndex
CREATE INDEX "AiSkillCandidate_status_updatedAt_idx" ON "AiSkillCandidate"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "AiSkillCandidate_roleScope_idx" ON "AiSkillCandidate"("roleScope");

-- CreateIndex
CREATE INDEX "AiSkillCandidate_reviewedById_idx" ON "AiSkillCandidate"("reviewedById");

-- CreateIndex
CREATE INDEX "AiSkillInstallLog_candidateId_createdAt_idx" ON "AiSkillInstallLog"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "AiSkillInstallLog_operatorId_createdAt_idx" ON "AiSkillInstallLog"("operatorId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiKnowledgeEntry" ADD CONSTRAINT "AiKnowledgeEntry_sourceUserId_fkey" FOREIGN KEY ("sourceUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiKnowledgeEntry" ADD CONSTRAINT "AiKnowledgeEntry_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiKnowledgeRevision" ADD CONSTRAINT "AiKnowledgeRevision_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "AiKnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiKnowledgeRevision" ADD CONSTRAINT "AiKnowledgeRevision_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiKnowledgeHit" ADD CONSTRAINT "AiKnowledgeHit_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "AiKnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiKnowledgeHit" ADD CONSTRAINT "AiKnowledgeHit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiKnowledgeFeedback" ADD CONSTRAINT "AiKnowledgeFeedback_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "AiKnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiKnowledgeFeedback" ADD CONSTRAINT "AiKnowledgeFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSkillCandidate" ADD CONSTRAINT "AiSkillCandidate_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSkillInstallLog" ADD CONSTRAINT "AiSkillInstallLog_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "AiSkillCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSkillInstallLog" ADD CONSTRAINT "AiSkillInstallLog_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
