import { PrismaClient, AssetScope, AuthorizationLevel, RoleCode } from '@prisma/client'
import { hashPassword } from '../common/crypto/password'
import { permissionDefinitions, rolePermissionMap } from '../modules/rbac/permissions'

const prisma = new PrismaClient()

const roles: Array<{ code: RoleCode; name: string; description: string }> = [
  { code: 'STUDENT', name: '学生用户', description: '提交漏洞、查看个人漏洞、使用学生 AI 与学习资源。' },
  { code: 'AUDITOR', name: '审核员', description: '审核漏洞、复测、管理公告，并可由管理员授权签发证书。' },
  { code: 'ADMIN', name: '管理员', description: '管理平台运行、用户权限、系统设置、证书、商城、学习资源与审计。' },
]

const authorizationSources = [
  ['manual_admin', '管理员手动授权', '由管理员基于线下审批或导入结果手动授予。'],
  ['security_team', '安全团队授权', '安全组、实验室、社团等可信学生安全组织。'],
  ['online_exam', '线上安全考试', '完成准入考试并达到平台要求。'],
  ['staff_special', '教职工专项', '信息化办、安全老师或平台运营老师专项授权。'],
] as const

const authorizationPolicies: Array<{ level: AuthorizationLevel; scope: AssetScope; allowed: boolean; description: string }> = [
  { level: 'BASIC', scope: 'PUBLIC', allowed: true, description: '基础授权用户允许测试公开授权资产。' },
  { level: 'BASIC', scope: 'INTERNAL', allowed: false, description: '基础授权用户默认不可测试内部授权资产。' },
  { level: 'BASIC', scope: 'SPECIAL', allowed: false, description: '基础授权用户默认不可测试专项资产。' },
  { level: 'TRUSTED', scope: 'PUBLIC', allowed: true, description: '可信授权用户允许测试公开授权资产。' },
  { level: 'TRUSTED', scope: 'INTERNAL', allowed: true, description: '可信授权用户允许测试内部授权资产。' },
  { level: 'TRUSTED', scope: 'SPECIAL', allowed: false, description: '可信授权用户默认不可测试专项资产。' },
  { level: 'STAFF', scope: 'PUBLIC', allowed: true, description: '教职工/管理授权允许测试公开授权资产。' },
  { level: 'STAFF', scope: 'INTERNAL', allowed: true, description: '教职工/管理授权允许测试内部授权资产。' },
  { level: 'STAFF', scope: 'SPECIAL', allowed: true, description: '教职工/管理授权允许测试专项资产。' },
]

const seedUsers = [
  {
    unifiedCode: '2025001',
    password: '123456+-',
    email: 'student@example.edu.cn',
    name: '学生用户',
    studentNo: '2025001',
    college: '网络空间安全与信息法学院',
    grade: '2025',
    identityText: '校内学生',
    role: 'STUDENT' as RoleCode,
    authorizationLevel: 'BASIC' as AuthorizationLevel,
    authorizationSourceCode: 'online_exam',
  },
  {
    unifiedCode: '0000001',
    password: 'auditor123456+-',
    email: 'auditor@example.edu.cn',
    name: '审核员',
    studentNo: null,
    college: '信息化办公室',
    grade: null,
    identityText: '漏洞审核员',
    role: 'AUDITOR' as RoleCode,
    authorizationLevel: 'STAFF' as AuthorizationLevel,
    authorizationSourceCode: 'staff_special',
  },
  {
    unifiedCode: '0000000',
    password: 'admin123456+-',
    email: 'admin@example.edu.cn',
    name: '管理员',
    studentNo: null,
    college: '平台运营组',
    grade: null,
    identityText: '平台管理员',
    role: 'ADMIN' as RoleCode,
    authorizationLevel: 'STAFF' as AuthorizationLevel,
    authorizationSourceCode: 'manual_admin',
  },
]

