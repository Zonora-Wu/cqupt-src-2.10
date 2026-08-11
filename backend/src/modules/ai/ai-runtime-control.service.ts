import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { AiAgentRunStatus, AiCallPurpose, Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AiResolvedModel } from './ai-model.types'

const DEFAULT_USER_FOREGROUND_LIMIT = 5
const DEFAULT_USER_RUNS_PER_MINUTE = 30
const DEFAULT_GLOBAL_RUNNING_LIMIT = 300

@Injectable()
export class AiRuntimeControlService {
  private readonly controllers = new Map<string, Set<AbortController>>()
  private readonly cancellationPollers = new Map<AbortController, NodeJS.Timeout>()
  private readonly cancelled = new Set<string>()

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async start(input: { model: AiResolvedModel; purpose: AiCallPurpose; userId: string; snapshot: Record<string, unknown> }) {
    const minuteAgo = new Date(Date.now() - 60_000)
    const [runningByUser, recentByUser, runningGlobal] = await Promise.all([
      this.prisma.aiAgentRun.count({ where: { userId: input.userId, status: AiAgentRunStatus.RUNNING } }),
      this.prisma.aiAgentRun.count({ where: { userId: input.userId, startedAt: { gte: minuteAgo } } }),
      this.prisma.aiAgentRun.count({ where: { status: AiAgentRunStatus.RUNNING } }),
    ])
    if (runningByUser >= envLimit('AI_USER_FOREGROUND_RUN_LIMIT', DEFAULT_USER_FOREGROUND_LIMIT, 20)) {
      throw new HttpException('当前 AI 任务较多，请等待已有任务完成', HttpStatus.TOO_MANY_REQUESTS)
    }
    if (recentByUser >= envLimit('AI_USER_RUNS_PER_MINUTE', DEFAULT_USER_RUNS_PER_MINUTE, 120)) {
      throw new HttpException('AI 请求过于频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS)
    }
    if (runningGlobal >= envLimit('AI_GLOBAL_RUNNING_LIMIT', DEFAULT_GLOBAL_RUNNING_LIMIT, 2000)) {
      throw new HttpException('平台 AI 当前繁忙，请稍后再试', HttpStatus.TOO_MANY_REQUESTS)
    }
    return this.prisma.aiAgentRun.create({
      data: {
        credentialId: input.model.credentialId,
        modelName: input.model.model,
        policySnapshot: input.snapshot as Prisma.InputJsonValue,
        providerId: input.model.providerId,
        purpose: input.purpose,
        source: input.model.source,
        userId: input.userId,
        steps: { create: { kind: 'MODEL_EXECUTION', sequence: 1, status: 'RUNNING' } },
      },
    })
  }

  register(runId: string, controller: AbortController) {
    const set = this.controllers.get(runId) ?? new Set<AbortController>()
    set.add(controller)
    this.controllers.set(runId, set)
    const poller = setInterval(() => {
      void this.prisma.aiAgentRun.findUnique({ where: { id: runId }, select: { status: true } })
        .then((run) => {
          if (run?.status === AiAgentRunStatus.CANCELLED) {
            this.cancelled.add(runId)
            controller.abort()
          }
        })
        .catch(() => undefined)
    }, 750)
    poller.unref()
    this.cancellationPollers.set(controller, poller)
  }

  unregister(runId: string, controller: AbortController) {
    const set = this.controllers.get(runId)
    set?.delete(controller)
    if (!set?.size) this.controllers.delete(runId)
    const poller = this.cancellationPollers.get(controller)
    if (poller) clearInterval(poller)
    this.cancellationPollers.delete(controller)
  }

  async finish(runId: string, input: { errorCode?: string; inputTokens?: number; outputTokens?: number; usageConfirmed: boolean }) {
    this.cancelled.delete(runId)
    const status = input.errorCode === 'USER_CANCELLED'
      ? AiAgentRunStatus.CANCELLED
      : input.errorCode ? AiAgentRunStatus.FAILED : AiAgentRunStatus.COMPLETED
    await this.prisma.$transaction([
      this.prisma.aiAgentRun.update({
        where: { id: runId },
        data: { completedAt: new Date(), errorCode: input.errorCode, inputTokens: input.inputTokens, outputTokens: input.outputTokens, status },
      }),
      this.prisma.aiAgentRunStep.updateMany({
        where: { runId, status: 'RUNNING' },
        data: { completedAt: new Date(), status },
      }),
      this.prisma.aiAgentUsage.upsert({
        where: { runId },
        create: { inputTokens: input.inputTokens, outputTokens: input.outputTokens, runId, usageConfirmed: input.usageConfirmed },
        update: { inputTokens: input.inputTokens, outputTokens: input.outputTokens, usageConfirmed: input.usageConfirmed },
      }),
    ])
  }

  async get(id: string, userId: string) {
    const run = await this.prisma.aiAgentRun.findFirst({
      where: { id, userId },
      include: { steps: { orderBy: { sequence: 'asc' } }, toolCalls: true, usage: true },
    })
    if (!run) throw new NotFoundException('AI Run 不存在')
    return run
  }

  async metrics(days = 7) {
    const normalizedDays = Math.min(Math.max(Math.trunc(days) || 7, 1), 90)
    const since = new Date(Date.now() - normalizedDays * 86_400_000)
    const runs = await this.prisma.aiAgentRun.findMany({
      orderBy: { startedAt: 'desc' },
      select: {
        completedAt: true,
        errorCode: true,
        inputTokens: true,
        modelName: true,
        outputTokens: true,
        purpose: true,
        source: true,
        startedAt: true,
        status: true,
      },
      take: 10_000,
      where: { startedAt: { gte: since } },
    })
    const completed = runs.filter((run) => run.completedAt)
    const durations = completed
      .map((run) => Math.max(0, run.completedAt!.getTime() - run.startedAt.getTime()))
      .sort((a, b) => a - b)
    const failed = runs.filter((run) => run.status === AiAgentRunStatus.FAILED)
    const tokens = runs.reduce((total, run) => total + (run.inputTokens ?? 0) + (run.outputTokens ?? 0), 0)

    return {
      byPurpose: groupRuns(runs, (run) => run.purpose),
      bySource: groupRuns(runs, (run) => run.source),
      days: normalizedDays,
      failureRate: runs.length ? failed.length / runs.length : 0,
      generatedAt: new Date().toISOString(),
      p50LatencyMs: percentile(durations, 0.5),
      p95LatencyMs: percentile(durations, 0.95),
      running: runs.filter((run) => run.status === AiAgentRunStatus.RUNNING).length,
      topErrors: Object.entries(countBy(failed, (run) => run.errorCode || 'UNKNOWN'))
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      totalRuns: runs.length,
      totalTokens: tokens,
    }
  }

  async cancel(id: string, userId: string) {
    const run = await this.prisma.aiAgentRun.findFirst({ where: { id, userId } })
    if (!run) throw new NotFoundException('AI Run 不存在')
    if (run.status !== AiAgentRunStatus.RUNNING) throw new BadRequestException('AI Run 已结束')
    this.cancelled.add(id)
    for (const controller of this.controllers.get(id) ?? []) controller.abort()
    await this.prisma.aiAgentRun.update({
      where: { id },
      data: { completedAt: new Date(), errorCode: 'USER_CANCELLED', status: AiAgentRunStatus.CANCELLED },
    })
    return { id, status: AiAgentRunStatus.CANCELLED }
  }

  isCancelled(runId: string) {
    return this.cancelled.has(runId)
  }
}

function countBy<T>(items: T[], keyOf: (item: T) => string) {
  return items.reduce<Record<string, number>>((result, item) => {
    const key = keyOf(item)
    result[key] = (result[key] ?? 0) + 1
    return result
  }, {})
}

function groupRuns<T extends { inputTokens: number | null; outputTokens: number | null; status: AiAgentRunStatus }>(items: T[], keyOf: (item: T) => string) {
  const groups = new Map<string, { failed: number; runs: number; tokens: number }>()
  for (const item of items) {
    const key = keyOf(item)
    const current = groups.get(key) ?? { failed: 0, runs: 0, tokens: 0 }
    current.runs += 1
    current.tokens += (item.inputTokens ?? 0) + (item.outputTokens ?? 0)
    if (item.status === AiAgentRunStatus.FAILED) current.failed += 1
    groups.set(key, current)
  }
  return [...groups].map(([key, value]) => ({ key, ...value })).sort((a, b) => b.runs - a.runs)
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0
  return values[Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1)]
}

function envLimit(name: string, fallback: number, hardMax: number) {
  const parsed = Number(process.env[name])
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, hardMax) : fallback
}
