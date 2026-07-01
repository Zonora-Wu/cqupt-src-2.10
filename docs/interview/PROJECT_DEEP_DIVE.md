# CQUPT-SRC 项目全景与代码导读

> 基于 2026-06-19 当前分支 `AI复测修复优化` 的代码事实整理。面试时应优先以代码、Prisma Schema 和实际构建结果为准，历史文档仅作为设计背景。

## 1. 一句话定位

CQUPT-SRC 是面向校园场景的漏洞响应与安全学习平台。它把学生漏洞提交、审核员审核、责任单位修复、复测归档、证书与积分激励、学习资源和 AI 辅助串成一个可审计的闭环。

它不是单纯的漏洞工单系统，主要有四个层次：

1. SRC 核心业务：漏洞提交、审核、修复、复测、归档。
2. 平台治理：认证、RBAC、准入、审计、用户、公告、证书、积分商城。
3. AI 助手与知识治理：邮宝、确定性业务回答、Hermes、知识沉淀、Skill Candidate。
4. AI 自动复测：低风险 Runner 与高风险 Hermes Direct 双通道。

## 2. 业务角色与价值

| 角色 | 核心诉求 | 平台能力 |
|---|---|---|
| 学生/白帽 | 合规提交漏洞、跟踪进度、获得激励、学习提升 | 准入考试、漏洞提交、附件、进度、证书、积分、商城、邮宝 |
| 审核员 | 高效初审、补充材料、判断等级、复测归档 | 审核队列、附件预览、审核意见、积分奖励、复测、AI 复测 |
| 管理员 | 平台运营和风险治理 | 用户/RBAC、公告、证书、商城、审计、系统配置、AI 知识治理 |
| 责任单位 | 修复漏洞 | 当前主要由平台状态和审核流程间接承载，尚未形成独立角色门户 |

项目解决的核心矛盾是：校园漏洞响应需要效率，但又必须控制越权测试、敏感数据、自动化攻击和 AI 幻觉带来的风险。

## 3. 仓库与技术栈

当前仓库约有 6 万行 TypeScript/TSX 源码，包含四个可独立构建的 Node.js 工程：

```text
frontend/                 React 19 + TypeScript + Vite 6 + Tailwind CSS 4
backend/                  NestJS 11 + Prisma + PostgreSQL
retest-runner/            受限低风险复测执行器
retest-egress-proxy/      Hermes Direct 动态出网范围控制代理
database/prisma/          Schema 和迁移
deploy/                   本地依赖、Hermes Direct、启动脚本
tests/                    API/E2E 测试
```

基础设施：

- PostgreSQL：主业务数据、状态机、审计和 AI 数据。
- MinIO：PDF、证书和复测 artifact。
- Redis：Compose 已提供，但当前业务 Worker 并未真正使用 BullMQ。
- 主 Hermes：OpenAI-compatible AI Gateway，默认端口 5000。
- 复测 Hermes：代码和环境配置仍支持独立端口 5001。

## 4. 总体架构

```text
浏览器
  -> React 单页应用
  -> REST / Bearer JWT
  -> NestJS 模块化单体
       -> Prisma -> PostgreSQL
       -> 自实现 S3 SigV4 Client -> MinIO
       -> AI Gateway -> 主 Hermes :5000
       -> Retest Runner
       -> Hermes Direct :5001 -> Egress Proxy
```

架构风格是“模块化单体 + 外置高风险执行器”：

- 事务型业务集中在 NestJS 和 PostgreSQL，避免分布式事务复杂度。
- AI 与自动复测通过明确边界隔离。
- Runner、Hermes Direct 不持有主业务数据库权限。
- 高风险能力采用人工审批、范围控制和审计，而不是让模型直接修改业务。

## 5. 前端架构

入口是 `frontend/src/App.tsx`。

- 根据登录用户角色懒加载 `UserHome`、`AuditorHome`、`AdminHome`。
- 没有使用 React Router；各角色工作台通过 `activeMenu` 状态切换页面。
- API 集中在 `frontend/src/services/`。
- `apiClient.ts` 统一处理 JSON、FormData、Blob、Bearer Token 和 401 失效事件。
- 页面级组件普遍使用 `React.lazy` 减少首屏包体。
- 主题、通知偏好等部分状态保存在 localStorage。

