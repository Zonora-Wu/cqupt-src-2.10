# AI Context Injection 上下文注入规则

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-06-01 已按当前代码、运行环境和 AI 问题会话 Phase 2 进度更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、最小上下文 + dataRequests、AI Knowledge Base 问题会话生命周期、已解决会话总结、AI+规则评分、相似聚类、管理员审核、高频高质自动入库、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型路由为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 当前仍待实现/验收：Knowledge Retrieval 命中回答、来源标注写回、turn 级点赞/点踩持久化、语义问题族聚类（canonicalProblem + hybrid retrieval + embedding/reranker + merge review）、数据使用路由（直接返回 vs AI 处理）、问题会话 fork/archive/title 接口、maintenanceStatus/retrievalPolicy、维护任务 Worker、不可变 revision 回滚、知识投毒暂停与恢复闭环。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`docs/architecture/AI_PROBLEM_SESSION_KNOWLEDGE_CAPTURE.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

本文档记录 CQUPT-SRC AI Gateway 当前落地的上下文注入策略。目标是在 Hermes tool calling 尚未稳定启用前，采用“最小上下文 + Backend-hosted Agent Tool Gateway（dataRequests）”替代每轮全量注入：后端只注入必要摘要，Hermes 判断是否需要更多实时平台数据并输出结构化 dataRequests，由 NestJS 后端基于 JWT/RBAC 代为执行只读查询，再回灌结果让 Hermes 生成最终回复。

## 1. 当前阶段

当前采用折中方案：

```text
用户消息
  -> 后端 JWT / RBAC 校验
  -> 输入脱敏
  -> 后端轻量意图分类，得到 contextDomains
  -> AiToolsService.buildUserContext(user, { domains }) 实时查库并最小注入
  -> buildSystemPrompt 注入“已注入/未注入模块”与 dataRequests 协议
  -> Hermes Agent 第一轮：直接回答，或输出 {"dataRequests":[...]}
  -> AiDataRequestService 解析/校验 dataRequests
  -> 后端基于当前 JWT/RBAC 执行只读查询，生成 platformToolResults
  -> Hermes Agent 第二轮：基于 platformToolResults 生成最终回复与 cards/actions
  -> 后端解析、ID 白名单校验、卡片兜底补全、审计日志记录 contextDomains/dataRequests
```

说明：

- Agent 当前默认不接收 OpenAI tools，避免 Hermes Gateway 对 unknown tool / tool_calls 兼容不稳定导致超时。
- Hermes 可以“请求数据”，但不能“自己取数据”：不能 curl 后端、不能持有 JWT、不能访问数据库。
- NestJS 后端托管工具执行权，所有数据查询均以当前登录用户 JWT/RBAC 为准。
- `AI_DIRECT_RESOURCE_RESPONSE=true` 时保留兼容：后端强制构建完整上下文，让旧的 Direct Response 逻辑仍可工作。

### 1.1 数据使用路由：直接返回还是交给 AI

平台数据进入回复前，后端先产出 `AiDataRouteDecision`。这个决策是内部契约，不是模型提示词。模型只能在被允许的路由内工作。

```text
用户消息
  -> routeAiDataUsage()
       A. DIRECT_RESOURCE_RESPONSE  后端确定性直接返回
       B. KNOWLEDGE_DIRECT_ANSWER   平台知识库高置信直接返回
       C. KNOWLEDGE_INJECTED_AGENT  知识库作为参考资料注入 Hermes
       D. AGENT_DATA_REQUEST        Hermes 请求数据，后端查库后再让 Hermes 生成
       E. NORMAL_AGENT              不使用确定性平台数据
       F. ACTION_PROPOSAL           写操作只生成提案
```

决策 DTO 建议：

```ts
type AiDataRouteDecision = {
  route: AiDataUsageRoute
  reasonCode: string
  confidence: number
  dataSources: string[]
  requiresModelCall: boolean
  requiresKnowledgeHit: boolean
  requiresSourceBadge: boolean
  requiresUserConfirmation: boolean
  allowedContextDomains: UserContextDomain[]
  blockedRoutes: Array<{ route: AiDataUsageRoute; reason: string }>
}
```

决策原则：

| 路由 | 适用数据 | 是否需要 AI 处理 | 原因 |
|---|---|---|---|
| `DIRECT_RESOURCE_RESPONSE` | 当前积分、可兑换商品、真实库存、个人漏洞状态、证书状态、学习资源卡片 | 不需要 | 实时业务数据必须由后端查库和格式化，避免模型编造、漏卡片或越权 |
| `KNOWLEDGE_DIRECT_ANSWER` | 已审核知识库高置信命中，且用户问题只需要标准操作答案 | 不需要或只做模板填充 | 答案已脱敏、泛化、可复用；直接返回更快、更稳定 |
| `KNOWLEDGE_INJECTED_AGENT` | 中置信知识命中、需要解释、比较、改写、结合用户上下文组织语言 | 需要 | AI 负责表达和推理，后端提供受控参考资料 |
| `AGENT_DATA_REQUEST` | 初始上下文不足，模型需要更多只读平台数据才能回答 | 需要两轮 | 模型只能声明需要什么数据，后端按 JWT/RBAC 查询后回灌 |
| `NORMAL_AGENT` | 泛问、方法论、无平台数据依赖的问题 | 需要 | 不消耗实时数据和知识命中 |
| `ACTION_PROPOSAL` | 兑换、提交、审核、修改等写操作意图 | 需要或不需要 | AI 只生成草稿/提案，最终写入由业务 API 二次确认 |

优先级固定：

```text
附件/PDF上下文
  > 写操作提案
  > 实时业务 Direct Response
  > Knowledge Direct Answer
  > Knowledge Injected Agent
  > Agent dataRequests
  > Normal Agent
