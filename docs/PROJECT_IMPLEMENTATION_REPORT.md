# CQUPT-SRC 项目实现情况详细说明

> 文档日期：2026-06-19  
> 对应仓库：`cqupt-src-2.10`  
> 对应分支：`AI复测修复优化`

## 1. 文档说明

本文档用于客观记录 CQUPT-SRC 当前代码库的实际情况，包括：

- 项目用途与业务范围。
- 当前技术栈。
- 仓库结构。
- 前端、后端、数据库和外部服务的实现方式。
- 认证、权限、漏洞处理、积分商城、证书和 AI 等主要业务流程。
- API、状态机、异步任务和测试实现。
- 当前已经完成的功能。
- 当前存在的问题、技术债和未完成闭环。
- 项目文档与实际代码之间的不一致。

本文档不把规划中的目标能力视为已经完成。事实判断采用以下优先级：

1. 当前分支中的实际代码。
2. `database/prisma/schema.prisma` 和数据库迁移。
3. `package.json`、环境变量示例、Docker Compose 和启动脚本。
4. 自动化测试及本地构建结果。
5. README、架构文档和历史实施计划。

由于项目在较短时间内经历过多轮 AI 知识库和 AI 漏洞复测方案调整，部分历史文档描述的是过去方案或目标方案，与当前代码并不完全一致。本文会单独列出这些差异。

---

## 2. 项目概述

CQUPT-SRC 是一个校园漏洞响应与安全学习平台。

平台主要连接以下参与者：

- 提交漏洞的学生或白帽用户。
- 负责漏洞初审和复测的审核员。
- 负责平台治理的管理员。
- 被报告资产对应的责任单位。

项目覆盖的业务范围包括：

- 用户注册与登录。
- 校园账号及邮箱身份信息。
- 用户角色和权限控制。
- 漏洞提交前责任书签署。
- 安全知识考试。
- 漏洞报告提交。
- PDF 附件上传和受控预览。
- 漏洞审核和补充材料。
- 修复与复测。
- 漏洞归档。
- 贡献证书生成与核验。
- 积分奖励和积分商城。
- 学习资源。
- 公告。
- 用户管理。
- 审计日志。
- 系统配置。
- AI 助手。
- AI 问题会话和知识沉淀。
- AI 漏洞自动复测。

项目当前不仅包含基础业务后台，还包含三个规模较大的 AI 相关子系统：

1. 邮宝 AI Gateway。
2. AI Knowledge Base。
3. AI Vulnerability Retest。

---

## 3. 当前代码规模

截至 2026-06-19，仓库中的 TypeScript 和 TSX 源代码约为 6 万行。

主要代码工程包括：

| 工程 | 目录 | 作用 |
|---|---|---|
| 前端 | `frontend/` | React 单页应用 |
| 后端 | `backend/` | NestJS REST API 和业务逻辑 |
| 低风险复测执行器 | `retest-runner/` | 执行受限制的自动复测步骤 |
| 复测出网代理 | `retest-egress-proxy/` | 控制 Hermes Direct 的目标范围 |
| 数据库 | `database/` | Prisma Schema、迁移和数据库设计 |
| 部署配置 | `deploy/` | Docker Compose、脚本和 Hermes 配置 |
| 测试 | `tests/` | API、E2E 和测试数据 |

当前部分源文件体积较大：

| 文件 | 约计行数 |
|---|---:|
| `frontend/src/pages/user/UserAIAssistant.tsx` | 2300+ |
| `backend/src/modules/ai/ai.service.ts` | 2100+ |
| `backend/src/modules/ai-knowledge/ai-knowledge.service.ts` | 1700+ |
| `frontend/src/pages/admin/AdminSystemSettings.tsx` | 1700+ |
| `frontend/src/pages/auditor/AuditorHome.tsx` | 1600+ |
| `backend/src/modules/ai-knowledge/ai-problem-session.service.ts` | 1600+ |
| `backend/src/modules/ai-vulnerability-retest/ai-vulnerability-retest.service.ts` | 1100+ |
| `backend/src/modules/ai-vulnerability-retest/ai-vulnerability-retest-worker.service.ts` | 1100+ |
| `backend/src/modules/vulnerabilities/vulnerabilities.service.ts` | 1000+ |

这些文件已经承担较多职责，属于当前代码可维护性方面的主要问题之一。

---

## 4. 技术栈

## 4.1 前端

| 技术 | 当前用途 |
|---|---|
| React 19 | 页面和组件 |
| TypeScript 5.9 | 类型系统 |
| Vite 6 | 开发服务器和生产构建 |
| Tailwind CSS 4 | 页面样式 |
| lucide-react | 图标 |
| motion | 页面交互动画 |
| Three.js | 访客首页 3D 笔记本展示 |
| `@react-three/fiber` | React 中的 Three.js 渲染 |
| Playwright | AI 复测界面 E2E |

前端没有使用：

- React Router。
- Redux。
- Zustand。
- TanStack Query。
- Axios。
- 成熟表单库。

页面导航主要依赖各角色工作台中的 `activeMenu` 状态。

HTTP 请求使用浏览器原生 `fetch`，由 `frontend/src/services/apiClient.ts` 封装。

## 4.2 后端

| 技术 | 当前用途 |
|---|---|
| NestJS 11 | REST API、依赖注入和模块组织 |
| TypeScript 5.9 | 后端开发 |
| Prisma 6 | ORM、Schema 和迁移 |
| PostgreSQL 16 | 主数据库 |
| `pdf-lib` | 证书 PDF 生成 |
| `pdf-parse` | PDF 文本提取 |
| Node.js 原生 `fetch` | Hermes、Runner、Egress Proxy 请求 |
| Node.js Crypto | JWT、密码、哈希、AES-GCM、签名 |

后端没有引入以下常见组件：

- Passport。
- `@nestjs/jwt`。
- `class-validator`。
- `class-transformer`。
- AWS S3 SDK。
- BullMQ。
- Redis 客户端。
- Swagger。

JWT、密码处理、对象存储签名和大部分输入校验均由项目代码自行实现。

## 4.3 数据与基础设施

| 技术 | 当前用途 |
|---|---|
| PostgreSQL | 业务数据、状态、审计和 AI 数据 |
| MinIO | PDF、证书资源和 AI 复测 artifact |
| Redis | 本地 Compose 中存在，目前未被核心后端代码实际使用 |
| Docker Compose | PostgreSQL、Redis、MinIO 和 Hermes 相关服务 |
| Nginx | 文档中规划用于生产反向代理，当前仓库配置不完整 |

## 4.4 AI

| 组件 | 作用 |
|---|---|
| 主 Hermes Agent | 邮宝 AI 助手和开放式模型调用 |
| NestJS AI Gateway | 身份、权限、上下文、工具、配额、审计和输出处理 |
| AI Knowledge Base | 对已解决问题进行沉淀、审核和维护 |
| Retest Runner | 执行低风险固定模板 |
| Hermes Direct | 执行复杂自动复测任务 |
| Egress Proxy | 限制 Hermes Direct 的出网目标 |

Hermes 通过 OpenAI-compatible API 接入。

---

## 5. 仓库结构

```text
cqupt-src-2.10/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── constants/
│   │   ├── hooks/
│   │   └── utils/
│   ├── public/
│   ├── e2e/
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── common/
│   │   ├── config/
│   │   ├── database/
│   │   ├── integrations/
│   │   ├── jobs/
│   │   ├── modules/
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/
│   └── package.json
├── database/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── seed/
├── retest-runner/
├── retest-egress-proxy/
├── deploy/
│   ├── docker/
│   ├── hermes-direct/
│   ├── nginx/
│   └── scripts/
├── tests/
│   ├── api/
│   ├── e2e/
│   └── fixtures/
├── docs/
├── storage/
├── tmp/
└── README.md
```

---

## 6. 系统总体架构

当前系统可以描述为一个模块化单体和多个外部执行服务的组合。

```text
浏览器
  |
  | HTTP / REST / Bearer Token
  v
React 前端
  |
  v
NestJS 后端
  |
  +-- Prisma --------------------> PostgreSQL
  |
  +-- S3StorageService ----------> MinIO
  |
  +-- AI Gateway ----------------> 主 Hermes Agent
  |
  +-- RetestRunnerClient --------> Retest Runner
  |
  +-- HermesDirectClient --------> Hermes Direct
  |
  +-- HermesEgressClient --------> Retest Egress Proxy
```

主要业务集中在一个 NestJS 应用中。

采用模块化单体的实际表现包括：

- 所有主要业务模块在同一个 `AppModule` 注册。
- 业务模块使用同一个 Prisma Client。
- 所有业务数据保存在同一个 PostgreSQL 数据库。
- 事务可以跨同一数据库中的多个表。
- API 和后台轮询 Worker 运行在同一个 Node.js 进程中。

复测 Runner 和 Hermes Direct 被单独部署，原因是它们涉及对外请求和潜在高风险执行，不适合直接与主业务数据库和主后端权限混在一起。

---

## 7. 前端实现

## 7.1 应用入口

前端入口文件：

- `frontend/src/main.tsx`
- `frontend/src/App.tsx`

