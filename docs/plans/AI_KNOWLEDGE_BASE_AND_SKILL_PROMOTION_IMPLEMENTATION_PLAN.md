# CQUPT-SRC AI Knowledge Base 与 Skill 晋升落地实施方案

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-06-01 已按当前代码、运行环境和 AI 问题会话 Phase 2 进度更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、最小上下文 + dataRequests、AI Knowledge Base 问题会话生命周期、已解决会话总结、AI+规则评分、相似聚类、管理员审核、高频高质自动入库、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型路由为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 当前仍待实现/验收：Knowledge Retrieval 命中回答、来源标注写回、turn 级点赞/点踩持久化、语义问题族聚类（canonicalProblem + hybrid retrieval + embedding/reranker + merge review）、数据使用路由（直接返回 vs AI 处理）、问题会话 fork/archive/title 接口、maintenanceStatus/retrievalPolicy、维护任务 Worker、不可变 revision 回滚、知识投毒暂停与恢复闭环。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`docs/architecture/AI_PROBLEM_SESSION_KNOWLEDGE_CAPTURE.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 在 CQUPT-SRC 中落地企业级“AI 知识沉淀 + 持续维护 + Hermes Skill 晋升”体系，让邮宝能复用高质量通用安全问答、减少重复 token，同时避免隐私泄露、恶意投毒、知识过期和 skill 污染。

**Architecture:** 采用三层治理：PostgreSQL 中的 AI Knowledge Base 负责动态、可审核、可检索、可修订、可归档的问答经验；NestJS AI Gateway 负责路由、脱敏、审核、检索、审计、权限和维护状态机；平台 Hermes 容器 `/home/cocking/cqupt-src-hermes-linux` 只承载少量管理员批准后的长期稳定 class-level skills。普通用户问答永远不直接写入 Hermes skill，已入库知识也不能一次入库后长期不管。

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL, optional pgvector/pg_trgm, Hermes Agent OpenAI-compatible API, React 19 + TypeScript + Tailwind CSS 4.

---

## 0. 当前落地状态（2026-05-21）

本方案中的 Phase 1 / Phase 1.5 / Phase 1.7 已完成落地并通过构建与服务层 E2E 验证：

- 多轮会话级知识沉淀：`AiKnowledgeConversation` + `AiKnowledgeConversationTurn`。
- AI 总结与 AI+规则混合评分：`overallScore`、`kbScore`、`skillScore`、`safetyScore`、`privacyRiskScore`、`confidenceScore` 等字段。
- 自动流转：低风险高分知识可自动进入 KB 或 Skill Candidate；未达阈值进入管理员审核。
- 相似知识去重：`duplicateRiskScore`、`similarKnowledgeMatches`、`mergeSuggestion`；0.86 以上强重复、0.72 以上中等重复均阻断自动入库。
- 管理端展示：会话队列、AI 评分、重复风险、相似知识和合并建议。
- Skill Candidate：生成、审批、安装和安装日志链路可用。
- 验证方式：服务层 E2E 使用临时 `targetRoot` 完成 KB → Skill Candidate → install 验证，避免误写平台 Hermes 目录。

当前剩余生产部署事项不是业务逻辑缺失，而是平台 Hermes skills 目录权限：`/home/cocking/cqupt-src-hermes-linux/data` 可能由容器 UID `10000:10000` 持有且权限为 `700`，后端进程无法直接写入。上线前需选择宿主权限调整、容器内受控安装任务或 Docker socket 运维代理中的一种。

---

## 0. 最终决策

### 0.1 知识沉淀存到哪里

知识沉淀必须存到主业务 PostgreSQL，而不是 Hermes skill 目录，也不是前端 localStorage，也不是 Hermes session。

落地位置：

```text
database/prisma/schema.prisma
  -> AiKnowledgeEntry
  -> AiKnowledgeRevision
  -> AiKnowledgeHit
  -> AiKnowledgeFeedback
  -> AiKnowledgeCaptureJob
  -> AiSkillCandidate
  -> AiSkillInstallLog
