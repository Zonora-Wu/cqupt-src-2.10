CREATE TYPE "AiUserModelPolicy" AS ENUM ('USER_PLATFORM_ONLY', 'USER_BYOK_ONLY', 'USER_HYBRID');
CREATE TYPE "AiProviderCategory" AS ENUM ('OFFICIAL', 'AGGREGATOR', 'RELAY');
CREATE TYPE "AiCredentialStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "AiModelSource" AS ENUM ('PLATFORM', 'USER_BYOK');
CREATE TYPE "AiAgentRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "AiModelPurpose" AS ENUM ('GLOBAL', 'USER_INTERACTIVE', 'ADMIN_INTERACTIVE', 'AUDITOR_INTERACTIVE', 'BACKGROUND_TASK', 'STRUCTURED_ANALYSIS', 'SKILL_GENERATION');

CREATE TABLE "AiModelPolicy" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "userMode" "AiUserModelPolicy" NOT NULL DEFAULT 'USER_PLATFORM_ONLY',
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiModelPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiProviderPreset" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "AiProviderCategory" NOT NULL,
  "protocol" TEXT NOT NULL DEFAULT 'OPENAI_COMPATIBLE',
  "modelsPath" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "source" TEXT NOT NULL DEFAULT 'PLATFORM',
  "sourceCommit" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiProviderPreset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserProviderCredential" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "ciphertext" TEXT NOT NULL,
  "iv" TEXT NOT NULL,
  "authTag" TEXT NOT NULL,
  "keyVersion" INTEGER NOT NULL DEFAULT 1,
  "lastFour" TEXT NOT NULL,
  "status" "AiCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
  "consentVersion" TEXT NOT NULL,
  "consentedAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserProviderCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserProviderConsent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "UserProviderConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserModelProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserModelProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAgentRun" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "source" "AiModelSource" NOT NULL,
  "modelName" TEXT NOT NULL,
  "providerId" TEXT,
  "credentialId" TEXT,
  "purpose" "AiCallPurpose" NOT NULL,
  "status" "AiAgentRunStatus" NOT NULL DEFAULT 'RUNNING',
  "policySnapshot" JSONB NOT NULL,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "errorCode" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AiAgentRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserProviderCredential_userId_status_idx" ON "UserProviderCredential"("userId", "status");
CREATE INDEX "UserProviderCredential_providerId_idx" ON "UserProviderCredential"("providerId");
CREATE UNIQUE INDEX "UserProviderConsent_credentialId_version_key" ON "UserProviderConsent"("credentialId", "version");
CREATE INDEX "UserProviderConsent_userId_revokedAt_idx" ON "UserProviderConsent"("userId", "revokedAt");
CREATE UNIQUE INDEX "UserModelProfile_credentialId_model_key" ON "UserModelProfile"("credentialId", "model");
CREATE INDEX "UserModelProfile_userId_enabled_idx" ON "UserModelProfile"("userId", "enabled");
CREATE INDEX "UserModelProfile_userId_isDefault_idx" ON "UserModelProfile"("userId", "isDefault");
CREATE INDEX "AiAgentRun_userId_startedAt_idx" ON "AiAgentRun"("userId", "startedAt");
CREATE INDEX "AiAgentRun_status_startedAt_idx" ON "AiAgentRun"("status", "startedAt");