`App.tsx` 负责：

- 读取本地登录状态。
- 调用后端校验当前用户。
- 处理登录状态失效事件。
- 打开登录和注册弹窗。
- 根据角色加载不同工作台。

角色和页面关系：

```text
未登录 -> GuestHome
STUDENT -> UserHome
AUDITOR -> AuditorHome
ADMIN -> AdminHome
```

角色工作台和认证弹窗使用 `React.lazy` 懒加载。

## 7.2 路由方式

当前没有使用 URL 路由库。

页面切换方式通常是：

```text
ScrollableNav
  -> setActiveMenu(...)
  -> 条件渲染不同页面组件
```

这种实现的结果：

- 页面切换实现简单。
- 不需要维护路由配置。
- 不能直接通过 URL 打开某个后台页面。
- 浏览器刷新后通常回到工作台默认页。
- 浏览器前进和后退不能准确表达内部页面历史。
- 不利于深链接、分享和页面级权限路由。

## 7.3 用户端

用户端入口：

```text
frontend/src/pages/user/UserHome.tsx
```

用户端包含：

- 首页。
- 提交漏洞。
- 我的漏洞。
- 我的证书。
- 积分商城。
- 排行榜。
- 学习中心。
- AI 助手。
- 平台公告。
- 个人资料。
- 账号安全。
- 系统设置。
- 通知。

用户端首页会请求：

- 当前账号资料。
- 用户仪表盘统计。
- 准入状态。
- 平台 AI Skill 展示数据。

部分首页活动数据和展示内容是前端静态数据。

## 7.4 审核员端

审核员端入口：

```text
frontend/src/pages/auditor/AuditorHome.tsx
```

审核员端包含：

- 首页。
- 漏洞审核。
- 复测归档。
- 证书管理。
- AI 辅助。
- 审核记录。
- 公告管理。

审核队列和复测队列已经有对应后端 API。

但是 `AuditorHome.tsx` 内仍包含：

- 静态 `reviewReports`。
- 静态 `retestItems`。
- 静态 `reviewHistory`。
- 静态公告示例。

页面后续会通过 API 加载真实列表，但当前静态数据仍是页面初始化和展示逻辑的一部分。

## 7.5 管理员端

管理员端入口：

```text
frontend/src/pages/admin/AdminHome.tsx
```

管理员端包含：

- 漏洞管理。
- 证书管理。
- 用户管理。
- 公告管理。
- 学习资源管理。
- 积分商城。
- AI 复测。
- 审计日志。
- AI 知识库。
- 系统设置。

管理员首页的统计数据来自后端 Dashboard API。

部分风险队列、系统健康和审计展示仍使用静态数组。

## 7.6 前端服务层

`frontend/src/services/` 包含：

- `auth.ts`
- `account.ts`
- `access.ts`
- `captcha.ts`
- `vulnerabilities.ts`
- `certificates.ts`
- `announcements.ts`
- `learning.ts`
- `mall.ts`
- `users.ts`
- `auditLogs.ts`
- `systemSettings.ts`
- `dashboard.ts`
- `notifications.ts`
- `securityExam.ts`
- `ai.ts`
- `aiKnowledge.ts`
- `aiRetests.ts`
- `aiRetestAdmin.ts`

`apiClient.ts` 统一提供：

- JSON 请求。
- FormData 请求。
- Blob 请求。
- Bearer Token 注入。
- API Base URL。
- API 错误解析。
- 401 登录失效处理。

默认 API 地址：

```text
http://localhost:3000/api
```

## 7.7 前端认证状态

登录结果保存在 localStorage：

```text
cqupt-src-auth-session
```

其中包含：

- Access Token。
- Refresh Token。
- 用户信息。

当前 API Client 只读取 Access Token。

当接口返回 401 时：

1. 删除 localStorage 登录信息。
2. 触发 `cqupt-src-auth-session-expired` 事件。
3. `App.tsx` 清理用户状态。
4. 页面提示重新登录。

前端没有使用 Refresh Token 自动更新 Access Token。

## 7.8 前端构建情况

2026-06-19 执行：

```bash
cd frontend
npm run build
```

构建通过。

构建产物中较大的 Chunk 包括：

- `KaliLaptopShowcase`：约 979 kB。
- 主入口 Chunk：约 228 kB。
- Three.js 相关代理 Chunk：约 124 kB。
- `UserAIAssistant`：约 66 kB。
- `AdminVulnerabilityManagement`：约 67 kB。

3D 首页资源是当前前端包体积的主要来源。

---

## 8. 后端启动和全局配置

## 8.1 启动入口

后端入口：

```text
backend/src/main.ts
```

启动过程：

1. 创建 NestJS 应用。
2. 设置 JSON Body 上限为 5 MB。
3. 设置全局 API 前缀。
4. 配置 CORS。
5. 监听配置端口。

默认配置：

| 配置 | 默认值 |
|---|---|
| API Prefix | `api` |
| Frontend Origin | `http://localhost:5173` |
| Port | `3000` |

## 8.2 环境变量校验

环境变量校验文件：

```text
backend/src/config/env.ts
```

强制要求：

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

当前校验范围较小。

MinIO、Hermes、SMTP 和 AI 复测密钥没有在应用启动阶段统一强制校验，而是在使用相关功能时才可能报错。

## 8.3 AppModule

`backend/src/app.module.ts` 当前注册：

- PrismaModule
- ObjectStorageModule
- HealthModule
- SchoolPolicyModule
- AuthModule
- AccountModule
- AiModule
- AiKnowledgeModule
- AiVulnerabilityRetestModule
- AccessModule
- SecurityExamModule
- VulnerabilitiesModule
- AttachmentsModule
- CaptchaModule
- CertificatesModule
- AnnouncementsModule
- AuditLogsModule
- LearningModule
- PointsMallModule
- NotificationsModule
- SystemSettingsModule
- UsersModule
- DashboardModule

---

## 9. 后端模块组织方式

大部分后端模块包含：

```text
xxx.module.ts
xxx.controller.ts
xxx.service.ts
xxx.validation.ts
xxx.types.ts
```

控制器负责：

- 定义路由。
- 使用 Guard。
- 声明权限。
- 读取 Path、Query、Body 和上传文件。
- 调用输入归一化函数。
- 调用 Service。

Service 负责：

- 业务规则。
- 数据查询。
- 状态校验。
- Prisma 事务。
- 业务事件。
- 审计日志。

项目没有使用统一 DTO 和全局 ValidationPipe。

输入校验主要由各模块 `validation.ts` 中的普通函数完成。

---

## 10. 用户和认证

## 10.1 用户模型

`User` 模型包含：

- 统一认证码。
- 邮箱。
- 姓名。
- 密码哈希。
- 学号。
- 学院。
- 年级。
- 身份描述。
- 头像。
- 用户状态。
- 角色。
- 授权等级。
- 邮箱验证时间。
- 最后登录时间。
- 注册审批状态。
- AI 配额和关联数据。

用户角色：

```text
STUDENT
AUDITOR
ADMIN
```

用户状态：

```text
PENDING
ACTIVE
DISABLED
LOCKED
```

授权等级：

```text
BASIC
TRUSTED
STAFF
```

角色和授权等级是两个不同概念：

- 角色决定默认权限集合。
- 授权等级可以用于资产范围和业务准入策略。

## 10.2 登录方式

当前认证接口包括：

- 统一认证码和密码登录。
- 邮箱验证码登录。
- 发送登录验证码。
- 发送注册验证码。
- 用户注册。
- 获取当前登录用户。

密码登录流程：

1. 按统一认证码查找用户。
2. 验证密码哈希。
3. 验证用户为 ACTIVE。
4. 查询用户实际权限。
5. 生成随机 Refresh Token。
6. 只保存 Refresh Token 哈希。
7. 更新用户最后登录时间。
8. 写登录审计日志。
9. 签发 Access Token。

## 10.3 JWT

项目使用自有 JWT 工具：

```text
backend/src/common/crypto/jwt.ts
```

Access Token 默认有效期：

```text
15 分钟
```

Refresh Token 默认有效期：

```text
7 天
```

Access Token Payload 包含：

- `sub`
- `role`
- `type`
- `exp`

当前 Refresh Token 存在以下实现：

- 登录时生成。
- 数据库只保存哈希。
- 保存过期时间、IP 和 User-Agent。

当前缺少：

- Refresh API。
- Logout API。
- 主动撤销当前 Refresh Token 的 API。
- 前端自动续期。
- Refresh Token 轮换。

因此 Refresh Token 数据模型和签发逻辑已经存在，但使用闭环尚未完成。

## 10.4 邮箱验证码

开发环境验证码固定为：

```text
123456
```

验证码以 SHA-256 哈希形式保存。

登录验证码包含：

- 10 分钟有效期。
- 重发间隔。
- 时间窗口内次数限制。
- 消费状态。
- IP 和 User-Agent。

生产环境返回结果不会包含 `devCode`，但实际 SMTP 发送尚未接入。

注册验证码的速率限制实现没有登录验证码完整。

## 10.5 注册模式

系统设置支持开放注册和审批注册。

开放注册：

- 用户注册后直接 ACTIVE。

