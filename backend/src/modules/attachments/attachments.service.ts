import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { AttachmentKind, AuditAction } from '@prisma/client'
import { createHash } from 'node:crypto'
import { extname } from 'node:path'
import { S3StorageService } from '../../integrations/object-storage/s3-storage.service'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'
import { UploadedAttachmentFile, UploadedPdfFile } from './attachment.types'

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024
const MB = 1024 * 1024
const sharp = require('sharp') as typeof import('sharp').default
const DRAFT_LIMITS = {
  INLINE_IMAGE: { count: 20, fileBytes: 5 * MB, totalBytes: 50 * MB },
  SUPPLEMENTARY: { count: 10, fileBytes: 20 * MB, totalBytes: 50 * MB },
} as const

@Injectable()
export class AttachmentsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(S3StorageService)
    private readonly storage: S3StorageService,
  ) {}

  async uploadVulnerabilityReportPdf(
    reportId: string,
    file: UploadedPdfFile | undefined,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    const validatedFile = this.validatePdf(file)
    const report = await this.prisma.vulnerabilityReport.findFirst({
      where: {
        deletedAt: null,
        id: reportId,
      },
      select: {
        id: true,
        reportNo: true,
        submitterId: true,
      },
    })

    if (!report) {
      throw new NotFoundException('漏洞报告不存在')
    }

    if (report.submitterId !== user.id) {
      throw new ForbiddenException('只能为自己提交的漏洞报告上传附件')
    }

    const attachmentId = createStorageId()
    const originalName = sanitizeOriginalName(validatedFile.originalname ?? 'vulnerability-report.pdf')
    const storageKey = `vulnerabilities/${report.id}/${attachmentId}-${originalName}`
    const sha256 = createHash('sha256').update(validatedFile.buffer).digest('hex')

    await this.storage.putObject({
      body: validatedFile.buffer,
      contentType: 'application/pdf',
      key: storageKey,
    })

    const attachment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.vulnerabilityAttachment.create({
        data: {
          id: attachmentId,
          kind: AttachmentKind.VULNERABILITY_REPORT,
          mimeType: 'application/pdf',
          originalName,
          reportId: report.id,
          sha256,
          sizeBytes: validatedFile.buffer.length,
          storageKey,
          uploaderId: user.id,
        },
      })

      await tx.vulnerabilityEvent.create({
        data: {
          action: 'UPLOAD_VULNERABILITY_ATTACHMENT',
          actorId: user.id,
          ipAddress: meta.ipAddress,
          note: `上传 PDF 附件：${originalName}`,
          reportId: report.id,
          userAgent: meta.userAgent,
        },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.CREATE_VULNERABILITY,
          actorId: user.id,
          metadata: {
            attachmentId: created.id,
            fileName: originalName,
            reportNo: report.reportNo,
            sha256,
            sizeBytes: created.sizeBytes,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: report.id,
          targetType: 'VulnerabilityAttachment',
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      })

      return created
    })

    return {
      id: attachment.id,
      originalName: attachment.originalName,
      previewUrl: `/api/attachments/${attachment.id}/preview`,
      sha256: attachment.sha256,
      sizeBytes: attachment.sizeBytes,
      uploadedAt: attachment.uploadedAt,
    }
  }

  async uploadDraftAttachment(
    draftId: string,
    requestedKind: unknown,
    file: UploadedAttachmentFile | undefined,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    const kind = requestedKind === 'INLINE_IMAGE' ? AttachmentKind.INLINE_IMAGE
      : requestedKind === 'SUPPLEMENTARY' ? AttachmentKind.SUPPLEMENTARY
        : null
    if (!kind) throw new BadRequestException('附件类型不正确')
    const draft = await this.prisma.vulnerabilitySubmissionDraft.findFirst({
      where: { id: draftId, userId: user.id, expiresAt: { gt: new Date() } },
      include: { attachments: { where: { deletedAt: null, kind }, select: { id: true, sizeBytes: true } } },
    })
    if (!draft) throw new NotFoundException('漏洞草稿不存在或已过期')

    const validated = kind === AttachmentKind.INLINE_IMAGE
      ? this.validateImage(file)
      : this.validateSupplementary(file)
    const limit = DRAFT_LIMITS[kind]
    if (draft.attachments.length >= limit.count) throw new BadRequestException(`${kind === AttachmentKind.INLINE_IMAGE ? '正文图片' : '补充附件'}数量已达上限`)
    const totalBytes = draft.attachments.reduce((sum, attachment) => sum + attachment.sizeBytes, 0)
    if (totalBytes + validated.buffer.length > limit.totalBytes) throw new BadRequestException('该类附件总大小不能超过 50MB')

    const attachmentId = createStorageId()
    const originalName = sanitizeFileName(validated.originalname)
    const storageKey = `vulnerability-drafts/${draft.id}/${attachmentId}-${originalName}`
    const sha256 = createHash('sha256').update(validated.buffer).digest('hex')
    let thumbnailStorageKey: string | null = null

    await this.storage.putObject({ body: validated.buffer, contentType: validated.mimeType, key: storageKey })
    try {
      if (kind === AttachmentKind.INLINE_IMAGE) {
        const thumbnail = await sharp(validated.buffer, { failOn: 'error' })
          .rotate()
          .resize({ fit: 'inside', height: 960, width: 1280, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer()
        thumbnailStorageKey = `vulnerability-drafts/${draft.id}/${attachmentId}-thumbnail.webp`
        await this.storage.putObject({ body: thumbnail, contentType: 'image/webp', key: thumbnailStorageKey })
      }

      const attachment = await this.prisma.$transaction(async (tx) => {
        const created = await tx.vulnerabilityAttachment.create({
          data: {
            draftId: draft.id,
            id: attachmentId,
            kind,
            mimeType: validated.mimeType,
            originalName,
            sha256,
            sizeBytes: validated.buffer.length,
            storageKey,
            thumbnailStorageKey,
            uploaderId: user.id,
          },
        })
        await tx.auditLog.create({
          data: {
            action: AuditAction.CREATE_VULNERABILITY,
            actorId: user.id,
            ipAddress: meta.ipAddress,
            metadata: { attachmentId, draftId, fileName: originalName, kind, sha256, sizeBytes: created.sizeBytes },
            requestPath: meta.requestPath,
            result: 'success',
            targetId: attachmentId,
            targetType: 'VulnerabilityDraftAttachment',
            userAgent: meta.userAgent,
          },
        })
        return created
      })
      return this.toAttachmentResponse(attachment)
    } catch (error) {
      await Promise.allSettled([
        this.storage.deleteObject(storageKey),
        ...(thumbnailStorageKey ? [this.storage.deleteObject(thumbnailStorageKey)] : []),
      ])
      throw error
    }
  }

  async deleteDraftAttachment(attachmentId: string, user: AuthenticatedRequestUser) {
    const attachment = await this.prisma.vulnerabilityAttachment.findFirst({
      where: { deletedAt: null, id: attachmentId, uploaderId: user.id, draft: { userId: user.id } },
    })
    if (!attachment) throw new NotFoundException('草稿附件不存在')
    await this.prisma.vulnerabilityAttachment.delete({ where: { id: attachment.id } })
    await Promise.allSettled([
      this.storage.deleteObject(attachment.storageKey),
      ...(attachment.thumbnailStorageKey ? [this.storage.deleteObject(attachment.thumbnailStorageKey)] : []),
    ])
    return { deleted: true, id: attachment.id }
  }

  async uploadSupplementAttachment(
    reportId: string,
    supplementId: string,
    file: UploadedAttachmentFile | undefined,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    const supplement = await this.prisma.vulnerabilitySupplement.findFirst({
      where: { id: supplementId, reportId, authorId: user.id, report: { submitterId: user.id, deletedAt: null } },
      include: { attachments: { where: { deletedAt: null }, select: { sizeBytes: true } } },
    })
    if (!supplement) throw new NotFoundException('补充材料记录不存在')
    if (supplement.attachments.length >= 10) throw new BadRequestException('每次补充最多上传 10 个附件')
    const validated = file?.mimetype?.startsWith('image/') ? this.validateImage(file) : this.validateSupplementary(file)
    if (supplement.attachments.reduce((sum, item) => sum + item.sizeBytes, 0) + validated.buffer.length > 50 * MB) {
      throw new BadRequestException('本次补充附件总大小不能超过 50MB')
    }
    const id = createStorageId()
    const originalName = sanitizeFileName(validated.originalname)
    const storageKey = `vulnerabilities/${reportId}/supplements/${supplementId}/${id}-${originalName}`
    const sha256 = createHash('sha256').update(validated.buffer).digest('hex')
    let thumbnailStorageKey: string | null = null
    await this.storage.putObject({ body: validated.buffer, contentType: validated.mimeType, key: storageKey })
    try {
      if (validated.mimeType.startsWith('image/')) {
        const thumbnail = await sharp(validated.buffer).rotate().resize({ fit: 'inside', height: 960, width: 1280, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
        thumbnailStorageKey = `${storageKey}-thumbnail.webp`
        await this.storage.putObject({ body: thumbnail, contentType: 'image/webp', key: thumbnailStorageKey })
      }
      const attachment = await this.prisma.vulnerabilityAttachment.create({
        data: {
          id, kind: AttachmentKind.SUPPLEMENTARY, mimeType: validated.mimeType, originalName, reportId,
          sha256, sizeBytes: validated.buffer.length, storageKey, supplementId, thumbnailStorageKey, uploaderId: user.id,
        },
      })
      await this.prisma.auditLog.create({
        data: {
          action: AuditAction.CREATE_VULNERABILITY, actorId: user.id, ipAddress: meta.ipAddress,
          metadata: { attachmentId: id, fileName: originalName, reportId, supplementId, sha256 },
          requestPath: meta.requestPath, result: 'success', targetId: id,
          targetType: 'VulnerabilitySupplementAttachment', userAgent: meta.userAgent,
        },
      })
      return this.toAttachmentResponse(attachment)
    } catch (error) {
      await Promise.allSettled([this.storage.deleteObject(storageKey), ...(thumbnailStorageKey ? [this.storage.deleteObject(thumbnailStorageKey)] : [])])
      throw error
    }
  }

  async getPrivateContent(attachmentId: string, thumbnail: boolean, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    const attachment = await this.prisma.vulnerabilityAttachment.findFirst({
      where: { deletedAt: null, id: attachmentId },
      include: {
        draft: { select: { userId: true } },
        report: { select: { id: true, reportNo: true, submitterId: true } },
      },
    })
    if (!attachment) throw new NotFoundException('附件不存在')
    const canRead = attachment.uploaderId === user.id
      || attachment.draft?.userId === user.id
      || attachment.report?.submitterId === user.id
      || user.permissions.includes('attachment:read_sensitive')
    if (!canRead) throw new ForbiddenException('无权查看该附件')
    const key = thumbnail && attachment.thumbnailStorageKey ? attachment.thumbnailStorageKey : attachment.storageKey
    const object = await this.storage.getObject(key)
    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.VIEW_SENSITIVE_ATTACHMENT,
        actorId: user.id,
        ipAddress: meta.ipAddress,
        metadata: { attachmentId, draftId: attachment.draftId, reportId: attachment.reportId, thumbnail },
        requestPath: meta.requestPath,
        result: 'success',
        targetId: attachmentId,
        targetType: 'VulnerabilityAttachment',
        userAgent: meta.userAgent,
      },
    })
    return {
      body: object.body,
      contentType: thumbnail && attachment.thumbnailStorageKey ? 'image/webp' : attachment.mimeType,
      fileName: attachment.originalName,
    }
  }

  async getPreviewPdf(attachmentId: string, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    const attachment = await this.prisma.vulnerabilityAttachment.findFirst({
      where: {
        deletedAt: null,
        id: attachmentId,
      },
      include: {
        report: {
          select: {
            id: true,
            reportNo: true,
            submitterId: true,
          },
        },
      },
    })

    if (!attachment) {
      throw new NotFoundException('附件不存在')
    }

    const canReadSensitive = user.permissions.includes('attachment:read_sensitive')
    if (!attachment.report || (attachment.report.submitterId !== user.id && !canReadSensitive)) {
      throw new ForbiddenException('无权查看该附件')
    }

    const object = await this.storage.getObject(attachment.storageKey)

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.VIEW_SENSITIVE_ATTACHMENT,
        actorId: user.id,
        metadata: {
          attachmentId: attachment.id,
          fileName: attachment.originalName,
          reportId: attachment.report.id,
          reportNo: attachment.report.reportNo,
          sizeBytes: attachment.sizeBytes,
        },
        requestPath: meta.requestPath,
        result: 'success',
        targetId: attachment.id,
        targetType: 'VulnerabilityAttachment',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    })

    return {
      body: object.body,
      contentType: 'application/pdf',
      fileName: attachment.originalName,
      sizeBytes: attachment.sizeBytes,
    }
  }

  private validateImage(file: UploadedAttachmentFile | undefined) {
    const common = validateFilePresence(file, DRAFT_LIMITS.INLINE_IMAGE.fileBytes, '单张图片不能超过 5MB')
    const detected = detectImageMime(common.buffer)
    const extension = extname(common.originalname).toLowerCase()
    const allowedExtensions = detected === 'image/jpeg' ? ['.jpg', '.jpeg'] : detected === 'image/png' ? ['.png'] : ['.webp']
    if (!detected || !allowedExtensions.includes(extension)) throw new BadRequestException('仅支持真实的 PNG、JPEG 或 WebP 图片')
    return { ...common, mimeType: detected }
  }

  private validateSupplementary(file: UploadedAttachmentFile | undefined) {
    const common = validateFilePresence(file, DRAFT_LIMITS.SUPPLEMENTARY.fileBytes, '单个补充附件不能超过 20MB')
    const extension = extname(common.originalname).toLowerCase()
    const mimeType = detectSupplementaryMime(common.buffer, extension)
    if (!mimeType) throw new BadRequestException('补充附件仅支持真实的 PDF、ZIP、TXT 或 HAR 文件')
    return { ...common, mimeType }
  }

  private toAttachmentResponse(attachment: { id: string; kind: AttachmentKind; mimeType: string; originalName: string; sizeBytes: number; thumbnailStorageKey: string | null; uploadedAt: Date }) {
    return {
      contentUrl: `/api/attachments/${attachment.id}/content`,
      id: attachment.id,
      kind: attachment.kind,
      mimeType: attachment.mimeType,
      originalName: attachment.originalName,
      sizeBytes: attachment.sizeBytes,
      thumbnailUrl: attachment.thumbnailStorageKey ? `/api/attachments/${attachment.id}/content?thumbnail=true` : null,
      uploadedAt: attachment.uploadedAt,
    }
  }

  private validatePdf(file: UploadedPdfFile | undefined): Required<Pick<UploadedPdfFile, 'buffer' | 'originalname'>> {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException('请上传 PDF 文件')
    }

    if (file.buffer.length > MAX_PDF_SIZE_BYTES || (file.size ?? file.buffer.length) > MAX_PDF_SIZE_BYTES) {
      throw new BadRequestException('单个 PDF 文件不能超过 10MB')
    }

    const originalName = file.originalname ?? ''
    const extension = extname(originalName).toLowerCase()
    const isPdfMime = file.mimetype === 'application/pdf' || file.mimetype === 'application/octet-stream'
    const hasPdfMagicBytes = file.buffer.subarray(0, 5).toString('utf8') === '%PDF-'

    if (extension !== '.pdf' || !isPdfMime || !hasPdfMagicBytes) {
      throw new BadRequestException('仅支持上传真实 PDF 文件')
    }

    return {
      buffer: file.buffer,
      originalname: originalName || 'vulnerability-report.pdf',
    }
  }
}

