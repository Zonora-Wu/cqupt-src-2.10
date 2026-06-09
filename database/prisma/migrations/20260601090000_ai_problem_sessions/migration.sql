CREATE TYPE "AiProblemSessionStatus" AS ENUM (
  'ACTIVE',
  'AWAITING_RESOLUTION',
  'RESOLVED',
  'READY_REVIEW',
  'APPROVED_TO_KB',
  'SKILL_CANDIDATE',
  'DISCARDED',
  'ARCHIVED'
);

CREATE TABLE "AiProblemSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "aiSpace" "AiSpace" NOT NULL,
  "mode" TEXT NOT NULL,
  "title" TEXT,
  "topicKey" TEXT,
  "initialQuestion" TEXT NOT NULL,
  "status" "AiProblemSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "resolutionByUser" BOOLEAN,
  "userOutcomeNote" TEXT,
  "turnCount" INTEGER NOT NULL DEFAULT 0,
  "tokenEstimate" INTEGER NOT NULL DEFAULT 0,
  "summaryJson" JSONB,
  "knowledgeEntryId" TEXT,
  "duplicateRiskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiProblemSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiProblemSessionTurn" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "contentHash" TEXT,
  "sanitizedText" TEXT NOT NULL,
  "sourceCallId" TEXT,
  "hasAttachment" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiProblemSessionTurn_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiProblemSession_userId_status_updatedAt_idx" ON "AiProblemSession"("userId", "status", "updatedAt");
CREATE INDEX "AiProblemSession_topicKey_status_idx" ON "AiProblemSession"("topicKey", "status");
CREATE INDEX "AiProblemSession_status_lastActiveAt_idx" ON "AiProblemSession"("status", "lastActiveAt");
CREATE INDEX "AiProblemSessionTurn_sessionId_createdAt_idx" ON "AiProblemSessionTurn"("sessionId", "createdAt");
CREATE INDEX "AiProblemSessionTurn_contentHash_idx" ON "AiProblemSessionTurn"("contentHash");

ALTER TABLE "AiProblemSession"
  ADD CONSTRAINT "AiProblemSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiProblemSessionTurn"
  ADD CONSTRAINT "AiProblemSessionTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiProblemSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