关闭开放注册：

- 创建 PENDING 用户。
- 标记 `pendingRegistrationApproval`。
- 管理员批准后才可以登录。

---

## 11. RBAC 权限系统

## 11.1 数据模型

RBAC 使用：

- `Role`
- `Permission`
- `RolePermission`
- `UserPermissionOverride`

默认角色权限由：

```text
backend/src/modules/rbac/permissions.ts
```

定义。

权限覆盖以下领域：

- 漏洞。
- AI 复测。
- 附件。
- 证书。
- 积分和商城。
- 公告。
- 学习资源。
- 用户。
- 审计。
- 系统设置。
- AI。
- AI 知识管理。

## 11.2 Guard

`JwtAuthGuard`：

1. 读取 Bearer Token。
2. 校验 JWT。
3. 查找数据库用户。
4. 验证用户状态。
5. 实时计算权限。
6. 写入 `request.auth`。

`PermissionsGuard`：

1. 读取 `@RequirePermissions` 元数据。
2. 检查 `request.auth.permissions`。
3. 缺失权限时返回 403。

权限不是完全依赖 JWT Payload。

即使 Token 中角色未变化，后端每次请求仍会查询数据库中的用户和权限，因此：

- 用户被禁用后旧 Token 不能继续使用。
- 管理员修改用户权限后可以较快生效。

## 11.3 用户权限覆盖

`UserPermissionOverride` 支持为单个用户：

- 显式授予权限。
- 显式撤销权限。

实际权限由角色权限和用户覆盖共同计算。

---

## 12. 漏洞提交准入

漏洞提交不是仅检查登录和 `vulnerability:create` 权限。

学生还需要满足平台准入条件：

- 当前责任书已签署。
- 安全考试已通过。
- 用户和授权策略允许提交。

相关模型：

- `ResponsibilityAgreement`
- `ResponsibilitySignature`
- `SecurityQuestion`
- `SecurityExamAttempt`
- `AuthorizationPolicy`
- `AuthorizationSource`

安全考试支持：

- 单选题。
- 判断题。
- 多选题。
- 随机组卷。
- 后端判分。
- 通过分数配置。
- 管理员题库管理。
- AI 生成题目。
- 批量导入。

前端会提示用户完成准入，但最终限制由后端执行。

---

## 13. 漏洞业务实现

## 13.1 主要模型

- `Asset`
- `VulnerabilityReport`
- `VulnerabilityAttachment`
- `VulnerabilityEvent`
- `ReviewAssignment`
- `ReviewComment`
- `RetestRecord`

## 13.2 漏洞报告字段

漏洞报告包含：

- 报告编号。
- 提交人。
- 标题。
- 资产名称。
- 资产 URL。
- 责任单位。
- 漏洞类型。
- 自评等级。
- 最终等级。
- 复现步骤。
- 影响说明。
- 修复建议。
- 请求包。
- 测试边界。
- 状态。
- 提交、确认、归档时间。
- 软删除时间。

## 13.3 严重等级

```text
CRITICAL
HIGH
MEDIUM
LOW
INFO
```

## 13.4 状态

```text
DRAFT
SUBMITTED
PENDING_REVIEW
NEEDS_SUPPLEMENT
CONFIRMED
FIXING
PENDING_RETEST
ARCHIVED
CERTIFIED
REJECTED
```

不是所有枚举状态都被当前流程完整使用。

例如当前新建漏洞直接创建为 `SUBMITTED`，没有公开的漏洞草稿保存接口。

## 13.5 提交流程

调用：

```http
POST /api/vulnerabilities
```

后端执行：

1. 检查提交准入。
2. 生成报告编号。
3. 创建 `VulnerabilityReport`。
4. 创建 `VulnerabilityEvent`。
5. 创建 `AuditLog`。

上述操作在 Prisma 事务中完成。

新报告状态为：

```text
SUBMITTED
```

## 13.6 审核流程

审核结论：

```text
CONFIRM
NEEDS_SUPPLEMENT
REJECT
```

状态变化：

```text
CONFIRM -> PENDING_RETEST
NEEDS_SUPPLEMENT -> NEEDS_SUPPLEMENT
REJECT -> REJECTED
```

审核确认时：

- 设置最终严重等级。
- 计算奖励积分。
- 创建或更新审核分派。
- 创建审核意见。
- 写积分流水。
- 创建漏洞事件。
- 创建审计日志。

这些操作在一个事务中完成。

## 13.7 积分奖励

默认积分：

| 严重等级 | 默认积分 |
|---|---:|
| CRITICAL | 800 |
| HIGH | 500 |
| MEDIUM | 260 |
| LOW | 80 |
| INFO | 20 |

审核员可以在允许范围内提供积分值，未提供时使用默认值。

当前实现需要注意：

- 审核接口如果被重复调用，需要依赖状态约束避免重复奖励。
- `reviewReport` 当前只明确禁止 DRAFT，没有显式限制所有合法来源状态。
- 对重复审核和重复积分应增加更严格的状态机和幂等约束。

## 13.8 补充材料

当状态为：

```text
NEEDS_SUPPLEMENT
```

用户可以提交补充内容。

提交后状态回到：

```text
SUBMITTED
```

并创建漏洞事件。

## 13.9 修复与复测

复测允许的当前状态包括：

- `FIXING`
- `PENDING_RETEST`
- `CONFIRMED`

复测结论：

```text
RETEST_PASS
RETURN_TO_FIX
ARCHIVE
```

状态变化：

```text
RETEST_PASS -> ARCHIVED
ARCHIVE -> ARCHIVED
RETURN_TO_FIX -> FIXING
```

复测会创建：

- `RetestRecord`
- `VulnerabilityEvent`
- `AuditLog`

## 13.10 状态显示差异

后端存在多套状态格式化函数：

- 用户端状态。
- 审核员状态。
- 管理员状态。

同一数据库状态可能在不同角色页面显示为不同文字。

例如：

- `PENDING_RETEST` 在用户端可能显示为“修复中”。
- 在管理员端显示为“待复测”。
- `REJECTED` 在用户端映射为“已归档”，在审核端显示为“已驳回”。

这会使状态语义难以统一，也可能隐藏真实业务结果。

---

## 14. 附件实现

漏洞附件 API：

```http
POST /api/vulnerabilities/:reportId/attachments
GET /api/attachments/:attachmentId/preview
```

支持附件类型：

- 漏洞报告。
- 复测证据。

附件安全检查包括：

- 文件大小。
- 文件扩展名。
- MIME Type。
- PDF Magic Bytes。
- SHA-256。

附件存储在 MinIO。

附件元数据保存在 PostgreSQL。

敏感附件预览需要权限，并写入审计日志。

当前附件只支持 PDF，没有图片附件和通用文件类型。

---

## 15. MinIO 对象存储实现

对象存储代码：

```text
backend/src/integrations/object-storage/s3-storage.service.ts
```

没有使用 AWS SDK 或 MinIO SDK。

项目自行实现了 AWS Signature Version 4。

当前支持：

- HEAD Bucket。
- PUT Bucket。
- PUT Object。
- GET Object。

实现特点：

- 依赖较少。
- 只实现项目当前需要的最小功能。
- 每次写对象前检查 Bucket。
- 默认使用 `us-east-1` 区域。

当前限制：

- 没有流式上传和下载。
- 文件整体读入内存。
- 没有 Multipart Upload。
- 没有预签名 URL。
- 没有删除对象。
- 没有成熟 SDK 的重试和错误分类。
- MinIO 默认账号密码存在代码默认值。

---

## 16. 证书系统

主要模型：

- `Certificate`
- `CertificateTemplate`

支持：

- 管理员或审核员签发证书。
- 撤销证书。
- 证书 PDF 生成。
- 证书预览。
- 公开证书编号核验。
- 公开结果脱敏。
- 模板背景。
- 印章。
- 文本坐标和布局。

PDF 使用：

- `pdf-lib`
- `fontkit`
- Noto Sans CJK 字体

证书和漏洞为接近一对一关系。

当前系统设置页面支持调整证书模板布局，但可视化编辑文件体积较大，逻辑集中在单个页面和 Service 中。

---

## 17. 积分和商城

## 17.1 数据模型

- `PointLedgerEntry`
- `MallProduct`
- `MallRedemption`
- `MallRedemptionEvent`

## 17.2 积分账本

积分没有直接作为 User 表的余额字段。

每条流水包含：

- 用户。
- 方向。
- 积分数量。
- 变更后余额。
- 原因。
- 备注。
- 关联漏洞。
- 操作人。

方向：

```text
IN
OUT
ADJUST
```

## 17.3 商品

商品状态：

```text
DRAFT
ACTIVE
INACTIVE
```

商品包含：

- 名称。
- 描述。
- 图片。
- 所需积分。
- 库存。
- 状态。

## 17.4 兑换

兑换状态：

```text
PENDING_PICKUP
COMPLETED
CANCELED
EXPIRED
```

兑换流程在 Prisma 事务中：

1. 查询商品。
2. 检查商品状态。
3. 检查库存。
4. 查询用户积分余额。
5. 检查积分。
6. 扣减库存。
7. 写积分支出流水。
8. 创建兑换记录。
9. 创建兑换事件。
10. 写审计日志。

