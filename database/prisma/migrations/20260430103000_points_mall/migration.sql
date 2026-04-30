-- Upgrade points mall to a transaction-safe offline pickup flow.

ALTER TYPE "MallRedemptionStatus" RENAME VALUE 'PICKED_UP' TO 'COMPLETED';
ALTER TYPE "MallRedemptionStatus" RENAME VALUE 'CANCELLED' TO 'CANCELED';
ALTER TYPE "MallRedemptionStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

CREATE TYPE "MallProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MANAGE_MALL';

ALTER TABLE "MallProduct"
  ADD COLUMN "category" TEXT NOT NULL DEFAULT '实体奖励',
  ADD COLUMN "status" "MallProductStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "perUserLimit" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "pickupInstructions" TEXT,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "createdById" TEXT;

UPDATE "MallProduct"
SET "status" = CASE
  WHEN "active" = true THEN 'ACTIVE'::"MallProductStatus"
  ELSE 'INACTIVE'::"MallProductStatus"
END;

ALTER TABLE "MallProduct"
  ALTER COLUMN "pickupLocation" SET DEFAULT '蓝山工作室',
  DROP COLUMN "active";

ALTER TABLE "MallProduct"
  ADD CONSTRAINT "MallProduct_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MallRedemption"
  RENAME COLUMN "pickedUpAt" TO "completedAt";

ALTER TABLE "MallRedemption"
  RENAME COLUMN "cancelledAt" TO "canceledAt";

ALTER TABLE "MallRedemption"
  ADD COLUMN "expiresAt" TIMESTAMP(3);

ALTER TABLE "MallRedemption"
  ALTER COLUMN "note" TYPE TEXT;

ALTER TABLE "PointLedgerEntry"
  ADD COLUMN "redemptionId" TEXT;

ALTER TABLE "PointLedgerEntry"
  ADD CONSTRAINT "PointLedgerEntry_redemptionId_fkey"
  FOREIGN KEY ("redemptionId") REFERENCES "MallRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MallRedemptionEvent" (
  "id" TEXT NOT NULL,
  "redemptionId" TEXT NOT NULL,
  "actorId" TEXT,
  "fromStatus" "MallRedemptionStatus",
  "toStatus" "MallRedemptionStatus" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MallRedemptionEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MallRedemptionEvent"
  ADD CONSTRAINT "MallRedemptionEvent_redemptionId_fkey"
  FOREIGN KEY ("redemptionId") REFERENCES "MallRedemption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PointLedgerEntry_redemptionId_idx" ON "PointLedgerEntry"("redemptionId");
CREATE INDEX "MallProduct_status_idx" ON "MallProduct"("status");
CREATE INDEX "MallProduct_category_idx" ON "MallProduct"("category");
CREATE INDEX "MallProduct_sortOrder_idx" ON "MallProduct"("sortOrder");
CREATE INDEX "MallRedemptionEvent_redemptionId_createdAt_idx" ON "MallRedemptionEvent"("redemptionId", "createdAt");
