import assert from 'node:assert/strict'
import test from 'node:test'
import { RoleCode, UserStatus } from '@prisma/client'
import { AiDeclarativeSkillService } from '../src/modules/ai/ai-declarative-skill.service'
import type { AuthenticatedRequestUser } from '../src/modules/auth/auth.types'

const student: AuthenticatedRequestUser = {
  email: 'student@example.test',
  id: 'user_student',
  name: 'Student',
  permissions: ['ai:use_student'],
  role: RoleCode.STUDENT,
  status: UserStatus.ACTIVE,
  tokenType: 'access',
  unifiedCode: '2026001',
}

test('declarative Skill upload accepts UTF-8 SKILL.md and stores only read-only tool requests', async () => {
  let createData: unknown
  const prisma = {
    aiSkill: {
      create: async (input: { data: unknown }) => {
        createData = input.data
        return { id: 'skill_1', ...input.data }
      },
    },
  }
  const service = new AiDeclarativeSkillService(prisma as never)
  const content = `---
name: report-helper
description: 整理漏洞报告
requested_tools:
  - get_my_vulnerabilities
---
只读取当前用户漏洞摘要，并给出结构建议。`

  const result = await service.upload({
    buffer: Buffer.from(content),
    originalname: 'SKILL.md',
    size: Buffer.byteLength(content),
  }, student)

  assert.equal((result as { id: string }).id, 'skill_1')
  assert.match(JSON.stringify(createData), /get_my_vulnerabilities/)
  assert.doesNotMatch(JSON.stringify(createData), /ciphertext|apiKey/)
})

test('declarative Skill rejects executable files before database access', async () => {
  const service = new AiDeclarativeSkillService({} as never)
  await assert.rejects(
    service.upload({ buffer: Buffer.from('console.log(1)'), originalname: 'skill.js', size: 14 }, student),
    /不支持的 Skill 文件类型/,
  )
})

test('auditors cannot create declarative Skills', async () => {
  const service = new AiDeclarativeSkillService({} as never)
  await assert.rejects(
    service.create({ content: '合法但不可创建的内容', title: '审核员 Skill' }, { ...student, role: RoleCode.AUDITOR }),
    /审核员不能创建 Skill/,
  )
})