取消兑换：

- 返还库存。
- 返还积分。
- 更新兑换状态。
- 创建兑换事件。
- 写审计日志。

当前积分余额通过最近一条 `balanceAfter` 获取。

如果同一用户发生高并发兑换，读取余额后再写入可能存在并发竞争，需要依赖更强的数据库锁、条件更新或序列化事务提高可靠性。

---

## 18. 公告和学习资源

## 18.1 公告

公告状态：

```text
DRAFT
PUBLISHED
OFFLINE
```

公告范围：

```text
ALL
STUDENTS
AUDITORS
ADMINS
```

支持：

- 公开公告列表和详情。
- 登录用户可见公告。
- 管理列表。
- 创建和更新。
- 发布和下线。

## 18.2 学习资源

资源类型：

```text
RESOURCE
RANGE
```

支持：

- 公共列表。
- 点击统计。
- 管理列表。
- 创建、修改、启用、禁用和删除。
- 封面上传。

前端提供学习中心和管理页面。

---

## 19. 用户、系统设置和审计

## 19.1 用户管理

管理员可以：

- 查询用户。
- 查看用户详情。
- 修改角色。
- 修改状态。
- 修改用户权限覆盖。
- 修改 AI 配额。
- 重置密码。

## 19.2 系统设置

包含：

- 平台信息。
- 注册模式。
- 待审批注册。
- 安全考试配置。
- 证书模板。
- AI 外观。
- AI 配额。
- AI 知识使用策略。
- AI 复测策略。

系统设置部分以 `SystemSetting` Key-Value 模型存储。

这使配置扩展较快，但类型约束主要依赖 Service 代码，不如独立配置表清晰。

## 19.3 审计日志

`AuditLog` 记录：

- 操作人。
- 动作。
- 目标类型。
- 目标 ID。
- 结果。
- IP。
- User-Agent。
- 请求路径。
- 元数据。
- 创建时间。

审计覆盖：

- 登录。
- 用户管理。
- 漏洞提交和审核。
- 附件访问。
- 证书。
- 商城。
- AI 调用。
- AI 知识。
- AI 复测。
- 凭据和审批。

审计元数据在输出前有专门的 Sanitizer 和 Mapper，避免直接返回敏感字段。

---

## 20. Dashboard 和通知

Dashboard 分为：

- 用户 Dashboard。
- 审核员 Dashboard。
- 管理员 Dashboard。

统计内容包括：

- 漏洞数量。
- 已确认漏洞。
- 当前积分。
- 证书数量。
- 待审核漏洞。
- 待签发证书。
- 待准入用户。
- 待处理兑换。

Notifications 模块当前功能相对简单，主要提供通知列表。

部分前端通知数量和活动内容仍使用静态数据。

---

## 21. 邮宝 AI Gateway

## 21.1 定位

“邮宝”是平台面向用户的 AI 助手名称。

Hermes Agent 是底层模型和 Skill 运行环境。

前端不直接调用 Hermes，也不保存模型密钥。

所有 AI 请求经过：

```text
backend/src/modules/ai/
```

## 21.2 API

当前 AI API 包括：

```http
GET  /api/ai/health
GET  /api/ai/appearance
GET  /api/ai/quota
GET  /api/ai/skills
POST /api/ai/chat
POST /api/ai/knowledge/route-preview
POST /api/ai/report-drafts
POST /api/ai/attachments/text
POST /api/ai/actions/:actionId/confirm
```

## 21.3 角色空间

AI Space：

```text
STUDENT
AUDITOR
ADMIN
```

权限：

- `ai:use_student`
- `ai:use_auditor`
- `ai:use_admin`
- `ai:manage_skills`

学生只能使用学生空间。

审核员使用审核员空间。

管理员可以根据当前 Mode 使用多个空间，但后端仍会缩小本轮 Skill 范围。

## 21.4 请求流程

大致流程：

1. JWT 身份验证。
2. AI 权限校验。
3. 请求体归一化。
4. 配额检查。
5. 创建最小用户上下文。
6. 根据角色和消息路由 Skill。
7. 判断是否可以由后端确定性回答。
8. 如果是开放问题，调用 Hermes。
9. Hermes 可以返回 `dataRequests`。
10. 后端验证并执行只读查询。
11. 将查询结果再次提供给 Hermes。
12. 解析结构化内容、Cards 和 Actions。
13. 校验业务 ID。
14. 脱敏输出。
15. 写 `AiCallLog` 和 `AuditLog`。
16. 返回前端。

## 21.5 确定性回答

以下类型的实时问题优先由后端回答，而不是让模型生成事实：

- 当前积分。
- 商城商品和库存。
- 用户自己的漏洞状态。
- 证书状态。
- 学习资源。
- 审核队列统计。
- 管理统计。

实现目的：

- 避免模型编造实时数据。
- 保证权限过滤。
- 保证业务 ID 来自数据库。
- 降低模型调用成本。

## 21.6 Data Requests

Hermes 可以请求后端提供只读数据。

后端工具层：

```text
ai.tools.registry.ts
ai.tools.service.ts
ai.data-request.service.ts
```

后端负责：

- 限定工具名称。
- 校验参数。
- 根据角色限制工具。
- 限制返回数量。
- 对返回数据脱敏。
- 生成允许的卡片实体 ID。

Hermes 不能直接访问数据库。

## 21.7 Cards 和 Actions

AI 响应可以包含：

- 文本内容。
- Cards。
- Actions。
- Proposals。

后端会过滤未知卡片和不允许的 Action。

涉及写操作时：

1. AI 生成 Action Proposal。
2. 数据库存储 Proposal。
3. 用户确认。
4. 后端重新验证权限和业务状态。
5. 后端事务执行。
6. 写审计日志。

模型本身不能直接修改业务数据。

## 21.8 附件和报告草稿

AI 支持：

- 提取 PDF 文本。
- 基于报告内容回答问题。
- 将渗透报告转换为漏洞草稿。

后端会根据用户意图决定是否生成结构化报告草稿。

包含附件时会避免部分关键词确定性路由，防止用户询问附件内容时被误判为普通漏洞状态查询。

## 21.9 AI 配额

数据库存在：

- `AiUserQuota`
- `AiCallLog`

系统设置和用户管理支持配置 AI 配额。

AI 调用日志记录用途、空间、模型、请求状态和相关元数据。

## 21.10 AI 降级

当 Hermes：

- 未配置。
- 超时。
- 返回无效内容。
- 调用失败。

后端会构造降级回答，而不是直接将底层错误暴露给前端。

---

## 22. AI Knowledge Base

## 22.1 目的

知识系统用于把已经解决、具有复用价值的问题转成平台知识。

知识系统不是直接保存并共享用户完整聊天记录。

## 22.2 主要模型

- `AiKnowledgeConversation`
- `AiKnowledgeConversationTurn`
- `AiProblemSession`
- `AiProblemSessionTurn`
- `AiKnowledgeCluster`
- `AiKnowledgeEntry`
- `AiKnowledgeRevision`
- `AiKnowledgeHit`
- `AiKnowledgeFeedback`
- `AiKnowledgeCaptureJob`
- `AiSkillCandidate`
- `AiSkillInstallLog`
- `AiKnowledgeMaintenanceTask`

## 22.3 Problem Session

`AiProblemSession` 表示用户围绕一个问题进行的多轮交互。

状态包括：

```text
ACTIVE
AWAITING_RESOLUTION
RESOLVED
UNRESOLVED
ABANDONED
SUMMARIZED
READY_REVIEW
AUTO_APPROVED
APPROVED_TO_KB
SKILL_CANDIDATE
DISCARDED
```

当前已实现的接口包括：

- 创建问题会话。
- 获取当前活动会话。
- 历史会话。
- 管理员审核队列。
- 查看详情。
- Heartbeat。
- Leave。
- 标记解决。
- 总结。
- 审核。
- 丢弃。
- Turn 反馈。

## 22.4 会话沉淀流程

```text
创建问题会话
  -> 多轮聊天
  -> 用户确认是否解决
  -> 对话脱敏
  -> 生成结构化总结
  -> AI 评分
  -> 规则评分兜底
  -> 相似问题检测
  -> 聚类
  -> 管理员审核或自动批准
  -> 生成知识条目
```

## 22.5 脱敏

知识沉淀前会处理：

- Token。
- Cookie。
- 密码。
- Authorization Header。
- 手机号。
- 邮箱。
- 学号或统一认证码。
- URL 中可能的敏感参数。
- 用户原始身份信息。

脱敏规则并不能保证覆盖所有业务敏感信息，因此管理员审核仍然必要。

## 22.6 评分和聚类

会话会进行：

- 质量评分。
- 可复用性评分。
- 安全评分。
- 隐私风险判断。
- 重复风险判断。
- 相似知识匹配。
- Canonical Problem 生成。
- Cluster 归类。

聚类当前主要使用：

- 规则归一化。
- Canonical Key。
- 字段相似度。
- 关键词和答案兼容性。

当前没有使用：

- pgvector。
- 独立向量数据库。
- Embedding 服务。
- Cross Encoder Reranker。