function createStorageId() {
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function sanitizeOriginalName(name: string) {
  const normalized = name
    .replace(/[\r\n]/g, '')
    .replace(/[\\/]/g, '-')
    .replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')
    .slice(0, 120)

  return normalized.toLowerCase().endsWith('.pdf') ? normalized : `${normalized || 'vulnerability-report'}.pdf`
}

function sanitizeFileName(name: string) {
  return name.replace(/[\r\n]/g, '').replace(/[\\/]/g, '-').replace(/[^\w.\-\u4e00-\u9fa5]/g, '_').slice(0, 120) || 'attachment'
}

function validateFilePresence(file: UploadedAttachmentFile | undefined, maxBytes: number, oversizeMessage: string) {
  if (!file?.buffer?.length) throw new BadRequestException('请选择需要上传的文件')
  if (file.buffer.length > maxBytes || (file.size ?? file.buffer.length) > maxBytes) throw new BadRequestException(oversizeMessage)
  return { buffer: file.buffer, originalname: file.originalname || 'attachment' }
}

function detectImageMime(buffer: Buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  return null
}

function detectSupplementaryMime(buffer: Buffer, extension: string) {
  if (extension === '.pdf' && buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf'
  if (extension === '.zip' && buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2])) return 'application/zip'
  if (extension === '.har') {
    try {
      const parsed = JSON.parse(buffer.toString('utf8')) as { log?: unknown }
      return parsed && typeof parsed === 'object' && parsed.log ? 'application/json' : null
    } catch { return null }
  }
  if (extension === '.txt' && isUtf8Text(buffer)) return 'text/plain'
  return null
}

function isUtf8Text(buffer: Buffer) {
  if (buffer.includes(0)) return false
  const text = buffer.toString('utf8')
  return !text.includes('\uFFFD')
}