三个工作台：

- 用户端：提交、我的漏洞、证书、积分、排行榜、学习、邮宝。
- 审核员端：审核、复测、证书、公告和 AI 辅助。
- 管理员端：漏洞、用户、证书、公告、资源、商城、AI 复测、审计、知识库、设置。

当前前端的工程特点：

- 优点：角色边界清晰，服务层集中，页面懒加载，UI 组件已有复用。
- 局限：缺少 URL 路由、深链接和浏览器历史管理；大型页面文件超过 1000 行；部分首页和审核员页面仍保留静态展示或 mock 初始数据；没有通用服务端状态管理方案。

## 6. 后端模块

`backend/src/app.module.ts` 注册了主要业务模块：

| 模块 | 责任 |
|---|---|
| Auth / Account | 登录、注册、当前用户、密码、邮箱、头像 |
| RBAC / Access / SecurityExam | 权限、责任书、安全答题准入 |
| Vulnerabilities / Attachments | 漏洞生命周期、PDF 附件 |
| Certificates | 签发、撤销、PDF、公开脱敏核验 |
| PointsMall | 积分账本、商品、兑换事务 |
| Announcements / Learning / Notifications | 内容与通知 |
| Users / AuditLogs / SystemSettings / Dashboard | 平台治理 |
| Ai | 邮宝 AI Gateway |
| AiKnowledge | 问题会话、知识库、维护、Skill Candidate |
| AiVulnerabilityRetest | AI 自动复测状态机和双通道执行 |

典型模块内部采用：

```text
controller -> validation/normalization -> service -> Prisma transaction
                                      -> AuditLog / Event
```

项目没有全局 DTO ValidationPipe，主要通过每个模块的 `*.validation.ts` 手动归一化输入。

## 7. 认证、授权与准入

### 7.1 认证

支持：

- 统一认证码 + 密码。
- 邮箱验证码登录。
- 校内邮箱验证码注册。
- 开放注册或管理员审批注册。

密码使用项目自有 `password.ts` 处理；Access Token 使用 JWT。登录成功后：

1. 校验用户状态。
2. 查询角色权限和用户覆盖权限。
3. 创建 RefreshToken 哈希记录。
4. 更新最后登录时间。
5. 写入登录审计。
6. 返回 Access Token、Refresh Token 和用户权限。

重要现状：代码会签发并保存 Refresh Token，但当前控制器没有 refresh/logout 接口，前端也没有自动刷新逻辑。Access Token 过期后直接清理本地会话并要求重新登录。这是可以主动说明的未完成闭环。

### 7.2 RBAC

权限采用“角色默认权限 + 用户级覆盖”：

- STUDENT：提交和查看自己的漏洞、证书、积分、商城、学生 AI。
- AUDITOR：查看全部漏洞、审核、复测、敏感附件、AI 复测审批。
- ADMIN：平台治理、策略、用户、审计、AI 知识管理。

请求流程：

```text
JwtAuthGuard
  -> 验证 JWT
  -> 重新查用户状态
  -> 实时计算权限
  -> request.auth
PermissionsGuard
  -> 读取 @RequirePermissions
  -> 拒绝缺失权限
```

权限不只依赖 JWT 中的旧角色信息，Guard 每次会重新查用户与权限，因此后台禁用用户或修改权限后可即时生效。

### 7.3 业务准入

学生提交漏洞前还要满足：

- 签署责任书。
- 通过安全答题。
- 账号和授权策略允许提交。

前端提示只是体验层，最终由后端 `AccessPolicyService` 强制校验。

## 8. 漏洞核心生命周期

核心实体：

- `VulnerabilityReport`
- `VulnerabilityAttachment`
- `VulnerabilityEvent`
- `ReviewAssignment`
- `ReviewComment`
- `RetestRecord`

主要状态：