因此“语义聚类”当前是规则和结构化字段相似度方案，不是完整向量检索方案。

## 22.7 知识条目

知识条目包含：

- 标题。
- 问题。
- 答案。
- 类别。
- 角色范围。
- 可见性。
- 敏感等级。
- 状态。
- 来源。
- 质量和安全评分。
- 命中和反馈统计。
- 维护状态。
- 检索策略。
- 版本和修订。

知识条目支持：

- 创建。
- 审核。
- 反馈。
- 查看 Revision。
- 创建 Revision。
- Restore。

虽然存在 Revision 和 Restore API，但“不可变 Revision 和完整回滚”在部分项目文档中仍被列为待完善能力。

## 22.8 Skill Candidate

Skill Candidate 用于管理员创建长期稳定的方法论。

支持：

- 创建候选。
- 审核候选。
- 安装候选。
- 记录安装日志。

Skill 安装会写入平台 Hermes Skill 目录。

项目规则要求：

- 用户原始聊天不能直接成为 Skill。
- 用户问题总结不能直接成为 Skill。
- 自动入库知识不能自动晋升 Skill。
- Skill 需要管理员显式创建和审批。

实际代码中需要持续检查所有创建路径是否严格执行上述来源限制。

## 22.9 Knowledge Worker

当前有：

- `AiKnowledgeWorker`
- `AiKnowledgeMaintenanceWorker`

实现方式：

- NestJS 应用启动时创建定时器。
- 使用 `setInterval` 周期执行。
- 从 PostgreSQL 查询待处理任务。
- 在当前 API 进程中执行。

没有使用 BullMQ。

## 22.10 知识维护

维护扫描会考虑：

- 知识过期。
- 命中情况。
- 正负反馈。
- 重复风险。
- 维护状态。
- 安全和投毒风险。

管理员可以：

- 查看维护任务。
- Resolve。
- Dismiss。
- 手动触发维护扫描。

---

## 23. AI 漏洞自动复测

## 23.1 目的

AI 自动复测用于辅助审核员或管理员验证漏洞是否仍可复现。

该子系统不直接修改漏洞最终审核结论。

生成的报告可以被审核员引用到人工审核意见中。

## 23.2 模式

```text
PLAN_ONLY
CONTROLLED_RUN
HERMES_DIRECT
```

`PLAN_ONLY`：

- 只生成计划。
- 不执行目标请求。

`CONTROLLED_RUN`：

- 使用受限 Runner。
- 只运行低风险模板。

`HERMES_DIRECT`：

- 使用独立 Hermes Agent。
- 支持复杂浏览器、HTTP 和工具操作。
- 需要更多审批。

## 23.3 主要模型

- `AiVulnerabilityRetestJob`
- `AiVulnerabilityRetestPlan`
- `AiVulnerabilityRetestStep`
- `AiVulnerabilityRetestArtifact`
- `AiVulnerabilityRetestReport`
- `AiVulnerabilityRetestDirectSession`
- `AiVulnerabilityRetestDirectAction`
- `AiVulnerabilityRetestCredential`

## 23.4 Job 状态

```text
PENDING
QUEUED
PLANNING
POLICY_CHECK
PLAN_REVIEW
DIRECT_PLAN_REVIEW
DIRECT_RUNNING
DIRECT_ACTION_REVIEW
ADVISORY_ONLY
RUNNING
CANCELLING
REPORTING
SUCCEEDED
FAILED
CANCELLED
BLOCKED
EXPIRED
```

状态变化由：

```text
assertAiRetestTransition(...)
```

检查。

## 23.5 创建任务

接口：

```http
POST /api/vulnerabilities/:id/ai-retests
```

创建任务时会：

- 验证用户权限。
- 验证漏洞是否存在。
- 构造脱敏上下文。
- 提取并确认目标。
- 创建 Job。
- 创建审计日志。

## 23.6 计划生成

Planning Service 会：

1. 读取漏洞上下文。
2. 生成系统 Prompt。
3. 调用主 AI 服务或 Hermes。
4. 要求返回结构化计划。
5. 校验计划字段。
6. 校验目标范围。
7. 创建 Plan 和 Steps。
8. 进入策略检查。

计划包含：

- Summary。
- Targets。
- Impact Scope。
- Overall Risk。
- Tool Classes。
- Preconditions。
- Request Budget。
- Rollback Plan。
- Planned Actions。

代码支持通过环境变量读取 Mock Plan，用于测试。

## 23.7 策略检查

风险等级：

```text
LOW
MEDIUM
HIGH
CRITICAL
```

策略结果：

```text
ALLOW
ALLOW_WITH_LIMITS
REQUIRE_HUMAN_APPROVAL
ADVISORY_ONLY
BLOCK
```

策略会考虑：

- 复测模式。
- 漏洞类型。
- 目标。
- HTTP Method。
- 工具类型。
- 风险等级。
- 请求预算。
- 是否包含凭据。
- 是否需要写操作。
- 是否可能扩大范围。

HIGH 和 CRITICAL 步骤不会进入受限 Runner。

## 23.8 低风险 Runner

目录：

```text
retest-runner/
```

Runner 是独立 Node.js 服务。

当前设计约束：

- 不持有主数据库凭据。
- 不持有用户 JWT。
- 不持有 MinIO 管理凭据。
- 不挂载 Docker Socket。
- 执行内置模板。
- 限制请求数量。
- 限制单步超时。
- 校验 DNS。
- 校验 Redirect。
- 校验目标同源。
- 拒绝未授权私网和元数据地址。

Runner 返回：

- 执行状态。
- 请求数量。
- 时长。
- Summary。
- Error Code。
- Artifacts。

## 23.9 Hermes Direct

Hermes Direct Client 使用：

```text
POST /v1/runs
GET  /v1/runs/:runId
GET  /v1/runs/:runId/events
POST /v1/runs/:runId/approval
POST /v1/runs/:runId/stop
```

Direct 执行流程：

1. 生成 Direct Proposal。
2. 管理员或审核员批准整个计划。
3. 创建 Direct Session。
4. 调用 Hermes `/runs`。
5. 通过 SSE 读取事件。
6. 遇到高风险 Action 时进入审批状态。
7. 用户批准或拒绝。
8. 将结果回传 Hermes。
9. 继续执行。
10. 生成统一报告。

## 23.10 SSE

Hermes Direct Client 自行解析 SSE。

包含：

- SSE Frame 解析。
- JSON 事件校验。
- 事件去重。
- 连接失败重试。
- Stream 中断重连。
- 指数退避。
- 最大重连次数。
- Hermes 状态查询兜底。

事件去重 Key 当前由：

- 事件名。
- 时间戳。
- JSON 长度。

组成。

这种去重方式不是严格唯一，如果两个不同事件恰好具有相同事件名、时间戳和长度，理论上可能误判。

## 23.11 Direct Action 审批

支持：

- 批准动作。
- 拒绝动作。
- 一次性批准。
- 保存动作状态。
- 审计动作请求和决策。

高风险动作需要人工审批。

项目禁止部分超高风险操作，即使人工批准也不能执行。

## 23.12 凭据保险箱

凭据类型：

- 用户名密码。
- Cookie。
- Bearer Token。
- 自定义 Header。
- 客户端证书引用。
- 交互式 OTP。

加密：

- AES-256-GCM。
- Key ID。
- 多密钥 Key Ring。
- AAD。

AAD 绑定：

- Job。
- 凭据类型。
- 目标范围。

凭据支持：

- 创建。
- 租用。
- 到期。
- 销毁。
- 审计。

环境变量：

```text
AI_RETEST_CREDENTIAL_ACTIVE_KEY_ID
AI_RETEST_CREDENTIAL_KEYS
```

## 23.13 Egress Proxy

目录：

```text
retest-egress-proxy/
```

作用：

- 维护当前允许的目标 Scope。
- 检查域名、子域名和端口。
- 拒绝未批准目标。
- 拒绝私网地址。
- 拒绝云元数据地址。
- 区分可申请范围扩展和硬阻断。

当前测试覆盖：

- 精确目标。
- 子域名。
- 端口。
- 私网地址。
- 元数据地址。
- 范围扩展候选。

## 23.14 Worker

`AiVulnerabilityRetestWorkerService` 和 API 在同一个 NestJS 进程中运行。

启动时：

```text
onModuleInit -> setInterval -> tick
```

默认每 5 秒轮询。

Worker 查询可执行状态的 Job。

并发控制：

- `lockedAt`
- `lockedBy`
- 10 分钟锁 TTL
- `statusVersion`
- `updateMany` 条件更新

任务处理：

- Planning。
- Policy Check。
- Advisory Report。
- Runner。
- Direct。
- Reporting。
- Cancelling。
- Expiration。

当前不是消息队列。

Redis 和 BullMQ 没有参与实际 Worker 调度。

## 23.15 Artifact

Artifact 可以包含：

- HTTP 请求和响应证据。
- 截图。
- 文本证据。
- Runner 结果。
- Hermes 事件产生的证据。

Artifact 保存：

- 类型。
- MIME。
- 大小。
- SHA-256。
- MinIO Key。
- 脱敏预览。
- 关联 Job 和 Step。