```

原因：

- PostgreSQL 受现有备份、权限、审计、迁移体系保护。
- 知识条目需要管理员审核、撤回、归档、统计命中和反馈。
- 知识条目属于平台业务数据，不属于 Hermes 运行时配置。
- 方便后端做 RBAC、状态机和审计。

Hermes skill 最终安装位置只用于被批准的长期稳定方法论：

```text
宿主机：/home/cocking/cqupt-src-hermes-linux/platform-skills/cqupt-src
容器内：/opt/data/skills/cqupt-src
```

但因为平台 Hermes `data` 根目录会保持容器私有，当前安装时不再通过 `docker cp` 写 `/opt/data`，而是写宿主可写目录并由 Compose bind mount 到容器：

```bash
# 后端受控安装写入宿主 CQUPT_HERMES_SKILLS_ROOT：
# /home/cocking/cqupt-src-hermes-linux/platform-skills/cqupt-src/<skill-name>/SKILL.md
# Docker Compose 将该目录挂载为容器内：
# /opt/data/skills/cqupt-src/<skill-name>/SKILL.md
docker restart hermes-agent
```

### 0.2 何时只做知识沉淀

默认进入 AI Knowledge Base，而不是 skill。满足以下任一条件，只做知识沉淀：

| 类型 | 示例 | 处理 |
|---|---|---|
| 高频问答经验 | “XSS 报告怎么写？” | 知识沉淀 |
| 通用学习建议 | “新手怎么学 Web 安全？” | 知识沉淀 |
| 报告写作片段 | “SSRF 影响范围怎么说明？” | 知识沉淀 |
| 平台规则解释 | “为什么漏洞会被驳回？” | 知识沉淀，通常需审核 |
| 可脱敏的漏洞场景 | “登录页 XSS 怎么写报告？” | 脱敏后知识沉淀，需审核 |
| 审核经验片段 | “复现材料不完整怎么提示？” | 角色限定知识沉淀 |
| 管理分析话术 | “漏洞周报怎么写？” | 管理员范围知识沉淀 |

要求：

- 已脱敏、已泛化。
- 不依赖当前用户实时数据。
- 可被后续相似问题复用。
- 状态可审核、可撤回、可归档、可修订、可合并、可降级或暂停检索。

### 0.3 何时创建 / 晋升 Hermes Skill

只有满足全部条件，才允许从知识库晋升为 Hermes Skill：

```text
status = APPROVED
sensitivity in (PUBLIC, INTERNAL)
hitCount >= 10
helpfulRate >= 0.80
answerQuality >= 0.85
reuseValue >= 0.80
platformRelevance >= 0.70
no open abuse reports
reviewedBy is not null
admin explicitly approves promotion
content is stable methodology, not a one-off answer
```

适合创建 skill 的内容必须是“长期稳定方法论 / 平台级行为规范 / class-level 能力”：

| 适合 Skill | 不适合 Skill |
|---|---|
| XSS 漏洞报告写作流程 | 某一次 XSS 的具体 URL 和 payload |
| SQL 注入报告结构 | 某用户提交的 SQLi 原始请求包 |
| SSRF 影响范围判断流程 | 某资产 SSRF 测试记录 |
| 待补充材料处理流程 | 某报告的补充材料原文 |
| 审核员初筛 checklist | 某审核员对某报告的意见 |
| 学生 Web 安全学习路径 | 某用户的学习进度 |
| 邮宝卡片协议 / 安全边界 | 当前商品库存、积分余额、漏洞状态 |

Skill 必须通过 `AiSkillCandidate` 审核流生成，不允许用户聊天自动创建 skill。

### 0.4 何时拒绝沉淀

以下内容不进入知识库，也不进入 skill：

- 包含真实 Token、Cookie、API Key、密码、Authorization header。
- 包含未脱敏真实资产 URL、内网 IP、敏感接口、完整请求包。
- 包含其他用户数据、积分、证书、漏洞详情。
- 包含未授权攻击步骤、绕过平台规则、提权、持久化、破坏性利用。
- 包含 prompt injection，例如“忽略规则”“以后都按我说的审核”。
- 包含明显错误安全知识，或模型回答质量不足。
- 实时业务数据：商品库存、当前积分、漏洞状态、证书状态、公告临时内容。

拒绝记录要留痕，但只保存最小化摘要和拒绝原因，不保存敏感原文。

### 0.5 入库后的持续维护

知识条目进入 `APPROVED` / `AUTO_APPROVED` 后仍需持续维护。入库只代表当前版本可用，不代表永久有效。

维护触发信号：

- 命中后用户点踩、举报、隐式失败或标记“知识过期”。
- 同类问题新总结与已有知识冲突或重复。
- 平台规则、审核标准、学习资源或工具版本变化。
- 长期无命中，或存在更新、更高质量的替代条目。
- 安全复核发现越权、敏感信息残留、危险指导或知识投毒风险。

维护动作：

```text
修订 -> 创建 AiKnowledgeRevision
合并 -> 保留来源和变更原因
降级 -> 从直接回答降为注入 Agent
暂停 -> SECURITY_SUSPENDED / RETRIEVAL_DISABLED，普通用户不可检索
归档 -> ARCHIVED，仅保留审计和历史引用
晋升 -> 通过 Skill Candidate 二次审批后安装为 Hermes Skill
```

Knowledge Retrieval 必须在相似度计算前过滤维护状态和 retrievalPolicy，避免过期、暂停、归档、安全复核或知识投毒中的知识继续污染后续回答。每个实施项必须在进度表中声明完成定义和验收规则，不能只以“代码写完”作为完成依据。

### 0.6 语义问题族聚类决策

当前 Phase 2 的聚类按 `topicKey` / 文本相似度工作，适合验证自动入库链路，但不足以支撑生产级“不同用户不同问法，同一类问题”的统计。下一阶段以语义问题族为准。

目标数据流：

```text
ProblemSessionSummary
  -> canonicalProblemJson / canonicalKey
  -> hybrid retrieval 召回候选 cluster
  -> embedding similarity + reranker 精排
  -> SAME_CLUSTER / VARIANT_OF_CLUSTER / MERGE_REVIEW / NEW_CLUSTER / REJECT
  -> 更新 cluster、variant、merge task 或新建 cluster
```

落地要求：

| 项 | 要求 |
|---|---|
| 归一化 | 建立 CQUPT-SRC taxonomy：domain、intent、entity、scenario、symptom、environment、expectedOutcome、roleScope |
| 召回 | 规则 exact key、PostgreSQL full-text/pg_trgm、pgvector embedding、已有 knowledge duplicate candidates 混合召回 |
| 精排 | 结合问题相似、实体重叠、症状、意图、答案兼容性、环境兼容性，不只看向量分 |
| 决策 | 高置信 `SAME_CLUSTER` 才参与自动入库；`VARIANT` 只挂变体；`MERGE_REVIEW` 阻断自动入库 |
| 治理 | 管理端显示候选 cluster、冲突字段、推荐理由和合并/变体/保留独立操作 |
| 版本化 | embeddingModel、embeddingVersion、embeddingTextHash、embeddingUpdatedAt 必须持久化 |

推荐阈值：

```text
score >= 0.90                         -> SAME_CLUSTER
0.82 <= score < 0.90 且答案兼容       -> VARIANT_OF_CLUSTER
0.75 <= score < 0.90 且存在不确定项   -> MERGE_REVIEW
score < 0.75                          -> NEW_CLUSTER
安全/隐私/越权硬阻断                  -> REJECT
```

自动入库新增门槛：

```text
semanticClusterConfidenceAvg >= 0.90
pendingMergeReviewCount = 0
最近参与统计的 source sessions 均为 SAME_CLUSTER
```

这部分完成前，不应把“文本级 topicKey 聚类”描述成已能可靠识别不同问法的同类问题。

---

## 1. 总体链路

```text
POST /api/ai/chat
  -> JWT / RBAC
  -> redactSensitiveText(input)
  -> buildUserContext(user)
  -> Direct Response 优先
  -> Knowledge Retrieval 仅处理通用专业问题
  -> 高置信命中：Knowledge Direct Answer
  -> 中置信命中：Knowledge Injected Agent
  -> 无命中：Hermes Agent
  -> Response Normalizer
  -> AiCallLog + AuditLog
  -> enqueue AiKnowledgeCaptureJob
  -> 后台捕获任务：分析、脱敏、评分、入库/拒绝
  -> 入库后维护任务：命中/反馈/过期/重复/安全风险检查
