import {
  PrismaClient,
  AnnouncementRange,
  AnnouncementStatus,
  AssetScope,
  AuthorizationLevel,
  LearningResourceKind,
  MallProductStatus,
  PointDirection,
  RoleCode,
} from '@prisma/client'
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

const seedAnnouncements = [
  {
    id: 'ann_demo_public_rules',
    title: 'CQUPT-SRC 平台试运行规则说明',
    category: '平台通知',
    range: AnnouncementRange.ALL,
    pinned: true,
    summary: '平台试运行期间，所有漏洞提交需先完成安全准入流程，并严格遵守授权测试范围。',
    content:
      'CQUPT-SRC 平台试运行期间，漏洞提交、复现和附件上传均需遵守学校授权测试范围。\n\n请勿对未授权资产进行扫描、爆破、数据下载、权限维持或影响业务运行的测试行为。平台将根据漏洞有效性、影响范围、材料完整度和修复价值进行审核。',
  },
  {
    id: 'ann_demo_public_certificate',
    title: '关于漏洞证书公开查询能力的说明',
    category: '规则更新',
    range: AnnouncementRange.ALL,
    pinned: true,
    summary: '证书查询仅展示证书真实性、颁发状态与脱敏信息，不公开漏洞资产、复现步骤和附件。',
    content:
      'CQUPT-SRC 漏洞贡献证书支持公开核验。访客输入证书编号后，只能看到证书状态、颁发日期和脱敏后的获得者信息。\n\n平台不会在公开查询中展示漏洞 URL、复现步骤、附件内容、审核备注、敏感资产信息或内部处置记录。',
  },
  {
    id: 'ann_demo_student_report',
    title: '漏洞提交报告格式建议',
    category: '安全提醒',
    range: AnnouncementRange.STUDENTS,
    pinned: false,
    summary: '建议漏洞报告包含影响资产、漏洞类型、复现步骤、影响说明、证明材料和修复建议。',
    content:
      '为了提高审核效率，建议漏洞报告包含：漏洞标题、影响资产、漏洞类型、复现步骤、影响评估、修复建议、测试边界说明和必要的 PDF 附件。\n\n截图和附件中如包含账号、手机号、Token、Cookie 等敏感信息，请先进行脱敏处理。',
  },
  {
    id: 'ann_demo_auditor_priority',
    title: '高危漏洞优先审核提醒',
    category: '审核通知',
    range: AnnouncementRange.AUDITORS,
    pinned: false,
    summary: '统一认证、账号安全、敏感数据暴露和影响业务连续性的漏洞应优先处理。',
    content:
      '审核员处理漏洞时，应优先关注统一认证、账号安全、敏感数据暴露和影响业务连续性的报告。\n\n确认有效前需要核对授权边界、复现证据、影响范围和修复建议，必要时要求提交人补充材料。',
  },
]

const seedLearningResources = [
  {
    id: 'learn_demo_burp_community',
    kind: LearningResourceKind.RESOURCE,
    category: '工具资源',
    title: 'Burp Suite Community 下载入口',
    description: 'Web 请求代理、重放与漏洞验证常用工具。使用时应严格遵守授权测试范围，不得对未授权资产进行扫描或攻击。',
    externalUrl: 'https://portswigger.net/burp/communitydownload',
  },
  {
    id: 'learn_demo_wstg',
    kind: LearningResourceKind.RESOURCE,
    category: '文档资料',
    title: 'OWASP Web Security Testing Guide',
    description: 'Web 安全测试方法论与检查清单，可作为漏洞复现、影响评估和修复建议撰写参考。',
    externalUrl: 'https://owasp.org/www-project-web-security-testing-guide/',
  },
  {
    id: 'learn_demo_webgoat',
    kind: LearningResourceKind.RANGE,
    category: 'Web靶场',
    title: 'OWASP WebGoat 靶场',
    description: '面向 Web 漏洞基础训练的开源靶场资源，适合学习常见漏洞原理和安全测试边界。',
    externalUrl: 'https://owasp.org/www-project-webgoat/',
  },
  {
    id: 'learn_demo_juice_shop',
    kind: LearningResourceKind.RANGE,
    category: 'Web靶场',
    title: 'OWASP Juice Shop 靶场',
    description: '覆盖多类型 Web 安全问题的综合训练靶场，适合用于学习报告撰写和复现材料整理。',
    externalUrl: 'https://owasp.org/www-project-juice-shop/',
  },
]