Artifact 下载需要权限，并记录访问审计。

项目文档仍把 Hermes Direct 原始 Artifact 完整统一归档列为未完全完成项。

## 23.16 报告

Runner、Plan Only 和 Hermes Direct 最终统一成 AI Retest Report。

报告包含：

- 执行摘要。
- 目标。
- 步骤。
- Evidence。
- 限制。
- 结论。
- 可复现性。
- 置信度。
- 人工复测建议。
- 审核意见草稿。

可复现性：

```text
REPRODUCED
NOT_REPRODUCED
PARTIALLY_REPRODUCED
INSUFFICIENT_EVIDENCE
BLOCKED_BY_POLICY
NOT_EXECUTED_PLATFORM_BLOCKED
```

AI 报告不会直接修改漏洞状态。

审核员可以将报告中的建议幂等引用到审核意见。

---

## 24. 数据库设计

Prisma Schema 中有 40 多个 Model。

## 24.1 身份和权限

- User
- Role
- Permission
- RolePermission
- UserPermissionOverride
- RefreshToken
- EmailVerificationCode
- CaptchaChallenge
- CaptchaToken
- AuthorizationSource
- AuthorizationPolicy

## 24.2 准入

- ResponsibilityAgreement
- ResponsibilitySignature
- SecurityQuestion
- SecurityExamAttempt

## 24.3 漏洞

- Asset
- VulnerabilityReport
- VulnerabilityAttachment
- VulnerabilityEvent
- ReviewAssignment
- ReviewComment
- RetestRecord

## 24.4 证书和激励

- Certificate
- CertificateTemplate
- PointLedgerEntry
- MallProduct
- MallRedemption
- MallRedemptionEvent

## 24.5 内容

- LearningResource
- Announcement

## 24.6 AI

- AiCallLog
- AiUserQuota
- AiSkill
- AiFaqEntry
- AiActionProposal

## 24.7 AI 复测

- AiVulnerabilityRetestJob
- AiVulnerabilityRetestPlan
- AiVulnerabilityRetestDirectSession
- AiVulnerabilityRetestDirectAction
- AiVulnerabilityRetestCredential
- AiVulnerabilityRetestStep
- AiVulnerabilityRetestArtifact
- AiVulnerabilityRetestReport

## 24.8 AI 知识

- AiKnowledgeConversation
- AiKnowledgeConversationTurn
- AiProblemSession
- AiProblemSessionTurn
- AiKnowledgeCluster
- AiKnowledgeEntry
- AiKnowledgeRevision
- AiKnowledgeHit
- AiKnowledgeFeedback
- AiKnowledgeCaptureJob
- AiSkillCandidate
- AiSkillInstallLog
- AiKnowledgeMaintenanceTask

## 24.9 平台治理

- AuditLog
- SchoolProfile
- SystemSetting

---

## 25. API 概况

后端使用 REST API。

主要路由前缀：

```text
/api/auth
/api/account
/api/access
/api/security-exam
/api/vulnerabilities
/api/attachments
/api/certificates
/api/announcements
/api/learning
/api/points
/api/mall
/api/users/manage
/api/audit-logs
/api/system-settings
/api/dashboard
/api/notifications
/api/ai
/api/ai/knowledge
/api/ai/problem-sessions
/api/ai-retests
```

当前项目没有自动生成 OpenAPI Schema。

API 契约主要存在于：

- Controller 代码。
- `validation.ts`。
- `types.ts`。
- `frontend/src/services/`。
- `docs/api/README.md`。

这几处之间可能发生不同步。

---

## 26. 本地开发环境

## 26.1 基础服务

`deploy/docker/docker-compose.local.yml` 包含：

- PostgreSQL 16。
- Redis 7。
- MinIO。

端口：

| 服务 | 地址 |
|---|---|
| PostgreSQL | `127.0.0.1:15432` |
| Redis | `127.0.0.1:6379` |
| MinIO API | `127.0.0.1:9000` |
| MinIO Console | `127.0.0.1:9001` |

## 26.2 一键启动

Linux/WSL/macOS：

```bash
bash deploy/scripts/start-local.sh
```

脚本执行：

1. 检查主 Hermes 5000。
2. 检查 Hermes Direct 5001。
3. 检查 AI 复测环境变量。
4. 启动 PostgreSQL。
5. 启动 Redis。
6. 启动 MinIO。
7. 安装缺失依赖。
8. 生成 Prisma Client。
9. 执行 Migration。
10. 执行 Seed。
11. 启动后端。
12. 启动前端。
13. 保存进程 PID 和日志路径。

## 26.3 默认地址

| 服务 | 地址 |
|---|---|
| 前端 | `http://localhost:5173` |
| 后端健康检查 | `http://localhost:3000/api/health` |
| 主 Hermes | `http://localhost:5000` |
| Hermes Direct | `http://localhost:5001` |

## 26.4 环境变量

主要环境变量：

- 数据库。
- JWT。
- CORS。
- MinIO。
- SMTP。
- 主 Hermes。
- AI Timeout。
- Hermes Direct。
- Egress Proxy。
- 凭据加密 Key Ring。
- Worker Interval。

当前 `.env.example` 中部分变量是占位值。

---

## 27. 测试实现

## 27.1 后端和全链路

脚本包括：

```text
test:core-api
test:core-e2e
test:ai-problem-session
test:ai-vulnerability-retest
```

测试主要使用 Node.js 脚本调用实际 HTTP API。

## 27.2 后端模块测试

`backend/test/` 包含：

- AI 复测策略测试。
- AI 复测凭据测试。
- AI 复测状态机测试。
- AI 复测报告测试。
- Credential Vault 测试。
- Hermes Direct Client 测试。
- Hermes Direct Scope 测试。

这些测试更接近独立 TypeScript 脚本或 Node Test，而不是完整 Jest 测试套件。

## 27.3 Runner

`retest-runner/tests/runner-contract.test.ts`

覆盖：

- Runner 合同。
- 安全限制。
- 输入约束。
- Scope 和执行结果。

2026-06-19 本地执行通过。

## 27.4 Egress Proxy

使用 Node Test Runner。

2026-06-19：

```text
3 tests passed
```

## 27.5 前端

Playwright 当前主要覆盖 AI 复测页面。

项目没有完整的：

- 前端单元测试。
- 组件测试。
- 所有核心业务页面 E2E。
- 可访问性自动测试。
- Visual Regression。

## 27.6 构建验证

2026-06-19：

| 命令 | 结果 |
|---|---|
| `backend npm run build` | 通过 |
| `frontend npm run build` | 通过 |
| `retest-runner npm test` | 通过 |
| `retest-egress-proxy npm test` | 3/3 通过 |

本次没有重新运行依赖完整数据库、MinIO、Hermes 和测试数据的全链路 E2E。

---

## 28. 当前已经实现的主要功能

根据当前代码可以确认实现的能力：

### 28.1 平台基础

- NestJS 后端启动。
- React 前端构建。
- PostgreSQL 和 Prisma。
- MinIO 对象存储。
- 健康检查。
- CORS。
- 环境变量基础校验。

### 28.2 用户和权限

- 密码登录。
- 邮箱验证码登录。
- 邮箱注册。
- 开放/审批注册。
- 当前用户。
- 用户资料。
- 头像。
- 邮箱修改。
- 密码修改。
- 用户管理。
- RBAC。
- 用户级权限覆盖。
- 账号状态。
- 登录和账号安全日志。

### 28.3 准入

- 责任书。
- 安全考试。
- 随机组卷。
- 后端判分。
- 题库管理。
- 考试设置。
- AI 生成题目。

### 28.4 漏洞

- 提交。
- 我的漏洞。
- 审核队列。
- 补充材料。
- 审核。
- 最终等级。
- 积分奖励。
- 修复状态。
- 复测。
- 归档。
- 管理列表。
- 事件时间线。
- 审计。

### 28.5 文件和证书

- PDF 上传。
- MinIO 存储。
- PDF 预览。
- 附件权限。
- 证书签发。
- 证书撤销。
- PDF 生成。
- 公开脱敏核验。
- 模板配置。

### 28.6 运营

- 公告。
- 学习资源。
- 积分账本。
- 积分商城。
- 兑换和取消。
- Dashboard。
- 用户管理。
- 审计日志。
- 系统设置。

### 28.7 AI

- AI Gateway。
- Hermes 调用。
- 角色 Skill 路由。
- 实时业务确定性回答。
- Data Requests。
- Cards 和 Actions。
- Action Proposal。
- 附件文本提取。
- 报告草稿。
- AI 配额。
- AI 调用日志。
- Agent 失败降级。

### 28.8 AI 知识

- Problem Session。
- Turn 保存。
- 用户解决确认。
- 总结。
- 评分。
- 脱敏。
- 去重和聚类。
- 管理审核。
- 自动批准条件。
- Knowledge Entry。
- Revision。
- Feedback。
- Maintenance Task。
- Skill Candidate。
- Skill 安装日志。

### 28.9 AI 复测