```text
DRAFT
  -> SUBMITTED
  -> NEEDS_SUPPLEMENT -> SUBMITTED
  -> PENDING_RETEST
  -> FIXING / PENDING_RETEST
  -> ARCHIVED
  -> CERTIFIED

任意审核阶段也可能 -> REJECTED
```

实际代码中，审核确认会直接进入 `PENDING_RETEST`，并同时：

- 更新最终等级。
- 记录审核分派和审核意见。
- 按严重等级写入积分账本。
- 记录 `VulnerabilityEvent`。
- 写入 `AuditLog`。

默认积分：

| 等级 | 积分 |
|---|---:|
| 严重 | 800 |
| 高危 | 500 |
| 中危 | 260 |
| 低危 | 80 |
| 信息 | 20 |

复测结论：

- `RETEST_PASS` 或 `ARCHIVE` -> `ARCHIVED`
- `RETURN_TO_FIX` -> `FIXING`

设计重点是双日志：

- `VulnerabilityEvent`：面向业务时间线。
- `AuditLog`：面向安全审计和责任追踪。

## 9. 附件与证书

附件：

- 只允许 PDF。
- 校验扩展名、MIME、magic bytes、大小和 SHA-256。
- 存入 MinIO。
- 预览必须鉴权。
- 敏感访问写审计。

对象存储没有引入 AWS SDK，而是在 `S3StorageService` 中自行实现 AWS Signature V4 的 HEAD/PUT/GET。优点是依赖少；缺点是维护成本高、功能面窄，应在生产化阶段考虑成熟 SDK。

证书：

- 漏洞归档后可签发。
- 支持模板背景、印章和坐标布局。
- 使用 `pdf-lib` 和中文字体生成 PDF。
- 支持撤销、受控预览和公开脱敏核验。

## 10. 积分商城

积分不是 User 表上的一个可变余额字段，而是 `PointLedgerEntry` 流水账。

每条记录保存：

- 收入/支出/调整方向。
- 本次积分。
- `balanceAfter`。
- 原因、漏洞、操作人。

兑换流程在事务中完成：

1. 读取余额和商品状态。
2. 校验库存和积分。
3. 扣减库存。
4. 写支出流水。
5. 创建兑换记录和事件。
6. 写审计日志。

取消兑换时反向返还库存和积分。账本模型比直接修改余额更适合审计和纠错。

## 11. 邮宝 AI Gateway

用户侧品牌是“邮宝”，Hermes 是底层 Agent 运行时。

请求链路：

```text
POST /api/ai/chat
  -> JWT/RBAC/配额
  -> 最小用户上下文
  -> 后端 Skill 路由
  -> 强业务意图：后端确定性回答
  -> 开放问题：调用 Hermes
  -> dataRequests：后端执行只读工具后再次调用 Hermes
  -> 结构化解析 cards/actions
  -> 脱敏、ID 白名单、审计
```

关键设计：

- 前端不持有模型密钥，不直连模型。
- 当前积分、库存、漏洞状态等实时数据不依赖模型记忆。
- 用户角色和权限只信任后端 JWT 上下文。
- 模型生成的实体 ID 必须经过后端白名单校验。
- 写操作必须先形成 Action Proposal，再由用户确认和后端事务执行。
- Agent 不可用时返回降级响应。

这是“LLM 负责语言和推理，后端负责事实、权限和副作用”的边界设计。

## 12. AI 知识沉淀

知识系统分四层：

1. `AiProblemSession`：一个问题的多轮对话。
2. `AiKnowledgeCluster`：相似问题族和统计。
3. `AiKnowledgeEntry`：可检索复用的审核知识。
4. `AiSkillCandidate`：管理员显式整理的长期方法论候选。

问题会话流程：

```text
ACTIVE
  -> 用户确认已解决
  -> 脱敏总结
  -> AI + 规则评分
  -> 相似度/重复风险判断
  -> READY_REVIEW 或 AUTO_APPROVED
  -> APPROVED_TO_KB
```

治理原则：

