# CQUPT-SRC

cd ~/projcets/cqupt-src-test
./update-all-test.sh             #更新脚本命令

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-06-01 已按当前代码、运行环境和 AI 问题会话 Phase 2 进度更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、最小上下文 + dataRequests、AI Knowledge Base 问题会话生命周期、已解决会话总结、AI+规则评分、相似聚类、管理员审核、高频高质自动入库、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型路由为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 当前仍待实现/验收：Knowledge Retrieval 命中回答、来源标注写回、turn 级点赞/点踩持久化、问题会话 fork/archive/title 接口、maintenanceStatus/retrievalPolicy、维护任务 Worker、不可变 revision 回滚、知识投毒暂停与恢复闭环。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`docs/architecture/AI_PROBLEM_SESSION_KNOWLEDGE_CAPTURE.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

校园漏洞响应与安全学习平台。项目连接学生、审核员、管理员与校园资产责任单位，形成从漏洞提交、审核、修复、复测、归档、证书、积分、学习资源到 AI 辅助的完整闭环。

## 当前状态

```text
已完成：认证/RBAC、漏洞全流程、PDF 附件上传与受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心。
已完成：个人中心头像上传、邮箱修改、密码修改（邮箱验证码）、账号安全日志页。
已完成：安全答题准入（题库、随机组卷、提交判分、管理员题库接口）。
已完成：后端 AI Gateway、Context Injection、按角色 Skill 路由、确定性业务响应、邮宝用户端 AI 助手。
已完成：附件问答与渗透报告草稿解析，明确报告意图才生成可编辑漏洞草稿卡片。
已完成：AI Knowledge Base 多轮会话沉淀、AI 评分自动流转、相似知识去重、Skill Candidate 审核与受控安装链路。
已完成：平台 Hermes skills 目录宿主写入权限已按最小权限修正，并通过后端真实 Skill Candidate 安装链路验证。
```

## 技术栈

| 模块 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite 6 + Tailwind CSS 4 + Three.js (@react-three/fiber + drei) |
| 后端 | NestJS 11 + TypeScript + Express |
| 数据库 | PostgreSQL + Prisma |
| 队列/缓存 | Redis（缓存与分布式锁），后端 Worker 使用 NestJS Injectable + setInterval 调度（非 BullMQ） |
| 认证 | JWT（HS256，access + refresh 双令牌） |
| 文件存储 | MinIO（PDF 附件受控存储与预览） |
| PDF 处理 | pdf-lib（PDF 生成/字体嵌入） + pdf-parse（PDF 文本提取，用于附件问答） |
| AI | NestJS AI Gateway + Hermes Agent OpenAI-compatible API |
| 平台 Hermes | `/home/cocking/cqupt-src-hermes-linux/` Docker 容器，宿主机 `5000` 端口 |
| 部署 | Docker Compose + Nginx，目标环境 Ubuntu 服务器 |
| 开发/测试 | tsx（后端热加载）、ESLint + TypeScript ESLint、自定义 MJS E2E 测试脚本 |

## 核心文档

| 文档 | 内容 |
|---|---|
| `docs/AI.md` | 邮宝 / AI Gateway 总体架构、角色路由、卡片协议、附件处理、降级策略 |
| `docs/AI_KNOWLEDGE_BASE.md` | AI 知识沉淀、Skill Candidate、去重、评分、审核与安装链路 |
| `docs/AI_SKILLS.md` | CQUPT-SRC 平台 Hermes skills 规划、职责边界和当前清单 |
| `docs/HERMES_RUNTIME.md` | 平台 Hermes 独立容器、目录、模型、skills 同步与权限说明 |
| `docs/api/README.md` | REST API 汇总，包括认证、AI、知识沉淀、安全答题等接口 |
| `database/DATABASE_DESIGN.md` | PostgreSQL / Prisma 数据模型设计 |
| `docs/PROJECT_STRUCTURE.md` | 项目目录结构与入口说明 |

## Hermes Agent 与模型路由

平台用户端 AI 助手名称为“邮宝”。Hermes Agent 是底层 OpenAI-compatible Agent / skills 运行时，不直接作为用户侧品牌名。

```text
CLI Hermes：/home/cocking/.hermes/
平台 Hermes：/home/cocking/cqupt-src-hermes-linux/
平台 API：http://localhost:5000/v1/chat/completions
平台后端模型名：OPENAI_MODEL=hermes-agent（后端虚拟名）
平台容器实际模型：由 Hermes config.yaml 路由，目前用于平台/微信回复的模型为 DeepSeek 系列
```

后端环境变量示例：

```env
OPENAI_BASE_URL=http://localhost:5000/v1
OPENAI_API_KEY=API_SERVER_KEY
OPENAI_MODEL=hermes-agent
```

若后端也运行在 Docker 容器内，`OPENAI_BASE_URL` 应改为 Docker 网络内服务名：

```env
OPENAI_BASE_URL=http://hermes-agent:5000/v1
```

健康检查：

```bash
curl -s http://localhost:5000/health
```

## 项目结构

```text
cqupt-src-2.10/
├── frontend/       # React 前端
├── backend/        # NestJS 后端
├── database/       # Prisma schema、数据库设计、seed、迁移
├── deploy/         # Docker、Nginx、部署脚本
├── docs/           # API、架构、安全、部署、AI 文档
├── tests/          # E2E 测试和测试数据
├── storage/        # 本地上传文件临时目录，不提交真实文件
├── tmp/            # 临时文件目录，不提交真实文件
├── start-local.sh / .ps1
├── stop-local.sh / .ps1
├── PROJECT_HANDOFF.md
├── VibeCoding.md
└── 文档/           # 早期需求与过程记录，已加同步说明
```

完整结构说明见 `docs/PROJECT_STRUCTURE.md`。

## 目录结构详解

以下基于当前代码实际内容整理。

### `backend/` — NestJS 后端

```text
backend/
├── package.json                    # 后端依赖：NestJS、Prisma、pdf-lib、pdf-parse 等
├── tsconfig.json / tsconfig.build.json
├── main.ts                         # 入口：NestFactory 创建 AppModule，配置 CORS、前缀、端口
│
├── src/
│   ├── app.module.ts               # 根模块，集中注册所有业务模块、配置模块、Prisma 模块
│   │
│   ├── config/
│   │   ├── env.ts                  # 环境变量校验：强制读取 DATABASE_URL、JWT_ACCESS_SECRET、JWT_REFRESH_SECRET 等
│   │
│   ├── database/
│   │   └── seed.ts                 # 数据库种子：初始化角色、权限、演示账号、系统配置等
│   │
│   ├── common/
│   │   ├── crypto/
│   │   │   ├── jwt.ts              # JWT 工具：HS256 签名/验签、access + refresh 双令牌生成与解析
│   │   │   └── password.ts         # 密码哈希：bcrypt 比对
│   │
│   ├── modules/                    # 业务模块（按领域划分）
│   │   │
│   │   ├── auth/                   # 认证模块
│   │   │   ├── auth.controller.ts   # 登录、注册、刷新令牌、邮箱验证码发送
│   │   │   ├── auth.service.ts      # 认证逻辑：学校统一码校验、JWT 签发与刷新
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.types.ts / auth.validation.ts
│   │   │   ├── jwt-auth.guard.ts    # JWT 鉴权 Guard
│   │   │   └── permissions.guard.ts # RBAC 权限 Guard
│   │   │
│   │   ├── users/                  # 用户管理模块
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.types.ts / users.validation.ts
│   │   │
│   │   ├── rbac/                   # RBAC 权限管理
│   │   │   ├── permissions.ts       # 权限常量定义
│   │   │   ├── rbac.service.ts      # 角色-权限映射、用户权限查询
│   │   │
│   │   ├── vulnerabilities/        # 漏洞管理模块（核心）
│   │   │   ├── vulnerabilities.controller.ts
│   │   │   ├── vulnerabilities.service.ts
│   │   │   ├── vulnerability.types.ts / vulnerability.validation.ts
│   │   │   # 支持漏洞提交、草稿、审核、修复、复测、归档全流程
│   │   │
│   │   ├── attachments/            # PDF 附件模块
│   │   │   ├── attachments.controller.ts
│   │   │   ├── attachments.service.ts
│   │   │   ├── attachments.types.ts
│   │   │   # MinIO 上传、受控下载（预签名 URL）、访问审计
│   │   │
│   │   ├── certificates/           # 证书模块
│   │   │   ├── certificates.controller.ts
│   │   │   ├── certificates.service.ts
│   │   │   ├── certificate-pdf.generator.ts  # pdf-lib 生成 PDF 证书
│   │   │   ├── certificate.types.ts / certificate.validation.ts
│   │   │
│   │   ├── access/                 # 漏洞详情页访问控制
│   │   │   ├── access.controller.ts
│   │   │   ├── access.service.ts
│   │   │   ├── access.validation.ts
│   │   │   ├── access.types.ts
│   │   │
│   │   ├── audit-logs/             # 审计日志
│   │   │   ├── audit-logs.controller.ts
│   │   │   ├── audit-logs.service.ts
│   │   │   ├── audit-logs.types.ts / audit-logs.validation.ts
│   │   │   ├── audit-log-mapper.ts   # 日志字段脱敏映射
│   │   │   └── audit-log-sanitizer.ts
│   │   │
│   │   ├── account/                # 账号中心
│   │   │   ├── account.controller.ts
│   │   │   ├── account.service.ts
│   │   │   ├── account.types.ts / account.validation.ts
│   │   │   # 头像上传、邮箱修改（验证码）、密码修改
│   │   │
│   │   ├── notifications/          # 通知模块
│   │   │   ├── notifications.controller.ts
│   │   │   ├── notifications.service.ts
│   │   │
│   │   ├── announcements/          # 公告模块
│   │   │   ├── announcements.controller.ts
│   │   │   ├── announcements.service.ts
│   │   │   ├── announcement.types.ts / announcement.validation.ts
│   │   │
│   │   ├── learning/               # 学习资源模块
│   │   │   ├── learning.controller.ts
│   │   │   ├── learning.service.ts
│   │   │   ├── learning.types.ts / learning.validation.ts
│   │   │
│   │   ├── points-mall/            # 积分商城模块
│   │   │   ├── points-mall.controller.ts
│   │   │   ├── points-mall.service.ts
│   │   │   ├── points-mall.types.ts / points-mall.validation.ts
│   │   │
│   │   ├── security-exam/          # 安全答题模块
│   │   │   ├── security-exam.controller.ts
│   │   │   ├── security-exam.service.ts
│   │   │   ├── security-exam.types.ts / security-exam.validation.ts
│   │   │
│   │   ├── dashboard/              # 仪表盘模块
│   │   │   ├── dashboard.controller.ts
│   │   │   ├── dashboard.service.ts
│   │   │
│   │   ├── system-settings/        # 系统设置模块
│   │   │   ├── system-settings.controller.ts
│   │   │   ├── system-settings.service.ts
│   │   │   ├── system-settings.types.ts
│   │   │
│   │   ├── health/                 # 健康检查
│   │   │   ├── health.controller.ts
│   │   │
│   │   ├── school/                 # 学校策略
│   │   │   ├── school-policy.service.ts
│   │   │   ├── school-policy.module.ts
│   │   │
│   │   ├── captcha/                # 验证码模块
│   │   │   ├── captcha.controller.ts
│   │   │   ├── captcha.service.ts
│   │   │   ├── captcha.types.ts / captcha.validation.ts
│   │   │
│   │   ├── prisma/                 # Prisma 客户端封装
│   │   │   ├── prisma.module.ts
│   │   │   └── prisma.service.ts
│   │   │
│   │   ├── ai/                     # AI Gateway 模块
│   │   │   ├── ai.controller.ts          # AI 对话 API 入口（邮宝助手）
│   │   │   ├── ai.module.ts
│   │   │   ├── ai.service.ts             # OpenAI-compatible API 调用封装
│   │   │   ├── ai.prompt.service.ts      # 系统提示词组装
│   │   │   ├── ai.response.service.ts    # 响应处理与卡片生成
│   │   │   ├── ai.data-request.service.ts# 最小上下文数据请求（dataRequests JSON 协议）
│   │   │   ├── ai.tools.service.ts       # AI 工具注册与调用
│   │   │   ├── ai.tools.registry.ts      # 工具清单注册
│   │   │   ├── ai.guards.ts              # AI 模块鉴权 Guard
│   │   │   ├── ai.skill-router.service.ts# 按角色路由 Hermes Skill
│   │   │   ├── ai.report-draft.service.ts# 渗透报告草稿解析
│   │   │   ├── ai.types.ts / ai.validation.ts
│   │   │
│   │   ├── ai-knowledge/           # AI 知识沉淀模块
│   │   │   ├── ai-knowledge.controller.ts
│   │   │   ├── ai-knowledge.service.ts
│   │   │   ├── ai-knowledge.module.ts
│   │   │   ├── ai-knowledge.types.ts / ai-knowledge.validation.ts
│   │   │   ├── ai-knowledge.utils.ts
│   │   │   ├── ai-knowledge.worker.ts          # setInterval 调度的后台 Worker
│   │   │   ├── ai-knowledge-maintenance.worker.ts # 维护扫描 Worker
│   │   │   ├── ai-problem-session.controller.ts
│   │   │   └── ai-problem-session.service.ts   # 问题会话管理（多轮对话、知识沉淀）
│   │   │
│   │   └── integrations/         # 外部集成（见下方）
│   │
│   └── integrations/
│       └── object-storage/
│           ├── object-storage.module.ts
│           └── s3-storage.service.ts  # MinIO S3 客户端封装
│
└── scripts/
    ├── prisma-generate.cjs         # Prisma Client 生成脚本（避免误在项目根目录生成）
    ├── prisma-migrate-dev.cjs      # 开发环境迁移脚本
    └── prisma-migrate-deploy.cjs   # 生产环境迁移脚本
