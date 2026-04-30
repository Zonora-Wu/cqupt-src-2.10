import { AuditAction } from '@prisma/client'

export type AuditModuleCode =
  | 'AUTH'
  | 'USER'
  | 'VULNERABILITY'
  | 'ATTACHMENT'
  | 'CERTIFICATE'
  | 'ANNOUNCEMENT'
  | 'LEARNING'
  | 'MALL'
  | 'SYSTEM'
  | 'AI'

export type AuditRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export type AuditLogQuery = {
  action?: AuditAction
  actorId?: string
  actorKeyword?: string
  dateFrom?: Date
  dateTo?: Date
  ipAddress?: string
  keyword?: string
  module?: AuditModuleCode
  page: number
  pageSize: number
  result?: string
  riskLevel?: AuditRiskLevel
  targetId?: string
  targetType?: string
}

export type AuditLogListItem = {
  id: string
  action: AuditAction
  actionLabel: string
  actor: {
    email: string
    id: string
    name: string
    role: string
    roleLabel: string
    unifiedCode: string
  } | null
  createdAt: Date
  ipAddress: string
  module: AuditModuleCode
  moduleLabel: string
  requestPath: string
  result: string
  resultLabel: string
  riskLevel: AuditRiskLevel
  riskLabel: string
  summary: string
  targetId: string
  targetLabel: string
  targetType: string
  userAgent: string
}

export type AuditLogDetail = AuditLogListItem & {
  metadata: unknown
}
