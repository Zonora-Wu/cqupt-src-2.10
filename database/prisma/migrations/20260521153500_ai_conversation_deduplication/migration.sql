-- Add duplicate detection and merge suggestion metadata for AI knowledge conversation learning.
ALTER TABLE "AiKnowledgeConversation"
  ADD COLUMN "duplicateRiskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "similarKnowledgeMatches" JSONB,
  ADD COLUMN "mergeSuggestion" TEXT;
