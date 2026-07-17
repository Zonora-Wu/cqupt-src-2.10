import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common'
import {
  AiKnowledgeRoleScope,
  AiKnowledgeSensitivity,
  AiKnowledgeStatus,
  AiSkillCandidateStatus,
  AiSkillLifecycleOperation,
  AiSkillLifecycleOrigin,
  AiSkillLifecycleStatus,
  AiSpace,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AiKnowledgeService } from './ai-knowledge.service'
import { stableHash } from './ai-knowledge.utils'

const AUTO_UPDATE_THRESHOLD = 0.82
const LOW_RISK_CATEGORIES = new Set(['PLATFORM_USAGE', 'SRC_RULES', 'SECURITY_LEARNING', 'VULNERABILITY_REPORTING'])
const GENERATION_TIMEOUT_MS = 60_000

type LifecycleOrigin = 'AUTO_APPROVAL' | 'MANUAL_REVIEW'

type SkillDecision = {
  operation: AiSkillLifecycleOperation
  reason: string
  score: number
  targetSkillId?: string
}

@Injectable()
export class AiSkillLifecycleService {
  private readonly logger = new Logger(AiSkillLifecycleService.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiKnowledgeService) private readonly knowledge: AiKnowledgeService,
  ) {}

  async processKnowledge(knowledgeId: string, origin: LifecycleOrigin) {
    const knowledge = await this.prisma.aiKnowledgeEntry.findUnique({ where: { id: knowledgeId } })
    if (!knowledge) return null

    const existing = await this.prisma.aiSkillCandidate.findFirst({
      orderBy: { createdAt: 'desc' },
      where: { origin: origin === 'AUTO_APPROVAL' ? AiSkillLifecycleOrigin.AUTO_APPROVAL : AiSkillLifecycleOrigin.MANUAL_REVIEW, sourceKnowledgeIds: { has: knowledgeId } },
    })
    if (existing) return existing

    const automatic = origin === 'AUTO_APPROVAL' && this.isAutoPublishEligible(knowledge)
    const decision = automatic
      ? await this.decideSkillTarget({ ...knowledge, aiSpace: mapRoleScopeToAiSpace(knowledge.roleScope) })
      : { operation: AiSkillLifecycleOperation.CREATE, reason: '未通过自动入库规则的知识仅创建新 Skill 草案，禁止覆盖既有 Skill。', score: 0 }

    const target = decision.targetSkillId
      ? await this.prisma.aiSkill.findUnique({ where: { id: decision.targetSkillId } })
      : await this.createDraftSkill({ ...knowledge, aiSpace: mapRoleScopeToAiSpace(knowledge.roleScope) }, decision)
    if (!target) throw new ConflictException('Skill 目标不存在')

    const name = this.buildCandidateName(target.slug ?? this.slugify(knowledge.title), target.version + (decision.operation === AiSkillLifecycleOperation.UPDATE ? 1 : 0))
    let content = ''
    try {
      content = await this.generateSkill(knowledge, target, decision)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Hermes 生成 Skill 失败'
      const failed = await this.prisma.aiSkillCandidate.create({
        data: {
          content: this.renderDraftFallback(knowledge, target.slug ?? this.slugify(knowledge.title)),
          contentSha256: '',
          decisionReason: `${decision.reason}；${message}`,
          decisionScore: decision.score,
          description: `${knowledge.title}（Hermes 生成失败，待重试）`,
          generationModel: getOpenAiModel(),
          name,
          operation: decision.operation,
          origin: automatic ? AiSkillLifecycleOrigin.AUTO_APPROVAL : AiSkillLifecycleOrigin.MANUAL_REVIEW,
          roleScope: knowledge.roleScope,
          sourceClusterId: knowledge.sourceClusterId,
          sourceKnowledgeIds: [knowledge.id],
          status: AiSkillCandidateStatus.FAILED,
          targetSkillId: target.id,
        },
      })
      await this.prisma.aiSkill.update({ data: { lifecycleStatus: AiSkillLifecycleStatus.FAILED, syncError: message }, where: { id: target.id } })
      return failed
    }

    const candidate = await this.prisma.aiSkillCandidate.create({
      data: {
        content,
        contentSha256: stableHash(content),
        decisionReason: decision.reason,
        decisionScore: decision.score,
        description: `${decision.operation === AiSkillLifecycleOperation.UPDATE ? '更新' : '新建'}：${knowledge.title}`,
        generationModel: getOpenAiModel(),
        name,
        operation: decision.operation,
        origin: automatic ? AiSkillLifecycleOrigin.AUTO_APPROVAL : AiSkillLifecycleOrigin.MANUAL_REVIEW,
        roleScope: knowledge.roleScope,
        sourceClusterId: knowledge.sourceClusterId,
        sourceKnowledgeIds: [knowledge.id],
        status: automatic ? AiSkillCandidateStatus.APPROVED : AiSkillCandidateStatus.DRAFT,
        targetSkillId: target.id,
      },
    })

    if (!automatic) return candidate

    try {
      const installed = await this.knowledge.installSkillCandidate(candidate.id, undefined)
      await this.prisma.auditLog.create({
        data: {
          action: 'CHANGE_SYSTEM_SETTING',
          metadata: { candidateId: candidate.id, operation: decision.operation, origin: 'AUTO_APPROVAL', skillId: installed.candidate.targetSkillId } as never,
          result: 'success',
          targetId: knowledge.id,
          targetType: 'AiSkillLifecycle',
        },
      })
      return installed.candidate
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Skill 自动同步失败'
      this.logger.error(`自动 Skill 同步失败：${candidate.id} ${message}`)
      return this.prisma.aiSkillCandidate.findUnique({ where: { id: candidate.id } })
    }
  }

  private isAutoPublishEligible(entry: {
    category: string
    privacyRiskScore: number
    roleScope: AiKnowledgeRoleScope
    safetyScore: number
    sensitivity: AiKnowledgeSensitivity
    sourceClusterId: string | null
    status: AiKnowledgeStatus
  }) {
    return entry.status === AiKnowledgeStatus.AUTO_APPROVED
      && Boolean(entry.sourceClusterId)
      && entry.roleScope !== AiKnowledgeRoleScope.ALL
      && entry.sensitivity !== AiKnowledgeSensitivity.SENSITIVE
      && entry.safetyScore >= 0.9
      && entry.privacyRiskScore <= 0.1
      && LOW_RISK_CATEGORIES.has(entry.category)
  }

  private async decideSkillTarget(entry: { aiSpace: AiSpace; canonicalQuestion: string; canonicalAnswer: string; roleScope: AiKnowledgeRoleScope; similarityKey: string | null; sourceClusterId: string | null; tags: string[]; title: string }) {
    const skills = await this.prisma.aiSkill.findMany({
      where: { active: true, aiSpace: entry.aiSpace, lifecycleStatus: AiSkillLifecycleStatus.PUBLISHED, roleScope: entry.roleScope },
    })
    const linked = entry.sourceClusterId ? skills.find((skill) => skill.sourceClusterIds.includes(entry.sourceClusterId!)) : undefined
    if (linked) return { operation: AiSkillLifecycleOperation.UPDATE, reason: '同一知识簇已绑定已发布 Skill，按簇连续性更新已有 Skill。', score: 1, targetSkillId: linked.id }

    const queryTokens = new Set(tokenize(`${entry.title}\n${entry.canonicalQuestion}\n${entry.tags.join(' ')}`))
    const best = skills
      .map((skill) => ({ skill, score: similarity(queryTokens, new Set(tokenize(`${skill.title}\n${skill.content.slice(0, 4000)}`))) }))
      .sort((a, b) => b.score - a.score)[0]
    if (best && best.score >= AUTO_UPDATE_THRESHOLD) {
      return { operation: AiSkillLifecycleOperation.UPDATE, reason: `同角色、同领域已发布 Skill 语义匹配 ${(best.score * 100).toFixed(0)}%，超过更新阈值 ${AUTO_UPDATE_THRESHOLD * 100}%。`, score: best.score, targetSkillId: best.skill.id }
    }
    return { operation: AiSkillLifecycleOperation.CREATE, reason: best ? `最高相似度 ${(best.score * 100).toFixed(0)}%，低于更新阈值；新建 Skill，避免错误合并。` : '未发现同角色已发布 Skill；新建 Skill。', score: best?.score ?? 0 }
  }

  private async createDraftSkill(entry: { aiSpace: AiSpace; canonicalQuestion: string; roleScope: AiKnowledgeRoleScope; similarityKey: string | null; sourceClusterId: string | null; title: string }, decision: SkillDecision) {
    const slugBase = this.slugify(entry.title)
    const slug = await this.ensureUniqueSlug(slugBase)
    return this.prisma.aiSkill.create({
      data: {
        active: false,
        aiSpace: entry.aiSpace,
        canonicalKey: entry.similarityKey,
        content: '',
        lifecycleStatus: AiSkillLifecycleStatus.DRAFT,
        metadata: { lifecycleDecision: decision.reason } as never,
        roleScope: entry.roleScope,
        slug,
        source: 'ai-knowledge-lifecycle',
        sourceClusterIds: entry.sourceClusterId ? [entry.sourceClusterId] : [],
        title: entry.title.slice(0, 96),
      },
    })
  }

  private async generateSkill(entry: { canonicalAnswer: string; canonicalQuestion: string; roleScope: AiKnowledgeRoleScope; title: string }, target: { content: string; slug: string | null; title: string }, decision: SkillDecision) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const apiKey = getOpenAiApiKey()
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`
    const prompt = [
      `任务：${decision.operation === AiSkillLifecycleOperation.UPDATE ? '更新' : '新建'} CQUPT-SRC Hermes Skill。`,
      '只输出 SKILL.md Markdown。禁止代码围栏、禁止解释。',
      '必须包含：名称、适用范围、前置条件、步骤、边界与拒绝条件、输出要求。',
      '禁止任何真实资产、凭证、Cookie、Token、内网地址、绕过权限、破坏性利用或可直接攻击生产目标的内容。',
      `知识标题：${entry.title}`,
      `问题：${entry.canonicalQuestion}`,
      `已验证答案：${entry.canonicalAnswer}`,
      target.content ? `现有 Skill（仅在保持边界前提下合并）：${target.content.slice(0, 9000)}` : '',
    ].filter(Boolean).join('\n\n')
    try {
      const response = await fetch(new URL('chat/completions', getOpenAiBaseUrl()), {
        body: JSON.stringify({ messages: [{ content: '你是受约束的 CQUPT-SRC Skill 编写器。', role: 'system' }, { content: prompt, role: 'user' }], model: getOpenAiModel(), temperature: 0.1 }),
        headers,
        method: 'POST',
        signal: controller.signal,
      })
      const body = await readResponseBody(response)
      if (!response.ok) throw new Error(`Hermes Skill 生成失败：${response.status}`)
      const content = extractOpenAiContent(body).replace(/^```(?:markdown|md)?\s*/i, '').replace(/```\s*$/, '').trim()
      this.assertSafeGeneratedContent(content)
      return content
    } finally {
      clearTimeout(timeout)
    }
  }

  private assertSafeGeneratedContent(content: string) {
    if (content.length < 120 || content.length > 16_000) throw new Error('Hermes 返回的 Skill 长度不合法')
    if (/(authorization\s*:|bearer\s+[a-z0-9._~+/=-]{12,}|set-cookie|api[_-]?key\s*[=:]|private key|忽略.*(?:系统|指令)|绕过.{0,8}(权限|审核)|rm\s+-rf|真实(?:资产|域名|地址))/i.test(content)) {
      throw new Error('Hermes 返回的 Skill 未通过安全校验')
    }
  }

  private renderDraftFallback(entry: { canonicalAnswer: string; canonicalQuestion: string; title: string }, slug: string) {
    return `---\nname: ${slug}\ndescription: ${entry.title}\n---\n\n# ${entry.title}\n\n## 适用范围\n${entry.canonicalQuestion}\n\n## 已验证方法\n${entry.canonicalAnswer}\n\n## 安全边界\n仅处理已授权、脱敏的教学或平台场景；不得使用真实凭证、资产地址或绕过权限。\n`
  }

  private async ensureUniqueSlug(base: string) {
    let slug = base
    let index = 2
    while (await this.prisma.aiSkill.findUnique({ where: { slug } })) slug = `${base}-${index++}`
    return slug
  }

  private buildCandidateName(slug: string, version: number) {
    return `${slug}-v${Math.max(version, 1)}`.slice(0, 120)
  }

  private slugify(value: string) {
    const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    return normalized ? normalized.slice(0, 48) : `knowledge-skill-${stableHash(value).slice(0, 8)}`
  }
}

