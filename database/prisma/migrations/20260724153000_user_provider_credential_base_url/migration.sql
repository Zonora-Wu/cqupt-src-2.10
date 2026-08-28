ALTER TABLE "AiProviderPreset"
ADD COLUMN IF NOT EXISTS "baseUrl" TEXT;

UPDATE "AiProviderPreset"
SET "baseUrl" = CASE "id"
  WHEN 'deepseek' THEN 'https://api.deepseek.com/'
  WHEN 'moonshot' THEN 'https://api.moonshot.cn/v1/'
  WHEN 'zhipu' THEN 'https://open.bigmodel.cn/api/paas/v4/'
  WHEN 'qwen' THEN 'https://dashscope.aliyuncs.com/compatible-mode/v1/'
  WHEN 'siliconflow' THEN 'https://api.siliconflow.cn/v1/'
  WHEN 'modelscope' THEN 'https://api-inference.modelscope.cn/v1/'
  WHEN 'openai' THEN 'https://api.openai.com/v1/'
  WHEN 'openrouter' THEN 'https://openrouter.ai/api/v1/'
  WHEN 'xai' THEN 'https://api.x.ai/v1/'
  WHEN 'mistral' THEN 'https://api.mistral.ai/v1/'
  WHEN 'groq' THEN 'https://api.groq.com/openai/v1/'
  ELSE ''
END
WHERE "baseUrl" IS NULL;

ALTER TABLE "AiProviderPreset"
ALTER COLUMN "baseUrl" SET NOT NULL;

ALTER TABLE "UserProviderCredential"
ADD COLUMN IF NOT EXISTS "baseUrl" TEXT;

UPDATE "UserProviderCredential" AS credential
SET "baseUrl" = provider."baseUrl"
FROM "AiProviderPreset" AS provider
WHERE credential."providerId" = provider."id"
  AND credential."baseUrl" IS NULL;

ALTER TABLE "UserProviderCredential"
ALTER COLUMN "baseUrl" SET NOT NULL;
