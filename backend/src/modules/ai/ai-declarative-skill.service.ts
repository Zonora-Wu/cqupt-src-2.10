import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  AiKnowledgeRoleScope,
  AiSkillLifecycleOperation,
  AiSkillLifecycleStatus,
  AiSpace,
  RoleCode,
} from '@prisma/client'
import { createHash } from 'node:crypto'
import { basename, extname, posix } from 'node:path'
import { parse as parseYaml } from 'yaml'
import * as unzipper from 'unzipper'
import { AuthenticatedRequestUser } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'
import { getAvailableTools } from './ai.tools.registry'

const MAX_PACKAGE_BYTES = 2 * 1024 * 1024
const MAX_FILE_BYTES = 512 * 1024
const MAX_FILES = 30
const ALLOWED_EXTENSIONS = new Set(['.md', '.txt', '.json', '.yaml', '.yml'])
const ARCHIVE_EXTENSIONS = new Set(['.zip', '.tar', '.gz', '.7z', '.rar'])
const USER_READ_TOOLS = new Set(getAvailableTools(RoleCode.STUDENT).map((tool) => tool.name))

type SkillUpload = { buffer?: Buffer; originalname?: string; size?: number }
type ParsedFile = { content: string; path: string; sizeBytes: number; sha256: string }

