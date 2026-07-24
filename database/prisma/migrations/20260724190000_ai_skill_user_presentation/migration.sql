ALTER TABLE "AiSkill"
ADD COLUMN "visibleToUsers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "defaultPinnedForUsers" BOOLEAN NOT NULL DEFAULT false;

UPDATE "AiSkill"
SET "visibleToUsers" = true
WHERE "lifecycleStatus" = 'PUBLISHED'
  AND "roleScope" IN ('ALL', 'STUDENT');

CREATE INDEX "AiSkill_visibleToUsers_defaultPinnedForUsers_idx"
ON "AiSkill"("visibleToUsers", "defaultPinnedForUsers");
