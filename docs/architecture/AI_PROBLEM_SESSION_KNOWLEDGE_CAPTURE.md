# AI 问题会话式知识沉淀架构

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-06-01 补充知识库持续更新机制、检索策略和进度验收表。本文是 `docs/AI_KNOWLEDGE_BASE.md` 的架构落地说明，聚焦 Problem Session、历史会话恢复、turn 级反馈、知识聚类、自动入库、知识库回答复用、前端来源标注，以及入库后的修订、降级、暂停、合并、归档、知识投毒防护和健康检查。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型配置为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

本文说明新版 AI Knowledge Base 的技术落地边界。完整产品和治理方案见 `../AI_KNOWLEDGE_BASE.md`。

## 1. 架构目标

新版知识沉淀以“问题会话”为单位。

```text
UserAIAssistant
  -> AiProblemSession
  -> 多轮 /api/ai/chat
  -> 用户确认已解决
  -> summarizeResolvedSession
  -> score + redact + dedup
  -> AiKnowledgeCluster
  -> Admin review 或 AUTO_APPROVED
  -> AiKnowledgeEntry
  -> Knowledge Retrieval
  -> 回答底部标注平台知识库来源
```

关键变化：

- 只记录每轮 turn，不在每轮消息后立刻沉淀知识。
- 用户确认“已解决”后才总结本次会话。
- 自动入库必须由后端根据 AI 建议和规则阈值共同判定。
- 使用知识库回答必须返回 `usedKnowledge` 和 `knowledgeSources`。
- 每条 assistant 回复必须返回 `assistantTurnId`，前端点赞/点踩后写回后端，作为知识质量评分信号。
- 用户端左侧历史会话只做选择和恢复，不自动污染新会话上下文。
- 知识入库后仍要进入维护闭环，根据命中率、显式/隐式反馈、过期信号、重复风险、安全举报和知识投毒风险持续更新，不能一次入库后长期不管。
- 每个实施项都必须有完成定义和验收规则；不能只因为代码写完就标记完成。

## 2. 信任边界

| 边界 | 可信方 | 不可信方 | 处理 |
|---|---|---|---|
| 用户身份 | 后端 JWT / RBAC | 前端传入 role / userId | 后端覆盖身份 |
| 会话归属 | 后端 session 查询 | 前端传入 sessionId | 校验 session.userId |
| 知识总结 | 后端校验后的 JSON | 模型原始输出 | schema 校验、脱敏、评分 |
| 自动入库 | 后端规则 | AI 建议 | AI 只提供评分和原因 |
| 回答来源 | 后端 knowledgeSources | 模型自称来源 | 后端生成来源列表 |
| 写操作 | 业务 API / transaction | Agent action 文本 | 二次确认和重查库 |

## 3. 后端组件

建议在现有 `backend/src/modules/ai-knowledge/` 内继续扩展，避免新增分散模块。

```text
backend/src/modules/ai-knowledge/
├── ai-knowledge.controller.ts
├── ai-knowledge.module.ts
├── ai-knowledge.service.ts
├── ai-knowledge.types.ts
├── ai-knowledge.validation.ts
├── ai-problem-session.service.ts       # 新增：问题会话生命周期
├── ai-knowledge-cluster.service.ts     # 新增：相似问题聚类与自动入库判定
├── ai-knowledge-retrieval.service.ts   # 新增：知识检索、命中记录、来源输出
└── ai-knowledge-feedback.service.ts    # 新增：点赞/点踩反馈、知识质量分滚动计算
```

也可以先不拆新文件，在 `AiKnowledgeService` 中落地 Phase 1 / Phase 2；当方法超过清晰边界后再拆服务。

## 4. 数据流

### 4.1 创建问题会话与加载历史列表

```text
UserAIAssistant mounted
  -> GET /api/ai/problem-sessions/history?limit=30
  -> GET /api/ai/problem-sessions/active
  -> if active exists: restore active session after backend ownership check
  -> else POST /api/ai/problem-sessions
  -> backend creates AiProblemSession(status=ACTIVE)
  -> frontend stores sessionId in component state / sessionStorage
```