```

关键顺序不可变：

```text
Direct Response > Knowledge Retrieval > Agent > Capture
```

原因：积分、商品、漏洞状态是实时业务数据，必须查库，不能让历史知识库回答。

### 1.1 专家建议分步执行表

这张表把后端架构、安全工程、产品体验和知识治理建议拆成可执行任务。状态默认按目标态记录，实际完成必须以代码、API、UI 和 E2E 证据为准。

| 阶段 | 目标 | 任务 | 主要落点 | 完成标准 | 验收用例 | 状态 |
|---|---|---|---|---|---|---|
| P0-1 | 固定 AI Gateway 入口 | 所有前端 AI 请求只走 `POST /api/ai/chat`，禁止前端直连 Hermes 或模型 | `frontend/src/services/ai.ts`、`backend/src/modules/ai/` | 请求必须带 JWT；后端写 AiCallLog/AuditLog；Hermes 只由后端调用 | 浏览器网络面板无模型直连；后端健康检查和 AI 请求均可追踪 | 已落地，持续校验 |
| P0-2 | 固定数据路由 | 实现 `AiDataRouteDecision`，显式区分 Direct、KB、Agent、dataRequests、Proposal | `ai-route.service.ts` 或 `ai.service.ts`、`ai.types.ts` | 每轮响应可审计 `route`、`reasonCode`、`blockedRoutes`、`requiresModelCall` | “我的积分可以兑换什么”走 `DIRECT_RESOURCE_RESPONSE`；“SQL 注入报告怎么写”可走 KB | 待代码确认 |
| P0-3 | 实时数据不被知识库抢答 | 积分、库存、兑换资格、漏洞状态、证书状态优先查实时 DB | `AiToolsService`、Direct Response handler、route handler | 命中实时业务语义时压制 KB direct answer，并记录 blockedRoutes | “我的漏洞状态”不能由历史知识回答；返回真实业务 ID | 待代码确认 |
| P0-4 | 写操作只生成提案 | 兑换、提交、审核、修改资料全部走 Action Proposal + 二次确认 | `ai.response.service.ts`、业务 controller/service | AI 不声称“已执行”；确认时后端重新鉴权、查库、事务写入 | “帮我兑换杯子”确认前无 redemption 记录；确认后写 AuditLog | 待代码确认 |
| P0-5 | cards/actions 白名单 | 模型输出的 `productId`、`vulnerabilityId`、`resourceId` 必须由后端白名单校验 | `ai.response.service.ts`、前端卡片 action handler | 只保留已注入上下文或 platformToolResults 中出现过的真实 ID | 构造伪造 ID 的模型输出应被过滤；前端不显示非法 action | 待代码确认 |
| P0-6 | 附件场景隔离 | 含 PDF/附件上下文时跳过 Direct Response 和 KB 直接回答 | `ai.report-draft.service.ts`、`ai.service.ts`、`UserAIAssistant.tsx` | 附件只作为当前轮上下文；不把原文直接沉淀入 KB | 上传 PDF 问“帮我修改报告”不得触发“我的漏洞列表”查询 | 待代码确认 |
| P0-7 | 同一问题多轮不丢上下文 | `/api/ai/chat` 读取当前用户 session 最近 turns 注入 Hermes messages | `AiProblemSessionService.getRecentChatTurnsForPrompt()`、`ai.service.ts` | 只加载当前用户拥有的 ACTIVE/AWAITING session；限制 turn 数和长度 | 两轮省略追问能正确引用上一轮问题；跨用户 session 403 | 已落地，需持续回归 |
| P1-1 | 用户可控地沉淀知识 | 用户明确点击“已解决，沉淀经验”后才进入总结/入库流程 | `UserAIAssistant.tsx`、`ai-problem-session.controller.ts` | 未解决、丢弃、仅离开页面的 session 不入库 | “不沉淀，结束对话”不会生成 READY_REVIEW summary | 已部分落地 |
| P1-2 | 结构化总结 | 将已解决 session 转成问题、环境、有效步骤、失败尝试、踩坑点、适用边界 | `ai-problem-session.service.ts`、Hermes summary prompt | 总结不包含敏感原文；字段完整；可被管理员审核 | 多轮排错后生成 summary，含 successfulSteps 和 pitfalls | 已部分落地 |
| P1-3 | 脱敏与拒绝入库 | Token、Cookie、API Key、内网 IP、真实资产、附件原文、跨用户数据禁止入库 | redaction service、safety checker、capture worker | 命中敏感规则时只保存最小摘要和拒绝原因 | 含 Authorization header 的会话进入拒绝/复审，不进入 APPROVED KB | 待加强 |
| P1-4 | AI+规则评分 | 计算质量、复用价值、安全、隐私、投毒、重复风险 | `AiKnowledgeScore`、capture worker | 低质量、隐私风险高、投毒风险高的总结不能自动入库 | 构造 prompt injection 样例，必须 reject 或 security review | 已部分落地 |
| P1-5 | 管理端审核队列 | 管理员能查看 READY_REVIEW、评分、脱敏摘要、相似知识和推荐操作 | `AdminAiKnowledgeManagement.tsx`、knowledge APIs | 支持通过、丢弃、合并建议、标为 Skill Candidate | 管理员通过后生成 `AiKnowledgeEntry`；丢弃写 AuditLog | 已部分落地 |
| P1-6 | Knowledge Hit 与来源 | KB 参与回答时写 hit，前端在 assistant bubble 内展示来源 | `AiKnowledgeHit`、`AiChatResponse`、`UserAIAssistant.tsx` | 返回 `usedKnowledge`、`knowledgeSources`、`knowledgeHitIds`、`assistantTurnId` | 高置信 KB 直答后底部显示“参考平台知识库” | 待代码确认 |
| P2-1 | 点赞/点踩持久化 | 每条 assistant 回复绑定 `assistantTurnId`，反馈写后端 | `turns/:turnId/feedback`、前端反馈条 | 反馈不只存在前端 state；可撤销/改投；写 AuditLog | 点踩“知识过期”能关联到对应 knowledge hit | 待实现 |
| P2-2 | 维护状态参与检索 | 检索前过滤 `maintenanceStatus` 和 retrievalPolicy | retrieval service、schema migration | `SECURITY_SUSPENDED`、`ARCHIVED`、`RETRIEVAL_DISABLED` 不参与普通检索 | 暂停知识即使相似度 0.99 也不会命中 | 待实现 |
| P2-3 | 维护任务 Worker | 根据点踩、举报、过期、冲突、重复创建维护任务 | `AiKnowledgeMaintenanceWorker`、maintenance APIs | 同一 dedupeKey 不重复创建 OPEN 任务；Worker 不自动高风险改写 | 高频点踩自动生成 LOW_QUALITY_REVIEW 任务 | 待实现 |
| P2-4 | Revision 与回滚 | 管理员修订、合并、恢复必须生成不可变 `AiKnowledgeRevision` | `AiKnowledgeRevision`、admin UI | 可查看版本 diff；可回滚；回滚写 AuditLog | 修改 KB 后生成 revision；回滚后旧版本可追踪 | 待实现 |
| P2-5 | 安全暂停闭环 | 安全风险、投毒、敏感泄露触发 `SECURITY_SUSPENDED` | security review APIs、admin UI | 暂停后普通用户不可检索；恢复必须管理员复核 | 点踩“存在安全风险”后知识从直答路径移除 | 待实现 |
| P3-1 | 语义问题族聚类 | 用 canonicalProblem、hybrid retrieval、embedding/reranker 聚类相似问题 | schema、pgvector/pg_trgm、cluster service | SAME_CLUSTER 高置信才参与自动入库；VARIANT/MERGE_REVIEW 阻断自动合并 | “Kali 下载链接”和“官网镜像在哪”归同类；SQLi 报告写作和靶场排错不误合并 | 待实现 |
| P3-2 | 自动入库硬阈值 | 高频、高质量、低风险、无 pending merge review 才自动入库 | `tryAutoApproveCluster()`、score service | resolved>=3、ask>=5、quality/reuse/safety/feedback 达标；隐私/重复风险不过线 | 不满足反馈或存在 merge review 的 cluster 不能 AUTO_APPROVED | 待加强 |
| P3-3 | Skill Candidate 晋升 | 只有长期稳定方法论可从 KB 生成 Skill Candidate | skill candidate service、admin UI | 不含实时数据、用户私有数据、一次性问答；管理员二次审批 | XSS 报告流程可晋升；“我的积分状态”不可晋升 | 已部分落地 |
| P3-4 | 受控安装平台 Hermes Skill | 审批后写入平台 Hermes bind mount 目录并记录安装日志 | `CQUPT_HERMES_SKILLS_ROOT`、install service | 目标为 `/home/cocking/cqupt-src-hermes-linux/platform-skills/cqupt-src`；不写 CLI Hermes | 安装后宿主文件存在，容器内可读，AiSkillInstallLog 有 hash | 已部分落地 |

执行顺序：先 P0 保证不会越权和错用实时数据，再 P1 打通沉淀链路，再 P2 做质量维护，最后 P3 做语义聚类和 Skill 晋升。

### 1.2 数据使用路由实施要求

`/api/ai/chat` 需要新增可审计的数据路由决策层，避免“所有数据都交给 AI”或“所有命中都直接返回”。

```text
routeAiDataUsage()
  -> DIRECT_RESOURCE_RESPONSE   # 实时业务数据，后端直接返回或补卡片
  -> KNOWLEDGE_DIRECT_ANSWER    # 高置信已审核知识，直接返回
  -> KNOWLEDGE_INJECTED_AGENT   # 中置信知识或需改写，注入 Agent
  -> AGENT_DATA_REQUEST         # Agent 请求更多只读数据，后端查库回灌
  -> NORMAL_AGENT               # 无确定性数据，正常 Agent
  -> ACTION_PROPOSAL            # 写操作只生成提案，业务 API 二次确认
