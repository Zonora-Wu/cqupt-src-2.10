ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'NOTIFICATION_DELIVERY';

CREATE TABLE "PlatformNotification" (
  "id" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "channelTitle" TEXT NOT NULL,
  "iconType" TEXT NOT NULL,
  "menuScope" TEXT,
  "content" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "route" TEXT,
  "emailRequired" BOOLEAN NOT NULL DEFAULT false,
  "emailStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  "emailAttemptedAt" TIMESTAMP(3),
  "emailError" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformNotification_eventKey_key" ON "PlatformNotification"("eventKey");
CREATE INDEX "PlatformNotification_recipientId_readAt_createdAt_idx" ON "PlatformNotification"("recipientId", "readAt", "createdAt");
CREATE INDEX "PlatformNotification_recipientId_menuScope_readAt_idx" ON "PlatformNotification"("recipientId", "menuScope", "readAt");
CREATE INDEX "PlatformNotification_recipientId_channelId_createdAt_idx" ON "PlatformNotification"("recipientId", "channelId", "createdAt");
CREATE INDEX "PlatformNotification_entityType_entityId_idx" ON "PlatformNotification"("entityType", "entityId");
ALTER TABLE "PlatformNotification" ADD CONSTRAINT "PlatformNotification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