```

硬性规则：

- 实时个人业务数据优先后端直接返回或后端补卡片，不让知识库抢答。
- 写操作不能由 AI 直接执行。兑换、提交、审核、修改资料必须走业务 API、二次确认和重新查库。
- 卡片/action 的真实 ID 只能来自已注入上下文或 `platformToolResults`，不能相信模型生成的 ID。
- 附件/PDF 场景默认走 `KNOWLEDGE_INJECTED_AGENT` 或 `NORMAL_AGENT` 的附件上下文变体，跳过 Direct Response 和知识库直接回答。
- 知识库高置信直接回答必须返回 `usedKnowledge=true`、`knowledgeSources`，并写 `AiKnowledgeHit` 或同等审计记录。
- 管理员可配置 `knowledgeUsageStrength = 1..10` 调整知识库参与度；该值只解析为直答/注入阈值、topK、来源展示和审计策略，不得绕过权限、实时数据优先、附件阻断、写操作确认和维护状态过滤。详细方案见 `docs/AI_KNOWLEDGE_BASE.md` 的“管理员知识库使用强度（1-10 档）”。
- 每次路由决策都写审计：route、reasonCode、blockedRoutes、contextDomains、knowledgeHitIds、toolNames、latencyMs、tokensUsed。


## 2. 可注入模块

`UserContextDomain` 当前为四类：

```ts
type UserContextDomain = 'points' | 'mall' | 'vulnerabilities' | 'learning'
```

| 模块 | 触发场景 | 注入数据 | 当前上限 |
|---|---|---|---|
| `points` | 询问“我的积分/余额/够不够”等 | balance、earned、spent、pendingRedemptions | 1 份摘要 |
| `mall` | 询问商城、兑换、商品、价格过滤、具体商品关键词 | 可见商品、真实商品 ID、价格、库存、限购、canRedeem、hasImage | 20 个商品 |
| `vulnerabilities` | 询问“我的漏洞/我的报告/待补充/审核状态/证书”等 | 当前用户漏洞统计与近期报告真实 ID | 10 条近期报告 |
| `learning` | 询问平台内学习资源、靶场、教程、资料、课程 | 平台可见学习资源真实 ID、标题、分类、kind、description 摘要 | 12 个资源（优先完整覆盖靶场） |

`mall` 会同时查询积分，因为兑换卡片需要 `userBalance` 与 `remainingAfterRedeem`。完整 `imageUrl`（尤其是 data URL / base64 图片）不得进入模型 prompt 或 `platformToolResults`；模型只看到 `hasImage`，最终 API 响应中的商品图片由后端按真实商品 ID 在卡片补全阶段回填。

## 3. 不注入规则

以下情况默认不注入实时业务数据：

1. 问候、平台概念、SRC 方法论、漏洞报告写作等泛问。
2. 附件/PDF 场景：附件上下文优先，避免“报告/漏洞”等词把用户的 PDF 总结或修改请求误判为个人漏洞列表查询。
3. 审核员/管理员 mode：`UserContextSnapshot` 仍只承载学生域数据；审核/管理实时统计通过 dataRequests 的只读工具按需查询。

未注入不代表数据为空。Prompt 中必须明确告诉模型：未注入模块不能被回答成“没有数据”，也不能编造。

## 4. 意图分类规则

当前分类由 `backend/src/modules/ai/ai.service.ts` 的 `selectContextDomains()` 完成：

- `hasPersonalPointIntent()` -> `points`
- `hasMallBrowseIntent()` / `hasPriceFilterIntent()` / `extractProductKeywords()` -> `points + mall`，但明确靶场/学习意图优先，不把“SQL 注入靶场”等关键词误判为商品搜索
- `hasUserVulnerabilityListIntent()` -> `vulnerabilities`
- `hasLearningResourceIntent()` -> `learning`
- `hasUserSummaryIntent()` -> `points + vulnerabilities`
- `hasAttachmentContext` -> `[]`
- `forceFullContext`（Direct Response 兼容开关）-> 全部模块

这层分类只做粗粒度模块选择，不做最终业务判断；最终回复仍由 Agent 基于已注入数据和 skill prompt 生成。对于平台内靶场推荐，后端还会在结构化补全阶段按真实学习资源 ID 兜底补齐 `LEARNING_RESOURCE` 卡片和 `OPEN_LEARNING_RESOURCE` action，避免模型漏卡片、混入资料类资源或输出前端无法绑定的 action payload。

## 5. Prompt 与 dataRequests 约束

`backend/src/modules/ai/ai.prompt.service.ts` 与 `AiDataRequestService.buildPrompt()` 会在 system prompt 中注入：

- 已注入模块列表。
- 未注入模块列表。
- “未注入不代表不存在”的约束。
- OpenAI `tool_calls` 当前不启用的说明。
- `dataRequests` JSON 协议：模型只能请求，不能自行取数。
- 可请求的只读工具清单与参数 schema。
- 卡片只能引用已注入真实 ID 或 `platformToolResults` 真实 ID 的约束。

当 `mall` 未注入且没有 `search_mall_products/get_redeem_eligibility` 结果时，模型不能输出商品卡片；当 `learning` 未注入且没有 `search_learning_resources` 结果时，模型不能输出平台学习资源卡片；当 `vulnerabilities` 未注入且没有漏洞查询结果时，模型不能输出个人漏洞卡片。

`dataRequests` 示例：

```json
{"dataRequests":[{"tool":"search_learning_resources","arguments":{"keyword":"SQL注入","kind":"RANGE"},"reason":"用户需要平台内 SQL 注入靶场"}]}
```

## 6. 安全边界

- 数据查询必须以后端 JWT 用户为准，不信任用户消息或模型传入的 userId。
- `dataRequests.arguments` 中的 `userId`、`role`、`permission`、`jwt`、`token` 等字段会被丢弃；后端强制覆盖当前用户身份。
- dataRequests 只允许调用 `ai.tools.registry.ts` 中按角色开放的只读工具；写操作仍必须走业务 API 和二次确认。
- 不注入密码、token、API key、完整手机号/邮箱、其他用户数据、原始 PDF 全文、敏感请求包、Cookie、内网资产细节。
- Agent 输出的卡片/action 只是展示和提案；兑换、查看、提交、审核等写操作仍必须由后端重新查库校验权限、库存、积分、状态并写 AuditLog。
- 后端会对最终 cards/actions 做 ID 白名单校验：只保留已注入上下文或 `platformToolResults` 中真实出现过的商品、学习资源、漏洞 ID。
- 审计日志记录 `contextDomains`、`dataRequests` 和 `dataRequestResults`，便于复盘某次回复使用了哪些实时数据。

## 7. 验证用例

后端构建：

```bash
cd backend && npm run build
```

推荐人工用例：

| 用户消息 | 预期 contextDomains |
|---|---|
| `你好` | `[]` |
| `我的积分还有多少` | `['points']` |
| `我能兑换什么` | `['points','mall']` |
| `推荐 400 积分以下商品` | `['points','mall']` |
| `我有哪些待补充漏洞` | `['vulnerabilities']` |
| `推荐平台靶场` | `['learning']` |
| `推荐一个SQL注入靶场` | `['learning']`，返回 sqli-labs 等 RANGE 卡片 |
| `我想练习XSS靶场` | `['learning']`，返回包含 XSS 模块的 RANGE 卡片 |
| `我的平台概览` | `['points','vulnerabilities']` |
| 带 PDF 附件的“帮我总结这份报告” | `[]`，仅使用附件上下文 |
| `我的积分可以兑换什么` | 后端直接返回或后端补齐商品卡片，不让知识库回答 |
| `SQL 注入报告影响范围怎么写` | 优先 Knowledge Retrieval；高置信直接返回，中置信注入 Agent |
| `结合我这份 PDF 帮我改报告` | 附件上下文 + Agent，不走知识库直接回答 |

## 8. 后续演进

1. 已落地 Backend-hosted Agent Tool Gateway：`AiDataRequestService` 解析/校验 dataRequests，后端执行只读查询并回灌 `platformToolResults`。
2. 已创建平台 Hermes skill：`/home/cocking/cqupt-src-hermes-linux/platform-skills/cqupt-src/cqupt-src-platform-data-request/SKILL.md`。
3. 继续观察平台 Hermes OpenAI-compatible `/v1/chat/completions` 对 `tools` / `tool_calls` 的稳定性；稳定后可从 dataRequests 协议平滑迁移到原生 function calling。
4. 扩展 `search_mall_products` 参数：`minPoints`、`maxPoints`、`canRedeem`、`category`。
5. 为 `selectContextDomains()`、`AiDataRequestService.parse()` 和卡片白名单校验增加单元测试或 API smoke 用例，覆盖商城、学习、漏洞、附件、泛问和恶意越权请求。