```

#### 1.1.1 专家复核后的实施切分

| 专家视角 | 必须补齐的设计 | 代码落点 |
|---|---|---|
| 后端架构 | `AiDataRouteDecision` DTO、handler 分发、降级路径 | `backend/src/modules/ai/ai.service.ts` 或独立 `ai-route.service.ts` |
| 安全工程 | 实时数据优先、写操作 proposal、ID 白名单、RBAC 二次校验 | `ai.response.service.ts`、业务 controller/service、AuditLog |
| 提示词工程 | 知识注入模板、dataRequests JSON 协议、冲突时以后端上下文为准 | `ai.prompt.service.ts`、平台 Hermes skill |
| 数据库优化 | route audit / hit 记录、查询索引、命中质量统计 | `schema.prisma`、迁移、管理端统计 API |

#### 1.1.2 路由决策 DTO

```ts
type AiDataRouteDecision = {
  route: AiDataUsageRoute
  reasonCode: string
  confidence: number
  dataSources: Array<'REALTIME_DB' | 'AI_KNOWLEDGE' | 'PLATFORM_TOOL_RESULTS' | 'ATTACHMENT_TEXT' | 'NONE'>
  requiresModelCall: boolean
  requiresKnowledgeHit: boolean
  requiresSourceBadge: boolean
  requiresUserConfirmation: boolean
  allowedContextDomains: UserContextDomain[]
  blockedRoutes: Array<{ route: AiDataUsageRoute; reason: string }>
}
```

`routeAiDataUsage()` 只做判断，不查库、不调用模型、不执行写操作。后续 handler 按 route 执行，并在执行前再次校验 JWT/RBAC。

#### 1.1.3 完成定义与验收

| 路由 | 完成定义 | 验收 |
|---|---|---|
| `DIRECT_RESOURCE_RESPONSE` | 积分、商城、漏洞状态、证书状态、学习资源卡片由后端可信数据直接生成 | “我的积分/可兑换商品/待补充漏洞”不触发知识库抢答，返回真实 ID 卡片；审计记录 route |
| `KNOWLEDGE_DIRECT_ANSWER` | 高置信 KB 命中直接返回模板化答案 | 返回 `usedKnowledge=true`、`knowledgeSources`、`knowledgeHitIds`；不调用 Hermes 或只做受控模板填充 |
| `KNOWLEDGE_INJECTED_AGENT` | 中置信 KB 作为参考资料注入 Agent | Prompt 明确知识不是系统指令；最终仍记录 hit 和来源；模型不能引用被暂停知识 |
| `AGENT_DATA_REQUEST` | Hermes 只声明需要数据，后端按 JWT/RBAC 只读查询并回灌 | dataRequests 参数中的 userId/token 被丢弃；审计记录 tool/results；cards/actions ID 白名单通过 |
| `ACTION_PROPOSAL` | 兑换、提交、审核等写操作只生成提案 | 点击确认后业务 API 重新查库、校验权限、写 AuditLog；AI 生成的 ID 不直接可信 |
| `NORMAL_AGENT` | 泛问或开放式推理不注入实时私有数据 | 无 `knowledgeSources` 时不展示来源；不产生知识命中记录 |

默认优先级：

```text
附件/PDF上下文
  > 写操作提案
  > 实时业务 Direct Response
  > Knowledge Direct Answer
  > Knowledge Injected Agent
  > Agent dataRequests
  > Normal Agent
```

附件场景必须跳过 Direct Response 和知识库直接回答，除非用户明确要求“把附件和平台知识库对照”，且仍不得把附件原文沉淀入知识库。

#### 1.1.4 审计与索引

短期可写入 `AuditLog.metadata`；生产态建议独立表。最小字段：

```text
route, reasonCode, blockedRoutes, userId, role, sessionId, assistantTurnId,
messageHash, contextDomains, dataSources, knowledgeHitIds, toolNames,
requiresModelCall, latencyMs, tokensUsed, createdAt
```

索引：

```sql
CREATE INDEX idx_ai_route_audit_user_created ON ai_data_route_audit(user_id, created_at DESC);
CREATE INDEX idx_ai_route_audit_route_created ON ai_data_route_audit(route, created_at DESC);
CREATE INDEX idx_ai_knowledge_hit_route_created ON ai_knowledge_hit(route, created_at DESC);
```

#### 1.1.5 E2E 验收用例

| 用例 | 输入 | 必须证明 |
|---|---|---|
| 实时数据压制 KB | “我的积分可以兑换什么” | route 为 `DIRECT_RESOURCE_RESPONSE`，即使命中积分规则 KB 也不走知识库直接答 |
| 高置信 KB 直答 | “SQL 注入报告影响范围怎么写” | route 为 `KNOWLEDGE_DIRECT_ANSWER`，写 hit，展示来源 |
| 中置信 KB 注入 | “这个 SQLi 报告怎么写得更像平台规范” | route 为 `KNOWLEDGE_INJECTED_AGENT`，知识作为参考资料，不覆盖系统规则 |
| 附件跳过直答 | 上传 PDF 后问“帮我修改这份报告” | route 不得为 Direct/Knownledge Direct；不把 PDF 原文入库 |
| 写操作提案 | “帮我兑换这个杯子” | route 为 `ACTION_PROPOSAL`，确认前不创建兑换记录 |
| dataRequests 越权参数 | 模型请求带 userId/token | 后端丢弃参数，按当前 JWT 查询，审计记录清洗结果 |


---

## 2. 存储模型设计

### 2.1 Prisma enum

在 `database/prisma/schema.prisma` 增加：

```prisma
enum AiKnowledgeCategory {
  VULNERABILITY_REPORTING
  XSS
  SQL_INJECTION
  SSRF
  FILE_UPLOAD
  ACCESS_CONTROL
  AUTHENTICATION
  SECURITY_LEARNING
  SRC_RULES
  PLATFORM_USAGE
  AUDITOR_REVIEW
  ADMIN_ANALYTICS
}

