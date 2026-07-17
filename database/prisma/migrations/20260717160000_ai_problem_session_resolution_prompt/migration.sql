-- AlterTable
ALTER TABLE "AiProblemSession"
  ADD COLUMN "resolutionPromptedAt" TIMESTAMP(3),
  ADD COLUMN "resolutionSnoozedUntil" TIMESTAMP(3),
  ADD COLUMN "resolutionPromptCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "AiProblemSession_resolutionSnoozedUntil_idx" ON "AiProblemSession"("resolutionSnoozedUntil");
