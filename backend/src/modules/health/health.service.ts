import { Inject, Injectable } from '@nestjs/common'
import { SecurityRateLimitService } from '../../common/security/security-rate-limit.service'
import { MalwareScanService } from '../../common/security/malware-scan.service'
import { S3StorageService } from '../../integrations/object-storage/s3-storage.service'
import { PrismaService } from '../prisma/prisma.service'

type DependencyState = { detail?: string; required: boolean; status: 'down' | 'ok' | 'skipped' }
type ReadinessResult = {
  checkedAt: string
  dependencies: Record<string, DependencyState>
  ready: boolean
  service: string
  status: 'degraded' | 'ok' | 'unavailable'
}

const CACHE_MS = 10_000
const PROBE_TIMEOUT_MS = 3_000

@Injectable()
export class HealthService {
  private cached: { expiresAt: number; value: ReadinessResult } | null = null
  private pending: Promise<ReadinessResult> | null = null

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MalwareScanService) private readonly malwareScan: MalwareScanService,
    @Inject(SecurityRateLimitService) private readonly rateLimit: SecurityRateLimitService,
    @Inject(S3StorageService) private readonly storage: S3StorageService,
  ) {}

  async checkReadiness() {
    if (this.cached && this.cached.expiresAt > Date.now()) return this.cached.value
    if (this.pending) return this.pending
    this.pending = this.probe().then((value) => {
      this.cached = { expiresAt: Date.now() + CACHE_MS, value }
      return value
    }).finally(() => {
      this.pending = null
    })
    return this.pending
  }

  private async probe(): Promise<ReadinessResult> {
    const [database, storage, ai, malwareScanning] = await Promise.all([
      probe(true, () => this.prisma.$queryRaw`SELECT 1`),
      probe(true, () => this.storage.checkHealth()),
      this.probeAi(),
      this.malwareScan.checkHealth(),
    ])
    const redisHealth = this.rateLimit.getHealth()
    const redis: DependencyState = {
      detail: redisHealth.configured ? undefined : 'REDIS_URL is not configured',
      required: process.env.NODE_ENV === 'production',
      status: redisHealth.ready ? 'ok' : 'down',
    }
    const dependencies = { ai, database, malwareScanning, objectStorage: storage, redis }
    const ready = Object.values(dependencies).every((item) => !item.required || item.status === 'ok')
    const degraded = ready && Object.values(dependencies).some((item) => item.status === 'down')
    return {
      checkedAt: new Date().toISOString(),
      dependencies,
      ready,
      service: 'cqupt-src-backend',
      status: ready ? (degraded ? 'degraded' : 'ok') : 'unavailable',
    }
  }

  private async probeAi(): Promise<DependencyState> {
    const baseUrl = (process.env.OPENAI_BASE_URL || process.env.HERMES_AGENT_BASE_URL)?.trim()
    if (!baseUrl) return { detail: 'AI endpoint is not configured', required: false, status: 'skipped' }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
        headers: process.env.OPENAI_API_KEY ? { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } : undefined,
        signal: controller.signal,
      })
      return response.ok
        ? { required: false, status: 'ok' }
        : { detail: `HTTP ${response.status}`, required: false, status: 'down' }
    } catch (error) {
      return { detail: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'connection failed', required: false, status: 'down' }
    } finally {
      clearTimeout(timeout)
    }
  }
}

async function probe(required: boolean, operation: () => Promise<unknown>): Promise<DependencyState> {
  try {
    await withTimeout(operation(), PROBE_TIMEOUT_MS)
    return { required, status: 'ok' }
  } catch {
    return { detail: 'connection failed', required, status: 'down' }
  }
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timeout')), timeoutMs)
    operation.then(resolve, reject).finally(() => clearTimeout(timeout))
  })
}