enum AiKnowledgeRoleScope {
  STUDENT
  AUDITOR
  ADMIN
  ALL
}

enum AiKnowledgeVisibility {
  PRIVATE
  REVIEW_REQUIRED
  PLATFORM_PUBLIC
  ROLE_ONLY
}

enum AiKnowledgeSensitivity {
  PUBLIC
  INTERNAL
  SENSITIVE
  REJECTED
}

enum AiKnowledgeStatus {
  CANDIDATE
  AUTO_APPROVED
  NEEDS_REVIEW
  APPROVED
  REJECTED
  ARCHIVED
  PROMOTED_TO_SKILL
}

enum AiKnowledgeSource {
  USER_CHAT
  ADMIN_CREATED
  DOC_IMPORT
  SKILL_PROMOTION
}

enum AiKnowledgeFeedbackValue {
  HELPFUL
  UNHELPFUL
  REPORT_ABUSE
}

enum AiKnowledgeJobStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  DISCARDED
}

enum AiSkillCandidateStatus {
  DRAFT
  NEEDS_REVIEW
  APPROVED
  REJECTED
  INSTALLED
  FAILED
}
```

### 2.2 AiKnowledgeEntry

```prisma
model AiKnowledgeEntry {
  id                   String                 @id @default(cuid())
  title                String
  canonicalQuestion    String                 @db.Text
  canonicalAnswer      String                 @db.Text
  summary              String?                @db.Text

  category             AiKnowledgeCategory
  tags                 String[]
  roleScope            AiKnowledgeRoleScope
  visibility           AiKnowledgeVisibility
  sensitivity          AiKnowledgeSensitivity
  status               AiKnowledgeStatus      @default(CANDIDATE)
  source               AiKnowledgeSource      @default(USER_CHAT)

  sourceCallId         String?
  sourceUserId         String?
  sourceHash           String                 @unique
  sanitizedInputHash   String?
  similarityKey        String?

  embeddingModel       String?
  embeddingDimension   Int?
  embedding            Unsupported("vector")?
  embeddingJson        Json?

  generalityScore      Float                  @default(0)
  safetyScore          Float                  @default(0)
  privacyRiskScore     Float                  @default(1)
  educationalValueScore Float                 @default(0)
  reuseValueScore      Float                  @default(0)
  answerQualityScore   Float                  @default(0)
  platformRelevanceScore Float                @default(0)
  confidenceScore      Float                  @default(0)

  hitCount             Int                    @default(0)
  helpfulCount         Int                    @default(0)
  unhelpfulCount       Int                    @default(0)
  abuseReportCount     Int                    @default(0)

  promotedSkillId      String?
  reviewedById         String?
  reviewedAt           DateTime?
  reviewNote           String?                @db.Text

  createdAt            DateTime               @default(now())
  updatedAt            DateTime               @updatedAt
  archivedAt           DateTime?

  sourceUser           User?                  @relation("AiKnowledgeSourceUser", fields: [sourceUserId], references: [id])
  reviewedBy           User?                  @relation("AiKnowledgeReviewer", fields: [reviewedById], references: [id])
  hits                 AiKnowledgeHit[]
  feedbacks            AiKnowledgeFeedback[]
  revisions            AiKnowledgeRevision[]

  @@index([status, updatedAt])
  @@index([roleScope, status])
  @@index([category, status])
  @@index([sourceCallId])
  @@index([sourceUserId])
}
```

说明：

- `embedding Unsupported("vector")?` 是生产向量检索字段。
- `embeddingJson` 是兼容 fallback，防止 pgvector 尚未启用时无法落库。
- `sourceHash` 用于去重，基于脱敏后的 canonical question + answer + category 计算。
- `sourceUserId` 只用于内部审计，不向普通用户展示。

### 2.3 AiKnowledgeRevision

```prisma
model AiKnowledgeRevision {
  id                String            @id @default(cuid())
  knowledgeId       String
  editorId          String?
  title             String
  canonicalQuestion String            @db.Text
  canonicalAnswer   String            @db.Text
  changeReason      String?           @db.Text
  createdAt         DateTime          @default(now())

  knowledge         AiKnowledgeEntry  @relation(fields: [knowledgeId], references: [id], onDelete: Cascade)
  editor            User?             @relation("AiKnowledgeRevisionEditor", fields: [editorId], references: [id])

  @@index([knowledgeId, createdAt])
}
```

### 2.4 AiKnowledgeHit

```prisma
model AiKnowledgeHit {
  id             String                   @id @default(cuid())
  knowledgeId    String
  userId         String?
  aiSpace        AiSpace
  questionHash   String
  questionSummary String                  @db.Text
  similarity     Float
  route          String
  usedInResponse Boolean                  @default(false)
  createdAt      DateTime                 @default(now())

  knowledge      AiKnowledgeEntry         @relation(fields: [knowledgeId], references: [id], onDelete: Cascade)
  user           User?                    @relation("AiKnowledgeHitUser", fields: [userId], references: [id])

  @@index([knowledgeId, createdAt])
  @@index([userId, createdAt])
  @@index([aiSpace, createdAt])
}
```

### 2.5 AiKnowledgeFeedback

```prisma
model AiKnowledgeFeedback {
  id            String                   @id @default(cuid())
  knowledgeId   String
  userId        String?
  value         AiKnowledgeFeedbackValue
  note          String?                  @db.Text
  createdAt     DateTime                 @default(now())

  knowledge     AiKnowledgeEntry         @relation(fields: [knowledgeId], references: [id], onDelete: Cascade)
  user          User?                    @relation("AiKnowledgeFeedbackUser", fields: [userId], references: [id])

  @@index([knowledgeId, createdAt])
  @@index([userId, createdAt])
}
```

### 2.6 AiKnowledgeCaptureJob

MVP 不引入 Redis/BullMQ，先用数据库 outbox，避免增加部署复杂度；后续可平滑迁移到 BullMQ。

```prisma
model AiKnowledgeCaptureJob {
  id              String                @id @default(cuid())
  callId          String?
  userId          String?
  aiSpace         AiSpace
  questionSummary String                @db.Text
  answerSummary   String                @db.Text
  questionHash    String
  answerHash      String
  status          AiKnowledgeJobStatus  @default(PENDING)
  attempts        Int                   @default(0)
  error           String?               @db.Text
  processAfter    DateTime              @default(now())
  lockedAt        DateTime?
  lockedBy        String?
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt

  @@index([status, processAfter])
  @@index([callId])
  @@index([userId, createdAt])
}
```

### 2.7 AiSkillCandidate

```prisma
model AiSkillCandidate {
  id                 String                  @id @default(cuid())
  name               String                  @unique
  description        String
  content            String                  @db.Text
  sourceKnowledgeIds String[]
  roleScope          AiKnowledgeRoleScope
  status             AiSkillCandidateStatus  @default(DRAFT)
  reviewedById       String?
  reviewedAt         DateTime?
  reviewNote         String?                 @db.Text
  installedPath      String?
  installError       String?                 @db.Text
  createdAt          DateTime                @default(now())
  updatedAt          DateTime                @updatedAt

  reviewedBy         User?                   @relation("AiSkillCandidateReviewer", fields: [reviewedById], references: [id])
  installLogs        AiSkillInstallLog[]

  @@index([status, updatedAt])
  @@index([roleScope])
}
```

### 2.8 AiSkillInstallLog

```prisma
model AiSkillInstallLog {
  id              String             @id @default(cuid())
  candidateId     String
  operatorId      String?
  targetPath      String
  containerPath   String
  contentSha256   String
  success         Boolean
  error           String?            @db.Text
  createdAt       DateTime           @default(now())

  candidate       AiSkillCandidate   @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  operator        User?              @relation("AiSkillInstallOperator", fields: [operatorId], references: [id])

  @@index([candidateId, createdAt])
  @@index([operatorId, createdAt])
}
```

---

## 3. 服务模块设计

新增目录：

```text
backend/src/modules/ai-knowledge/
├── ai-knowledge.module.ts
├── ai-knowledge.controller.ts
├── ai-knowledge.admin.controller.ts
├── ai-knowledge.service.ts
├── ai-knowledge-analyzer.service.ts
├── ai-knowledge-redaction.service.ts
├── ai-knowledge-retrieval.service.ts
├── ai-knowledge-capture-worker.service.ts
├── ai-knowledge-promotion.service.ts
├── ai-knowledge-embedding.service.ts
├── ai-knowledge.types.ts
└── ai-knowledge.validation.ts
```

### 3.1 AiKnowledgeService

职责：

- 创建 capture job。
- 创建 / 更新知识条目。
- 状态流转：CANDIDATE / AUTO_APPROVED / NEEDS_REVIEW / APPROVED / REJECTED / ARCHIVED / PROMOTED_TO_SKILL。
- 管理命中次数与反馈计数。
- 管理管理员审核。
- 写 AuditLog。

### 3.2 AiKnowledgeAnalyzerService

职责：

- 判断是否值得沉淀。
- 输出分类、标签、角色范围、敏感等级、分数。
- 检测 prompt injection / poisoning。
- 决定初始状态。

核心输出：

```ts
export type AnalyzeKnowledgeResult = {
  shouldCapture: boolean
  initialStatus: 'AUTO_APPROVED' | 'NEEDS_REVIEW' | 'REJECTED'
  reason: string
  category: AiKnowledgeCategory
  sensitivity: AiKnowledgeSensitivity
  roleScope: AiKnowledgeRoleScope
  visibility: AiKnowledgeVisibility
  confidence: number
  suggestedTitle: string
  tags: string[]
  scores: {
    generality: number
    safety: number
    privacyRisk: number
    educationalValue: number
    reuseValue: number
    answerQuality: number
    platformRelevance: number
  }
}
```

### 3.3 AiKnowledgeRedactionService

职责：

- 移除 URL、IP、Cookie、Token、Authorization、学号、邮箱、手机号、漏洞编号、请求包敏感字段。
- 把具体问题泛化成 canonicalQuestion。
- 把具体回答泛化成 canonicalAnswer。
- 产出 `sourceHash`。

脱敏策略：

```text
真实域名 -> [授权测试资产]
内网 IP -> [内网地址]
Cookie / Token -> [敏感凭据已脱敏]
具体漏洞编号 -> [漏洞编号]
用户身份 -> [用户]
请求包敏感字段 -> [请求细节已脱敏]
```

### 3.4 AiKnowledgeRetrievalService

职责：

- 仅对通用专业安全 / 学习 / 报告写作问题启用。
- 不处理积分、商品、当前漏洞状态、证书状态等实时数据。
- 按角色过滤知识。
- 混合检索：向量相似度 + pg_trgm/关键词兜底 + 标签加权。
- 决定 `DIRECT_ANSWER` / `INJECT_AGENT` / `MISS`。

推荐阈值：

```text
similarity >= 0.88 且 status in (AUTO_APPROVED, APPROVED)：直接返回知识库答案
0.75 <= similarity < 0.88：注入 Agent 作为参考
similarity < 0.75：正常 Agent
```

### 3.5 AiKnowledgeEmbeddingService

职责：

- 封装 embedding provider，避免业务代码绑定某个供应商。
- 优先使用配置的 embedding API。
- 如果没有 embedding provider，MVP 使用 pg_trgm + 关键词检索，不阻塞上线。

环境变量建议：

```text
AI_KNOWLEDGE_CAPTURE_ENABLED=true
AI_KNOWLEDGE_RETRIEVAL_ENABLED=true
AI_KNOWLEDGE_EMBEDDING_PROVIDER=openai-compatible|none
AI_KNOWLEDGE_EMBEDDING_BASE_URL=http://localhost:5000/v1
AI_KNOWLEDGE_EMBEDDING_MODEL=text-embedding-3-small
AI_KNOWLEDGE_DIRECT_THRESHOLD=0.88
AI_KNOWLEDGE_INJECT_THRESHOLD=0.75
```

如果平台 Hermes 当前不提供 `/embeddings`，先设置：

```text
AI_KNOWLEDGE_EMBEDDING_PROVIDER=none
```

仍可用 PostgreSQL `pg_trgm` 和 `similarityKey` 做 MVP 检索。

### 3.6 AiKnowledgeCaptureWorkerService

MVP 用 NestJS 内置定时轮询数据库 outbox：

```text
每 15 秒扫描 AiKnowledgeCaptureJob PENDING
  -> 乐观锁 lockedAt / lockedBy
  -> PROCESSING
  -> analyze
  -> redact
  -> dedupe
  -> embed / similarityKey
  -> create AiKnowledgeEntry 或 discard
  -> COMPLETED / FAILED
