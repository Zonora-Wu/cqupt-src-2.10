-- AlterTable: add pendingRegistrationApproval to User
ALTER TABLE "User" ADD COLUMN "pendingRegistrationApproval" BOOLEAN NOT NULL DEFAULT false;

-- Seed the default open_registration SystemSetting (enabled by default)
INSERT INTO "SystemSetting" ("id", "key", "value", "description", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'open_registration',
  'true'::jsonb,
  '是否开放自由注册。关闭后，新用户提交注册信息后需等待管理员审核。',
  now(),
  now()
)
ON CONFLICT ("key") DO NOTHING;