- Job。
- 计划生成。
- 策略判断。
- 计划审批。
- 低风险 Runner。
- Hermes Direct。
- Direct Action 审批。
- 凭据保险箱。
- 任务取消。
- Worker。
- SSE。
- Artifact。
- 统一报告。
- 报告引用。
- 管理统计。
- 策略管理。

---

## 29. 当前未完成或不完整的功能

## 29.1 Refresh Token

已实现：

- 签发。
- 哈希存储。
- 过期时间。

未实现：

- 刷新接口。
- 轮换。
- Logout。
- 撤销。
- 前端自动续期。

## 29.2 SMTP

已存在 SMTP 配置项。

当前验证码仍是开发固定值，没有实际发送逻辑。

## 29.3 Redis 和 BullMQ

Redis 在 Docker Compose 中存在。

文档中多处描述 BullMQ。

当前后端依赖中没有 BullMQ，也没有 Redis 客户端。

实际 Worker 使用进程内 `setInterval`。

## 29.4 前端真实数据覆盖

部分页面仍包含静态示例数据：

- 审核员审核报告。
- 审核员复测数据。
- 审核记录。
- 公告。
- 管理员首页风险队列。
- 管理员首页系统健康。
- 用户首页活动。
- 部分通知数量。

## 29.5 路由

没有正式前端路由。

缺少：

- 深链接。
- 刷新恢复。
- 页面 URL。
- 浏览器导航历史。
- 路由级权限。

## 29.6 AI Knowledge Retrieval

代码和文档显示知识沉淀已经实现较多能力。

但是部分文档仍将以下能力列为待实现或待验收：

- 知识命中回答。
- 来源标注写回。
- 完整回答快照。
- 更成熟的语义检索。
- 缓存失效。
- 知识缺口发现。
- 知识投毒暂停和恢复。

当前应区分“数据库和管理功能存在”与“生产检索质量已经完成验收”。

## 29.7 AI 复测 Artifact

Runner Artifact 已有保存能力。

Hermes Direct 原始事件、截图和完整 Artifact 的统一归档仍被项目文档列为未完全完成。

## 29.8 生产部署

本地基础设施 Compose 已存在。

仍缺少或未完整验证：

- 前端生产容器。
- 后端生产容器。
- 完整生产 Compose。
- Nginx 实际配置。
- TLS。
- 数据库备份和恢复。
- MinIO 备份。
- 密钥管理。
- 监控和告警。
- 日志聚合。
- 多实例部署。
- Ubuntu 生产环境完整验收。

---

## 30. 当前主要技术问题

## 30.1 大型文件和职责集中

部分页面和 Service 超过 1000～2000 行。

影响：

- 阅读成本高。
- 修改影响范围大。
- 测试困难。
- 合并冲突概率高。
- AI 辅助修改时上下文不稳定。

典型文件：

- `ai.service.ts`
- `ai-knowledge.service.ts`
- `ai-problem-session.service.ts`
- `UserAIAssistant.tsx`
- `AuditorHome.tsx`
- `AdminSystemSettings.tsx`

## 30.2 Worker 与 API 同进程

当前 AI Knowledge 和 AI Retest Worker 都在 NestJS API 进程内运行。

问题：

- API 重启会中断 Worker。
- 多 API 实例会同时启动 Worker。
- 依赖数据库租约避免重复。
- 不能独立扩容。
- 任务积压会影响 API 进程。
- 没有标准队列可观测性。

## 30.3 状态机规则分散

AI 复测有集中式状态迁移断言。

普通漏洞状态机主要分散在 Service 中。

问题：

- 不同接口可能允许不一致的来源状态。
- 重复审核可能导致重复副作用。
- 状态显示存在多套映射。

## 30.4 自研安全基础组件较多

项目自行实现：

- JWT。
- 密码哈希工具。
- S3 SigV4。
- SSE Parser。
- 多种输入校验。

这些实现可以工作，但需要比成熟库更多的安全测试和维护。

## 30.5 环境变量验证不足

启动时只强制检查数据库和 JWT。

以下配置缺失时通常在运行中才发现：

- MinIO。
- Hermes。
- SMTP。
- Egress Proxy。
- 凭据加密密钥。

## 30.6 前端状态管理分散

前端大量页面使用：

- `useState`
- `useEffect`
- 手工 Loading/Error
- 手工 API 刷新

缺少统一 Server State Cache。

可能导致：

- 重复请求。
- 数据刷新不一致。
- 页面切换后状态丢失。
- 错误处理重复。

## 30.7 API 契约分散

同一接口的类型可能分别存在于：

- 后端 Types。
- 后端 Validation。
- 前端 Service。
- 文档。

没有自动代码生成。

容易发生字段和状态不一致。

## 30.8 测试覆盖不均

AI 复测的安全测试较多。

普通业务缺少同等强度的：

- 单元测试。
- 并发测试。
- 状态机测试。
- 权限矩阵测试。
- 数据库约束测试。

## 30.9 性能

已观察到：

- 3D 首页 Chunk 接近 1 MB。
- 大型页面代码较多。
- 附件整体读入内存。
- 部分统计查询可能对数据表进行全量查询后在内存统计。
- Worker 使用数据库轮询。
- RBAC 每次请求重新查数据库。

当前数据规模下可以运行，但生产数据增长后需要索引、查询和缓存优化。

---

## 31. 当前安全问题和风险点

## 31.1 开发默认凭据

本地 Compose 和代码默认包含：

- PostgreSQL 开发密码。
- MinIO 默认账号和密码。
- 固定验证码。
- 演示账号。

生产部署必须覆盖所有默认配置。

## 31.2 Token 存储

Access Token 和 Refresh Token 保存在 localStorage。

风险：

- XSS 可以读取 Token。

更安全的生产方案通常会考虑：

- HttpOnly Secure SameSite Cookie。
- Refresh Token Cookie。
- CSP。
- XSS 防护。

## 31.3 缺少统一安全 Header

当前 `main.ts` 没有看到 Helmet 或等效安全 Header 配置。

## 31.4 CORS

CORS Origin 由环境变量逗号分隔。

需要保证生产环境不使用过宽 Origin。

## 31.5 固定验证码

开发环境固定验证码是测试便利功能。

如果生产环境判断或配置失误，可能造成严重认证风险。

## 31.6 AI 输出

项目已经对 AI 输出做了较多限制，但仍需防范：

- Prompt Injection。
- Data Request 滥用。
- Card ID 注入。
- 知识投毒。
- 敏感数据进入日志。
- Artifact 泄露。
- 模型错误结论。

## 31.7 自动复测

AI 自动复测本身具有安全风险。

当前已经有：

- Scope。
- Policy。
- Approval。
- Vault。
- Audit。
- Budget。

仍需继续验证：

- DNS Rebinding。
- Redirect 链。
- IPv4/IPv6 混合解析。
- 浏览器发出的次级资源请求。
- WebSocket。
- 文件下载。
- 第三方认证跳转。
- Artifact 脱敏。
- Prompt 中凭据生命周期。

---

## 32. 文档和代码不一致

## 32.1 Hermes Direct 拓扑

`docs/HERMES_RETEST_INTERACTION.md` 描述：

- 复测已合并到主 Hermes。
- Retest Agent 和 Egress Proxy 已废弃。

当前代码和配置仍然存在：

- `AI_RETEST_HERMES_BASE_URL=http://localhost:5001/v1/`
- `HermesDirectClient`
- `HermesEgressClient`
- `retest-egress-proxy/`
- `deploy/hermes-direct/`
- 启动脚本检查 5001。

因此当前代码事实仍是支持独立 Hermes Direct 和 Egress Proxy。

该文档可能记录了一次尚未完全合并、已经回滚或只在特定环境使用的方案。

## 32.2 BullMQ

部分文档写：

```text
Redis + BullMQ
```

当前：

- Redis Compose 存在。
- BullMQ 依赖不存在。
- Worker 使用 `setInterval`。

因此不能把 BullMQ 描述为已经落地。

## 32.3 AI Knowledge 状态

不同日期的文档对以下功能描述不一致：

- Knowledge Retrieval。
- 来源标注。
- Turn Feedback。
- Maintenance Worker。
- Revision Restore。
- Retrieval Policy。

当前代码已经存在部分 Controller、模型和 Worker。

但代码存在不等于已经经过生产验收，文档中的“已实现”和“待验收”需要分开处理。

## 32.4 演示账号

不同文档和启动脚本中的演示密码不一致。

实际账号应以当前 Seed 和实际数据库为准。

## 32.5 项目路径

部分文档仍引用旧路径：

```text
/home/cocking/cqupt-src-hermes-linux/
```

当前代码仓库路径是：

```text
/home/cocking/projects/cqupt-src-2.10
```

Hermes 外部工程路径仍可能是前者，两者不能混淆。

---

## 33. 数据一致性实现

项目在以下场景使用 Prisma Transaction：

- 注册。
- 登录记录和 Refresh Token。
- 漏洞提交。
- 漏洞审核。
- 积分奖励。
- 补充材料。
- 复测。
- 兑换。
- 取消兑换。
- 证书。
- AI Proposal。
- AI Knowledge 状态变化。
- AI Retest 状态变化。

项目使用以下一致性方式：

