ALTER TABLE "AiUserQuota"
  ADD COLUMN "dailyLimit" INTEGER,
  ADD COLUMN "weeklyLimit" INTEGER;

UPDATE "AiUserQuota"
SET
  "dailyLimit" = "monthlyLimit",
  "weeklyLimit" = "monthlyLimit"
WHERE "dailyLimit" IS NULL OR "weeklyLimit" IS NULL;