const seedMallProducts = [
  {
    id: 'mall_demo_notebook',
    category: '实体奖励',
    description: '用于记录漏洞复现过程、学习笔记和靶场训练思路的 CQUPT-SRC 定制笔记本。',
    imageUrl: '',
    name: 'CQUPT-SRC 定制笔记本',
    perUserLimit: 2,
    pickupInstructions: '兑换成功后请携带校园卡或有效身份证明前往蓝山工作室领取。',
    pickupLocation: '蓝山工作室',
    pointsCost: 280,
    sortOrder: 80,
    status: MallProductStatus.ACTIVE,
    stock: 18,
  },
  {
    id: 'mall_demo_toolkit',
    category: '学习权益',
    description: '包含常见 Web 测试工具配置说明、使用边界和漏洞报告模板。',
    imageUrl: '',
    name: '安全工具进阶资料包',
    perUserLimit: 1,
    pickupInstructions: '兑换后由管理员确认领取状态，资料链接后续可通过站内通知发放。',
    pickupLocation: '蓝山工作室',
    pointsCost: 360,
    sortOrder: 70,
    status: MallProductStatus.ACTIVE,
    stock: 42,
  },
  {
    id: 'mall_demo_certificate_print',
    category: '证书周边',
    description: '将已获得的高价值漏洞证书进行精装打印，适合个人成长档案留存。',
    imageUrl: '',
    name: '漏洞证书精装打印服务',
    perUserLimit: 1,
    pickupInstructions: '请先确认已经拥有有效电子证书，兑换成功后前往蓝山工作室领取。',
    pickupLocation: '蓝山工作室',
    pointsCost: 520,
    sortOrder: 60,
    status: MallProductStatus.ACTIVE,
    stock: 12,
  },
  {
    id: 'mall_demo_badge',
    category: '实体奖励',
    description: '面向有效漏洞贡献者的定制徽章，库存补充后可继续兑换。',
    imageUrl: '',
    name: 'CQUPT-SRC 定制徽章',
    perUserLimit: 2,
    pickupInstructions: '库存补充后开放领取。',
    pickupLocation: '蓝山工作室',
    pointsCost: 180,
    sortOrder: 40,
    status: MallProductStatus.INACTIVE,
    stock: 0,
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

  const adminUser = await prisma.user.findUnique({ where: { unifiedCode: '0000000' } })
  if (!adminUser) {
    throw new Error('Missing admin seed user')
  }
  const studentUser = await prisma.user.findUnique({ where: { unifiedCode: '2025001' } })
  if (!studentUser) {
    throw new Error('Missing student seed user')
  }

  for (const announcement of seedAnnouncements) {
    await prisma.announcement.upsert({
      where: { id: announcement.id },
      create: {
        ...announcement,
        authorId: adminUser.id,
        publishedAt: new Date(),
        status: AnnouncementStatus.PUBLISHED,
      },
      update: {
        category: announcement.category,
        content: announcement.content,
        pinned: announcement.pinned,
        publishedAt: new Date(),
        range: announcement.range,
        status: AnnouncementStatus.PUBLISHED,
        summary: announcement.summary,
        title: announcement.title,
      },
    })
  }

  for (const resource of seedLearningResources) {
    await prisma.learningResource.upsert({
      where: { id: resource.id },
      create: {
        ...resource,
        active: true,
      },
      update: {
        active: true,
        category: resource.category,
        description: resource.description,
        externalUrl: resource.externalUrl,
        kind: resource.kind,
        title: resource.title,
      },
    })
  }

  await prisma.pointLedgerEntry.upsert({
    where: { id: 'point_demo_student_initial' },
    create: {
      id: 'point_demo_student_initial',
      balanceAfter: 1260,
      direction: PointDirection.IN,
      note: '开发环境演示积分，用于验证积分商城兑换流程。',
      operatorId: adminUser.id,
      points: 1260,
      reason: '演示积分初始化',
      userId: studentUser.id,
    },
    update: {
      balanceAfter: 1260,
      direction: PointDirection.IN,
      note: '开发环境演示积分，用于验证积分商城兑换流程。',
      operatorId: adminUser.id,
      points: 1260,
      reason: '演示积分初始化',
      userId: studentUser.id,
    },
  })

  for (const product of seedMallProducts) {
    await prisma.mallProduct.upsert({
      where: { id: product.id },
      create: {
        ...product,
        createdById: adminUser.id,
      },
      update: {
        category: product.category,
        description: product.description,
        imageUrl: product.imageUrl,
        name: product.name,
        perUserLimit: product.perUserLimit,
        pickupInstructions: product.pickupInstructions,
        pickupLocation: product.pickupLocation,
        pointsCost: product.pointsCost,
        sortOrder: product.sortOrder,
        status: product.status,
        stock: product.stock,
      },
    })
  }
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
