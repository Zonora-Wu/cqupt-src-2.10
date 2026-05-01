CREATE TABLE "CaptchaChallenge" (
    "id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "answerRatio" DOUBLE PRECISION NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaptchaChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaptchaToken" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaptchaToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaptchaToken_tokenHash_key" ON "CaptchaToken"("tokenHash");
CREATE INDEX "CaptchaChallenge_purpose_expiresAt_idx" ON "CaptchaChallenge"("purpose", "expiresAt");
CREATE INDEX "CaptchaChallenge_ipAddress_createdAt_idx" ON "CaptchaChallenge"("ipAddress", "createdAt");
CREATE INDEX "CaptchaToken_challengeId_idx" ON "CaptchaToken"("challengeId");
CREATE INDEX "CaptchaToken_purpose_expiresAt_idx" ON "CaptchaToken"("purpose", "expiresAt");

ALTER TABLE "CaptchaToken" ADD CONSTRAINT "CaptchaToken_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "CaptchaChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
