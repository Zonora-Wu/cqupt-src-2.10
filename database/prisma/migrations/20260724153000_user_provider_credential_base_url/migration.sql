ALTER TABLE "UserProviderCredential"
ADD COLUMN "baseUrl" TEXT;

UPDATE "UserProviderCredential" AS credential
SET "baseUrl" = provider."baseUrl"
FROM "AiProviderPreset" AS provider
WHERE credential."providerId" = provider."id";

ALTER TABLE "UserProviderCredential"
ALTER COLUMN "baseUrl" SET NOT NULL;
