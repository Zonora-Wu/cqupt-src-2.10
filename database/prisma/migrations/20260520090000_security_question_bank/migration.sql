-- Network security knowledge question bank and graded exam attempts
CREATE TYPE "SecurityQuestionType" AS ENUM ('SINGLE_CHOICE', 'TRUE_FALSE', 'MULTIPLE_CHOICE');

ALTER TYPE "AiCallPurpose" ADD VALUE IF NOT EXISTS 'SECURITY_QUESTION_GENERATION';

ALTER TABLE "SecurityExamAttempt"
  ADD COLUMN IF NOT EXISTS "totalScore" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS "threshold" INTEGER NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS "questionCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "correctCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "detailJson" JSONB;

CREATE TABLE "SecurityQuestion" (
  "id" TEXT NOT NULL,
  "type" "SecurityQuestionType" NOT NULL,
  "stem" TEXT NOT NULL,
  "options" JSONB NOT NULL,
  "answerKeys" TEXT[],
  "explanation" TEXT,
  "source" TEXT NOT NULL DEFAULT 'ADMIN',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SecurityQuestion_type_active_idx" ON "SecurityQuestion"("type", "active");
CREATE INDEX "SecurityQuestion_createdAt_idx" ON "SecurityQuestion"("createdAt");
CREATE INDEX "SecurityQuestion_createdById_idx" ON "SecurityQuestion"("createdById");

ALTER TABLE "SecurityQuestion"
  ADD CONSTRAINT "SecurityQuestion_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
