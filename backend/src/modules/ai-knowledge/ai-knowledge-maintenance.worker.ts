import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  AiKnowledgeMaintenanceStatus,
  AiKnowledgeStatus,
  Prisma,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { stableHash } from './ai-knowledge.utils'

const MAINTENANCE_TASK_TYPES = {
  ARCHIVE: 'ARCHIVE',
  DUPLICATE: 'DUPLICATE',
  LOW_QUALITY: 'LOW_QUALITY',
  SECURITY: 'SECURITY',
  STALE_REVIEW: 'STALE_REVIEW',
} as const

type MaintenanceTaskType = (typeof MAINTENANCE_TASK_TYPES)[keyof typeof MAINTENANCE_TASK_TYPES]

const PRIORITY_ORDER: Record<MaintenanceTaskType, string> = {
  [MAINTENANCE_TASK_TYPES.SECURITY]: 'P0',
  [MAINTENANCE_TASK_TYPES.LOW_QUALITY]: 'P1',
  [MAINTENANCE_TASK_TYPES.STALE_REVIEW]: 'P2',
  [MAINTENANCE_TASK_TYPES.DUPLICATE]: 'P3',
  [MAINTENANCE_TASK_TYPES.ARCHIVE]: 'P4',
}

const DEFAULT_MAINTENANCE_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours
const MIN_MAINTENANCE_INTERVAL_MS = 5 * 60 * 1000 // 5 min floor
const DEFAULT_BATCH_SIZE = 50
const NO_HIT_ARCHIVE_DAYS = 90
const LOW_QUALITY_POSITIVE_RATE_THRESHOLD = 0.60
const LOW_QUALITY_MIN_FEEDBACKS = 5
const RECENT_DOWNVOTE_WINDOW = 20
const RECENT_DOWNVOTE_RATE_THRESHOLD = 0.35

export type AiKnowledgeMaintenanceResult = {
  archived: number
  errors: string[]
  processed: number
  scanned: number
  securitySuspended: number
  staleMarked: number
  tasksCreated: number
}

