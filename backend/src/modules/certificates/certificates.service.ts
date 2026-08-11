import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import {
  AuditAction,
  CertificateStatus,
  RoleCode,
  VulnerabilitySeverity,
  VulnerabilityStatus,
} from '@prisma/client'
import { S3StorageService } from '../../integrations/object-storage/s3-storage.service'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationDeliveryService } from '../notifications/notification-delivery.service'
import { normalizePublicCertificateNo } from './certificate.validation'
import { generateCertificatePdf } from './certificate-pdf.generator'
import { NormalizedIssueCertificateInput, NormalizedRevokeCertificateInput } from './certificate.types'

const CERTIFIABLE_STATUSES: VulnerabilityStatus[] = [
  VulnerabilityStatus.CONFIRMED,
  VulnerabilityStatus.FIXING,
  VulnerabilityStatus.PENDING_RETEST,
  VulnerabilityStatus.ARCHIVED,
  VulnerabilityStatus.CERTIFIED,
]

@Injectable()
export class CertificatesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(S3StorageService)
    private readonly storage: S3StorageService,
    @Inject(NotificationDeliveryService)
    private readonly notifications: NotificationDeliveryService,
  ) {}

  async listManageCertificates() {
    const reports = await this.prisma.vulnerabilityReport.findMany({
      where: {
        deletedAt: null,
        finalSeverity: { not: null },
        status: { in: CERTIFIABLE_STATUSES },
      },
      include: {
        certificate: {
          include: {
            issuedBy: {
              select: { name: true, unifiedCode: true },
            },
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            action: true,
            createdAt: true,
            note: true,
            actor: {
              select: { name: true },
            },
          },
        },
        submitter: {
          select: {
            id: true,
            name: true,
            unifiedCode: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    })

    return {
      items: reports.map((report) => summarizeManageItem(report)),
      stats: {
        issued: reports.filter((report) => report.certificate?.status === CertificateStatus.ISSUED).length,
        pending: reports.filter((report) => !report.certificate).length,
        revoked: reports.filter((report) => report.certificate?.status === CertificateStatus.REVOKED).length,
        total: reports.length,
      },
    }
  }

  async listMyCertificates(user: AuthenticatedRequestUser) {
    const certificates = await this.prisma.certificate.findMany({
      where: {
        recipientId: user.id,
      },
      include: {
        issuedBy: {
          select: { name: true },
        },
        vulnerability: {
          select: {
            assetName: true,
            finalSeverity: true,
            id: true,
            reportNo: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return {
      items: certificates.map((certificate) => summarizeCertificate(certificate)),
      stats: {
        issued: certificates.filter((certificate) => certificate.status === CertificateStatus.ISSUED).length,
        revoked: certificates.filter((certificate) => certificate.status === CertificateStatus.REVOKED).length,
        total: certificates.length,
      },
    }
  }

  async issueCertificate(
    input: NormalizedIssueCertificateInput,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    const report = await this.prisma.vulnerabilityReport.findFirst({
      where: {
        deletedAt: null,
        id: input.vulnerabilityId,
      },
      include: {
        certificate: true,
        submitter: {
          select: {
            id: true,
            name: true,
            unifiedCode: true,
          },
        },
      },
    })

    if (!report) {
      throw new NotFoundException('关联漏洞不存在')
    }

    if (!report.finalSeverity || !CERTIFIABLE_STATUSES.includes(report.status)) {
      throw new BadRequestException('只有已确认并确定最终等级的漏洞可以签发证书')
    }

    if (report.certificate) {
      throw new BadRequestException('一个漏洞最多只能签发一张证书')
    }

    const template = await this.prisma.certificateTemplate.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!template) {
      throw new BadRequestException('请先在系统设置中上传并启用证书模板')
    }

    if (!template.sealStorageKey) {
      throw new BadRequestException('请先在系统设置中上传电子印章')
    }

    const certificateNo = await this.generateCertificateNo()
    const verifyCode = await this.generateVerifyCode()
    const issuedAt = new Date()
    const templateSnapshot = {
      id: template.id,
      layoutJson: template.layoutJson,
      name: template.name,
      sealMimeType: template.sealMimeType,
      sealSha256: template.sealSha256,
      templateMimeType: template.templateMimeType,
      templateSha256: template.templateSha256,
      version: template.version,
    }
    const pdfStorageKey = `certificates/${certificateNo}.pdf`
    const templateObject = await this.storage.getObject(template.templateStorageKey)
    const sealObject = await this.storage.getObject(template.sealStorageKey)
    const certificatePdf = await generateCertificatePdf({
      assetName: report.assetName,
      certificateNo,
      certificateType: '漏洞贡献证书',
      contribution: input.contribution,
      issuedAt,
      recipientName: report.submitter.name,
      reportNo: report.reportNo,
      sealBuffer: sealObject.body,
      severity: formatSeverity(report.finalSeverity),
      template: {
        layoutJson: template.layoutJson,
        sealMimeType: template.sealMimeType,
        sealStorageKey: template.sealStorageKey,
        templateMimeType: template.templateMimeType,
      },
      templateBuffer: templateObject.body,
      title: report.title,
      verifyCode,
    })

    await this.storage.putObject({
      body: certificatePdf,
      contentType: 'application/pdf',
      key: pdfStorageKey,
    })

    const notificationIds: string[] = []
    const certificate = await this.prisma.$transaction(async (tx) => {
      const created = await tx.certificate.create({
        data: {
          certificateNo,
          contribution: input.contribution,
          issuedAt,
          issuedById: user.id,
          pdfStorageKey,
          publicVerify: input.publicVerify,
          recipientId: report.submitter.id,
          status: CertificateStatus.ISSUED,
          templateId: template.id,
          templateSnapshot,
          verifyCode,
          vulnerabilityId: report.id,
        },
        include: {
          issuedBy: {
            select: { name: true },
          },
          vulnerability: {
            select: {
              assetName: true,
              finalSeverity: true,
              id: true,
              reportNo: true,
              title: true,
            },
          },
        },
      })

      await tx.vulnerabilityReport.update({
        where: { id: report.id },
        data: {
          status: VulnerabilityStatus.CERTIFIED,
        },
      })

      await tx.vulnerabilityEvent.create({
        data: {
          action: 'ISSUE_CERTIFICATE',
          actorId: user.id,
          fromStatus: report.status,
          ipAddress: meta.ipAddress,
          note: `签发证书：${certificateNo}`,
          reportId: report.id,
          toStatus: VulnerabilityStatus.CERTIFIED,
          userAgent: meta.userAgent,
        },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.ISSUE_CERTIFICATE,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            certificateNo,
            publicVerify: input.publicVerify,
            reportNo: report.reportNo,
            templateId: template.id,
            templateVersion: template.version,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: created.id,
          targetType: 'Certificate',
          userAgent: meta.userAgent,
        },
      })

      notificationIds.push(await this.notifications.create(tx, {
        channelId: 'certificate', channelTitle: '证书签发通知',
        content: `漏洞报告「${report.title}」（${report.reportNo}）的证书 ${certificateNo} 已签发。`,
        emailRequired: true, entityId: created.id, entityType: 'Certificate',
        eventKey: `certificate:${created.id}:issued:${report.submitter.id}`,
        iconType: 'award', menuScope: 'user-certificates', recipientId: report.submitter.id,
        route: `/user/certificates?certificateId=${created.id}`,
      }))
      notificationIds.push(...await this.notifications.createForRoles(tx, [RoleCode.ADMIN], {
        channelId: 'certificate-workflow', channelTitle: '证书管理通知',
        content: `证书 ${certificateNo} 已为漏洞报告「${report.title}」（${report.reportNo}）签发。`,
        entityId: created.id, entityType: 'Certificate', eventKeyPrefix: `certificate:${created.id}:issued:admin`,
        iconType: 'award', menuScope: 'admin-certificates', route: `/admin/certificates?certificateId=${created.id}`,
      }))
      notificationIds.push(...await this.notifications.createForRoles(tx, [RoleCode.AUDITOR], {
        channelId: 'certificate-workflow', channelTitle: '证书管理通知',
        content: `证书 ${certificateNo} 已为漏洞报告「${report.title}」（${report.reportNo}）签发。`,
        entityId: created.id, entityType: 'Certificate', eventKeyPrefix: `certificate:${created.id}:issued:auditor`,
        iconType: 'award', menuScope: 'auditor-certificates', route: `/auditor/certificates?certificateId=${created.id}`,
      }))

      return created
    })

    await this.notifications.dispatchAfterCommit(notificationIds)

    return summarizeCertificate(certificate)
  }

  async revokeCertificate(
    certificateId: string,
    input: NormalizedRevokeCertificateInput,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
      include: {
        vulnerability: {
          select: { id: true, reportNo: true },
        },
      },
    })

    if (!certificate) {
      throw new NotFoundException('证书不存在')
    }

    if (certificate.status === CertificateStatus.REVOKED) {
      throw new BadRequestException('证书已撤销')
    }

    const revokedAt = new Date()
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.certificate.update({
        where: { id: certificate.id },
        data: {
          revokedAt,
          revokedById: user.id,
          revokeReason: input.reason,
          status: CertificateStatus.REVOKED,
        },
        include: {
          issuedBy: {
            select: { name: true },
          },
          vulnerability: {
            select: {
              assetName: true,
              finalSeverity: true,
              id: true,
              reportNo: true,
              title: true,
            },
          },
        },
      })

      await tx.vulnerabilityEvent.create({
        data: {
          action: 'REVOKE_CERTIFICATE',
          actorId: user.id,
          ipAddress: meta.ipAddress,
          note: input.reason,
          reportId: certificate.vulnerability.id,
          userAgent: meta.userAgent,
        },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.REVOKE_CERTIFICATE,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            certificateNo: certificate.certificateNo,
            reason: input.reason,
            reportNo: certificate.vulnerability.reportNo,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: certificate.id,
          targetType: 'Certificate',
          userAgent: meta.userAgent,
        },
      })

      return next
    })

    return summarizeCertificate(updated)
  }

  async previewCertificatePdf(certificateId: string, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
      include: {
        vulnerability: {
          select: {
            reportNo: true,
          },
        },
      },
    })

    if (!certificate) {
      throw new NotFoundException('证书不存在')
    }

    const canManageVulnerabilities = user.permissions.includes('vulnerability:manage')
    if (certificate.recipientId !== user.id && !canManageVulnerabilities) {
      throw new ForbiddenException('无权查看该证书')
    }

    if (!certificate.pdfStorageKey) {
      throw new NotFoundException('证书 PDF 尚未生成')
    }

    const object = await this.storage.getObject(certificate.pdfStorageKey)

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.VIEW_SENSITIVE_ATTACHMENT,
        actorId: user.id,
        ipAddress: meta.ipAddress,
        metadata: {
          certificateNo: certificate.certificateNo,
          reportNo: certificate.vulnerability.reportNo,
        },
        requestPath: meta.requestPath,
        result: 'success',
        targetId: certificate.id,
        targetType: 'Certificate',
        userAgent: meta.userAgent,
      },
    })

    return {
      body: object.body,
      contentType: 'application/pdf',
      fileName: `${certificate.certificateNo}.pdf`,
    }
  }

  async publicVerify(certificateNo: string) {
    const normalizedCertificateNo = normalizePublicCertificateNo(certificateNo)
    const certificate = await this.prisma.certificate.findUnique({
      where: { certificateNo: normalizedCertificateNo },
      select: {
        id: true,
        publicVerify: true,
        status: true,
      },
    })

    if (!certificate || !certificate.publicVerify || certificate.status !== CertificateStatus.ISSUED) {
      throw new NotFoundException('未查询到可公开核验的证书')
    }

    const verified = await this.prisma.certificate.update({
      where: { id: certificate.id },
      data: {
        publicVerifyCount: {
          increment: 1,
        },
      },
      include: {
        recipient: {
          select: {
            name: true,
            unifiedCode: true,
          },
        },
        vulnerability: {
          select: {
            finalSeverity: true,
            reportNo: true,
          },
        },
      },
    })

    return {
      certificateNo: verified.certificateNo,
      issuedAt: verified.issuedAt,
      publicVerifyCount: verified.publicVerifyCount,
      recipientName: maskName(verified.recipient.name),
      status: '有效',
      unifiedCode: maskUnifiedCode(verified.recipient.unifiedCode),
      vulnerability: {
        finalSeverity: verified.vulnerability.finalSeverity
          ? formatSeverity(verified.vulnerability.finalSeverity)
          : null,
        reportNo: verified.vulnerability.reportNo,
      },
    }
  }

  private async generateCertificateNo() {
    for (let index = 0; index < 5; index += 1) {
      const now = new Date()
      const datePart = String(now.getFullYear())
      const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase()
      const certificateNo = `CQUPT-SRC-CERT-${datePart}-${randomPart}`
      const exists = await this.prisma.certificate.findUnique({ where: { certificateNo } })

      if (!exists) {
        return certificateNo
      }
    }

    throw new BadRequestException('证书编号生成失败，请稍后重试')
  }

  private async generateVerifyCode() {
    for (let index = 0; index < 5; index += 1) {
      const verifyCode = `VERIFY-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
      const exists = await this.prisma.certificate.findUnique({ where: { verifyCode } })

      if (!exists) {
        return verifyCode
      }
    }

    throw new BadRequestException('核验码生成失败，请稍后重试')
  }
}

function summarizeManageItem(report: {
  archivedAt: Date | null
  assetName: string
  certificate: null | {
    certificateNo: string
    contribution: string
    id: string
    issuedAt: Date | null
    issuedBy: null | { name: string; unifiedCode: string }
    publicVerify: boolean
    status: CertificateStatus
    verifyCode: string
  }
  confirmedAt: Date | null
  events: Array<{
    action: string
    actor: null | { name: string }
    createdAt: Date
    note: string | null
  }>
  finalSeverity: VulnerabilitySeverity | null
  id: string
  ownerUnit: string | null
  reportNo: string
  submitter: { id: string; name: string; unifiedCode: string }
  title: string
  updatedAt: Date
  vulnerabilityType: string
}) {
  return {
    asset: report.assetName,
    certificateId: report.certificate?.id ?? null,
    contribution:
      report.certificate?.contribution ??
      `发现并提交 ${report.vulnerabilityType} 风险，协助学校完善校园网络安全治理能力。`,
    id: report.certificate?.id ?? report.id,
    issueDate: report.certificate?.issuedAt ?? null,
    issuer: report.certificate?.issuedBy?.name ?? null,
    level: report.finalSeverity ? formatSeverity(report.finalSeverity) : null,
    owner: report.ownerUnit,
    publicVerify: report.certificate?.publicVerify ?? true,
    recipient: report.submitter.name,
    records: report.events.map((event) => ({
      action: event.action,
      actor: event.actor?.name ?? '系统',
      note: event.note,
      time: event.createdAt,
    })),
    status: report.certificate ? formatCertificateStatus(report.certificate.status) : '待签发',
    type: '漏洞贡献证书',
    unifiedCode: report.submitter.unifiedCode,
    verifyCode: report.certificate?.verifyCode ?? '签发后生成',
    vulnId: report.reportNo,
    vulnTitle: report.title,
    vulnerabilityId: report.id,
    archivedAt: report.archivedAt ?? report.confirmedAt ?? report.updatedAt,
  }
}

function summarizeCertificate(certificate: {
  certificateNo: string
  contribution: string
  id: string
  issuedAt: Date | null
  issuedBy: null | { name: string }
  publicVerify: boolean
  revokedAt?: Date | null
  revokeReason?: string | null
  status: CertificateStatus
  verifyCode: string
  vulnerability: {
    assetName: string
    finalSeverity: VulnerabilitySeverity | null
    id: string
    reportNo: string
    title: string
  }
}) {
  return {
    asset: certificate.vulnerability.assetName,
    certificateNo: certificate.certificateNo,
    contribution: certificate.contribution,
    id: certificate.id,
    issuedAt: certificate.issuedAt,
    issuer: certificate.issuedBy?.name ?? null,
    publicVerify: certificate.publicVerify,
    revokedAt: certificate.revokedAt ?? null,
    revokeReason: certificate.revokeReason ?? null,
    status: formatCertificateStatus(certificate.status),
    verifyCode: certificate.verifyCode,
    vulnerability: {
      finalSeverity: certificate.vulnerability.finalSeverity
        ? formatSeverity(certificate.vulnerability.finalSeverity)
        : null,
      id: certificate.vulnerability.id,
      reportNo: certificate.vulnerability.reportNo,
      title: certificate.vulnerability.title,
    },
  }
}

function formatCertificateStatus(status: CertificateStatus) {
  const labelMap: Record<CertificateStatus, string> = {
    ISSUED: '已签发',
    PENDING: '待签发',
    REVOKED: '已撤销',
  }

  return labelMap[status]
}

function formatSeverity(severity: VulnerabilitySeverity) {
  const labelMap: Record<VulnerabilitySeverity, string> = {
    CRITICAL: '严重',
    HIGH: '高危',
    INFO: '信息',
    LOW: '低危',
    MEDIUM: '中危',
  }

  return labelMap[severity]
}

function maskName(name: string) {
  if (name.length <= 1) return '*'
  if (name.length === 2) return `${name[0]}*`
  return `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}`
}

function maskUnifiedCode(unifiedCode: string) {
  if (unifiedCode.length <= 4) return '****'
  return `${unifiedCode.slice(0, 2)}****${unifiedCode.slice(-2)}`
}
