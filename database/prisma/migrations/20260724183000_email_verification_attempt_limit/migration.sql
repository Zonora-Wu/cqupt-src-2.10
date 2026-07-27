ALTER TABLE "EmailVerificationCode"
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "HumanVerificationNonce" (
    "nonceHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HumanVerificationNonce_pkey" PRIMARY KEY ("nonceHash")
);

CREATE INDEX "HumanVerificationNonce_expiresAt_idx"
ON "HumanVerificationNonce"("expiresAt");
