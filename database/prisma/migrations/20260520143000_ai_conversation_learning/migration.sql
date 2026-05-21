-- Conversation-level AI knowledge learning: group multi-turn troubleshooting into reviewable episodes.

CREATE TYPE "AiKnowledgeConversationStatus" AS ENUM (
  'ACTIVE',
  'READY_REVIEW',
  'APPROVED_TO_KB',
  'SKILL_CANDIDATE',
  'DISCARDED'
);

CREATE TABLE "AiKnowledgeConversation" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "aiSpace" "AiSpace" NOT NULL,
  "status" "AiKnowledgeConversationStatus" NOT NULL DEFAULT 'ACTIVE',
  "title" TEXT NOT NULL,
  "problemStatement" TEXT NOT NULL,
  "resolutionSummary" TEXT,
  "pitfalls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "environmentNotes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "successfulSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "failedAttempts" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "collectedEvidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "suggestedKnowledgeType" TEXT NOT NULL DEFAULT 'KB',
  "autoDecisionReason" TEXT,
  "topicKey" TEXT NOT NULL,
  "turnCount" INTEGER NOT NULL DEFAULT 0,
  "lastUserMessage" TEXT,
  "sourceCallIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiKnowledgeConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiKnowledgeConversationTurn" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "callId" TEXT,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiKnowledgeConversationTurn_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AiKnowledgeEntry" ADD COLUMN "sourceConversationId" TEXT;

CREATE INDEX "AiKnowledgeConversation_status_updatedAt_idx" ON "AiKnowledgeConversation"("status", "updatedAt");
CREATE INDEX "AiKnowledgeConversation_userId_aiSpace_updatedAt_idx" ON "AiKnowledgeConversation"("userId", "aiSpace", "updatedAt");
CREATE INDEX "AiKnowledgeConversation_aiSpace_topicKey_updatedAt_idx" ON "AiKnowledgeConversation"("aiSpace", "topicKey", "updatedAt");
CREATE INDEX "AiKnowledgeConversationTurn_conversationId_createdAt_idx" ON "AiKnowledgeConversationTurn"("conversationId", "createdAt");
CREATE INDEX "AiKnowledgeConversationTurn_contentHash_idx" ON "AiKnowledgeConversationTurn"("contentHash");
CREATE UNIQUE INDEX "AiKnowledgeConversationTurn_conversationId_contentHash_key" ON "AiKnowledgeConversationTurn"("conversationId", "contentHash");
CREATE INDEX "AiKnowledgeEntry_sourceConversationId_idx" ON "AiKnowledgeEntry"("sourceConversationId");

ALTER TABLE "AiKnowledgeConversation"
  ADD CONSTRAINT "AiKnowledgeConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiKnowledgeConversation"
  ADD CONSTRAINT "AiKnowledgeConversation_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiKnowledgeConversationTurn"
  ADD CONSTRAINT "AiKnowledgeConversationTurn_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiKnowledgeConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiKnowledgeEntry"
  ADD CONSTRAINT "AiKnowledgeEntry_sourceConversationId_fkey" FOREIGN KEY ("sourceConversationId") REFERENCES "AiKnowledgeConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
