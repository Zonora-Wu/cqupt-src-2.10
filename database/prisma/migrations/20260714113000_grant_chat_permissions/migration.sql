INSERT INTO "Permission" ("id", "code", "name", "createdAt", "updatedAt")
VALUES
  ('migration-chat-use-permission', 'chat:use', '使用聊天', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('migration-chat-manage-permission', 'chat:manage', '管理聊天', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name", "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT
  'migration-chat-use-' || "Role"."code"::text,
  "Role"."id",
  "Permission"."id",
  CURRENT_TIMESTAMP
FROM "Role"
JOIN "Permission" ON "Permission"."code" = 'chat:use'
WHERE "Role"."code" IN ('STUDENT', 'AUDITOR', 'ADMIN')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT
  'migration-chat-manage-admin',
  "Role"."id",
  "Permission"."id",
  CURRENT_TIMESTAMP
FROM "Role"
JOIN "Permission" ON "Permission"."code" = 'chat:manage'
WHERE "Role"."code" = 'ADMIN'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