@Injectable()
export class AiKnowledgeMaintenanceWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiKnowledgeMaintenanceWorker.name)
  private running = false
  private timer?: NodeJS.Timeout

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const enabled = this.config.get<string>('AI_KNOWLEDGE_MAINTENANCE_ENABLED') ?? 'true'
    if (enabled === 'false') {
      this.logger.log('AI knowledge maintenance worker is disabled by config')
      return
    }

    const intervalMs = Math.max(
      Number(this.config.get<string>('AI_KNOWLEDGE_MAINTENANCE_INTERVAL_MS') ?? DEFAULT_MAINTENANCE_INTERVAL_MS),
      MIN_MAINTENANCE_INTERVAL_MS,
    )
    // Run first scan after a short delay to let the app settle, then on interval
    const initialDelayMs = 30_000
    setTimeout(() => {
      void this.tick()
      this.timer = setInterval(() => void this.tick(), intervalMs)
      this.timer.unref?.()
    }, initialDelayMs)
    this.logger.log(`AI knowledge maintenance worker scheduled every ${Math.round(intervalMs / 1000)}s`)
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  private async tick() {
    if (this.running) return
    this.running = true
    try {
      const result = await this.runMaintenanceScan()
      if (result.processed > 0 || result.tasksCreated > 0 || result.securitySuspended > 0) {
        this.logger.log(
          `Maintenance scan: scanned=${result.scanned} processed=${result.processed} ` +
          `tasks=${result.tasksCreated} security=${result.securitySuspended} ` +
          `stale=${result.staleMarked} archived=${result.archived} errors=${result.errors.length}`,
        )
      }
    } catch (error) {
      this.logger.warn(`Maintenance scan failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      this.running = false
    }
  }

  /** Public entry point for admin-triggered or E2E runs. */
  async runMaintenanceScan(): Promise<AiKnowledgeMaintenanceResult> {
    const batchSize = Math.max(
      Number(this.config.get<string>('AI_KNOWLEDGE_MAINTENANCE_BATCH_SIZE') ?? DEFAULT_BATCH_SIZE),
      1,
    )
    const result: AiKnowledgeMaintenanceResult = {
      archived: 0,
      errors: [],
      processed: 0,
      scanned: 0,
      securitySuspended: 0,
      staleMarked: 0,
      tasksCreated: 0,
    }

    // Scan entries that are currently in retrievable/usable states
    const eligibleStatuses: AiKnowledgeStatus[] = [
      AiKnowledgeStatus.APPROVED,
      AiKnowledgeStatus.AUTO_APPROVED,
      AiKnowledgeStatus.PROMOTED_TO_SKILL,
    ]
    const eligibleMaintenanceStatuses: AiKnowledgeMaintenanceStatus[] = [
      AiKnowledgeMaintenanceStatus.HEALTHY,
      AiKnowledgeMaintenanceStatus.LOW_QUALITY_REVIEW,
      AiKnowledgeMaintenanceStatus.DUPLICATE_REVIEW,
      AiKnowledgeMaintenanceStatus.STALE_REVIEW,
    ]

    let cursor: string | undefined
    let batch = 0

    do {
      const entries = await this.prisma.aiKnowledgeEntry.findMany({
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { id: 'asc' },
        skip: cursor ? 1 : 0,
        take: batchSize,
        where: {
          maintenanceStatus: { in: eligibleMaintenanceStatuses },
          status: { in: eligibleStatuses },
        },
      })

      if (entries.length === 0) break

      result.scanned += entries.length
      batch++

      for (const entry of entries) {
        try {
          const actions = await this.evaluateEntry(entry)
          for (const action of actions) {
            await this.applyAction(entry.id, action, result)
          }
          result.processed++
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          this.logger.warn(`Maintenance eval failed for entry ${entry.id}: ${message}`)
          result.errors.push(`entry ${entry.id}: ${message}`)
        }
      }

      cursor = entries[entries.length - 1]?.id
    } while (cursor)

    return result
  }

  // ─── entry evaluation ───────────────────────────────────────────────

  private async evaluateEntry(entry: {
    abuseReportCount: number
    archivedAt: Date | null
    confidenceScore: number
    createdAt: Date
    directAnswerEnabled: boolean
    helpfulCount: number
    hitCount: number
    id: string
    maintenanceStatus: AiKnowledgeMaintenanceStatus
    retrievalEnabled: boolean
    status: AiKnowledgeStatus
    unhelpfulCount: number
    updatedAt: Date
  }): Promise<MaintenanceAction[]> {
    const actions: MaintenanceAction[] = []
    const now = new Date()

    // 1. Security — abuse reports trigger immediate suspension
    if (entry.abuseReportCount > 0 && entry.maintenanceStatus !== AiKnowledgeMaintenanceStatus.SECURITY_SUSPENDED) {
      actions.push({
        disableDirectAnswer: true,
        disableRetrieval: true,
        newMaintenanceStatus: AiKnowledgeMaintenanceStatus.SECURITY_SUSPENDED,
        reason: `安全举报计数=${entry.abuseReportCount}，自动暂停检索与直接回答，等待安全复核。`,
        taskPriority: PRIORITY_ORDER.SECURITY,
        taskType: MAINTENANCE_TASK_TYPES.SECURITY,
      })
      return actions // security takes precedence; skip other evaluations
    }

    // 2. Gather feedback stats for quality analysis
    const [recentFeedbacks, latestHit] = await Promise.all([
      this.prisma.aiKnowledgeFeedback.findMany({
        orderBy: { createdAt: 'desc' },
        select: { value: true },
        take: RECENT_DOWNVOTE_WINDOW,
        where: { knowledgeId: entry.id },
      }),
      this.prisma.aiKnowledgeHit.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
        where: { knowledgeId: entry.id },
      }),
    ])

    const totalVotes = entry.helpfulCount + entry.unhelpfulCount
    const positiveRate = totalVotes > 0 ? entry.helpfulCount / totalVotes : 1
    const recentUnhelpfulCount = recentFeedbacks.filter(
      (feedback) => feedback.value === 'UNHELPFUL',
    ).length
    const recentDownvoteRate =
      recentFeedbacks.length >= RECENT_DOWNVOTE_WINDOW
        ? recentUnhelpfulCount / recentFeedbacks.length
        : 0

    // Compute freshness score: decay over time since last meaningful update
    const daysSinceUpdate = Math.max(0, (now.getTime() - entry.updatedAt.getTime()) / (1000 * 60 * 60 * 24))
    const freshnessScore = Math.max(0, 1 - daysSinceUpdate / 180) // linear decay over 180 days
    const lastHitAt = latestHit?.createdAt ?? entry.createdAt
    const daysSinceLastHit = Math.max(0, (now.getTime() - lastHitAt.getTime()) / (1000 * 60 * 60 * 24))

    // 3. No hits for extended period → archive candidate
    if (daysSinceLastHit >= NO_HIT_ARCHIVE_DAYS && entry.hitCount > 0) {
      actions.push({
        newMaintenanceStatus: AiKnowledgeMaintenanceStatus.STALE_REVIEW,
        reason: `${NO_HIT_ARCHIVE_DAYS} 天无命中（最后命中 ${Math.round(daysSinceLastHit)} 天前），建议复审是否归档。`,
        taskPriority: PRIORITY_ORDER.ARCHIVE,
        taskType: MAINTENANCE_TASK_TYPES.ARCHIVE,
      })
    }

    // 4. Low quality — poor feedback (uses cumulative vote totals for overall quality)
    if (
      totalVotes >= LOW_QUALITY_MIN_FEEDBACKS &&
      positiveRate < LOW_QUALITY_POSITIVE_RATE_THRESHOLD &&
      entry.maintenanceStatus === AiKnowledgeMaintenanceStatus.HEALTHY
    ) {
      actions.push({
        disableDirectAnswer: true,
        newMaintenanceStatus: AiKnowledgeMaintenanceStatus.LOW_QUALITY_REVIEW,
        reason: `正向反馈率=${(positiveRate * 100).toFixed(0)}%（阈值 ${(LOW_QUALITY_POSITIVE_RATE_THRESHOLD * 100).toFixed(0)}%），反馈数=${totalVotes}，禁用直接回答，降级为仅注入 Agent。`,
        taskPriority: PRIORITY_ORDER.LOW_QUALITY,
        taskType: MAINTENANCE_TASK_TYPES.LOW_QUALITY,
      })
    }

    // 5. Recent downvote spike → pause direct answer
    if (
      recentDownvoteRate >= RECENT_DOWNVOTE_RATE_THRESHOLD &&
      entry.directAnswerEnabled &&
      entry.maintenanceStatus === AiKnowledgeMaintenanceStatus.HEALTHY
    ) {
      actions.push({
        disableDirectAnswer: true,
        newMaintenanceStatus: AiKnowledgeMaintenanceStatus.LOW_QUALITY_REVIEW,
        reason: `最近 ${RECENT_DOWNVOTE_WINDOW} 次反馈点踩率=${(recentDownvoteRate * 100).toFixed(0)}%（阈值 ${(RECENT_DOWNVOTE_RATE_THRESHOLD * 100).toFixed(0)}%），暂停直接回答。`,
        taskPriority: PRIORITY_ORDER.LOW_QUALITY,
        taskType: MAINTENANCE_TASK_TYPES.LOW_QUALITY,
      })
    }

    // 6. Staleness — freshness decay
    if (freshnessScore < 0.3 && entry.maintenanceStatus === AiKnowledgeMaintenanceStatus.HEALTHY) {
      actions.push({
        newMaintenanceStatus: AiKnowledgeMaintenanceStatus.STALE_REVIEW,
        reason: `新鲜度分=${freshnessScore.toFixed(2)}（更新时间 ${Math.round(daysSinceUpdate)} 天前），建议复审内容是否仍适用。`,
        taskPriority: PRIORITY_ORDER.STALE_REVIEW,
        taskType: MAINTENANCE_TASK_TYPES.STALE_REVIEW,
      })
    }

    // 7. Duplicate risk — checked via cluster associations
    const duplicateCluster = await this.prisma.aiKnowledgeCluster.findFirst({
      select: { duplicateRiskScore: true, id: true },
      where: { duplicateRiskScore: { gte: 0.72 }, promotedKnowledgeId: entry.id },
    })
    if (
      duplicateCluster &&
      entry.maintenanceStatus !== AiKnowledgeMaintenanceStatus.DUPLICATE_REVIEW
    ) {
      actions.push({
        newMaintenanceStatus: AiKnowledgeMaintenanceStatus.DUPLICATE_REVIEW,
        reason: `关联问题族 ${duplicateCluster.id} 重复风险=${((duplicateCluster.duplicateRiskScore ?? 0) * 100).toFixed(0)}%（阈值 72%），等待合并判断。`,
        taskPriority: PRIORITY_ORDER.DUPLICATE,
        taskType: MAINTENANCE_TASK_TYPES.DUPLICATE,
      })
    }

    // Deduplicate actions — only keep the most severe maintenance status transition
    return deduplicateActions(actions)
  }

  // ─── action application ─────────────────────────────────────────────

  private async applyAction(
    knowledgeId: string,
    action: MaintenanceAction,
    result: AiKnowledgeMaintenanceResult,
  ) {
    const dedupeKey = stableHash(`maintenance:${knowledgeId}:${action.taskType}:${action.newMaintenanceStatus}`)

    // Idempotent task creation: dedupeKey ensures no duplicate OPEN tasks
    const existingTask = await this.prisma.aiKnowledgeMaintenanceTask.findUnique({
      select: { id: true, status: true },
      where: { dedupeKey },
    })
    if (!existingTask) {
      await this.prisma.aiKnowledgeMaintenanceTask.create({
        data: {
          dedupeKey,
          knowledgeId,
          priority: action.taskPriority,
          reason: action.reason,
          status: 'OPEN',
          taskType: action.taskType,
        },
      })
      result.tasksCreated++
    } else if (existingTask.status !== 'OPEN') {
      // Reopen only DISMISSED tasks (not RESOLVED)
      await this.prisma.aiKnowledgeMaintenanceTask.update({
        data: { priority: action.taskPriority, reason: action.reason, resolvedAt: null, status: 'OPEN' },
        where: { id: existingTask.id },
      })
    }

    // Build update data for knowledge entry
    const updateData: Prisma.AiKnowledgeEntryUpdateInput = {
      maintenanceStatus: action.newMaintenanceStatus,
    }
    if (action.disableDirectAnswer) {
      updateData.directAnswerEnabled = false
      // Also update freshness/staleness tracking
    }
    if (action.disableRetrieval) {
      updateData.retrievalEnabled = false
      updateData.directAnswerEnabled = false
      updateData.agentInjectEnabled = false
    }

    await this.prisma.aiKnowledgeEntry.update({
      data: updateData,
      where: { id: knowledgeId },
    })

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        action: 'CHANGE_SYSTEM_SETTING',
        metadata: {
          action: action.newMaintenanceStatus,
          knowledgeId,
          reason: action.reason,
          source: 'AiKnowledgeMaintenanceWorker',
          taskType: action.taskType,
        } as Prisma.InputJsonValue,
        result: 'SUCCESS',
        targetId: knowledgeId,
        targetType: 'AiKnowledgeEntry',
      },
    })

    // Count
    if (action.newMaintenanceStatus === AiKnowledgeMaintenanceStatus.SECURITY_SUSPENDED) {
      result.securitySuspended++
    }
    if (action.taskType === MAINTENANCE_TASK_TYPES.STALE_REVIEW) {
      result.staleMarked++
    }
    if (action.taskType === MAINTENANCE_TASK_TYPES.ARCHIVE) {
      result.archived++
    }
  }

}

// ─── internal types ───────────────────────────────────────────────────

type MaintenanceAction = {
  disableDirectAnswer?: boolean
  disableRetrieval?: boolean
  newMaintenanceStatus: AiKnowledgeMaintenanceStatus
  reason: string
  taskPriority: string
  taskType: MaintenanceTaskType
}

function deduplicateActions(actions: MaintenanceAction[]): MaintenanceAction[] {
  if (actions.length <= 1) return actions

  // Sort by priority (most severe first), keep only the most severe transition
  const severityOrder: AiKnowledgeMaintenanceStatus[] = [
    AiKnowledgeMaintenanceStatus.SECURITY_SUSPENDED,
    AiKnowledgeMaintenanceStatus.LOW_QUALITY_REVIEW,
    AiKnowledgeMaintenanceStatus.STALE_REVIEW,
    AiKnowledgeMaintenanceStatus.DUPLICATE_REVIEW,
  ]

  const best = actions.reduce((prev, curr) => {
    const prevIdx = severityOrder.indexOf(prev.newMaintenanceStatus)
    const currIdx = severityOrder.indexOf(curr.newMaintenanceStatus)
    return currIdx >= 0 && (prevIdx < 0 || currIdx < prevIdx) ? curr : prev
  })

  // Merge disable flags from all actions
  const merged: MaintenanceAction = { ...best }
  for (const action of actions) {
    if (action.disableDirectAnswer) merged.disableDirectAnswer = true
    if (action.disableRetrieval) merged.disableRetrieval = true
  }
  return [merged]
}