ALTER TABLE "UserProviderCredential" ADD CONSTRAINT "UserProviderCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProviderCredential" ADD CONSTRAINT "UserProviderCredential_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AiProviderPreset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserProviderConsent" ADD CONSTRAINT "UserProviderConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProviderConsent" ADD CONSTRAINT "UserProviderConsent_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "UserProviderCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserModelProfile" ADD CONSTRAINT "UserModelProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserModelProfile" ADD CONSTRAINT "UserModelProfile_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "UserProviderCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiAgentRun" ADD CONSTRAINT "AiAgentRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PlatformProviderCredential" (
  "id" TEXT NOT NULL, "providerId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "ciphertext" TEXT NOT NULL, "iv" TEXT NOT NULL, "authTag" TEXT NOT NULL,
  "keyVersion" INTEGER NOT NULL DEFAULT 1, "lastFour" TEXT NOT NULL,
  "status" "AiCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformProviderCredential_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PlatformModelRoute" (
  "id" TEXT NOT NULL, "purpose" "AiModelPurpose" NOT NULL, "priority" INTEGER NOT NULL,
  "credentialId" TEXT NOT NULL, "baseUrl" TEXT NOT NULL, "model" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true, "automaticFailover" BOOLEAN NOT NULL DEFAULT true,
  "failureThreshold" INTEGER NOT NULL DEFAULT 3, "cooldownSeconds" INTEGER NOT NULL DEFAULT 60,
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0, "circuitOpenUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformModelRoute_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AiAgentRunStep" (
  "id" TEXT NOT NULL, "runId" TEXT NOT NULL, "sequence" INTEGER NOT NULL,
  "kind" TEXT NOT NULL, "status" TEXT NOT NULL, "summary" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
  CONSTRAINT "AiAgentRunStep_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AiAgentToolCall" (
  "id" TEXT NOT NULL, "runId" TEXT NOT NULL, "callId" TEXT NOT NULL,
  "toolName" TEXT NOT NULL, "status" TEXT NOT NULL, "argumentHash" TEXT NOT NULL,
  "resultSummary" TEXT, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
  CONSTRAINT "AiAgentToolCall_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AiAgentUsage" (
  "id" TEXT NOT NULL, "runId" TEXT NOT NULL, "inputTokens" INTEGER, "outputTokens" INTEGER,
  "cachedTokens" INTEGER, "reasoningTokens" INTEGER, "usageConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiAgentUsage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlatformProviderCredential_providerId_status_idx" ON "PlatformProviderCredential"("providerId", "status");
CREATE UNIQUE INDEX "PlatformModelRoute_purpose_priority_key" ON "PlatformModelRoute"("purpose", "priority");
CREATE INDEX "PlatformModelRoute_purpose_enabled_priority_idx" ON "PlatformModelRoute"("purpose", "enabled", "priority");
CREATE UNIQUE INDEX "AiAgentRunStep_runId_sequence_key" ON "AiAgentRunStep"("runId", "sequence");
CREATE UNIQUE INDEX "AiAgentToolCall_runId_callId_key" ON "AiAgentToolCall"("runId", "callId");
CREATE INDEX "AiAgentToolCall_runId_startedAt_idx" ON "AiAgentToolCall"("runId", "startedAt");
CREATE UNIQUE INDEX "AiAgentUsage_runId_key" ON "AiAgentUsage"("runId");
ALTER TABLE "PlatformModelRoute" ADD CONSTRAINT "PlatformModelRoute_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "PlatformProviderCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiAgentRunStep" ADD CONSTRAINT "AiAgentRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AiAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiAgentToolCall" ADD CONSTRAINT "AiAgentToolCall_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AiAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiAgentUsage" ADD CONSTRAINT "AiAgentUsage_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AiAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TYPE "AiSkillLifecycleStatus" ADD VALUE 'ACTIVE_PRIVATE';
ALTER TYPE "AiSkillLifecycleStatus" ADD VALUE 'SUBMITTED';
ALTER TYPE "AiSkillLifecycleStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "AiSkillLifecycleStatus" ADD VALUE 'CHANGES_REQUESTED';
ALTER TYPE "AiSkillLifecycleStatus" ADD VALUE 'REJECTED';
ALTER TYPE "AiSkillLifecycleStatus" ADD VALUE 'DISABLED';
ALTER TYPE "AiSkillLifecycleStatus" ADD VALUE 'ARCHIVED';

CREATE TABLE "AiSkillFile" (
  "id" TEXT NOT NULL, "skillId" TEXT NOT NULL, "path" TEXT NOT NULL,
  "content" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiSkillFile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AiSkillToolGrant" (
  "id" TEXT NOT NULL, "skillId" TEXT NOT NULL, "toolName" TEXT NOT NULL,
  "approved" BOOLEAN NOT NULL DEFAULT false, "approvedAt" TIMESTAMP(3), "approvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiSkillToolGrant_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AiSkillReview" (
  "id" TEXT NOT NULL, "skillId" TEXT NOT NULL, "revisionId" TEXT NOT NULL,
  "reviewerId" TEXT, "status" TEXT NOT NULL DEFAULT 'PENDING', "note" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiSkillReview_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AiConversationSkillPin" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "sessionId" TEXT NOT NULL,
  "skillId" TEXT NOT NULL, "revisionId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiConversationSkillPin_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiSkillFile_skillId_path_key" ON "AiSkillFile"("skillId", "path");
CREATE INDEX "AiSkillFile_skillId_idx" ON "AiSkillFile"("skillId");
CREATE UNIQUE INDEX "AiSkillToolGrant_skillId_toolName_key" ON "AiSkillToolGrant"("skillId", "toolName");
CREATE INDEX "AiSkillReview_status_submittedAt_idx" ON "AiSkillReview"("status", "submittedAt");
CREATE INDEX "AiSkillReview_skillId_createdAt_idx" ON "AiSkillReview"("skillId", "createdAt");
CREATE UNIQUE INDEX "AiConversationSkillPin_sessionId_skillId_key" ON "AiConversationSkillPin"("sessionId", "skillId");
CREATE INDEX "AiConversationSkillPin_userId_sessionId_idx" ON "AiConversationSkillPin"("userId", "sessionId");
ALTER TABLE "AiSkillFile" ADD CONSTRAINT "AiSkillFile_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "AiSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSkillToolGrant" ADD CONSTRAINT "AiSkillToolGrant_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "AiSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSkillReview" ADD CONSTRAINT "AiSkillReview_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "AiSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSkillReview" ADD CONSTRAINT "AiSkillReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiConversationSkillPin" ADD CONSTRAINT "AiConversationSkillPin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiConversationSkillPin" ADD CONSTRAINT "AiConversationSkillPin_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "AiSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiProblemSession" ADD COLUMN "modelBindingKey" TEXT;
ALTER TABLE "AiProblemSession" ADD COLUMN "modelName" TEXT;
ALTER TABLE "AiProblemSession" ADD COLUMN "modelSource" "AiModelSource";