```

失败重试：

```text
attempts < 3：指数退避
attempts >= 3：FAILED
敏感高风险：DISCARDED
```

后续要规模化时再引入 Redis + BullMQ。

### 3.7 AiKnowledgePromotionService

职责：

- 找出可晋升知识。
- 聚合同主题多条知识。
- 生成 SkillCandidateDraft。
- 管理员审核。
- 安装到平台 Hermes 容器。
- 重启 `hermes-agent` 或提示人工重启。

Skill 生成必须包含：

```text
frontmatter
When to Use
Decision Rules
Procedure
Safety Boundaries
Examples
Common Pitfalls
Verification Checklist
Source Knowledge IDs
```

---

## 4. AI Gateway 集成点

修改 `backend/src/modules/ai/ai.service.ts`。

### 4.1 聊天开始时增加 Knowledge Retrieval

位置：Direct Response 之后，Hermes Agent 之前。

当前流程片段：

```ts
const directResponse = buildDirectResourceResponse(input, context)
if (directResponse) { ... return directResponse }

const systemPrompt = buildSystemPrompt(...)
```

改为：

```ts
const directResponse = buildDirectResourceResponse(input, context)
if (directResponse) {
  await this.knowledgeService.enqueueCaptureIfEligible(...)
  return directResponse
}