function mapRoleScopeToAiSpace(roleScope: AiKnowledgeRoleScope) {
  if (roleScope === AiKnowledgeRoleScope.ADMIN) return AiSpace.ADMIN
  if (roleScope === AiKnowledgeRoleScope.AUDITOR) return AiSpace.AUDITOR
  return AiSpace.STUDENT
}

function tokenize(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
  const words = normalized.split(/\s+/).filter((item) => item.length >= 2)
  const chinese = Array.from(normalized.replace(/[^\u4e00-\u9fff]/g, ''))
  for (let index = 0; index < chinese.length - 1; index += 1) words.push(chinese.slice(index, index + 2).join(''))
  return words.slice(0, 300)
}

function similarity(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0
  let shared = 0
  for (const value of left) if (right.has(value)) shared += 1
  return shared / Math.sqrt(left.size * right.size)
}

function getOpenAiBaseUrl() {
  const baseUrl = process.env.OPENAI_BASE_URL || process.env.HERMES_AGENT_BASE_URL || 'http://localhost:5000/v1'
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY || process.env.HERMES_AGENT_API_KEY || ''
}

function getOpenAiModel() {
  return process.env.OPENAI_MODEL || process.env.HERMES_AGENT_MODEL || 'hermes-agent'
}

async function readResponseBody(response: Response) {
  return response.headers.get('content-type')?.includes('application/json') ? response.json() : response.text()
}

function extractOpenAiContent(body: unknown) {
  const choice = body && typeof body === 'object' ? (body as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0] : undefined
  return typeof choice?.message?.content === 'string' ? choice.message.content : ''
}