@Injectable()
export class AiDeclarativeSkillService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedRequestUser) {
    const ownerFilter = user.role === RoleCode.ADMIN
      ? {}
      : {
          OR: [
            { createdById: user.id },
            {
              lifecycleStatus: AiSkillLifecycleStatus.PUBLISHED,
              roleScope: { in: [AiKnowledgeRoleScope.ALL, AiKnowledgeRoleScope.STUDENT] },
              visibleToUsers: true,
            },
          ],
        }
    const skills = await this.prisma.aiSkill.findMany({
      where: user.role === RoleCode.ADMIN ? ownerFilter : { active: true, ...ownerFilter },
      include: {
        createdBy: { select: { name: true, role: { select: { code: true } }, unifiedCode: true } },
        toolGrants: true,
        _count: { select: { files: true, revisions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
    return {
      isolation: 'private_owner_or_published_role_scope',
      skills: skills.map((skill) => ({
        ...skill,
        content: skill.createdById === user.id || skill.lifecycleStatus === AiSkillLifecycleStatus.PUBLISHED ? skill.content : '',
        skillKind: !skill.createdBy || skill.createdBy.role.code === RoleCode.ADMIN ? 'SYSTEM' : 'USER',
        owned: skill.createdById === user.id,
      })),
    }
  }

  async create(input: Record<string, unknown>, user: AuthenticatedRequestUser) {
    this.assertCreator(user)
    const title = requiredText(input.title, 'Skill 名称', 80)
    const content = requiredText(input.content, 'Skill 内容', 30_000)
    return this.persistParsedSkill([{ ...fileFromText('SKILL.md', content) }], title, user)
  }

  async upload(file: SkillUpload | undefined, user: AuthenticatedRequestUser) {
    this.assertCreator(user)
    if (!file?.buffer || !file.originalname) throw new BadRequestException('请选择 Skill 文件')
    if (file.buffer.length > MAX_PACKAGE_BYTES) throw new BadRequestException('Skill 包不能超过 2MB')
    const files = extname(file.originalname).toLowerCase() === '.zip'
      ? await parseZip(file.buffer)
      : [validateFile(file.originalname, file.buffer)]
    const skillFile = files.find((item) => item.path === 'SKILL.md')
    if (!skillFile) throw new BadRequestException('Skill 包根目录必须包含 SKILL.md')
    const metadata = parseFrontmatter(skillFile.content)
    return this.persistParsedSkill(files, metadata.name, user, metadata)
  }

  async update(id: string, input: Record<string, unknown>, user: AuthenticatedRequestUser) {
    const skill = await this.requireOwner(id, user)
    if (!(new Set<AiSkillLifecycleStatus>([AiSkillLifecycleStatus.DRAFT, AiSkillLifecycleStatus.ACTIVE_PRIVATE, AiSkillLifecycleStatus.CHANGES_REQUESTED, AiSkillLifecycleStatus.REJECTED])).has(skill.lifecycleStatus)) {
      throw new BadRequestException('审核中或已发布版本不能直接修改')
    }
    const title = input.title === undefined ? skill.title : requiredText(input.title, 'Skill 名称', 80)
    const content = input.content === undefined ? skill.content : requiredText(input.content, 'Skill 内容', 30_000)
    const requestedTools = validateRequestedTools(input.requestedTools)
    return this.prisma.$transaction(async (tx) => {
      await tx.aiSkillToolGrant.deleteMany({ where: { skillId: id } })
      return tx.aiSkill.update({
        where: { id },
        data: {
          content,
          contentSha256: sha256(content),
          lifecycleStatus: AiSkillLifecycleStatus.ACTIVE_PRIVATE,
          metadata: { requestedTools },
          title,
          toolGrants: { create: requestedTools.map((toolName) => ({ toolName })) },
        },
        include: { toolGrants: true },
      })
    })
  }

  async remove(id: string, user: AuthenticatedRequestUser) {
    await this.requireOwner(id, user)
    await this.prisma.aiSkill.update({
      where: { id },
      data: { active: false, lifecycleStatus: AiSkillLifecycleStatus.ARCHIVED },
    })
    return { success: true }
  }

  async setActive(id: string, active: boolean, user: AuthenticatedRequestUser) {
    const skill = await this.requireOwner(id, user)
    if (user.role === RoleCode.ADMIN) {
      if (active && skill.lifecycleStatus === AiSkillLifecycleStatus.ARCHIVED) {
        throw new BadRequestException('已归档 Skill 不能重新启用')
      }
      return this.prisma.aiSkill.update({
        where: { id },
        data: { active },
      })
    }
    if (active && !(new Set<AiSkillLifecycleStatus>([AiSkillLifecycleStatus.DRAFT, AiSkillLifecycleStatus.ACTIVE_PRIVATE])).has(skill.lifecycleStatus)) {
      throw new BadRequestException('当前 Skill 状态不能启用为私有版本')
    }
    return this.prisma.aiSkill.update({
      where: { id },
      data: { active, lifecycleStatus: active ? AiSkillLifecycleStatus.ACTIVE_PRIVATE : AiSkillLifecycleStatus.DISABLED },
    })
  }

  async updatePresentation(id: string, input: Record<string, unknown>, user: AuthenticatedRequestUser) {
    if (user.role !== RoleCode.ADMIN || !user.permissions.includes('ai:manage_skills')) {
      throw new ForbiddenException('无 Skill 展示配置权限')
    }
    const skill = await this.prisma.aiSkill.findUnique({
      include: { createdBy: { select: { role: { select: { code: true } } } } },
      where: { id },
    })
    if (!skill) throw new NotFoundException('Skill 不存在')
    if (skill.createdBy && skill.createdBy.role.code !== RoleCode.ADMIN) {
      throw new BadRequestException('用户 Skill 不能配置为系统默认 Skill')
    }
    const visibleToUsers = optionalBoolean(input.visibleToUsers, '用户侧展示')
    const defaultPinnedForUsers = optionalBoolean(input.defaultPinnedForUsers, '默认固定')
    const nextDefaultPinned = defaultPinnedForUsers ?? skill.defaultPinnedForUsers
    const nextVisible = visibleToUsers ?? skill.visibleToUsers
    if (nextDefaultPinned && !nextVisible) throw new BadRequestException('默认固定的 Skill 必须在用户侧展示')
    if ((nextVisible || nextDefaultPinned) && (
      skill.lifecycleStatus !== AiSkillLifecycleStatus.PUBLISHED
      || (skill.roleScope !== AiKnowledgeRoleScope.ALL && skill.roleScope !== AiKnowledgeRoleScope.STUDENT)
    )) {
      throw new BadRequestException('只有已发布且适用于用户的系统 Skill 可以在用户侧展示')
    }
    return this.prisma.aiSkill.update({
      data: { defaultPinnedForUsers: nextDefaultPinned, visibleToUsers: nextVisible },
      where: { id },
    })
  }

  async submit(id: string, user: AuthenticatedRequestUser) {
    const skill = await this.requireOwner(id, user)
    if (!(new Set<AiSkillLifecycleStatus>([AiSkillLifecycleStatus.ACTIVE_PRIVATE, AiSkillLifecycleStatus.CHANGES_REQUESTED, AiSkillLifecycleStatus.REJECTED])).has(skill.lifecycleStatus)) {
      throw new BadRequestException('当前 Skill 不能提交审核')
    }
    const version = (await this.prisma.aiSkillRevision.aggregate({ where: { skillId: id }, _max: { version: true } }))._max.version ?? 0
    return this.prisma.$transaction(async (tx) => {
      const revision = await tx.aiSkillRevision.create({
        data: {
          content: skill.content,
          contentSha256: skill.contentSha256 ?? sha256(skill.content),
          operation: version === 0 ? AiSkillLifecycleOperation.CREATE : AiSkillLifecycleOperation.UPDATE,
          skillId: id,
          version: version + 1,
        },
      })
      const review = await tx.aiSkillReview.create({ data: { revisionId: revision.id, skillId: id } })
      await tx.aiSkill.update({ where: { id }, data: { lifecycleStatus: AiSkillLifecycleStatus.SUBMITTED } })
      return { reviewId: review.id, revisionId: revision.id, status: 'SUBMITTED' }
    })
  }

  async listReviews() {
    return this.prisma.aiSkillReview.findMany({
      where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } },
      include: { skill: { include: { files: true, toolGrants: true, createdBy: { select: { id: true, name: true, unifiedCode: true } } } } },
      orderBy: { submittedAt: 'asc' },
    })
  }

  async review(id: string, decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES', note: unknown, reviewer: AuthenticatedRequestUser) {
    if (reviewer.role !== RoleCode.ADMIN || !reviewer.permissions.includes('ai:manage_skills')) throw new ForbiddenException('无 Skill 审核权限')
    const review = await this.prisma.aiSkillReview.findUnique({ where: { id }, include: { skill: true } })
    if (!review || !['PENDING', 'UNDER_REVIEW'].includes(review.status)) throw new NotFoundException('待审核记录不存在')
    if (review.skill.createdById === reviewer.id) throw new ForbiddenException('管理员不能审核自己创建的 Skill')
    const reviewNote = typeof note === 'string' ? note.trim().slice(0, 2000) : ''
    if (decision !== 'APPROVE' && !reviewNote) throw new BadRequestException('驳回或要求修改时必须填写原因')
    const status = decision === 'APPROVE'
      ? AiSkillLifecycleStatus.PUBLISHED
      : decision === 'REJECT' ? AiSkillLifecycleStatus.REJECTED : AiSkillLifecycleStatus.CHANGES_REQUESTED
    return this.prisma.$transaction(async (tx) => {
      if (decision === 'APPROVE') {
        await tx.aiSkillToolGrant.updateMany({
          where: { skillId: review.skillId },
          data: { approved: true, approvedAt: new Date(), approvedById: reviewer.id },
        })
      }
      await tx.aiSkill.update({
        where: { id: review.skillId },
        data: { lastPublishedAt: decision === 'APPROVE' ? new Date() : undefined, lifecycleStatus: status, roleScope: AiKnowledgeRoleScope.STUDENT },
      })
      return tx.aiSkillReview.update({
        where: { id },
        data: { note: reviewNote || null, reviewedAt: new Date(), reviewerId: reviewer.id, status: decision },
      })
    })
  }

  async pin(skillId: string, sessionId: string, user: AuthenticatedRequestUser) {
    const skill = await this.prisma.aiSkill.findFirst({
      where: {
        id: skillId,
        active: true,
        OR: [{ createdById: user.id }, { lifecycleStatus: AiSkillLifecycleStatus.PUBLISHED }],
      },
      include: { revisions: { orderBy: { version: 'desc' }, take: 1 } },
    })
    if (!skill) throw new NotFoundException('Skill 不存在或不可用')
    return this.prisma.aiConversationSkillPin.upsert({
      where: { sessionId_skillId: { sessionId, skillId } },
      create: { revisionId: skill.revisions[0]?.id, sessionId, skillId, userId: user.id },
      update: { revisionId: skill.revisions[0]?.id },
    })
  }

  async unpin(skillId: string, sessionId: string, user: AuthenticatedRequestUser) {
    await this.prisma.aiConversationSkillPin.deleteMany({ where: { sessionId, skillId, userId: user.id } })
    return { success: true }
  }

  private assertCreator(user: AuthenticatedRequestUser) {
    if (user.role === RoleCode.AUDITOR) throw new ForbiddenException('审核员不能创建 Skill')
    const allowed = user.role === RoleCode.ADMIN
      ? user.permissions.includes('ai:manage_skills')
      : user.permissions.includes('ai:use_student')
    if (!allowed) throw new ForbiddenException('缺少 Skill 创建权限')
  }

  private async requireOwner(id: string, user: AuthenticatedRequestUser) {
    const skill = await this.prisma.aiSkill.findFirst({
      where: user.role === RoleCode.ADMIN ? { id } : { id, createdById: user.id },
    })
    if (!skill) throw new NotFoundException('Skill 不存在或无权操作')
    return skill
  }

  private async persistParsedSkill(files: ParsedFile[], title: string, user: AuthenticatedRequestUser, metadata?: ReturnType<typeof parseFrontmatter>) {
    const skillFile = files.find((file) => file.path === 'SKILL.md')!
    const requestedTools = validateRequestedTools(metadata?.requested_tools)
    const slug = uniqueSlug(metadata?.name ?? title)
    return this.prisma.aiSkill.create({
      data: {
        active: true,
        aiSpace: user.role === RoleCode.ADMIN ? AiSpace.ADMIN : AiSpace.STUDENT,
        content: skillFile.content,
        contentSha256: skillFile.sha256,
        createdById: user.id,
        lifecycleStatus: AiSkillLifecycleStatus.ACTIVE_PRIVATE,
        metadata: { description: metadata?.description ?? '', examples: metadata?.examples ?? [], requestedTools },
        roleScope: user.role === RoleCode.ADMIN ? AiKnowledgeRoleScope.ADMIN : AiKnowledgeRoleScope.STUDENT,
        slug: `${slug}-${createHash('sha1').update(`${user.id}:${Date.now()}`).digest('hex').slice(0, 8)}`,
        source: 'DECLARATIVE_USER',
        title,
        files: { create: files.map((file) => ({ ...file, mimeType: mimeFor(file.path) })) },
        toolGrants: { create: requestedTools.map((toolName) => ({ toolName })) },
      },
      include: { files: true, toolGrants: true },
    })
  }
}

async function parseZip(buffer: Buffer) {
  const archive = await unzipper.Open.buffer(buffer)
  if (archive.files.length > MAX_FILES) throw new BadRequestException(`Skill 包最多 ${MAX_FILES} 个文件`)
  const parsed: ParsedFile[] = []
  let total = 0
  for (const entry of archive.files) {
    if (entry.type === 'Directory') continue
    const path = normalizePackagePath(entry.path)
    const declaredSize = Number((entry as unknown as { uncompressedSize?: number }).uncompressedSize ?? 0)
    if (declaredSize > MAX_FILE_BYTES || total + declaredSize > MAX_PACKAGE_BYTES) {
      throw new BadRequestException('Skill 解压后大小超过限制')
    }
    if ((entry as unknown as { externalFileAttributes?: number }).externalFileAttributes && isSymlink(entry as unknown as { externalFileAttributes: number })) {
      throw new BadRequestException('Skill 包不能包含软链接')
    }
    const content = await entry.buffer()
    total += content.length
    if (total > MAX_PACKAGE_BYTES) throw new BadRequestException('Skill 解压后总大小不能超过 2MB')
    parsed.push(validateFile(path, content))
  }
  return parsed
}

function validateFile(path: string, buffer: Buffer): ParsedFile {
  const normalized = normalizePackagePath(path)
  const extension = extname(normalized).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new BadRequestException(`不支持的 Skill 文件类型：${extension || '无扩展名'}`)
  if (ARCHIVE_EXTENSIONS.has(extension)) throw new BadRequestException('Skill 包不能包含嵌套压缩包')
  if (buffer.length > MAX_FILE_BYTES) throw new BadRequestException('单个 Skill 文件不能超过 512KB')
  if (buffer.includes(0)) throw new BadRequestException('Skill 包不能包含二进制文件')
  const content = buffer.toString('utf8')
  if (content.includes('\uFFFD')) throw new BadRequestException('Skill 文件必须使用 UTF-8')
  return { content, path: normalized, sha256: sha256(content), sizeBytes: buffer.length }
}

function normalizePackagePath(value: string) {
  const normalized = posix.normalize(value.replaceAll('\\', '/')).replace(/^\.\/+/, '')
  if (!normalized || normalized.startsWith('../') || normalized.startsWith('/') || normalized.split('/').some((part) => part.startsWith('.'))) {
    throw new BadRequestException('Skill 包包含隐藏文件或非法路径')
  }
  return normalized
}

function parseFrontmatter(content: string) {
  if (!content.startsWith('---\n')) throw new BadRequestException('SKILL.md 缺少 YAML Frontmatter')
  const end = content.indexOf('\n---', 4)
  if (end < 0) throw new BadRequestException('SKILL.md Frontmatter 未闭合')
  const parsed = parseYaml(content.slice(4, end))
  if (!parsed || typeof parsed !== 'object') throw new BadRequestException('Skill Frontmatter 格式不正确')
  const record = parsed as Record<string, unknown>
  return {
    description: typeof record.description === 'string' ? record.description.trim().slice(0, 500) : '',
    examples: Array.isArray(record.examples) ? record.examples.filter((item): item is string => typeof item === 'string').slice(0, 10) : [],
    name: requiredText(record.name, 'Skill name', 80),
    requested_tools: record.requested_tools,
  }
}

function validateRequestedTools(value: unknown) {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new BadRequestException('requested_tools 必须是数组')
  const tools = [...new Set(value.map((item) => requiredText(item, '工具名称', 100)))]
  const invalid = tools.find((tool) => !USER_READ_TOOLS.has(tool))
  if (invalid) throw new BadRequestException(`Skill 只能申请用户只读工具：${invalid}`)
  return tools
}

function requiredText(value: unknown, label: string, max: number) {
  if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`请填写${label}`)
  if (value.trim().length > max) throw new BadRequestException(`${label}不能超过 ${max} 个字符`)
  return value.trim()
}

function optionalBoolean(value: unknown, label: string) {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') throw new BadRequestException(`${label}必须是布尔值`)
  return value
}

function fileFromText(path: string, content: string) {
  return { content, path, sha256: sha256(content), sizeBytes: Buffer.byteLength(content) }
}
function sha256(value: string) { return createHash('sha256').update(value).digest('hex') }
function uniqueSlug(value: string) { return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'skill' }
function mimeFor(path: string) { return extname(path).toLowerCase() === '.json' ? 'application/json' : 'text/plain' }
function isSymlink(entry: { externalFileAttributes: number }) { return ((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000 }
