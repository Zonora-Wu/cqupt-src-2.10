CREATE TABLE "AiUserQuota" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "monthlyLimit" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiUserQuota_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiUserQuota_userId_key" ON "AiUserQuota"("userId");
CREATE INDEX "AiUserQuota_enabled_idx" ON "AiUserQuota"("enabled");
CREATE INDEX "AiUserQuota_updatedAt_idx" ON "AiUserQuota"("updatedAt");

ALTER TABLE "AiUserQuota"
  ADD CONSTRAINT "AiUserQuota_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
