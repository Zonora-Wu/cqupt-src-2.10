-- Add AI-assisted scoring and auto-routing metadata for conversation-level knowledge learning.
ALTER TABLE "AiKnowledgeConversation"
  ADD COLUMN "aiOverallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "aiKbScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "aiSkillScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "aiSafetyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "aiPrivacyRiskScore" DOUBLE PRECISION NOT NULL DEFAULT 1,
  ADD COLUMN "aiConfidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "aiAutoApproveThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.88,
  ADD COLUMN "aiReviewThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.62,
  ADD COLUMN "aiEvaluation" JSONB;

CREATE INDEX "AiKnowledgeConversation_aiOverallScore_idx" ON "AiKnowledgeConversation"("aiOverallScore");
CREATE INDEX "AiKnowledgeConversation_aiKbScore_idx" ON "AiKnowledgeConversation"("aiKbScore");
CREATE INDEX "AiKnowledgeConversation_aiSkillScore_idx" ON "AiKnowledgeConversation"("aiSkillScore");
