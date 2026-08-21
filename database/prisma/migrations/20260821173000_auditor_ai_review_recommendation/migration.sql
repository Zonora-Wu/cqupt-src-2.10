CREATE TYPE "AiVulnerabilityReviewRecommendation" AS ENUM ('CONFIRM', 'NEEDS_SUPPLEMENT', 'REJECT');

ALTER TABLE "VulnerabilityAiAdvice"
ADD COLUMN "recommendedAction" "AiVulnerabilityReviewRecommendation",
ADD COLUMN "recommendationReason" TEXT;
