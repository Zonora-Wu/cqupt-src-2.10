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
  {
    id: 'learn_range_vulhub',
    kind: LearningResourceKind.RANGE,
    category: '综合演练靶场',
    title: 'Vulhub',
    description:
      '国内非常常用的漏洞复现环境集合，基于 Docker / Docker Compose，适合复现中间件、Web 组件、CMS、框架类漏洞。启动方便，适合学生做 CVE 复现、漏洞原理学习和课程实验。',
    externalUrl: 'https://vulhub.org/',
  },
  {
    id: 'learn_range_pikachu',
    kind: LearningResourceKind.RANGE,
    category: 'Web靶场',
    title: 'Pikachu 皮卡丘靶场',
    description:
      '中文 Web 安全练习靶场，适合新手入门。包含 XSS、SQL 注入、命令执行、文件包含、CSRF、越权等常见 Web 漏洞，适合基础 Web 安全漏洞练习。',
    externalUrl: 'https://github.com/zhuifengshaonianhanlu/pikachu',
  },
  {
    id: 'learn_range_dvwa',
    kind: LearningResourceKind.RANGE,
    category: 'Web靶场',
    title: 'DVWA',
    description:
      '经典 Web 漏洞靶场，全名 Damn Vulnerable Web Application。适合练习 SQL 注入、XSS、CSRF、命令注入、文件上传、文件包含、暴力破解等基础漏洞。',
    externalUrl: 'https://github.com/digininja/DVWA',
  },
  {
    id: 'learn_range_sqli_labs',
    kind: LearningResourceKind.RANGE,
    category: 'Web靶场',
    title: 'sqli-labs',
    description:
      'SQL 注入专项靶场，适合系统练习 GET、POST、报错注入、盲注、联合查询、堆叠注入、绕过等 SQL 注入技巧，是学习和测试 SQL 注入的常用开源平台。',
    externalUrl: 'https://github.com/Audi-1/sqli-labs',
  },
  {
    id: 'learn_range_upload_labs',
    kind: LearningResourceKind.RANGE,
    category: 'Web靶场',
    title: 'upload-labs',
    description:
      '文件上传漏洞专项靶场，适合练习前端校验绕过、MIME 绕过、后缀绕过、解析漏洞、条件竞争、图片马等上传类漏洞，常用于 Web 安全课程、CTF 入门和渗透测试练习。',
    externalUrl: 'https://github.com/c0ny1/upload-labs',
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
      contentHash: 'cqupt-src-responsibility-agreement-v2026-04-1',
      content: `CQUPT-SRC 校园网络安全测试责任书

为规范校园网络安全测试活动，维护学校网络、信息系统、数据资源及师生合法权益，保障 CQUPT-SRC 平台（以下简称“平台”）安全、有序运行，签署人就参与平台相关测试活动，郑重作出如下承诺：

一、适用范围
1. 本责任书适用于签署人通过平台开展的漏洞发现、验证、报告提交、复测及与网络安全测试相关的全部活动。
2. 签署人仅可在平台公布、管理人员明确授权或资产管理单位书面确认的范围内开展测试；未获授权的资产、账号、接口、网络区域和数据均不属于测试范围。
3. 测试活动应遵守国家法律法规、学校管理制度、平台规则及资产管理单位的合理要求；前述规定不一致时，适用要求更严格的一项。

二、测试行为要求
1. 签署人应遵循最小影响、最小权限、最少数据原则，仅采用验证漏洞存在所必需的方法和操作。
2. 签署人应优先使用非破坏性验证方式。确需进行可能影响业务连续性、系统性能或数据完整性的测试前，须取得平台或资产管理单位的明确许可。
3. 签署人应如实记录测试时间、目标、步骤、证据和影响，并通过平台提交完整、可复现的漏洞报告；不得伪造、篡改、隐瞒或恶意夸大测试结果。
4. 发现可能造成重大影响的漏洞、敏感数据暴露或系统异常时，签署人应立即停止进一步操作，保留必要证据并通过平台或指定渠道报告。

三、禁止行为
签署人承诺不实施或协助实施下列行为：
1. 对未授权目标进行扫描、探测、渗透、攻击或其他安全测试活动。
2. 进行拒绝服务、资源耗尽、暴力破解、撞库、社会工程、钓鱼、恶意代码投放、后门植入、权限维持、横向移动等可能危害系统或他人权益的行为。
3. 擅自获取、下载、复制、传播、出售、公开或以其他方式处置测试过程中接触到的账号、个人信息、业务数据、源代码、密钥、配置文件及其他敏感信息。
4. 擅自修改、删除、加密、锁定、损坏系统、数据或日志，干扰正常教学、科研、管理和服务秩序。
5. 绕过身份认证、访问控制、审计机制或平台限制；冒用、出借、共享账号，或使用他人身份参与测试。
6. 未经平台书面许可，向第三方披露漏洞细节、测试材料、截图、利用代码或受影响资产信息。
7. 利用漏洞牟取不正当利益，或实施其他违反法律法规、校纪校规和平台规则的行为。

四、数据与保密义务
1. 签署人对测试过程中知悉的非公开信息承担保密义务，未经授权不得向任何个人或组织披露。
2. 测试证据应限于证明漏洞所必需的最小范围，并采取脱敏、加密和妥善保管措施；完成提交或按平台要求后，应及时删除不再需要的本地副本。
3. 签署人不得将平台漏洞信息、测试数据或受影响资产信息用于与漏洞修复、验证和安全改进无关的用途。

五、报告与协作
1. 签署人应使用平台提供的规范流程提交漏洞，并配合管理员、审核员或资产管理单位进行沟通、补充材料、复测和修复验证。
2. 漏洞处于未修复、未公开或平台要求保密期间，签署人不得自行公开相关信息。
3. 平台可基于安全处置需要对报告进行分级、转交、合并、关闭或要求补充；签署人应予以理解并配合。

六、责任承担
1. 签署人应对本人账号下发生的测试活动和提交内容负责，并保证所提供身份信息真实、准确、有效。
2. 因违反本责任书、平台规则或相关法律法规造成系统故障、数据泄露、业务中断、名誉损害或其他损失的，签署人愿意承担相应责任；平台有权视情节采取限制功能、暂停账号、取消资格、移交有关部门等措施。
3. 如签署人为未成年人，应在监护人知情并同意的前提下参与平台活动，并遵守适用的管理要求。

七、其他
1. 本责任书自签署人在线确认之日起生效，至签署人停止使用平台相关测试功能或平台发布新版本责任书时止。
2. 平台可根据法律法规、学校管理要求和安全实践对本责任书进行修订；新版本发布后，签署人应重新阅读并签署后方可继续使用相关功能。
3. 本责任书未尽事项，按照国家法律法规、学校管理制度及平台规则执行。

本人已完整阅读、理解并同意遵守本责任书全部内容；本人确认在线签署与书面签署具有同等效力。`,
      active: true,
      publishedAt: new Date(),
    },
    update: {
      title: 'CQUPT-SRC 校园网络安全测试责任书',
      contentHash: 'cqupt-src-responsibility-agreement-v2026-04-1',
      content: `CQUPT-SRC 校园网络安全测试责任书

为规范校园网络安全测试活动，维护学校网络、信息系统、数据资源及师生合法权益，保障 CQUPT-SRC 平台（以下简称“平台”）安全、有序运行，签署人就参与平台相关测试活动，郑重作出如下承诺：

一、适用范围
1. 本责任书适用于签署人通过平台开展的漏洞发现、验证、报告提交、复测及与网络安全测试相关的全部活动。
2. 签署人仅可在平台公布、管理人员明确授权或资产管理单位书面确认的范围内开展测试；未获授权的资产、账号、接口、网络区域和数据均不属于测试范围。
3. 测试活动应遵守国家法律法规、学校管理制度、平台规则及资产管理单位的合理要求；前述规定不一致时，适用要求更严格的一项。

二、测试行为要求
1. 签署人应遵循最小影响、最小权限、最少数据原则，仅采用验证漏洞存在所必需的方法和操作。
2. 签署人应优先使用非破坏性验证方式。确需进行可能影响业务连续性、系统性能或数据完整性的测试前，须取得平台或资产管理单位的明确许可。
3. 签署人应如实记录测试时间、目标、步骤、证据和影响，并通过平台提交完整、可复现的漏洞报告；不得伪造、篡改、隐瞒或恶意夸大测试结果。
4. 发现可能造成重大影响的漏洞、敏感数据暴露或系统异常时，签署人应立即停止进一步操作，保留必要证据并通过平台或指定渠道报告。

三、禁止行为
签署人承诺不实施或协助实施下列行为：
1. 对未授权目标进行扫描、探测、渗透、攻击或其他安全测试活动。
2. 进行拒绝服务、资源耗尽、暴力破解、撞库、社会工程、钓鱼、恶意代码投放、后门植入、权限维持、横向移动等可能危害系统或他人权益的行为。
3. 擅自获取、下载、复制、传播、出售、公开或以其他方式处置测试过程中接触到的账号、个人信息、业务数据、源代码、密钥、配置文件及其他敏感信息。
4. 擅自修改、删除、加密、锁定、损坏系统、数据或日志，干扰正常教学、科研、管理和服务秩序。
5. 绕过身份认证、访问控制、审计机制或平台限制；冒用、出借、共享账号，或使用他人身份参与测试。
6. 未经平台书面许可，向第三方披露漏洞细节、测试材料、截图、利用代码或受影响资产信息。
7. 利用漏洞牟取不正当利益，或实施其他违反法律法规、校纪校规和平台规则的行为。

四、数据与保密义务
1. 签署人对测试过程中知悉的非公开信息承担保密义务，未经授权不得向任何个人或组织披露。
2. 测试证据应限于证明漏洞所必需的最小范围，并采取脱敏、加密和妥善保管措施；完成提交或按平台要求后，应及时删除不再需要的本地副本。
3. 签署人不得将平台漏洞信息、测试数据或受影响资产信息用于与漏洞修复、验证和安全改进无关的用途。

五、报告与协作
1. 签署人应使用平台提供的规范流程提交漏洞，并配合管理员、审核员或资产管理单位进行沟通、补充材料、复测和修复验证。
2. 漏洞处于未修复、未公开或平台要求保密期间，签署人不得自行公开相关信息。
3. 平台可基于安全处置需要对报告进行分级、转交、合并、关闭或要求补充；签署人应予以理解并配合。

六、责任承担
1. 签署人应对本人账号下发生的测试活动和提交内容负责，并保证所提供身份信息真实、准确、有效。
2. 因违反本责任书、平台规则或相关法律法规造成系统故障、数据泄露、业务中断、名誉损害或其他损失的，签署人愿意承担相应责任；平台有权视情节采取限制功能、暂停账号、取消资格、移交有关部门等措施。
3. 如签署人为未成年人，应在监护人知情并同意的前提下参与平台活动，并遵守适用的管理要求。

七、其他
1. 本责任书自签署人在线确认之日起生效，至签署人停止使用平台相关测试功能或平台发布新版本责任书时止。
2. 平台可根据法律法规、学校管理要求和安全实践对本责任书进行修订；新版本发布后，签署人应重新阅读并签署后方可继续使用相关功能。
3. 本责任书未尽事项，按照国家法律法规、学校管理制度及平台规则执行。

本人已完整阅读、理解并同意遵守本责任书全部内容；本人确认在线签署与书面签署具有同等效力。`,
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