```

**后端模块设计原则**：

- 每个业务模块自包含 Controller / Service / Module / Types / Validation，职责单一。
- 认证、权限、审计、脱敏、限流通过 `common/` 和 Guard/Interceptor 实现，不侵入业务逻辑。
- AI 模块（`ai/`）和知识模块（`ai-knowledge/`）通过 `integrations/` 中的 Hermes Agent 集成，前端不直连模型。
- Worker 使用 NestJS `OnModuleInit` + `setInterval` 调度，通过 PostgreSQL 行锁实现简单分布式锁（非 BullMQ）。

### `frontend/` — React 前端

```text
frontend/
├── package.json                    # 前端依赖：React 19、Vite 6、Tailwind CSS 4、Three.js
├── vite.config.ts
├── index.html
├── tsconfig.json
│
├── public/
├── src/
│   ├── main.tsx                    # 入口：ReactDOM.createRoot 挂载 App
│   ├── App.tsx                     # 根组件：路由、主题 Provider、布局
│   │
│   ├── components/                 # 公共组件
│   │   ├── GlobeSceneWrapper.tsx   # 首页粒子地球 3D 场景（Three.js + @react-three/fiber）
│   │   ├── TypewriterTitle.tsx     # 打字机动画标题
│   │   ├── NavHeader.tsx           # 导航栏（响应式、暗/亮主题切换）
│   │   └── ...
│   │
│   ├── pages/                      # 页面组件
│   │   ├── home/page.tsx           # 首页：3D 地球 + 打字机标题 + 底部备案号
│   │   ├── about/page.tsx          # 关于页
│   │   ├── blog/                   # 博客列表与详情（Markdown 渲染）
│   │   ├── projects/               # 项目展示
│   │   ├── models/                 # 3D 模型展示页（Three.js）
│   │   ├── gallery/                # 绘画页
│   │   ├── photography/            # 摄影页
│   │   ├── contact/page.tsx        # 联系页
│   │   └── ...
│   │
│   ├── hooks/                      # 自定义 Hooks
│   ├── lib/                        # 工具函数、常量、API 客户端
│   └── styles/                     # 全局样式、Tailwind 配置
```

### `database/` — 数据库

```text
database/
├── DATABASE_DESIGN.md              # PostgreSQL / Prisma 数据模型设计文档
├── prisma/
│   ├── schema.prisma               # 完整 Prisma Schema（1366 行）
│   │   # 核心模型：User、Vulnerability、Certificate、AuditLog、SecurityQuestion 等
│   │   # 枚举：RoleCode、VulnerabilitySeverity、VulnerabilityStatus、AuthorizationLevel 等
│   ├── migrations/                 # Prisma 迁移文件
│   └── README.md                   # Prisma 迁移/生成命令说明
└── seed/
    ├── README.md                   # 种子数据说明
    └── ...                         # 初始数据脚本
