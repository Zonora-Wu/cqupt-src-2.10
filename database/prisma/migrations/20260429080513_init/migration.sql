-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('STUDENT', 'AUDITOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED', 'LOCKED');

-- CreateEnum
CREATE TYPE "AuthorizationLevel" AS ENUM ('BASIC', 'TRUSTED', 'STAFF');

-- CreateEnum
CREATE TYPE "AssetScope" AS ENUM ('PUBLIC', 'INTERNAL', 'SPECIAL');

-- CreateEnum
CREATE TYPE "LoginProvider" AS ENUM ('UNIFIED_CODE_PASSWORD', 'EMAIL_CODE', 'SCHOOL_SSO');

-- CreateEnum
CREATE TYPE "VulnerabilitySeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "VulnerabilityStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_REVIEW', 'NEEDS_SUPPLEMENT', 'CONFIRMED', 'FIXING', 'PENDING_RETEST', 'ARCHIVED', 'CERTIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('VULNERABILITY_REPORT', 'RETEST_EVIDENCE');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('CONFIRM', 'NEEDS_SUPPLEMENT', 'REJECT', 'RETEST_PASS', 'RETURN_TO_FIX', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('PENDING', 'ISSUED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PointDirection" AS ENUM ('IN', 'OUT', 'ADJUST');

-- CreateEnum
CREATE TYPE "MallRedemptionStatus" AS ENUM ('PENDING_PICKUP', 'PICKED_UP', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LearningResourceKind" AS ENUM ('RESOURCE', 'RANGE');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'OFFLINE');

-- CreateEnum
CREATE TYPE "AnnouncementRange" AS ENUM ('ALL', 'STUDENTS', 'AUDITORS', 'ADMINS');

-- CreateEnum
CREATE TYPE "AiSpace" AS ENUM ('STUDENT', 'AUDITOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "AiCallPurpose" AS ENUM ('CHAT', 'VULNERABILITY_PARSE', 'VULNERABILITY_VALUE_REVIEW', 'LEARNING_RECOMMENDATION', 'REPORT_SUMMARY', 'AUDIT_ANALYSIS');

-- CreateEnum
CREATE TYPE "AiProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'CREATE_VULNERABILITY', 'SUBMIT_VULNERABILITY', 'VIEW_SENSITIVE_ATTACHMENT', 'REVIEW_VULNERABILITY', 'CHANGE_VULNERABILITY_STATUS', 'ISSUE_CERTIFICATE', 'REVOKE_CERTIFICATE', 'PUBLISH_ANNOUNCEMENT', 'CHANGE_USER_PERMISSION', 'CHANGE_SYSTEM_SETTING', 'CALL_AI');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "unifiedCode" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "studentNo" TEXT,
    "college" TEXT,
    "grade" TEXT,
    "identityText" TEXT,
    "authorizationLevel" "AuthorizationLevel" NOT NULL DEFAULT 'BASIC',
    "authorizationSourceId" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorizationSource" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorizationSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorizationPolicy" (
    "id" TEXT NOT NULL,
    "level" "AuthorizationLevel" NOT NULL,
    "scope" "AssetScope" NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorizationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" "RoleCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermissionOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityExamAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER,
    "passed" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponsibilityAgreement" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResponsibilityAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponsibilitySignature" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceFingerprint" TEXT,

    CONSTRAINT "ResponsibilitySignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "ownerUnit" TEXT NOT NULL,
    "scope" "AssetScope" NOT NULL DEFAULT 'PUBLIC',
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VulnerabilityReport" (
    "id" TEXT NOT NULL,
    "reportNo" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "assetId" TEXT,
    "title" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetUrl" TEXT,
    "ownerUnit" TEXT,
    "vulnerabilityType" TEXT NOT NULL,
    "selfSeverity" "VulnerabilitySeverity" NOT NULL,
    "finalSeverity" "VulnerabilitySeverity",
    "status" "VulnerabilityStatus" NOT NULL DEFAULT 'DRAFT',
    "reproductionSteps" TEXT NOT NULL,
    "impactAssessment" TEXT NOT NULL,
    "repairSuggestion" TEXT NOT NULL,
    "requestPacket" TEXT,
    "testBoundary" TEXT,
    "aiParsed" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "VulnerabilityReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VulnerabilityAttachment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "pageCount" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "VulnerabilityAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VulnerabilityEvent" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "fromStatus" "VulnerabilityStatus",
    "toStatus" "VulnerabilityStatus",
    "note" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VulnerabilityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewAssignment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "auditorId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewComment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "decision" "ReviewDecision",
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetestRecord" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "testerId" TEXT NOT NULL,
    "result" "ReviewDecision" NOT NULL,
    "note" TEXT,
    "evidenceStorageKey" TEXT,
    "evidenceSha256" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetestRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "certificateNo" TEXT NOT NULL,
    "vulnerabilityId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "issuedById" TEXT,
    "status" "CertificateStatus" NOT NULL DEFAULT 'PENDING',
    "verifyCode" TEXT NOT NULL,
    "publicVerify" BOOLEAN NOT NULL DEFAULT true,
    "contribution" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokeReason" TEXT,
    "pdfStorageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointLedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operatorId" TEXT,
    "reportId" TEXT,
    "direction" "PointDirection" NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MallProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "pickupLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MallProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MallRedemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "handlerId" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "status" "MallRedemptionStatus" NOT NULL DEFAULT 'PENDING_PICKUP',
    "pickupCode" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pickedUpAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "MallRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningResource" (
    "id" TEXT NOT NULL,
    "kind" "LearningResourceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "externalUrl" TEXT NOT NULL,
    "coverUrl" TEXT,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LearningResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "range" "AnnouncementRange" NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "offlineAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCallLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "aiSpace" "AiSpace" NOT NULL,
    "purpose" "AiCallPurpose" NOT NULL,
    "sanitizedInputSummary" TEXT NOT NULL,
    "outputSummary" TEXT,
    "modelName" TEXT,
    "hermesRunId" TEXT,
    "tokensUsed" INTEGER,
    "requiresHumanConfirm" BOOLEAN NOT NULL DEFAULT true,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSkill" (
    "id" TEXT NOT NULL,
    "aiSpace" "AiSpace" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "createdById" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiFaqEntry" (
    "id" TEXT NOT NULL,
    "aiSpace" "AiSpace" NOT NULL,
    "questionKey" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiFaqEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiActionProposal" (
    "id" TEXT NOT NULL,
    "aiSpace" "AiSpace" NOT NULL,
    "requesterId" TEXT,
    "approverId" TEXT,
    "reportId" TEXT,
    "actionType" TEXT NOT NULL,
    "sanitizedReason" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "AiProposalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiActionProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "result" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestPath" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolProfile" (
    "id" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "themeColor" TEXT NOT NULL DEFAULT '#2A6438',
    "emailDomain" TEXT,
    "certificateTemplate" TEXT,
    "ruleText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_unifiedCode_key" ON "User"("unifiedCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_studentNo_key" ON "User"("studentNo");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX "User_authorizationLevel_idx" ON "User"("authorizationLevel");

-- CreateIndex
CREATE INDEX "User_authorizationSourceId_idx" ON "User"("authorizationSourceId");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizationSource_code_key" ON "AuthorizationSource"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizationPolicy_level_scope_key" ON "AuthorizationPolicy"("level", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "UserPermissionOverride_permissionId_idx" ON "UserPermissionOverride"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionOverride_userId_permissionId_key" ON "UserPermissionOverride"("userId", "permissionId");

-- CreateIndex
CREATE INDEX "EmailVerificationCode_email_idx" ON "EmailVerificationCode"("email");

-- CreateIndex
CREATE INDEX "EmailVerificationCode_expiresAt_idx" ON "EmailVerificationCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "SecurityExamAttempt_userId_passed_idx" ON "SecurityExamAttempt"("userId", "passed");

-- CreateIndex
CREATE UNIQUE INDEX "ResponsibilityAgreement_version_key" ON "ResponsibilityAgreement"("version");

-- CreateIndex
CREATE INDEX "ResponsibilitySignature_signedAt_idx" ON "ResponsibilitySignature"("signedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResponsibilitySignature_userId_agreementId_key" ON "ResponsibilitySignature"("userId", "agreementId");

-- CreateIndex
CREATE INDEX "Asset_ownerUnit_idx" ON "Asset"("ownerUnit");

-- CreateIndex
CREATE INDEX "Asset_scope_idx" ON "Asset"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "VulnerabilityReport_reportNo_key" ON "VulnerabilityReport"("reportNo");

-- CreateIndex
CREATE INDEX "VulnerabilityReport_submitterId_idx" ON "VulnerabilityReport"("submitterId");

-- CreateIndex
CREATE INDEX "VulnerabilityReport_assetId_idx" ON "VulnerabilityReport"("assetId");

-- CreateIndex
CREATE INDEX "VulnerabilityReport_status_idx" ON "VulnerabilityReport"("status");

-- CreateIndex
CREATE INDEX "VulnerabilityReport_finalSeverity_idx" ON "VulnerabilityReport"("finalSeverity");

-- CreateIndex
CREATE INDEX "VulnerabilityReport_createdAt_idx" ON "VulnerabilityReport"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VulnerabilityAttachment_storageKey_key" ON "VulnerabilityAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "VulnerabilityAttachment_reportId_idx" ON "VulnerabilityAttachment"("reportId");

-- CreateIndex
CREATE INDEX "VulnerabilityAttachment_sha256_idx" ON "VulnerabilityAttachment"("sha256");

-- CreateIndex
CREATE INDEX "VulnerabilityEvent_reportId_createdAt_idx" ON "VulnerabilityEvent"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "VulnerabilityEvent_actorId_idx" ON "VulnerabilityEvent"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewAssignment_reportId_key" ON "ReviewAssignment"("reportId");

-- CreateIndex
CREATE INDEX "ReviewAssignment_auditorId_idx" ON "ReviewAssignment"("auditorId");

-- CreateIndex
CREATE INDEX "ReviewComment_reportId_idx" ON "ReviewComment"("reportId");

-- CreateIndex
CREATE INDEX "ReviewComment_authorId_idx" ON "ReviewComment"("authorId");

-- CreateIndex
CREATE INDEX "RetestRecord_reportId_idx" ON "RetestRecord"("reportId");

-- CreateIndex
CREATE INDEX "RetestRecord_testerId_idx" ON "RetestRecord"("testerId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_certificateNo_key" ON "Certificate"("certificateNo");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_vulnerabilityId_key" ON "Certificate"("vulnerabilityId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_verifyCode_key" ON "Certificate"("verifyCode");

-- CreateIndex
CREATE INDEX "Certificate_recipientId_idx" ON "Certificate"("recipientId");

-- CreateIndex
CREATE INDEX "Certificate_issuedById_idx" ON "Certificate"("issuedById");

-- CreateIndex
CREATE INDEX "Certificate_status_idx" ON "Certificate"("status");

-- CreateIndex
CREATE INDEX "PointLedgerEntry_userId_createdAt_idx" ON "PointLedgerEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PointLedgerEntry_reportId_idx" ON "PointLedgerEntry"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "MallRedemption_pickupCode_key" ON "MallRedemption"("pickupCode");

-- CreateIndex
CREATE INDEX "MallRedemption_userId_idx" ON "MallRedemption"("userId");

-- CreateIndex
CREATE INDEX "MallRedemption_productId_idx" ON "MallRedemption"("productId");

-- CreateIndex
CREATE INDEX "MallRedemption_status_idx" ON "MallRedemption"("status");

-- CreateIndex
CREATE INDEX "LearningResource_kind_idx" ON "LearningResource"("kind");

-- CreateIndex
CREATE INDEX "LearningResource_active_idx" ON "LearningResource"("active");

-- CreateIndex
CREATE INDEX "Announcement_status_idx" ON "Announcement"("status");

-- CreateIndex
CREATE INDEX "Announcement_range_idx" ON "Announcement"("range");

-- CreateIndex
CREATE INDEX "Announcement_pinned_idx" ON "Announcement"("pinned");

-- CreateIndex
CREATE INDEX "AiCallLog_aiSpace_purpose_idx" ON "AiCallLog"("aiSpace", "purpose");

-- CreateIndex
CREATE INDEX "AiCallLog_userId_createdAt_idx" ON "AiCallLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiSkill_aiSpace_idx" ON "AiSkill"("aiSpace");

-- CreateIndex
CREATE INDEX "AiSkill_active_idx" ON "AiSkill"("active");

-- CreateIndex
CREATE INDEX "AiFaqEntry_active_idx" ON "AiFaqEntry"("active");

-- CreateIndex
CREATE UNIQUE INDEX "AiFaqEntry_aiSpace_questionKey_key" ON "AiFaqEntry"("aiSpace", "questionKey");

-- CreateIndex
CREATE INDEX "AiActionProposal_aiSpace_status_idx" ON "AiActionProposal"("aiSpace", "status");

-- CreateIndex
CREATE INDEX "AiActionProposal_reportId_idx" ON "AiActionProposal"("reportId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_authorizationSourceId_fkey" FOREIGN KEY ("authorizationSourceId") REFERENCES "AuthorizationSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationCode" ADD CONSTRAINT "EmailVerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityExamAttempt" ADD CONSTRAINT "SecurityExamAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilitySignature" ADD CONSTRAINT "ResponsibilitySignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilitySignature" ADD CONSTRAINT "ResponsibilitySignature_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "ResponsibilityAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VulnerabilityReport" ADD CONSTRAINT "VulnerabilityReport_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VulnerabilityReport" ADD CONSTRAINT "VulnerabilityReport_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VulnerabilityAttachment" ADD CONSTRAINT "VulnerabilityAttachment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "VulnerabilityReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VulnerabilityAttachment" ADD CONSTRAINT "VulnerabilityAttachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VulnerabilityEvent" ADD CONSTRAINT "VulnerabilityEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "VulnerabilityReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VulnerabilityEvent" ADD CONSTRAINT "VulnerabilityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "VulnerabilityReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "VulnerabilityReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetestRecord" ADD CONSTRAINT "RetestRecord_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "VulnerabilityReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetestRecord" ADD CONSTRAINT "RetestRecord_testerId_fkey" FOREIGN KEY ("testerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_vulnerabilityId_fkey" FOREIGN KEY ("vulnerabilityId") REFERENCES "VulnerabilityReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointLedgerEntry" ADD CONSTRAINT "PointLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointLedgerEntry" ADD CONSTRAINT "PointLedgerEntry_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointLedgerEntry" ADD CONSTRAINT "PointLedgerEntry_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "VulnerabilityReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MallRedemption" ADD CONSTRAINT "MallRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MallRedemption" ADD CONSTRAINT "MallRedemption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MallProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MallRedemption" ADD CONSTRAINT "MallRedemption_handlerId_fkey" FOREIGN KEY ("handlerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCallLog" ADD CONSTRAINT "AiCallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSkill" ADD CONSTRAINT "AiSkill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiFaqEntry" ADD CONSTRAINT "AiFaqEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiActionProposal" ADD CONSTRAINT "AiActionProposal_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiActionProposal" ADD CONSTRAINT "AiActionProposal_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiActionProposal" ADD CONSTRAINT "AiActionProposal_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "VulnerabilityReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
