import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { AuditAction } from '@prisma/client'
import { createHash } from 'node:crypto'
import { extname } from 'node:path'
import { S3StorageService } from '../../integrations/object-storage/s3-storage.service'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'
import { CertificateTemplateSummary, UploadedSettingsFile } from './system-settings.types'

const MAX_TEMPLATE_SIZE_BYTES = 20 * 1024 * 1024
const MAX_SEAL_SIZE_BYTES = 5 * 1024 * 1024

const DEFAULT_LAYOUT = {
  certificateNo: { x: 90, y: 74, fontSize: 12 },
  issuedAt: { x: 420, y: 520, fontSize: 14 },
  qrCode: { height: 86, width: 86, x: 72, y: 480 },
  recipientName: { align: 'center', x: 300, y: 220, fontSize: 28 },
  seal: { width: 120, x: 450, y: 430 },
  vulnerabilityTitle: { align: 'center', x: 300, y: 302, fontSize: 16 },
}

@Injectable()
export class SystemSettingsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(S3StorageService)
    private readonly storage: S3StorageService,
  ) {}

  async getActiveCertificateTemplate(): Promise<CertificateTemplateSummary | null> {
    const template = await this.prisma.certificateTemplate.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    })

    return template ? summarizeTemplate(template) : null
  }

  async uploadCertificateTemplateBackground(
    file: UploadedSettingsFile | undefined,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    const validatedFile = validateTemplateFile(file)
    const templateId = createStorageId('tpl')
    const version = createTemplateVersion()
    const originalName = sanitizeOriginalName(validatedFile.originalname)
    const storageKey = `certificate-templates/${templateId}/${originalName}`
    const sha256 = createHash('sha256').update(validatedFile.buffer).digest('hex')

    await this.storage.putObject({
      body: validatedFile.buffer,
      contentType: validatedFile.mimeType,
      key: storageKey,
    })

    const template = await this.prisma.$transaction(async (tx) => {
      await tx.certificateTemplate.updateMany({
        where: { active: true },
        data: { active: false },
      })

      const created = await tx.certificateTemplate.create({
        data: {
          active: true,
          createdById: user.id,
          layoutJson: DEFAULT_LAYOUT,
          name: '默认证书模板',
          templateMimeType: validatedFile.mimeType,
          templateSha256: sha256,
          templateSizeBytes: validatedFile.buffer.length,
          templateStorageKey: storageKey,
          version,
        },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_SYSTEM_SETTING,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            fileName: originalName,
            mimeType: validatedFile.mimeType,
            sha256,
            templateId: created.id,
            version,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: created.id,
          targetType: 'CertificateTemplate',
          userAgent: meta.userAgent,
        },
      })

      return created
    })

    return summarizeTemplate(template)
  }

  async uploadCertificateSeal(
    file: UploadedSettingsFile | undefined,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    const validatedFile = validateSealFile(file)
    const template = await this.prisma.certificateTemplate.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!template) {
      throw new NotFoundException('请先上传并启用证书背景模板')
    }

    const originalName = sanitizeOriginalName(validatedFile.originalname)
    const storageKey = `certificate-templates/${template.id}/seal-${originalName}`
    const sha256 = createHash('sha256').update(validatedFile.buffer).digest('hex')

    await this.storage.putObject({
      body: validatedFile.buffer,
      contentType: validatedFile.mimeType,
      key: storageKey,
    })

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.certificateTemplate.update({
        where: { id: template.id },
        data: {
          sealMimeType: validatedFile.mimeType,
          sealSha256: sha256,
          sealSizeBytes: validatedFile.buffer.length,
          sealStorageKey: storageKey,
        },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_SYSTEM_SETTING,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            fileName: originalName,
            mimeType: validatedFile.mimeType,
            sealSha256: sha256,
            templateId: template.id,
            version: template.version,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: template.id,
          targetType: 'CertificateTemplate',
          userAgent: meta.userAgent,
        },
      })

      return next
    })

    return summarizeTemplate(updated)
  }
}

function summarizeTemplate(template: {
  active: boolean
  createdAt: Date
  id: string
  name: string
  sealStorageKey: string | null
  templateMimeType: string
  templateSizeBytes: number
  updatedAt: Date
  version: string
}): CertificateTemplateSummary {
  return {
    active: template.active,
    createdAt: template.createdAt,
    id: template.id,
    name: template.name,
    sealConfigured: Boolean(template.sealStorageKey),
    templateMimeType: template.templateMimeType,
    templateSizeBytes: template.templateSizeBytes,
    updatedAt: template.updatedAt,
    version: template.version,
  }
}

function validateTemplateFile(file: UploadedSettingsFile | undefined) {
  const validated = validateUploadedFile(file, MAX_TEMPLATE_SIZE_BYTES)
  const extension = extname(validated.originalname).toLowerCase()
  const isPdf = extension === '.pdf' && validated.mimeType === 'application/pdf' && hasPdfMagicBytes(validated.buffer)
  const isPng = extension === '.png' && validated.mimeType === 'image/png' && hasPngMagicBytes(validated.buffer)

  if (!isPdf && !isPng) {
    throw new BadRequestException('证书背景模板仅支持真实 PDF 或 PNG 文件')
  }

  return validated
}

function validateSealFile(file: UploadedSettingsFile | undefined) {
  const validated = validateUploadedFile(file, MAX_SEAL_SIZE_BYTES)
  const extension = extname(validated.originalname).toLowerCase()

  if (extension !== '.png' || validated.mimeType !== 'image/png' || !hasPngMagicBytes(validated.buffer)) {
    throw new BadRequestException('电子印章仅支持真实 PNG 文件')
  }

  return validated
}

function validateUploadedFile(file: UploadedSettingsFile | undefined, maxBytes: number) {
  if (!file?.buffer || file.buffer.length === 0) {
    throw new BadRequestException('请上传文件')
  }

  if (file.buffer.length > maxBytes || (file.size ?? file.buffer.length) > maxBytes) {
    throw new BadRequestException(`文件不能超过 ${Math.floor(maxBytes / 1024 / 1024)}MB`)
  }

  return {
    buffer: file.buffer,
    mimeType: file.mimetype ?? 'application/octet-stream',
    originalname: file.originalname ?? 'certificate-template',
  }
}

function createStorageId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function createTemplateVersion() {
  const now = new Date()
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('')

  return `cert-tpl-${datePart}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

function hasPdfMagicBytes(buffer: Buffer) {
  return buffer.subarray(0, 5).toString('utf8') === '%PDF-'
}

function hasPngMagicBytes(buffer: Buffer) {
  return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
}

function sanitizeOriginalName(name: string) {
  return name
    .replace(/[\r\n]/g, '')
    .replace(/[\\/]/g, '-')
    .replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')
    .slice(0, 120) || 'certificate-template'
}
