import { Inject, Injectable } from '@nestjs/common'
import {
  CertificateStatus,
  MallRedemptionStatus,
  RoleCode,
  UserStatus,
  VulnerabilityStatus,
} from '@prisma/client'
import { AuthenticatedRequestUser } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'

// ---- 用户仪表盘 ----
export type UserDashboardStats = {
  certCount: number
  confirmedCount: number
  currentPoints: number
  submitCount: number
}

// ---- 审核员仪表盘 ----
export type AuditorDashboardStats = {
  pendingArchive: number      // CONFIRMED + FIXING = 可推入复测
  pendingCerts: number        // 已归档但未签发证书
  pendingInitReview: number   // SUBMITTED + PENDING_REVIEW
  pendingRetest: number       // PENDING_RETEST
}

// ---- 管理员仪表盘 ----
export type AdminDashboardStats = {
  pendingAccessUsers: number  // PENDING 状态用户数
  pendingCerts: number
  pendingRedemptions: number  // 待领取兑换单
  pendingVulnerabilities: number
  totalActiveUsers: number
  totalVulnerabilities: number
}

@Injectable()
export class DashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getUserDashboard(user: AuthenticatedRequestUser): Promise<UserDashboardStats> {
    const [submitCount, confirmedCount, pointSummary, certCount] = await Promise.all([
      this.prisma.vulnerabilityReport.count({
        where: {
          deletedAt: null,
          submitterId: user.id,
          status: { notIn: [VulnerabilityStatus.DRAFT] },
        },
      }),
      this.prisma.vulnerabilityReport.count({
        where: {
          deletedAt: null,
          submitterId: user.id,
          status: {
            in: [
              VulnerabilityStatus.CONFIRMED,
              VulnerabilityStatus.FIXING,
              VulnerabilityStatus.PENDING_RETEST,
              VulnerabilityStatus.ARCHIVED,
              VulnerabilityStatus.CERTIFIED,
            ],
          },
        },
      }),
      this.prisma.pointLedgerEntry.aggregate({
        where: { userId: user.id },
        _max: { balanceAfter: true },
      }),
      this.prisma.certificate.count({
        where: {
          recipientId: user.id,
          status: { in: [CertificateStatus.ISSUED] },
        },
      }),
    ])

    // 当前余额 = 最新条目的 balanceAfter
    const latestEntry = await this.prisma.pointLedgerEntry.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfter: true },
    })

    return {
      certCount,
      confirmedCount,
      currentPoints: latestEntry?.balanceAfter ?? 0,
      submitCount,
    }
  }

  async getAuditorDashboard(): Promise<AuditorDashboardStats> {
    const [pendingInitReview, pendingRetest, pendingArchiveGroup, pendingCerts] = await Promise.all([
      this.prisma.vulnerabilityReport.count({
        where: {
          deletedAt: null,
          status: {
            in: [VulnerabilityStatus.SUBMITTED, VulnerabilityStatus.PENDING_REVIEW],
          },
        },
      }),
      this.prisma.vulnerabilityReport.count({
        where: {
          deletedAt: null,
          status: VulnerabilityStatus.PENDING_RETEST,
        },
      }),
      this.prisma.vulnerabilityReport.count({
        where: {
          deletedAt: null,
          status: {
            in: [VulnerabilityStatus.CONFIRMED, VulnerabilityStatus.FIXING],
          },
        },
      }),
      // 已归档但尚无已签发证书
      this.prisma.vulnerabilityReport.count({
        where: {
          deletedAt: null,
          status: { in: [VulnerabilityStatus.ARCHIVED] },
          certificate: {
            is: null,
          },
        },
      }),
    ])

    return {
      pendingArchive: pendingArchiveGroup,
      pendingCerts,
      pendingInitReview,
      pendingRetest,
    }
  }

  async getAdminDashboard(): Promise<AdminDashboardStats> {
    const [
      pendingVulnerabilities,
      pendingCerts,
      pendingAccessUsers,
      totalActiveUsers,
      totalVulnerabilities,
      pendingRedemptions,
    ] = await Promise.all([
      this.prisma.vulnerabilityReport.count({
        where: {
          deletedAt: null,
          status: {
            in: [VulnerabilityStatus.SUBMITTED, VulnerabilityStatus.PENDING_REVIEW],
          },
        },
      }),
      this.prisma.certificate.count({
        where: { status: CertificateStatus.PENDING },
      }),
      this.prisma.user.count({
        where: { status: UserStatus.PENDING, role: { code: RoleCode.STUDENT } },
      }),
      this.prisma.user.count({
        where: { status: UserStatus.ACTIVE },
      }),
      this.prisma.vulnerabilityReport.count({
        where: { deletedAt: null },
      }),
      this.prisma.mallRedemption.count({
        where: { status: MallRedemptionStatus.PENDING_PICKUP },
      }),
    ])

    return {
      pendingAccessUsers,
      pendingCerts,
      pendingRedemptions,
      pendingVulnerabilities,
      totalActiveUsers,
      totalVulnerabilities,
    }
  }
}
