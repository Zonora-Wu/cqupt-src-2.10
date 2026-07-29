import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { AiCredentialStatus, AiModelPurpose, AiModelSource, AiUserModelPolicy, RoleCode } from '@prisma/client'
import { AuthenticatedRequestUser } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'
import { assertPublicOutboundUrl, validatePublicHttpsUrl } from '../../common/security/outbound-url'
import { AiCredentialCrypto } from './ai-credential.crypto'
import { AI_PROVIDER_CATALOG_SOURCE_COMMIT, AI_PROVIDER_PRESETS, findProviderPreset } from './ai-provider.catalog'
import {
  AI_PROVIDER_CONSENT_VERSION,
  AiResolvedModel,
  CreateUserCredentialInput,
  CreateUserModelInput,
  PlatformAiRouteInput,
} from './ai-model.types'

const MAX_CREDENTIALS = 5
const MAX_MODELS_PER_CREDENTIAL = 10
const MAX_MODELS_PER_USER = 20

@Injectable()
export class AiModelService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiCredentialCrypto) private readonly crypto: AiCredentialCrypto,
  ) {}

  listProviders() {
    return AI_PROVIDER_PRESETS.map((provider) => ({ ...provider, protocol: 'OPENAI_COMPATIBLE' as const }))
  }

  async getPolicy() {
    const policy = await this.prisma.aiModelPolicy.findUnique({ where: { id: 'global' } })
    return { userMode: policy?.userMode ?? AiUserModelPolicy.USER_PLATFORM_ONLY, updatedAt: policy?.updatedAt ?? null }
  }

  async updatePolicy(userMode: unknown, actor: AuthenticatedRequestUser) {
    if (!Object.values(AiUserModelPolicy).includes(userMode as AiUserModelPolicy)) {
      throw new BadRequestException('无效的用户 AI 模式')
    }
    return this.prisma.aiModelPolicy.upsert({
      where: { id: 'global' },
      create: { id: 'global', userMode: userMode as AiUserModelPolicy, updatedById: actor.id },
      update: { userMode: userMode as AiUserModelPolicy, updatedById: actor.id },
      select: { userMode: true, updatedAt: true },
    })
  }

  async getPlatformConfig() {
    const routes = await this.prisma.platformModelRoute.findMany({
      include: { credential: { select: { lastFour: true, name: true, providerId: true } } },
      orderBy: [{ purpose: 'asc' }, { priority: 'asc' }],
    })
    return {
      routes: routes.map((route) => ({
        automaticFailover: route.automaticFailover,
        baseUrl: route.baseUrl,
        circuitOpenUntil: route.circuitOpenUntil,
        credentialLastFour: route.credential.lastFour,
        credentialName: route.credential.name,
        id: route.id,
        model: route.model,
        priority: route.priority,
        providerId: route.credential.providerId,
        purpose: route.purpose,
      })),
    }
  }

  async savePlatformRoute(input: PlatformAiRouteInput) {
    const purpose = input.purpose as AiModelPurpose
    if (!Object.values(AiModelPurpose).includes(purpose)) throw new BadRequestException('平台模型用途不正确')
    const priority = Number(input.priority)
    if (!Number.isInteger(priority) || priority < 0 || priority > 2) throw new BadRequestException('模型优先级必须为 0、1 或 2')
    const providerId = requiredText(input.providerId, '供应商', 50)
    const model = requiredText(input.model, '模型名称', 120)
    const name = requiredText(input.name, '凭据名称', 60)
    const apiKey = validateProviderApiKey(requiredText(input.apiKey, 'API Key', 500), providerId)
    const preset = findProviderPreset(providerId)
    const requestedBaseUrl = typeof input.baseUrl === 'string' ? input.baseUrl.trim() : ''
    const baseUrl = await validatePublicHttpsUrl(requestedBaseUrl || preset?.baseUrl || '')
    const encrypted = this.crypto.encrypt(apiKey)

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.platformModelRoute.findUnique({ where: { purpose_priority: { priority, purpose } } })
      if (existing) await tx.platformProviderCredential.delete({ where: { id: existing.credentialId } })
      const credential = await tx.platformProviderCredential.create({
        data: { ...encrypted, lastFour: apiKey.slice(-4), name, providerId },
      })
      const route = await tx.platformModelRoute.create({
        data: {
          automaticFailover: input.automaticFailover !== false,
          baseUrl,
          credentialId: credential.id,
          model,
          priority,
          purpose,
        },
      })
      return { id: route.id, purpose: route.purpose, priority: route.priority }
    })
  }

  async deletePlatformRoute(id: string) {
    const route = await this.prisma.platformModelRoute.findUnique({ where: { id } })
    if (!route) throw new NotFoundException('平台模型路由不存在')
    await this.prisma.platformProviderCredential.delete({ where: { id: route.credentialId } })
    return { success: true }
  }

  async resolvePlatformCandidates(purpose: AiModelPurpose): Promise<AiResolvedModel[]> {
    const now = new Date()
    const globalCount = await this.prisma.platformModelRoute.count({
      where: { enabled: true, purpose: AiModelPurpose.GLOBAL },
    })
    const routes = await this.prisma.platformModelRoute.findMany({
      where: {
        enabled: true,
        purpose: globalCount > 0 ? AiModelPurpose.GLOBAL : purpose,
        credential: { status: AiCredentialStatus.ACTIVE },
        OR: [{ circuitOpenUntil: null }, { circuitOpenUntil: { lte: now } }],
      },
      include: { credential: true },
      orderBy: { priority: 'asc' },
      take: 3,
    })
    if (!routes.length) return [platformModel()]
    return routes.map((route) => ({
      apiKey: this.crypto.decrypt(route.credential),
      baseUrl: route.baseUrl.endsWith('/') ? route.baseUrl : `${route.baseUrl}/`,
      credentialId: route.credentialId,
      model: route.model,
      providerId: route.credential.providerId,
      routeId: route.id,
      source: AiModelSource.PLATFORM,
    }))
  }

  async recordPlatformRouteResult(routeId: string | undefined, success: boolean) {
    if (!routeId) return
    const route = await this.prisma.platformModelRoute.findUnique({ where: { id: routeId } })
    if (!route) return
    if (success) {
      await this.prisma.platformModelRoute.update({
        where: { id: routeId },
        data: { circuitOpenUntil: null, consecutiveFailures: 0 },
      })
      return
    }
    const failures = route.consecutiveFailures + 1
    await this.prisma.platformModelRoute.update({
      where: { id: routeId },
      data: {
        consecutiveFailures: failures,
        circuitOpenUntil: failures >= route.failureThreshold
          ? new Date(Date.now() + route.cooldownSeconds * 1000)
          : null,
      },
    })
  }

  async listCredentials(userId: string) {
    const rows = await this.prisma.userProviderCredential.findMany({
      where: { userId },
      include: { provider: { select: { category: true, name: true } }, _count: { select: { models: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(({ authTag: _authTag, ciphertext: _ciphertext, iv: _iv, ...row }) => row)
  }

  async createCredential(input: CreateUserCredentialInput, user: AuthenticatedRequestUser) {
    const name = requiredText(input.name, '凭据名称', 40)
    const providerId = requiredText(input.providerId, '供应商', 50)
    const apiKey = validateProviderApiKey(requiredText(input.apiKey, 'API Key', 500), providerId)
    const requestedBaseUrl = typeof input.baseUrl === 'string' ? input.baseUrl.trim() : ''
    if (input.consentAccepted !== true) throw new BadRequestException('必须确认第三方数据授权')
    const preset = findProviderPreset(providerId)
    if (!preset) throw new BadRequestException('供应商不在平台白名单中')
    if (await this.prisma.userProviderCredential.count({ where: { userId: user.id } }) >= MAX_CREDENTIALS) {
      throw new BadRequestException(`每个用户最多保存 ${MAX_CREDENTIALS} 个凭据`)
    }
    const baseUrl = await validatePublicHttpsUrl(requestedBaseUrl || preset.baseUrl)
    await this.ensureProviderPreset(providerId)
    const encrypted = this.crypto.encrypt(apiKey)
    return this.prisma.userProviderCredential.create({
      data: {
        ...encrypted,
        consentVersion: AI_PROVIDER_CONSENT_VERSION,
        consentedAt: new Date(),
        lastFour: apiKey.slice(-4),
        name,
        baseUrl,
        providerId,
        userId: user.id,
        consents: { create: { acceptedAt: new Date(), userId: user.id, version: AI_PROVIDER_CONSENT_VERSION } },
      },
      select: { id: true, baseUrl: true, lastFour: true, name: true, providerId: true, status: true, createdAt: true },
    })
  }

  async setCredentialStatus(id: string, enabled: unknown, userId: string) {
    const credential = await this.requireCredential(id, userId)
    const status = enabled === true ? AiCredentialStatus.ACTIVE : AiCredentialStatus.DISABLED
    await this.prisma.$transaction([
      this.prisma.userProviderCredential.update({ where: { id: credential.id }, data: { status } }),
      this.prisma.userModelProfile.updateMany({ where: { credentialId: credential.id }, data: { enabled: status === AiCredentialStatus.ACTIVE } }),
    ])
    return { id, status }
  }

  async deleteCredential(id: string, userId: string) {
    await this.requireCredential(id, userId)
    await this.prisma.userProviderCredential.delete({ where: { id } })
    return { success: true }
  }

  async listModels(userId: string) {
    return this.prisma.userModelProfile.findMany({
      where: { userId },
      include: { credential: { select: { lastFour: true, name: true, providerId: true, status: true } } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
  }

  async createModel(input: CreateUserModelInput, userId: string) {
    const credentialId = requiredText(input.credentialId, '凭据', 80)
    const model = requiredText(input.model, '模型名称', 120)
    const displayName = requiredText(input.displayName, '显示名称', 60)
    const credential = await this.requireCredential(credentialId, userId)
    const [credentialCount, userCount] = await Promise.all([
      this.prisma.userModelProfile.count({ where: { credentialId } }),
      this.prisma.userModelProfile.count({ where: { userId } }),
    ])
    if (credentialCount >= MAX_MODELS_PER_CREDENTIAL) throw new BadRequestException(`每个凭据最多关联 ${MAX_MODELS_PER_CREDENTIAL} 个模型`)
    if (userCount >= MAX_MODELS_PER_USER) throw new BadRequestException(`每个用户最多保存 ${MAX_MODELS_PER_USER} 个模型`)
    const makeDefault = input.isDefault === true || userCount === 0
    return this.prisma.$transaction(async (tx) => {
      if (makeDefault) await tx.userModelProfile.updateMany({ where: { userId }, data: { isDefault: false } })
      return tx.userModelProfile.create({
        data: { credentialId: credential.id, displayName, isDefault: makeDefault, model, userId },
      })
    })
  }

  async setDefaultModel(id: string, userId: string) {
    const { userMode } = await this.getPolicy()
    if (userMode === AiUserModelPolicy.USER_PLATFORM_ONLY) {
      throw new ForbiddenException('管理员当前仅允许使用平台模型')
    }
    const profile = await this.requireModel(id, userId)
    if (!profile.enabled || profile.credential.status !== AiCredentialStatus.ACTIVE) {
      throw new BadRequestException('停用的模型不能设为默认')
    }
    await this.prisma.$transaction([
      this.prisma.userModelProfile.updateMany({ where: { userId }, data: { isDefault: false } }),
      this.prisma.userModelProfile.update({ where: { id }, data: { isDefault: true } }),
    ])
    return { id, isDefault: true }
  }

  async setPlatformDefault(userId: string) {
    const { userMode } = await this.getPolicy()
    if (userMode === AiUserModelPolicy.USER_BYOK_ONLY) {
      throw new ForbiddenException('管理员当前要求使用自有模型')
    }
    await this.prisma.userModelProfile.updateMany({
      where: { userId },
      data: { isDefault: false },
    })
    return { source: AiModelSource.PLATFORM }
  }

  async deleteModel(id: string, userId: string) {
    await this.requireModel(id, userId)
    await this.prisma.userModelProfile.delete({ where: { id } })
    return { success: true }
  }

  async resolve(user: AuthenticatedRequestUser, requestedModelId?: string): Promise<AiResolvedModel> {
    if (user.role !== RoleCode.STUDENT) {
      const purpose = user.role === RoleCode.AUDITOR ? AiModelPurpose.AUDITOR_INTERACTIVE : AiModelPurpose.ADMIN_INTERACTIVE
      return (await this.resolvePlatformCandidates(purpose))[0]
    }
    const { userMode } = await this.getPolicy()
    if (userMode === AiUserModelPolicy.USER_PLATFORM_ONLY) return (await this.resolvePlatformCandidates(AiModelPurpose.USER_INTERACTIVE))[0]
    const profile = requestedModelId
      ? await this.requireModel(requestedModelId, user.id)
      : await this.prisma.userModelProfile.findFirst({
          where: { userId: user.id, enabled: true, isDefault: true },
          include: { credential: { include: { provider: true } } },
        })
    if (!profile && userMode === AiUserModelPolicy.USER_HYBRID) {
      return (await this.resolvePlatformCandidates(AiModelPurpose.USER_INTERACTIVE))[0]
    }
    if (!profile || !profile.enabled || profile.credential.status !== AiCredentialStatus.ACTIVE) {
      throw new ForbiddenException('当前策略要求使用自有模型，请先配置并启用默认模型')
    }
    if (profile.credential.consentVersion !== AI_PROVIDER_CONSENT_VERSION) {
      throw new ForbiddenException('第三方数据授权已更新，请重新确认后使用')
    }
    await this.prisma.userProviderCredential.update({ where: { id: profile.credentialId }, data: { lastUsedAt: new Date() } })
    return {
      apiKey: this.crypto.decrypt(profile.credential),
      baseUrl: profile.credential.baseUrl,
      credentialId: profile.credentialId,
      model: profile.model,
      providerId: profile.credential.providerId,
      source: AiModelSource.USER_BYOK,
    }
  }

  async testCredential(id: string, userId: string) {
    const credential = await this.requireCredential(id, userId, true)
    const target = new URL('models', credential.baseUrl)
    await assertPublicOutboundUrl(target)
    const response = await fetch(target, {
      headers: { Authorization: `Bearer ${this.crypto.decrypt(credential)}` },
      redirect: 'manual',
      signal: AbortSignal.timeout(12_000),
    }).catch(() => null)
    if (!response?.ok) throw new ServiceUnavailableException('供应商连接测试失败')
    return { ok: true }
  }

  private async ensureProviderPreset(id: string) {
    const preset = findProviderPreset(id)!
    await this.prisma.aiProviderPreset.upsert({
      where: { id },
      create: {
        baseUrl: preset.baseUrl,
        category: preset.category,
        id: preset.id,
        name: preset.name,
        protocol: 'OPENAI_COMPATIBLE',
        source: 'CC_SWITCH',
        sourceCommit: AI_PROVIDER_CATALOG_SOURCE_COMMIT,
      },
      update: { baseUrl: preset.baseUrl, category: preset.category, enabled: true, name: preset.name },
    })
  }

  private async requireCredential(id: string, userId: string, includeProvider = false) {
    const credential = await this.prisma.userProviderCredential.findFirst({
      where: { id, userId },
      include: { provider: includeProvider },
    })
    if (!credential) throw new NotFoundException('凭据不存在')
    return credential
  }

  private async requireModel(id: string, userId: string) {
    const model = await this.prisma.userModelProfile.findFirst({
      where: { id, userId },
      include: { credential: { include: { provider: true } } },
    })
    if (!model) throw new NotFoundException('模型不存在')
    return model
  }
}

function requiredText(value: unknown, label: string, max: number) {
  if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`请填写${label}`)
  if (value.trim().length > max) throw new BadRequestException(`${label}不能超过 ${max} 个字符`)
  return value.trim()
}

export function validateProviderApiKey(value: string, providerId: string) {
  const normalized = value.trim()
  const invalidLiteral = /^(?:internal server error|unauthorized|undefined|null|\[object object\])$/i
  if (invalidLiteral.test(normalized) || /\s/.test(normalized)) {
    throw new BadRequestException('API Key 格式不正确，请重新粘贴供应商控制台生成的完整 Key')
  }
  if (providerId === 'deepseek' && !normalized.startsWith('sk-')) {
    throw new BadRequestException('DeepSeek API Key 应以 sk- 开头')
  }
  return normalized
}

function platformModel(): AiResolvedModel {
  const baseUrl = process.env.OPENAI_BASE_URL || process.env.HERMES_AGENT_BASE_URL || 'http://localhost:5000/v1'
  return {
    apiKey: process.env.OPENAI_API_KEY || process.env.HERMES_AGENT_API_KEY || '',
    baseUrl: baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
    model: process.env.OPENAI_MODEL || process.env.HERMES_AGENT_MODEL || 'hermes-agent',
    providerId: 'platform',
    source: AiModelSource.PLATFORM,
  }
}
