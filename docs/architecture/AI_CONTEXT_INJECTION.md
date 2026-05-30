# AI Context Injection 上下文注入规则

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

## 2. 可注入模块

`UserContextDomain` 当前为四类：

```ts
type UserContextDomain = 'points' | 'mall' | 'vulnerabilities' | 'learning'
```

| 模块 | 触发场景 | 注入数据 | 当前上限 |
|---|---|---|---|
| `points` | 询问“我的积分/余额/够不够”等 | balance、earned、spent、pendingRedemptions | 1 份摘要 |
| `mall` | 询问商城、兑换、商品、价格过滤、具体商品关键词 | 可见商品、真实商品 ID、价格、库存、限购、canRedeem、imageUrl | 20 个商品 |
| `vulnerabilities` | 询问“我的漏洞/我的报告/待补充/审核状态/证书”等 | 当前用户漏洞统计与近期报告真实 ID | 10 条近期报告 |
| `learning` | 询问平台内学习资源、靶场、教程、资料、课程 | 平台可见学习资源真实 ID、标题、分类、kind | 8 个资源 |

`mall` 会同时查询积分，因为兑换卡片需要 `userBalance` 与 `remainingAfterRedeem`。

## 3. 不注入规则

以下情况默认不注入实时业务数据：

1. 问候、平台概念、SRC 方法论、漏洞报告写作等泛问。
2. 附件/PDF 场景：附件上下文优先，避免“报告/漏洞”等词把用户的 PDF 总结或修改请求误判为个人漏洞列表查询。
3. 审核员/管理员 mode：`UserContextSnapshot` 仍只承载学生域数据；审核/管理实时统计通过 dataRequests 的只读工具按需查询。

未注入不代表数据为空。Prompt 中必须明确告诉模型：未注入模块不能被回答成“没有数据”，也不能编造。

## 4. 意图分类规则

当前分类由 `backend/src/modules/ai/ai.service.ts` 的 `selectContextDomains()` 完成：

- `hasPersonalPointIntent()` -> `points`
- `hasMallBrowseIntent()` / `hasPriceFilterIntent()` / `extractProductKeywords()` -> `points + mall`
- `hasUserVulnerabilityListIntent()` -> `vulnerabilities`
- `hasLearningResourceIntent()` -> `learning`
- `hasUserSummaryIntent()` -> `points + vulnerabilities`
- `hasAttachmentContext` -> `[]`
- `forceFullContext`（Direct Response 兼容开关）-> 全部模块

这层分类只做粗粒度模块选择，不做最终业务判断；最终回复仍由 Agent 基于已注入数据和 skill prompt 生成。

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
| `我的平台概览` | `['points','vulnerabilities']` |
| 带 PDF 附件的“帮我总结这份报告” | `[]`，仅使用附件上下文 |

## 8. 后续演进

1. 已落地 Backend-hosted Agent Tool Gateway：`AiDataRequestService` 解析/校验 dataRequests，后端执行只读查询并回灌 `platformToolResults`。
2. 已创建平台 Hermes skill：`/home/cocking/cqupt-src-hermes-linux/platform-skills/cqupt-src/cqupt-src-platform-data-request/SKILL.md`。
3. 继续观察平台 Hermes OpenAI-compatible `/v1/chat/completions` 对 `tools` / `tool_calls` 的稳定性；稳定后可从 dataRequests 协议平滑迁移到原生 function calling。
4. 扩展 `search_mall_products` 参数：`minPoints`、`maxPoints`、`canRedeem`、`category`。
5. 为 `selectContextDomains()`、`AiDataRequestService.parse()` 和卡片白名单校验增加单元测试或 API smoke 用例，覆盖商城、学习、漏洞、附件、泛问和恶意越权请求。
