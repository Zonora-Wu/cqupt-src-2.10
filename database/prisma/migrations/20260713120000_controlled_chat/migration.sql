CREATE TYPE "ChatConversationType" AS ENUM ('DIRECT', 'GROUP', 'GLOBAL');
CREATE TYPE "ChatConversationStatus" AS ENUM ('OPEN', 'CLOSED', 'DISSOLVED');
CREATE TYPE "ChatMemberRole" AS ENUM ('OWNER', 'MEMBER');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CHAT_MESSAGE_BLOCKED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CHAT_CONVERSATION_MANAGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CHAT_USER_RESTRICTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CHAT_RECORDS_EXPORTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CHAT_RECORDS_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CHAT_RECORDS_VIEWED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CHAT_SENSITIVE_WORD_MANAGED';

CREATE TABLE "ChatConversation" (
  "id" TEXT NOT NULL,
  "type" "ChatConversationType" NOT NULL,
  "status" "ChatConversationStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT,
  "directKey" TEXT,
  "directInitiatorId" TEXT,
  "strangerMessageCount" INTEGER NOT NULL DEFAULT 0,
  "acceptedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "closedById" TEXT,
  "closedReason" TEXT,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatConversationMember" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "ChatMemberRole" NOT NULL DEFAULT 'MEMBER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  "lastReadMessageId" TEXT,
  "lastReadAt" TIMESTAMP(3),
  CONSTRAINT "ChatConversationMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "clientMessageId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatUserRestriction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "disabledById" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "disabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "liftedAt" TIMESTAMP(3),
  CONSTRAINT "ChatUserRestriction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatSensitiveWord" (
  "id" TEXT NOT NULL,
  "term" TEXT NOT NULL,
  "normalizedTerm" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatSensitiveWord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatConversation_directKey_key" ON "ChatConversation"("directKey");
CREATE UNIQUE INDEX "ChatConversationMember_conversationId_userId_key" ON "ChatConversationMember"("conversationId", "userId");
CREATE UNIQUE INDEX "ChatMessage_senderId_clientMessageId_key" ON "ChatMessage"("senderId", "clientMessageId");
CREATE UNIQUE INDEX "ChatUserRestriction_userId_key" ON "ChatUserRestriction"("userId");
CREATE UNIQUE INDEX "ChatSensitiveWord_normalizedTerm_key" ON "ChatSensitiveWord"("normalizedTerm");
CREATE UNIQUE INDEX "ChatConversation_one_global" ON "ChatConversation"("type") WHERE "type" = 'GLOBAL';
CREATE INDEX "ChatConversation_type_status_idx" ON "ChatConversation"("type", "status");
CREATE INDEX "ChatConversation_updatedAt_idx" ON "ChatConversation"("updatedAt");
CREATE INDEX "ChatConversationMember_userId_removedAt_idx" ON "ChatConversationMember"("userId", "removedAt");
CREATE INDEX "ChatMessage_conversationId_createdAt_id_idx" ON "ChatMessage"("conversationId", "createdAt", "id");
CREATE INDEX "ChatUserRestriction_expiresAt_liftedAt_idx" ON "ChatUserRestriction"("expiresAt", "liftedAt");
CREATE INDEX "ChatSensitiveWord_active_idx" ON "ChatSensitiveWord"("active");

ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_directInitiatorId_fkey" FOREIGN KEY ("directInitiatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatConversationMember" ADD CONSTRAINT "ChatConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatConversationMember" ADD CONSTRAINT "ChatConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChatConversationMember" ADD CONSTRAINT "ChatConversationMember_lastReadMessageId_fkey" FOREIGN KEY ("lastReadMessageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatUserRestriction" ADD CONSTRAINT "ChatUserRestriction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatUserRestriction" ADD CONSTRAINT "ChatUserRestriction_disabledById_fkey" FOREIGN KEY ("disabledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChatSensitiveWord" ADD CONSTRAINT "ChatSensitiveWord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_direct_shape" CHECK (
  ("type" = 'DIRECT' AND "directKey" IS NOT NULL) OR ("type" <> 'DIRECT' AND "directKey" IS NULL)
);