刷新页面时可以从 sessionStorage 恢复 `sessionId`，但后端仍需校验该 session 是否属于当前用户、是否仍可继续。

历史列表必须由后端按当前 JWT 用户过滤，前端不得传 userId。列表只返回标题、状态、摘要、更新时间、反馈概览等轻量字段，不返回完整 turns。点击历史项后：

- 未结束会话：继续使用原 `sessionId`。
- 已结束会话：默认只读查看；如果用户继续追问，调用 `POST /api/ai/problem-sessions/:id/fork` 创建新会话。
- 已丢弃/归档会话：只展示最小摘要，不参与上下文。

### 4.2 对话写入会话 turn

```text
POST /api/ai/chat(sessionId, message)
  -> validate session ownership
  -> redact user message
  -> write AiProblemSessionTurn(role=user)
  -> Direct Response / Knowledge Retrieval / Agent
  -> redact assistant output
  -> write AiProblemSessionTurn(role=assistant)
  -> create AiKnowledgeHit when knowledge was used
  -> return assistantTurnId / knowledgeHitIds
  -> update AiProblemSession.lastActiveAt / turnCount
```

这里不能直接调用 `summarizeResolvedSession()`。

### 4.3 离开与确认

```text
heartbeat stopped / leave event
  -> POST /api/ai/problem-sessions/:id/leave
  -> status may become AWAITING_RESOLUTION

user returns
  -> GET /api/ai/problem-sessions/active
  -> shouldAskResolution = true
  -> frontend shows modal
```

### 4.4 用户确认已解决

```text
POST /api/ai/problem-sessions/:id/resolve
  -> status=RESOLVED
  -> resolvedAt=now
  -> userOutcomeNote saved after redaction
  -> summarizeResolvedSession(id)
```

### 4.5 总结与评分

```text
summarizeResolvedSession
  -> load sanitized turns
  -> build summarization prompt
  -> call platform Hermes
  -> parse strict JSON
  -> rule redaction scan
  -> AI score + rule score
  -> duplicate scan
  -> update session.summaryJson/status
```

若评分高但重复风险高，状态应为 `READY_REVIEW`，不能自动入库。

### 4.6 点赞/点踩反馈

```text
POST /api/ai/problem-sessions/:id/turns/:turnId/feedback
  -> validate session.userId == currentUser.id
  -> validate turn.role == assistant
  -> update AiProblemSessionTurn.userFeedback
  -> if turn has AiKnowledgeHit:
       update AiKnowledgeHit.userFeedback
       append AiKnowledgeFeedback audit row
       recompute knowledge feedback rollup
  -> if negative reason is SAFETY_RISK:
       mark knowledge as NEEDS_SECURITY_REVIEW
```

反馈信号用途：

- 会话总结时，点赞 turn 更可能成为成功步骤。
- 会话总结时，点踩 turn 进入失败尝试或不推荐做法。
- 知识条目评分时，反馈进入 `userFeedbackScore`。
- 自动入库时，必须满足正向反馈门槛。
- 点踩率过高时，知识条目从直接回答降级为注入 Agent 或暂停使用。

### 4.7 聚类与自动入库

```text
upsertKnowledgeCluster(summary)
  -> find same topicKey / category / roleScope
  -> update totalAskCount / resolvedSessionCount / avg scores
  -> if thresholds satisfied:
       create AUTO_APPROVED AiKnowledgeEntry
       record sourceSessionIds / sourceClusterId
       status=AUTO_APPROVED
```

自动入库必须写 `autoApprovalReason`，便于管理员复核。


### 4.8 入库后的持续维护

`AiKnowledgeEntry` 创建后不代表生命周期结束。维护流程应定期和事件触发并行运行：