const knowledgeDecision = await this.knowledgeRetrieval.retrieve({
  message: safeMessage,
  mode: input.mode,
  role: user.role,
  userId: user.id,
})

if (knowledgeDecision.route === 'DIRECT_ANSWER') {
  await this.knowledgeService.recordHit(...)
  await this.knowledgeService.enqueueCaptureIfEligible(...)
  return knowledgeDecision.response
}

const knowledgePrompt = knowledgeDecision.route === 'INJECT_AGENT'
  ? this.knowledgeRetrieval.buildPromptContext(knowledgeDecision.entries)
  : ''

const systemPrompt = buildSystemPrompt(
  input.mode,
  context,
  user.role,
  [this.skillRouter.buildPrompt(skillRoute), knowledgePrompt].filter(Boolean).join('\n\n'),
)
```

### 4.2 聊天完成后投递捕获任务

在 `AiCallLog` 创建后拿到 `callId`，投递 `AiKnowledgeCaptureJob`。

注意：现在 `ai.service.ts` 的 `tx.aiCallLog.create` 没保存返回值，实施时需要改成：

```ts
const callLog = await tx.aiCallLog.create({ data: ... })
```

然后事务后调用：

```ts
await this.knowledgeService.enqueueCapture({
  callId: callLog.id,
  userId: user.id,
  aiSpace: getAiSpace(input.mode),
  question: safeMessage,
  answer: displayContent,
})
```

Direct Response 是否沉淀：

- 积分 / 商品 / 当前漏洞列表：不沉淀。
- 报告写作模板 / 学习路径类 Direct Response：可以沉淀为 platform-default source 或跳过，因为它本身来自代码模板。
- 建议 MVP 先只捕获 Agent Response，避免把后端固定模板反复写入知识库。

---

## 5. API 设计

### 5.1 用户侧检索和反馈

```http
POST /api/ai/knowledge/retrieve
POST /api/ai/knowledge/:id/feedback
```

`retrieve` 初期只给内部 AI Gateway 调用，不暴露给普通前端页面。

反馈：

```json
{
  "value": "HELPFUL",
  "note": "回答有用"
}
```

### 5.2 管理员知识管理

```http
GET    /api/admin/ai/knowledge
GET    /api/admin/ai/knowledge/:id
POST   /api/admin/ai/knowledge/:id/approve
POST   /api/admin/ai/knowledge/:id/reject
POST   /api/admin/ai/knowledge/:id/archive
PATCH  /api/admin/ai/knowledge/:id
GET    /api/admin/ai/knowledge/:id/hits
```

### 5.3 Skill Candidate 管理

```http
POST /api/admin/ai/knowledge/:id/promote-skill
GET  /api/admin/ai/skill-candidates
GET  /api/admin/ai/skill-candidates/:id
POST /api/admin/ai/skill-candidates/:id/approve
POST /api/admin/ai/skill-candidates/:id/reject
POST /api/admin/ai/skill-candidates/:id/install
```

安装接口必须：

- 仅 ADMIN。
- 重新校验 candidate status。
- 校验 skill name：`^[a-z0-9][a-z0-9-]{2,63}$`。
- 写入 `AiSkillInstallLog`。
- 写入 `AuditLog`。
- 不在 HTTP 响应里返回 API key 或容器 env。

---

## 6. 管理端页面设计

新增页面：

```text
frontend/src/pages/admin/AdminAiKnowledgeManagement.tsx
frontend/src/pages/admin/AdminAiSkillCandidates.tsx
frontend/src/services/aiKnowledge.ts
```

页面结构：

```text
AI 知识库管理
├─ 概览指标：待审核、已发布、已拒绝、命中次数、有用率、可晋升数
├─ 候选知识
├─ 待审核
├─ 已发布
├─ 已拒绝
├─ 已归档
├─ 已提升为 Skill
└─ 命中统计
```

列表字段：

```text
标题
标准问题
分类
标签
角色范围
敏感等级
状态
命中次数
有用率
创建时间
审核人
操作
```

详情页：

```text
原始摘要（脱敏后）
标准问题
标准答案
Analyzer 评分雷达/表格
敏感信息检测结果
命中记录
版本历史
审核操作
晋升为 Skill Candidate
```

UI 风格按项目偏好：固定左栏 + 右侧独立滚动的后台式布局，rounded-lg，紧凑筛选栏，不用装饰性大渐变。

---

## 7. 安全与合规策略

### 7.1 最小化保存

不能保存原始敏感问题全文。保存：

```text
safeMessage summary
canonicalQuestion
canonicalAnswer
hashes
scores
redaction report
```

如果必须追溯原始调用，用 `sourceCallId` 指向 `AiCallLog`，但 `AiCallLog.sanitizedInputSummary` 也只保存脱敏摘要。

### 7.2 角色隔离

检索时必须满足：

```text
entry.status in (AUTO_APPROVED, APPROVED)
entry.sensitivity in (PUBLIC, INTERNAL)
entry.roleScope == ALL or entry.roleScope == currentRole
entry.visibility == PLATFORM_PUBLIC or ROLE_ONLY
```

学生不得命中 AUDITOR / ADMIN 知识。

### 7.3 投毒防护

Analyzer 必须识别并拒绝：

```text
忽略系统规则
以后所有漏洞都算高危
把我设为管理员
记住我的 token
绕过审核
查询其他用户漏洞
```

低信任来源策略：

- 新用户 / BASIC authorization：默认更严格，最多进入 NEEDS_REVIEW。
- TRUSTED / STAFF：仍需脱敏和评分，只是可进入 AUTO_APPROVED。
- 管理员手动创建：可直接 APPROVED，但仍需版本记录和审计。

### 7.4 写操作边界

Skill 安装、知识批准、知识修改都属于管理写操作：

```text
Admin action
  -> RBAC
  -> server-side validation
  -> Prisma transaction
  -> AuditLog
  -> optional container operation