- 数据库事务。
- 唯一约束。
- 状态校验。
- `statusVersion` 乐观并发。
- `lockedAt` 租约。
- Idempotency Key。
- Hash。
- 事件和审计。

需要继续加强：

- 普通漏洞状态机的统一 CAS 更新。
- 商城并发扣库存。
- 重复审核防护。
- 重复积分奖励防护。
- Worker 多实例并发测试。

---

## 34. 可观测性

当前已有：

- 后端健康检查。
- Hermes 健康检查。
- AuditLog。
- AiCallLog。
- Worker Logger。
- Retest Trace ID。
- Job Failure Code。
- Artifact Hash。
- 本地启动日志。

当前缺少完整生产可观测性：

- Prometheus Metrics。
- Grafana Dashboard。
- OpenTelemetry。
- 分布式 Trace。
- 集中日志。
- 告警。
- 队列深度指标。
- 数据库慢查询监控。
- AI Token 和成本监控。
- MinIO 容量监控。

---

## 35. 项目当前成熟度判断

按代码实现范围看，项目已经超过简单原型：

- 数据模型较完整。
- API 数量较多。
- 角色工作台已经形成。
- 多个业务流程有事务和审计。
- AI 复测具有明确安全设计。
- 存在迁移、Seed、构建和 E2E。

但项目仍没有达到完整生产系统状态：

- 认证续期未闭环。
- 邮件未接入。
- 部分前端使用静态数据。
- 生产部署配置不完整。
- Worker 未独立部署。
- 监控和告警缺失。
- 文档存在版本漂移。
- 部分大型模块可维护性较差。
- 核心业务测试覆盖不足。
- 部分 AI 能力存在“代码已出现但未完成生产验收”的情况。

因此更准确的状态是：

```text
功能覆盖较完整的开发/演示系统，
部分复杂能力已达到工程验证阶段，
但生产部署、长期运行可靠性和维护治理仍需补充。
```

---

## 36. 当前问题汇总

### 36.1 功能闭环

- Refresh Token 未闭环。
- Logout 和 Token 撤销未实现。
- SMTP 未实现。
- 部分页面不是完全真实数据。
- 普通漏洞草稿能力不完整。
- 责任单位没有独立角色门户。
- 部分 AI Knowledge 目标能力未完成生产验收。
- Hermes Direct Artifact 归档不完整。

### 36.2 架构

- Worker 与 API 同进程。
- Redis 未实际使用。
- BullMQ 仅存在于文档目标。
- 大型 Service 和页面职责过多。
- 前端无路由。
- API 类型没有统一生成。

### 36.3 安全

- Token 存 localStorage。
- 没有统一安全 Header。
- 开发默认凭据较多。
- 固定验证码依赖环境判断。
- 自研 JWT、密码、S3 签名需要更多审计。
- AI 和自动复测仍需长期安全测试。

### 36.4 测试

- 普通业务单元测试不足。
- 前端组件测试不足。
- 权限矩阵测试不足。
- 高并发事务测试不足。
- 完整生产拓扑 E2E 未稳定纳入 CI。

### 36.5 运维

- 生产 Compose 不完整。
- Nginx 配置不完整。
- 无 TLS 自动化。
- 无备份恢复脚本。
- 无监控告警。
- 无日志平台。
- 无密钥管理系统。

### 36.6 文档

- Hermes 拓扑描述冲突。
- BullMQ 状态描述不准确。
- 演示账号不一致。
- 已实现、目标态和待验收混写。
- 多个文档重复维护相同状态信息。

---

## 37. 建议的后续处理顺序

以下内容是基于当前问题严重程度的工程排序，不代表当前已经实现。

### 第一阶段：安全和正确性

1. 实现 Refresh、Logout、Refresh Token 轮换和撤销。
2. 接入真实 SMTP。
3. 清理生产默认凭据。
4. 增加安全 Header 和 CSP。
5. 统一漏洞状态机。
6. 防止重复审核和重复积分。
7. 加强商城库存并发控制。
8. 统一 Hermes Direct 实际拓扑。

### 第二阶段：可靠性

1. 将 Worker 拆成独立进程。
2. 正式接入 BullMQ 或其他可靠队列。
3. 增加任务重试、死信和可观测性。
4. 完成生产 Docker Compose 和 Nginx。
5. 增加数据库和 MinIO 备份恢复。
6. 建立监控和告警。

### 第三阶段：代码治理

1. 拆分大型 Service。
2. 拆分大型页面。
3. 引入前端路由。
4. 引入 Server State 管理。
5. 建立共享 API Schema。
6. 增加单元测试和组件测试。
7. 使用成熟 S3 SDK。

### 第四阶段：AI 能力验收

1. 建立 AI 回答评测集。
2. 验证知识检索、来源标注和权限隔离。
3. 验证知识投毒检测。
4. 验证 Hermes Direct Artifact 完整性。
5. 验证 Prompt Injection 和目标范围绕过。
6. 建立 AI 成本、成功率和降级率监控。

---

## 38. 关键文件索引

### 总体

- `README.md`
- `PROJECT_HANDOFF.md`
- `docs/DEVELOPMENT_STATUS.md`
- `docs/PROJECT_STRUCTURE.md`
- `docs/TECH_STACK.md`

### 前端

- `frontend/src/App.tsx`
- `frontend/src/pages/user/UserHome.tsx`
- `frontend/src/pages/auditor/AuditorHome.tsx`
- `frontend/src/pages/admin/AdminHome.tsx`
- `frontend/src/services/apiClient.ts`
- `frontend/src/services/auth.ts`

### 后端

- `backend/src/main.ts`
- `backend/src/app.module.ts`
- `backend/src/config/env.ts`

### 认证和权限

- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/jwt-auth.guard.ts`
- `backend/src/modules/auth/permissions.guard.ts`
- `backend/src/modules/rbac/permissions.ts`
- `backend/src/modules/rbac/rbac.service.ts`

### 漏洞

- `backend/src/modules/vulnerabilities/vulnerabilities.service.ts`
- `backend/src/modules/vulnerabilities/vulnerabilities.controller.ts`
- `backend/src/modules/attachments/attachments.service.ts`

### AI

- `backend/src/modules/ai/ai.service.ts`
- `backend/src/modules/ai/ai.tools.service.ts`
- `backend/src/modules/ai/ai.data-request.service.ts`
- `backend/src/modules/ai/ai.skill-router.service.ts`

### AI Knowledge

- `backend/src/modules/ai-knowledge/ai-knowledge.service.ts`
- `backend/src/modules/ai-knowledge/ai-problem-session.service.ts`
- `backend/src/modules/ai-knowledge/ai-knowledge.worker.ts`
- `backend/src/modules/ai-knowledge/ai-knowledge-maintenance.worker.ts`

### AI Retest

- `backend/src/modules/ai-vulnerability-retest/ai-vulnerability-retest.service.ts`
- `backend/src/modules/ai-vulnerability-retest/ai-vulnerability-retest-planning.service.ts`
- `backend/src/modules/ai-vulnerability-retest/retest-policy.service.ts`
- `backend/src/modules/ai-vulnerability-retest/ai-vulnerability-retest-worker.service.ts`
- `backend/src/modules/ai-vulnerability-retest/hermes-direct-session.service.ts`
- `backend/src/modules/ai-vulnerability-retest/hermes-direct.client.ts`
- `backend/src/modules/ai-vulnerability-retest/retest-credential-vault.service.ts`

### 数据库

- `database/prisma/schema.prisma`
- `database/prisma/migrations/`
- `backend/src/database/seed.ts`

### 部署

- `deploy/docker/docker-compose.local.yml`
- `deploy/scripts/start-local.sh`
- `deploy/hermes-direct/docker-compose.yml`

### 测试

- `tests/e2e/core-e2e.mjs`
- `tests/e2e/ai-problem-session-phase2.mjs`
- `tests/e2e/ai-vulnerability-retest.mjs`
- `retest-runner/tests/runner-contract.test.ts`
- `retest-egress-proxy/tests/scope-policy.test.ts`

---

## 39. 总结

CQUPT-SRC 当前实现了一个覆盖面较广的校园漏洞响应平台。

其主要工程特征是：

- React 前端。
- NestJS 模块化单体。
- PostgreSQL 和 Prisma。
- MinIO 文件存储。
- 基于角色和用户覆盖的 RBAC。
- 基于事务的漏洞、积分和商城流程。
- 业务事件与安全审计并存。
- 后端托管的 AI Gateway。
- 问题会话式 AI 知识沉淀。
- 低风险 Runner 和高风险 Hermes Direct 双通道复测。
- 对 AI 复测采用目标范围、策略、审批、凭据加密和证据约束。

项目已经具有较多实际代码和复杂业务实现，但仍存在明显的开发阶段特征：

- 某些功能只有部分闭环。
- 部分页面仍有静态数据。
- Worker 和生产部署尚未达到成熟状态。
- 测试覆盖不均衡。
- 文档和当前代码存在版本差异。
- 大型文件较多。

后续工作重点不应继续无边界增加新功能，而应优先处理认证闭环、状态一致性、Worker 可靠性、生产部署、测试覆盖和文档治理。