async function main() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      create: role,
      update: {
        name: role.name,
        description: role.description,
      },
    })
  }

  for (const [code, name] of permissionDefinitions) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, name },
      update: { name },
    })
  }

  for (const [code, name, description] of authorizationSources) {
    await prisma.authorizationSource.upsert({
      where: { code },
      create: { code, name, description },
      update: { name, description, active: true },
    })
  }

  for (const policy of authorizationPolicies) {
    await prisma.authorizationPolicy.upsert({
      where: {
        level_scope: {
          level: policy.level,
          scope: policy.scope,
        },
      },
      create: policy,
      update: {
        allowed: policy.allowed,
        description: policy.description,
      },
    })
  }

  const permissionsByCode = new Map(
    (await prisma.permission.findMany()).map((permission) => [permission.code, permission.id]),
  )
  const rolesByCode = new Map((await prisma.role.findMany()).map((role) => [role.code, role.id]))

  for (const [roleCode, permissions] of Object.entries(rolePermissionMap) as Array<[RoleCode, string[]]>) {
    const roleId = rolesByCode.get(roleCode)
    if (!roleId) {
      continue
    }

    for (const permissionCode of permissions) {
      const permissionId = permissionsByCode.get(permissionCode)
      if (!permissionId) {
        continue
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },
        create: {
          roleId,
          permissionId,
        },
        update: {},
      })
    }
  }

  for (const seedUser of seedUsers) {
    const roleId = rolesByCode.get(seedUser.role)
    const authorizationSource = await prisma.authorizationSource.findUnique({
      where: { code: seedUser.authorizationSourceCode },
    })

    if (!roleId) {
      throw new Error(`Missing role: ${seedUser.role}`)
    }

    const user = await prisma.user.upsert({
      where: { unifiedCode: seedUser.unifiedCode },
      create: {
        unifiedCode: seedUser.unifiedCode,
        email: seedUser.email,
        emailVerifiedAt: new Date(),
        passwordHash: hashPassword(seedUser.password),
        name: seedUser.name,
        studentNo: seedUser.studentNo,
        college: seedUser.college,
        grade: seedUser.grade,
        identityText: seedUser.identityText,
        roleId,
        authorizationLevel: seedUser.authorizationLevel,
        authorizationSourceId: authorizationSource?.id,
        status: 'ACTIVE',
      },
      update: {
        email: seedUser.email,
        name: seedUser.name,
        studentNo: seedUser.studentNo,
        college: seedUser.college,
        grade: seedUser.grade,
        identityText: seedUser.identityText,
        roleId,
        authorizationLevel: seedUser.authorizationLevel,
        authorizationSourceId: authorizationSource?.id,
        status: 'ACTIVE',
      },
    })

    if (seedUser.role === 'AUDITOR') {
      for (const code of ['certificate:issue', 'certificate:revoke']) {
        const permissionId = permissionsByCode.get(code)
        if (!permissionId) {
          continue
        }

        await prisma.userPermissionOverride.upsert({
          where: {
            userId_permissionId: {
              userId: user.id,
              permissionId,
            },
          },
          create: {
            userId: user.id,
            permissionId,
            enabled: true,
            reason: '初始审核员账号默认开启证书管理能力，后续可由管理员关闭。',
          },
          update: {
            enabled: true,
            reason: '初始审核员账号默认开启证书管理能力，后续可由管理员关闭。',
          },
        })
      }
    }
  }

  const agreement = await prisma.responsibilityAgreement.upsert({
    where: { version: 'v2026.04-demo' },
    create: {
      version: 'v2026.04-demo',
      title: 'CQUPT-SRC 校园网络安全测试责任书',
      contentHash: 'demo-responsibility-agreement-v2026-04',
      content: '开发环境责任书占位文本。正式环境应替换为学校审核后的责任书全文。',
      active: true,
      publishedAt: new Date(),
    },
    update: {
      title: 'CQUPT-SRC 校园网络安全测试责任书',
      contentHash: 'demo-responsibility-agreement-v2026-04',
      content: '开发环境责任书占位文本。正式环境应替换为学校审核后的责任书全文。',
      active: true,
      publishedAt: new Date(),
    },
  })

  const seededUsers = await prisma.user.findMany({
    where: {
      unifiedCode: {
        in: seedUsers.map((user) => user.unifiedCode),
      },
    },
  })

  for (const user of seededUsers) {
    await prisma.responsibilitySignature.upsert({
      where: {
        userId_agreementId: {
          userId: user.id,
          agreementId: agreement.id,
        },
      },
      create: {
        userId: user.id,
        agreementId: agreement.id,
        ipAddress: '127.0.0.1',
        userAgent: 'seed',
        deviceFingerprint: 'seed-demo',
      },
      update: {},
    })
  }

  await prisma.schoolProfile.upsert({
    where: { id: 'default-school-profile' },
    create: {
      id: 'default-school-profile',
      schoolName: '重庆邮电大学',
      shortName: 'CQUPT',
      themeColor: '#2A6438',
      emailDomain: 'example.edu.cn',
    },
    update: {
      schoolName: '重庆邮电大学',
      shortName: 'CQUPT',
      themeColor: '#2A6438',
      emailDomain: 'example.edu.cn',
    },
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error: unknown) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