```

### `deploy/` — 部署

```text
deploy/
├── README.md                       # 部署总体说明
├── docker/
│   ├── docker-compose.local.yml    # 本地开发环境：PostgreSQL + Redis + MinIO
│   ├── Dockerfile.backend          # 后端 Docker 镜像构建
│   ├── Dockerfile.frontend         # 前端 Docker 镜像构建
│   └── ...
├── nginx/
│   └── README.md                   # Nginx 职责说明与配置示例
└── scripts/
    └── README.md                   # 脚本迁移说明；本地启动脚本位于项目根目录
```

### `tests/` — 测试

```text
tests/
├── api/
│   └── core-api-smoke.mjs          # 核心 API 冒烟测试
├── e2e/
│   ├── core-e2e.mjs                # 端到端集成测试（安全答题、附件、报告草稿等）
│   └── ai-problem-session-phase2.mjs # AI 问题会话 Phase 2 E2E 测试
└── fixtures/                       # 测试数据
```

### `docs/` — 文档

```text
docs/
├── AI.md                           # AI 目标效果、当前进度、部署和接口链路
├── AI_KNOWLEDGE_BASE.md            # AI 知识沉淀、Skill Candidate、去重、评分、审核与安装链路
├── AI_SKILLS.md                    # CQUPT-SRC 平台 Hermes skills 规划与清单
├── HERMES_RUNTIME.md               # 平台 Hermes 容器、目录、模型、skills 同步
├── PROJECT_STRUCTURE.md            # 本文件：项目目录结构与入口说明
├── PROJECT_DEEP_DIVE.md            # 深度剖析：代码阅读顺序、面试表述、版本漂移
├── PROJECT_IMPLEMENTATION_REPORT.md # 实施报告
├── api/                            # REST API 契约文档
│   └── README.md                   # API 汇总（认证、AI、知识沉淀、安全答题等）
├── architecture/                   # 架构设计文档
│   └── AI_PROBLEM_SESSION_KNOWLEDGE_CAPTURE.md
├── security/                       # 安全设计文档
└── deployment/                     # 部署文档
```

### 根目录其他文件

```text
├── storage/                      # 本地开发临时存储（不提交真实上传文件）
├── tmp/                          # 临时文件（不提交真实运行数据）
├── start-local.sh / .ps1         # 一键启动本地开发环境
├── stop-local.sh / .ps1          # 停止本地开发环境
├── CQUPT/                        # Logo 原始资源
├── 文档/                         # 早期需求与过程记录
│   └── 总体建议.md               # 总体技术推进建议
├── PROJECT_HANDOFF.md            # 交接说明
├── VibeCoding.md                 # 开发流程约束
└── README.md                     # 本文件
```

## 本地运行

### 方式一：一键启动（推荐）

Linux / WSL / macOS：

```bash
bash start-local.sh
```

关闭：

```bash
bash stop-local.sh
```

Windows PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\start-local.ps1
```