- 原始用户对话不能直接成为公共知识。
- 实时业务数据不能沉淀成静态知识。
- 会话必须脱敏、泛化、评分和去重。
- 用户来源知识不能自动晋升 Hermes Skill。
- Skill Candidate 只能由管理员基于平台级规则或人工方法论显式创建。
- 知识维护 Worker 会扫描过期、低质量、负反馈和风险条目。

当前 Worker 使用 NestJS 进程内 `setInterval` 轮询数据库，不是 BullMQ。

## 13. AI 漏洞自动复测

这是项目最复杂的子系统。

### 13.1 为什么采用双通道

低风险、模板化步骤适合 Runner；需要浏览器、复杂推理或高风险动作的任务适合 Hermes Direct，但必须人工审批。

```text
PLAN_ONLY       只生成建议，不执行
CONTROLLED_RUN  受限 Runner 执行低风险步骤
HERMES_DIRECT   独立 Agent 执行复杂步骤
```

### 13.2 状态机

主要状态：

```text
PENDING -> PLANNING -> POLICY_CHECK
  -> PLAN_REVIEW
  -> RUNNING -> REPORTING -> SUCCEEDED
  -> DIRECT_PLAN_REVIEW -> DIRECT_RUNNING
       -> DIRECT_ACTION_REVIEW -> DIRECT_RUNNING
       -> REPORTING -> SUCCEEDED
  -> ADVISORY_ONLY / BLOCKED / FAILED / CANCELLED / EXPIRED
```

### 13.3 安全边界

- 任务上下文先脱敏。
- 明确 confirmed targets。
- 策略引擎逐步骤决定允许、限制、人工审批或阻断。
- Runner 只执行内置低风险模板。
- HIGH/CRITICAL 步骤不能进入 Runner。
- Hermes Direct 方案整体审批，高风险动作逐次审批。
- 凭据使用 AES-256-GCM 加密，AAD 绑定任务、类型和目标范围。
- 出网代理只允许已批准目标，并阻止私网和云元数据地址。
- 每个状态变化、审批、执行和 artifact 访问都有审计。
- 结论必须受证据约束，不能仅依据模型文本。

### 13.4 Worker 实现

`AiVulnerabilityRetestWorkerService` 使用进程内定时轮询：

- PostgreSQL 中查询可执行任务。
- `lockedAt + lockedBy + statusVersion` 实现租约和乐观并发。
- 锁超时后允许恢复。
- 状态迁移使用显式断言。
- Runner 和 Direct 最终统一为报告 Schema。

这能满足当前单实例/小规模部署，但多实例和高吞吐场景应迁移到独立 Worker + BullMQ 或可靠消息队列。

## 14. 数据模型分区

Prisma Schema 有 40 多个模型，可按领域理解：

| 分区 | 关键模型 |
|---|---|
| 身份权限 | User、Role、Permission、RolePermission、UserPermissionOverride、RefreshToken |
| 准入 | ResponsibilityAgreement、ResponsibilitySignature、SecurityQuestion、SecurityExamAttempt |
| 漏洞 | Asset、VulnerabilityReport、Attachment、Event、Assignment、Comment、RetestRecord |
| 激励 | Certificate、PointLedgerEntry、MallProduct、MallRedemption |
| 内容 | LearningResource、Announcement |
| AI Gateway | AiCallLog、AiUserQuota、AiActionProposal、AiSkill |
| AI 复测 | Job、Plan、Step、Artifact、Report、DirectSession、DirectAction、Credential |
| AI 知识 | ProblemSession、Turn、Cluster、Entry、Revision、Feedback、MaintenanceTask、SkillCandidate |
| 治理 | AuditLog、SchoolProfile、SystemSetting |

面试中不要逐表背诵，按领域和关系讲。

## 15. 部署与运行

本地：

- PostgreSQL：`127.0.0.1:15432`
- Redis：`127.0.0.1:6379`
- MinIO：`127.0.0.1:9000/9001`
- Backend：`localhost:3000/api`
- Frontend：`localhost:5173`
- 主 Hermes：`localhost:5000`
- Hermes Direct：配置默认 `localhost:5001`