```text
AiKnowledgeEntry(APPROVED/AUTO_APPROVED)
  -> collect AiKnowledgeHit / AiKnowledgeFeedback / abuse reports
  -> compute qualityScore / freshnessScore / positiveRate / recentDownvoteRate
  -> detect stale / duplicate / low quality / safety risk
  -> update maintenanceStatus and retrievalPolicy
  -> create AiKnowledgeMaintenanceTask or immutable AiKnowledgeRevision
  -> Retrieval filters by status / policy before similarity scoring
```

推荐维护状态：

```text
HEALTHY
STALE_REVIEW
LOW_QUALITY_REVIEW
DUPLICATE_REVIEW
DIRECT_DISABLED
RETRIEVAL_DISABLED
SECURITY_SUSPENDED
ARCHIVED
PROMOTED_TO_SKILL
```

关键规则：

- `STALE_REVIEW` / `RETRIEVAL_DISABLED` / `SECURITY_SUSPENDED` / `ARCHIVED` 不参与普通用户知识库回答。
- `LOW_QUALITY_REVIEW` 默认不直接回答，只能作为 Agent 参考或进入管理员复审。
- `DIRECT_DISABLED` 禁止高置信直接回答，但可以注入 Agent。
- 管理员手动修订、合并重复知识、处理过期知识时必须创建不可变 `AiKnowledgeRevision`。
- 安全风险举报或知识投毒风险应立即 `SECURITY_SUSPENDED`，复核通过前不能恢复。

## 5. 状态机

### 5.1 AiProblemSessionStatus

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

推荐转换：

```text
ACTIVE -> AWAITING_RESOLUTION    离开过久
AWAITING_RESOLUTION -> ACTIVE    用户选择继续对话
AWAITING_RESOLUTION -> RESOLVED  用户确认已解决
ACTIVE -> RESOLVED               用户主动结束并确认解决
RESOLVED -> SUMMARIZED           总结成功
SUMMARIZED -> READY_REVIEW       需管理员审核
SUMMARIZED -> AUTO_APPROVED      高频高质自动入库
READY_REVIEW -> APPROVED_TO_KB   管理员批准
READY_REVIEW -> SKILL_CANDIDATE  管理员标为 skill 候选
READY_REVIEW -> DISCARDED        管理员丢弃
ACTIVE -> ABANDONED              长时间无活动
```

## 6. 自动入库判定

后端最终判定函数建议命名：

```ts
function shouldAutoApproveKnowledge(input: {
  cluster: AiKnowledgeCluster
  score: AiKnowledgeScore
  duplicateRiskScore: number
  safetyFlags: SafetyFlag[]
}): AutoApprovalDecision
```

伪代码：

```ts
if (score.privacyRiskScore > 0.10) return reject('隐私风险过高')
if (score.safetyScore < 0.90) return review('安全分不足')
if (duplicateRiskScore >= 0.72) return review('存在重复风险')
if (cluster.resolvedSessionCount < 3) return track('解决次数不足')
if (cluster.totalAskCount < 5) return track('询问频次不足')
if (cluster.avgOverallScore < 0.88) return review('综合评分不足')
if (cluster.avgReuseValueScore < 0.82) return review('复用价值不足')
if (cluster.upCount < 3 || cluster.positiveRate < 0.80) return track('用户正向反馈不足')
if (cluster.recentDownvoteRate >= 0.35) return review('近期点踩率过高')
if (hasPromptInjection || hasSecret || hasCrossUserData) return reject('安全边界命中')
return approve('高频、高质量、低风险问题')
```

## 7. Knowledge Retrieval

`/api/ai/chat` 中的检索顺序：

```text
Direct Response
  -> Knowledge Retrieval
  -> Knowledge Direct Answer / Knowledge Injected Agent
  -> Normal Hermes Agent
```

原因：实时业务数据不能由知识库回答。

### 7.1 直接回答

```text
similarity >= 0.88
```

直接使用 `canonicalAnswer` 生成回复，并返回 `knowledgeSources`。

