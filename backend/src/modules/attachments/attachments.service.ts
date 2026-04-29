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
import { UploadedPdfFile } from './attachment.types'

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024

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
    if (attachment.report.submitterId !== user.id && !canReadSensitive) {
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
