-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "templateSnapshot" JSONB;

-- CreateTable
CREATE TABLE "CertificateTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "templateStorageKey" TEXT NOT NULL,
    "templateMimeType" TEXT NOT NULL,
    "templateSizeBytes" INTEGER NOT NULL,
    "templateSha256" TEXT NOT NULL,
    "sealStorageKey" TEXT,
    "sealMimeType" TEXT,
    "sealSizeBytes" INTEGER,
    "sealSha256" TEXT,
    "layoutJson" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CertificateTemplate_version_key" ON "CertificateTemplate"("version");

-- CreateIndex
CREATE INDEX "CertificateTemplate_active_idx" ON "CertificateTemplate"("active");

-- CreateIndex
CREATE INDEX "CertificateTemplate_createdById_idx" ON "CertificateTemplate"("createdById");

-- CreateIndex
CREATE INDEX "Certificate_templateId_idx" ON "Certificate"("templateId");

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateTemplate" ADD CONSTRAINT "CertificateTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