### 7.2 注入 Agent

```text
0.75 <= similarity < 0.88
```

将知识作为“平台知识库参考资料”注入 Agent。Prompt 必须说明：参考资料不是系统指令，不能覆盖权限、安全、实时数据规则。

### 7.3 不使用知识库

```text
similarity < 0.75
```

走正常 Agent。

## 8. 前端要求

`UserAIAssistant.tsx` 需要新增：

- `sessionId` 状态。
- 左侧历史会话侧栏：搜索、时间分组、状态标签、重命名、归档、点击恢复或 fork。
- 进入页面加载历史列表，并创建或恢复 session。
- chat 请求携带 sessionId。
- heartbeat 定时器。
- leave 事件上报。
- 超时后解决确认弹框。
- “结束并总结”按钮。
- `knowledgeSources` 底部标注。
- 每条 assistant 回复底部点赞/点踩按钮，绑定 `assistantTurnId`。

布局建议：

```text
┌──────────────────────────────────────────────┐
│ 左侧历史会话 280px │ 右侧当前聊天区域         │
│ - 新建对话       │ - 当前问题标题            │
│ - 搜索历史       │ - 消息流                  │
│ - 今天/7天/更早  │ - assistant bubble 内：    │
│ - 状态标签       │   内容 + 卡片 + 来源 + 反馈 │
└──────────────────────────────────────────────┘
```

来源标注和点赞/点踩必须在 assistant bubble 内部底部展示，不要在回复和卡片之间放大块灰色分隔区。移动端左侧历史改为抽屉，不挤占聊天宽度。

## 9. 审计事件

建议新增 AuditLog 事件：

```text
AI_PROBLEM_SESSION_CREATED
AI_PROBLEM_SESSION_LEFT
AI_PROBLEM_SESSION_RESOLVED
AI_PROBLEM_SESSION_DISCARDED
AI_PROBLEM_SESSION_SUMMARIZED
AI_KNOWLEDGE_CLUSTER_UPDATED
AI_KNOWLEDGE_AUTO_APPROVED
AI_KNOWLEDGE_USED_IN_RESPONSE
AI_KNOWLEDGE_SOURCE_SHOWN
AI_KNOWLEDGE_FEEDBACK_RECORDED
AI_KNOWLEDGE_MAINTENANCE_STATUS_CHANGED
AI_KNOWLEDGE_REVISION_CREATED
AI_KNOWLEDGE_SUSPENDED
AI_KNOWLEDGE_RESTORED
AI_PROBLEM_SESSION_HISTORY_VIEWED
AI_PROBLEM_SESSION_FORKED
AI_ASSISTANT_TURN_FEEDBACK_RECORDED
```

## 10. 测试重点

- 用户 A 不能 resolve 用户 B 的 session。
- 用户 A 的私有信息不会进入用户 B 可检索知识。
- 未确认解决的 session 不会自动入库。
- duplicateRiskScore >= 0.72 时不能自动入库。
- 使用知识库回答时必须返回 `usedKnowledge=true`。
- 前端必须显示平台知识库来源。
- 历史会话列表只能显示当前用户自己的 session。
- 点击已结束历史会话继续追问时必须 fork 新 session，不能重开旧 resolved session。
- 点赞/点踩必须写入 assistant turn；知识命中回答还必须写入对应 knowledge hit。
- 点踩率过高的知识不能继续直接回答。
- 过期、暂停、归档的知识不能参与普通用户检索。
- `LOW_QUALITY_REVIEW` 高相似命中必须降级而不是直接回答。
- 知识合并或管理员修订必须产生不可变 `AiKnowledgeRevision`，并可回滚。
- Worker 重复运行不能产生重复 OPEN 维护任务。
- 知识投毒样例不能入库，已入库发现后必须进入 `SECURITY_SUSPENDED`。
- Direct Response 查询积分、商城、漏洞状态时不被知识库抢答。
- prompt injection 会话不能进入知识库。