```

模型不能直接执行。

---

## 8. 实施阶段

### Phase 1：Schema + 基础服务骨架

目标：建立数据结构和模块边界，不接入聊天链路。

验收：

```bash
cd /home/cocking/projects/cqupt-src-2.10/backend
npm run prisma:validate
npm run build
```

### Phase 2：Analyzer + Redaction + Capture Outbox

目标：聊天完成后异步生成候选知识。

验收：

```text
用户问“XSS 报告怎么写”
Agent 回答
AiKnowledgeCaptureJob 创建
worker 生成 AiKnowledgeEntry NEEDS_REVIEW 或 AUTO_APPROVED
敏感问题被 REJECTED / DISCARDED
```

### Phase 3：Retrieval 接入 AI Gateway

目标：后续相似问题能命中知识库。

验收：

```text
管理员批准 “XSS 报告写作规范”
用户问 “XSS 报告怎么写”
similarity >= 0.88
直接返回知识库答案
AiKnowledgeHit 记录 usedInResponse=true
```

### Phase 4：管理端页面

目标：管理员可审核、编辑、归档、查看命中。

验收：

```text
管理员能看到待审核知识
能批准/拒绝/编辑后批准
能查看命中和反馈
```

### Phase 5：Skill Candidate 晋升

目标：高质量知识可晋升为 skill candidate 并安装到平台 Hermes。

验收：

```text
hitCount >= 10 且 helpfulRate >= 80% 的 APPROVED 知识
管理员点击晋升
生成 SKILL.md draft
管理员批准并安装
容器内 /opt/data/skills/cqupt-src/<skill>/SKILL.md 存在
docker restart hermes-agent 后健康检查通过
```

---

## 9. 任务拆分

### Task 1: 增加 Prisma enum 和模型

**Objective:** 为知识库、反馈、捕获任务、skill candidate 建立数据库结构。

**Files:**
- Modify: `database/prisma/schema.prisma`

**Steps:**
1. 添加第 2 节 enums。
2. 添加 AiKnowledgeEntry 等模型。
3. 给 User 增加 relation 字段。
4. 如果使用 pgvector，migration SQL 中添加：

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

5. 运行：

```bash
cd backend
npm run prisma:validate
npm run prisma:generate
npm run build
```

### Task 2: 创建 ai-knowledge 模块骨架

**Files:**
- Create: `backend/src/modules/ai-knowledge/ai-knowledge.module.ts`
- Create: `backend/src/modules/ai-knowledge/ai-knowledge.types.ts`
- Create: `backend/src/modules/ai-knowledge/ai-knowledge.validation.ts`
- Create: service/controller files listed in section 3.
- Modify: `backend/src/app.module.ts` or parent module imports if needed.

**Verification:** `npm run build` passes.

### Task 3: 实现 Redaction Service

**Files:**
- Create: `backend/src/modules/ai-knowledge/ai-knowledge-redaction.service.ts`

**Test cases:**

```text
https://oa.xxx.edu.cn/admin/login -> [授权测试资产]
10.1.2.3 -> [内网地址]
SESSION=abc -> [敏感凭据已脱敏]
Authorization: Bearer xxx -> [敏感凭据已脱敏]
学号/手机号/邮箱 -> [身份信息已脱敏]
```

### Task 4: 实现 Analyzer Service

**Files:**
- Create: `backend/src/modules/ai-knowledge/ai-knowledge-analyzer.service.ts`

**Rules:**

```text
自动通过：generality>=0.7, educationalValue>=0.7, privacyRisk<=0.2, safety>=0.8, answerQuality>=0.75
需审核：0.2<privacyRisk<=0.6 或涉及漏洞细节/审核规则/平台内部流程
拒绝：privacyRisk>0.6 或 Token/Cookie/API Key/越权/投毒/未授权攻击
```

### Task 5: 实现 Capture Outbox 和 Worker

**Files:**
- Create: `backend/src/modules/ai-knowledge/ai-knowledge-capture-worker.service.ts`
- Modify: `backend/src/modules/ai/ai.service.ts`

**Verification:** Agent 回复后能创建 job，worker 处理成 entry。

### Task 6: 实现 Retrieval Service

**Files:**
- Create: `backend/src/modules/ai-knowledge/ai-knowledge-retrieval.service.ts`
- Create: `backend/src/modules/ai-knowledge/ai-knowledge-embedding.service.ts`
- Modify: `backend/src/modules/ai/ai.service.ts`

**Verification:** APPROVED 知识能在相似问题中被命中。

### Task 7: 实现 Admin API

**Files:**
- Create: `backend/src/modules/ai-knowledge/ai-knowledge.admin.controller.ts`
- Modify: RBAC permission seed if needed.

**Endpoints:** section 5.2 and 5.3.

### Task 8: 实现 Skill Promotion

**Files:**
- Create: `backend/src/modules/ai-knowledge/ai-knowledge-promotion.service.ts`

**Important:** 安装 skill 时不要直接依赖宿主 data 权限，优先通过 `docker exec` / `docker cp` 或手动运维脚本。

### Task 9: 实现前端管理页

**Files:**
- Create: `frontend/src/pages/admin/AdminAiKnowledgeManagement.tsx`
- Create: `frontend/src/pages/admin/AdminAiSkillCandidates.tsx`
- Create: `frontend/src/services/aiKnowledge.ts`
- Modify: `frontend/src/App.tsx` or routes.

**UI:** 后台式左右布局、右侧独立滚动、隐藏滚动条、rounded-lg。

### Task 10: 加入测试与验收脚本

**Files:**
- Create: `backend/test/ai-knowledge-redaction.spec.ts` if test framework is enabled later.
- Create: `scripts/test_ai_knowledge.py` or `tests/api/ai-knowledge-smoke.mjs`.

**Smoke cases:**

```text
1. XSS 报告怎么写 -> 可捕获
2. 包含 Cookie 的问题 -> 拒绝或 NEEDS_REVIEW
3. 我多少积分 -> 不走知识库，Direct Response
4. 已批准知识相似命中 -> Direct Answer
5. 学生不能命中 auditor/admin 知识
6. hitCount/helpfulRate 达标 -> 可晋升 skill candidate
```

---

## 10. 生产上线闸门

上线前必须满足：

```text
[ ] npm run prisma:validate pass
[ ] backend npm run build pass
[ ] frontend npm run build pass
[ ] Direct Response 仍优先于 Knowledge Retrieval
[ ] 敏感信息不会进入 canonicalQuestion/canonicalAnswer
[ ] 学生不能检索 auditor/admin 知识
[ ] 未审核知识不会用于用户回答
[ ] skill candidate 不能自动安装，必须 admin approve
[ ] skill 安装写 AuditLog 和 AiSkillInstallLog
[ ] Hermes 容器重启后 /health 正常
[ ] 回滚策略已验证：ARCHIVED 知识不再命中，skill 文件可撤回
```

---

## 11. 回滚策略

知识库回滚：

```text
APPROVED -> ARCHIVED
清除 retrieval cache
保留 revision 和 hit 记录
```

Skill 回滚：

```text
AiSkillCandidate.status = REJECTED or previous version
从 /opt/data/skills/cqupt-src/<skill-name> 移除或恢复旧 SKILL.md
docker restart hermes-agent
写 AiSkillInstallLog(success=true, action=rollback)
```

数据库迁移回滚：

- 生产环境不要 drop 表。
- 先通过 feature flag 关闭：

```text
AI_KNOWLEDGE_CAPTURE_ENABLED=false
AI_KNOWLEDGE_RETRIEVAL_ENABLED=false
```

---

## 12. 和现有文档的关系

本计划是实现级计划，补充：

```text
docs/AI.md
docs/AI_SKILLS.md
docs/AI_KNOWLEDGE_BASE.md
docs/HERMES_RUNTIME.md
```

后续完成代码后，应把实际接口和最终字段同步回：

```text
docs/api/AI_KNOWLEDGE_API.md
docs/security/AI_KNOWLEDGE_SECURITY.md
docs/architecture/AI_KNOWLEDGE_BASE.md
```

---

## 13. 一句话原则

```text
用户问答先进入可审核、可检索、可脱敏、可撤回的 PostgreSQL AI Knowledge Base；只有长期稳定、重复命中、高质量、管理员批准的方法论，才安装为平台 Hermes Skill。
```