Windows 关闭：

```powershell
powershell -ExecutionPolicy Bypass -File .\stop-local.ps1
```

启动后访问：

| 服务 | 地址 |
|---|---|
| 前端页面 | http://localhost:5173 |
| 后端 API 健康检查 | http://localhost:3000/api/health |
| 平台 Hermes Gateway | http://localhost:5000/health |
| MinIO 控制台 | http://localhost:9001 |

可选参数：

```bash
bash start-local.sh --skip-postgres --skip-minio --skip-redis --skip-db-init
bash stop-local.sh --keep-postgres --keep-minio --keep-redis
```

### 方式二：手动分步启动

```bash
# 1. 基础服务
cd /home/cocking/projects/cqupt-src-2.10
docker compose -f deploy/docker/docker-compose.local.yml up -d

# 2. 数据库迁移与种子
cd backend
npm run prisma:migrate:dev
npm run db:seed

# 3. 后端
npm run dev

# 4. 前端（另开终端）
cd ../frontend
npm run dev
```

## 验证命令

```bash
# 后端
cd backend
npm run build
npm run prisma:validate

# 前端
cd ../frontend
npm run build
npm run lint

# 健康检查
curl -s http://localhost:3000/api/health
curl -s http://localhost:5000/health
```

## 演示账号