`deploy/scripts/start-local.sh` 会：

1. 检查 Hermes 服务。
2. 启动 PostgreSQL、Redis、MinIO。
3. 生成 Prisma Client、执行迁移和 Seed。
4. 后台启动前后端并记录 PID/日志。

当前 Compose 只覆盖基础设施，前后端生产容器、Nginx 和完整 Ubuntu 拓扑仍需进一步验收。

## 16. 测试与质量

测试分层：

- TypeScript/Vite 构建。
- 后端核心 API 冒烟。
- 核心业务 E2E。
- AI 问题会话 E2E。
- AI 复测 API E2E。
- Runner 合同与安全测试。
- Egress Scope Policy 测试。
- AI 复测 Playwright 页面回归。

2026-06-19 本地验证：

- Backend build：通过。
- Retest Runner contract/security tests：通过。
- Egress Proxy：3/3 通过。
- Frontend build：通过。

## 17. 代码层面的优势

1. 领域闭环完整，不只是展示型后台。
2. RBAC、业务准入、事件时间线和安全审计是分层设计。
3. 核心写操作广泛使用数据库事务。
4. AI 没有直接拿到业务写权限。
5. AI 复测引入目标范围、策略、审批、凭据保险箱和证据约束。
6. Prisma Schema 对复杂状态和关系表达较完整。
7. 对 AI 失败、SSE 断流和任务恢复已有降级与重试。

## 18. 当前不足与改进优先级

### P0：安全和正确性

1. 完成 Refresh Token 刷新、撤销和退出闭环。
2. 统一并核实 Hermes Direct 当前拓扑，删除相互矛盾的历史文档和废弃配置。
3. 生产环境接入真实 SMTP，禁止固定验证码和 `devCode` 泄露。
4. 为全局输入验证、异常响应和安全 Header 建立统一机制。

### P1：可靠性和可扩展性

1. 将进程内轮询 Worker 迁移为独立 Worker + BullMQ/可靠队列。
2. 对 AI 复测状态机增加数据库约束、更多并发和恢复测试。
3. 使用成熟 S3 SDK 替代手写 SigV4。
4. 完成全服务生产 Compose、Nginx、备份、监控和告警。

### P2：可维护性和体验

1. 拆分 1000～2300 行的 Service/Page。
2. 引入正式前端路由和深链接。
3. 清理首页和审核员端静态 mock/展示数据。
4. 引入统一 Query Cache、表单和测试组件策略。
5. 将历史目标文档与当前实现状态自动同步。

## 19. 文档冲突与面试口径

当前存在以下版本漂移：

- `docs/HERMES_RETEST_INTERACTION.md` 称复测已合并到主 Hermes、复测 Agent 和 Egress Proxy 已废弃。
- 当前 `backend/.env.example`、启动脚本、`HermesDirectClient` 和部署目录仍明确使用独立 5001 + Egress Proxy。
- 技术栈文档写 Redis + BullMQ，但 `backend/package.json` 没有 BullMQ，实际 Worker 是 `setInterval` + PostgreSQL 锁。
- 部分文档说某些知识能力待实现，但当前代码已出现对应 Controller/Worker；是否完成仍需以 E2E 验收为准。

面试表述：

> 项目迭代较快，部分架构文档记录了不同阶段方案。我接手后以 AppModule、环境配置、客户端实现、Prisma Schema 和测试为事实源，并把文档漂移列为工程治理问题。

## 20. 推荐代码阅读顺序

1. `README.md`
2. `backend/src/app.module.ts`
3. `database/prisma/schema.prisma`
4. `frontend/src/App.tsx`
5. `backend/src/modules/rbac/permissions.ts`
6. `backend/src/modules/auth/`
7. `backend/src/modules/access/`
8. `backend/src/modules/vulnerabilities/`
9. `backend/src/modules/attachments/`
10. `backend/src/modules/points-mall/`
11. `backend/src/modules/ai/`
12. `backend/src/modules/ai-knowledge/`
13. `backend/src/modules/ai-vulnerability-retest/`
14. `deploy/` 和 `tests/`
