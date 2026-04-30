-- Add dedicated audit action for learning resource management.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MANAGE_LEARNING_RESOURCE';

-- Add resource category for filtering and management.
ALTER TABLE "LearningResource" ADD COLUMN "category" TEXT NOT NULL DEFAULT '学习资料';

CREATE INDEX "LearningResource_category_idx" ON "LearningResource"("category");