```text
学生：2025001@stu.cqupt.edu.cn  /  123456+-
审核员：0000001@cqupt.edu.cn       /  auditor123456+-
管理员：0000000@cqupt.edu.cn       /  admin123456+-
邮箱/修改密码验证码：123456（开发环境固定值）
```

## 数据库模型要点

- 用户只允许校内注册，访客不入库。
- 用户只能绑定一个角色：学生、审核员、管理员。
- 授权等级：`BASIC / TRUSTED / STAFF`。
- 漏洞支持草稿，提交后不可撤回；一个漏洞只分配一个审核员；一个漏洞最多一张证书。
- 附件只允许 PDF，单文件 10MB，访问必须鉴权并写审计日志。
- 安全答题准入使用 `SecurityQuestion` 与 `SecurityExamAttempt`。
- AI 知识沉淀使用 `AiProblemSession`、`AiProblemSessionTurn`、`AiKnowledgeCluster`、`AiKnowledgeEntry`、`AiKnowledgeConversation`、`AiKnowledgeConversationTurn` 与 Skill Candidate 状态字段。
- AI 原始对话不作为长期知识直接复用；先按问题会话保存脱敏 turns，用户确认解决后再生成脱敏、泛化、审核后的知识条目或候选 Skill。

## 安全原则

- 不提交 `.env`、真实密钥、真实漏洞附件。
- 前端校验只做体验，后端必须重新校验所有字段。
- AI 调用必须经过后端代理、脱敏、限流、审计和角色边界控制。
- 模型输出不可信，业务 ID、库存、积分、权限、状态必须由后端查库确认。
- 写操作必须走 Action Proposal / 用户确认 / 后端事务 / AuditLog。
- 审核结论、知识沉淀、Skill 晋升必须保留人工审核与安全兜底。

## 近期待处理

1. 生产部署时复核 `/home/cocking/cqupt-src-hermes-linux/platform-skills/cqupt-src` 是否保持 `cocking:cocking` 与 `775`，且 Docker Compose 是否把它挂载到容器 `/opt/data/skills/cqupt-src`；后端 `CQUPT_HERMES_SKILLS_ROOT` 应指向该宿主目录。
2. 在生产数据规模下继续观察 AI 知识沉淀去重效果、评分阈值和审核工作量。
3. 生产部署后复跑 `cd backend && npm run test:core-e2e` 与 `npm run test:ai-problem-session`，确认安全答题、附件、报告草稿、知识沉淀、问题会话和 Skill 安装链路在服务器拓扑下仍通过。
