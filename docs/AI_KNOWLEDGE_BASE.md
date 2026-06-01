# CQUPT-SRC AI 问题会话式知识沉淀与 Skill 晋升方案

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-06-01 已按专家评审建议补充知识库持续更新、检索策略、知识投毒防护和进度验收表。本文描述目标架构：用户每次进入邮宝 AI 助手默认开启新的“问题会话”；用户围绕同一问题多轮对话并确认“已解决”后，系统再对本次会话做脱敏、总结、评分、去重、聚类和管理员审核；用户端 AI 助手左侧提供历史问题会话列表，支持恢复未结束会话、查看已结束会话、基于历史问题开启新会话；AI 回复底部提供点赞/点踩反馈，反馈写入会话 turn、知识命中和知识质量评分；高频高质量、低隐私风险且用户反馈良好的同类问题可由后端根据 AI 建议自动沉淀为 `AUTO_APPROVED` 知识条目；已入库知识必须持续维护，基于命中、显式/隐式反馈、过期、重复、规则变更和知识投毒风险进入修订、合并、降级、暂停、归档或 Skill 晋升流程，不能一次入库后长期不管；每个实施项必须有完成定义和验收规则；后续回答使用平台知识库时，前端必须在 AI 回复框底部标明“参考平台知识库”。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型配置为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`docs/architecture/AI_CONTEXT_INJECTION.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

本文档是 CQUPT-SRC 平台“邮宝”AI 知识沉淀、知识库复用、管理员审核、自动入库、相似知识聚类和 Hermes Skill 晋升的目标方案。

面向用户的 AI 助手名称统一为“邮宝”。Hermes Agent 只表示底层模型编排和 skill 运行环境。本文中的“知识沉淀”默认指沉淀到 PostgreSQL 主业务库，不是直接写入 Hermes skills 目录。Hermes Skill 只承载经过管理员批准的长期稳定方法论。

本文采用“问题会话式知识沉淀”（Problem Session Knowledge Capture）：不再把每一轮 AI 对话都立即当作知识候选，而是先把用户围绕同一问题的多轮交互组织成一次问题会话；只有用户确认问题已解决，或管理员明确标记会话有沉淀价值后，才进入总结、评分、去重和审核链路。

---

## 1. 设计目标

### 1.1 产品目标

1. 用户每次进入 AI 助手默认是新的对话，避免历史上下文污染当前问题。
2. 用户端 AI 助手左侧提供历史问题会话列表，用户可以恢复未结束会话、查看已结束会话，或基于历史问题开启新会话。
3. 用户可以围绕同一个问题与邮宝多轮沟通，直到解决。
4. 用户关闭平台、离开 AI 助手页面过久或主动点击结束时，系统询问“问题是否已解决”。
5. 用户确认已解决后，本次会话才进入知识沉淀流程。
6. 每条 AI 回复底部提供点赞/点踩按钮，用户反馈作为后续知识质量评分、聚类质量和自动入库判定的重要信号。
7. 邮宝对已解决会话生成结构化总结，并给出知识价值、安全性、隐私风险、复用价值评分。
8. 管理员可以审核、合并、丢弃或晋升为 Skill Candidate。
9. 同类问题多次被问到、且多次被用户确认解决、AI 评分也足够高、用户反馈为正向时，后端可以自动沉淀到知识库。
10. 后续其他用户问到相似问题时，系统优先复用知识库；若使用平台知识库，前端必须在回复底部标注来源。

### 1.2 工程目标

1. 所有 AI 会话、知识沉淀、知识检索和 Skill 晋升都通过 NestJS AI Gateway。
2. 前端不直连模型，不直连平台 Hermes，不持有模型密钥。
3. 用户身份、角色、权限和数据访问以后端 JWT / RBAC 为准。
4. 原始用户对话不直接进入共享知识库；必须先脱敏、泛化和风险评分。
5. AI 只提供评分建议和总结建议，最终是否自动入库由后端规则判定。
6. 自动入库的知识必须可撤回、可归档、可追踪、可反馈、可修订，入库后仍需持续维护。
7. 知识库不得替代实时业务查询。积分、库存、漏洞状态、证书状态等仍必须由后端实时查库。
8. 知识库命中回答要记录 `AiKnowledgeHit`，并支持有用、无用、举报反馈。
9. 历史会话列表只用于用户体验和问题续接，不得把旧会话自动注入新问题上下文；用户明确选择“继续此会话”或“基于此问题继续追问”时，后端才加载对应 session。
10. 点赞/点踩反馈必须绑定到具体 assistant turn 和 knowledge hit，不能只在前端本地计数。
11. 知识条目必须有生命周期维护：低质量要降级，过期要复审，重复要合并，错误或有风险要暂停检索，稳定方法论才晋升 Skill。

---

## 2. 核心原则

```text
每次进入 AI 助手
  -> 创建新的问题会话 AiProblemSession
  -> 用户围绕一个问题多轮对话
  -> 只记录脱敏 turns，不立即沉淀为知识
  -> 用户离开过久 / 主动结束时询问是否已解决
  -> 用户确认已解决
  -> AI 总结本次问题会话
  -> AI + 规则混合评分
  -> 相似知识去重与问题聚类
  -> 管理员审核或后端自动入库
  -> AI Knowledge Base
  -> 后续命中时回答并标注平台知识来源
  -> 根据命中、反馈、过期、重复和规则变化持续维护
  -> 高质量稳定方法论再生成 Skill Candidate
  -> 管理员二次审批
  -> 受控安装到平台 Hermes skills 目录
```

必须避免：

- 用户每问一个问题就自动创建 Hermes Skill。
- 未解决、半截、闲聊、低质量会话进入知识库。
- 把 A 用户原始对话、漏洞细节、资产、凭据或附件内容暴露给 B 用户。
- 用历史知识库回答实时业务问题，例如当前积分、商品库存、漏洞状态。
- 让 AI 自己决定直接写数据库；AI 只能给建议，后端做最终判定。
- 自动把 Skill Candidate 安装进 Hermes 运行目录。
- 使用知识库回答时不告诉用户该回答参考了平台知识。

---

## 3. 分层模型

### 3.1 AiProblemSession：问题会话层

`AiProblemSession` 是本方案新增的核心概念。它表示用户围绕一个具体问题与邮宝进行的一组多轮对话。

它解决三个问题：

1. 把“多轮解决一个问题”的上下文组织起来。
2. 避免把每一轮消息立即沉淀成碎片知识。
3. 用用户“已解决”确认作为高质量沉淀信号。

会话状态建议：

```text
ACTIVE              用户正在对话
AWAITING_RESOLUTION 用户离开过久，等待确认是否解决
RESOLVED            用户确认已解决
UNRESOLVED          用户确认未解决或继续对话
ABANDONED           长时间未活动且未确认
SUMMARIZED          已生成结构化总结
READY_REVIEW        等待管理员审核
AUTO_APPROVED       满足高频高质阈值，后端自动入库
APPROVED_TO_KB      管理员批准沉淀到知识库
SKILL_CANDIDATE     管理员标记为 Skill 候选
DISCARDED           管理员或用户丢弃
```

### 3.2 AI Knowledge Base：知识库层

AI Knowledge Base 仍然是主力复用层，存储在 PostgreSQL。

适合保存：

- 靶场安装与排错经验。
- XSS / SQL 注入 / SSRF / 文件上传等漏洞报告写作方法。
- 待补充材料写法。
- 漏洞为什么被驳回的通用原因。
- 新手学习 Web 安全的路线。
- 平台通用使用问题。
- 已脱敏、泛化后的审核经验。

特点：

- 可按角色范围控制可见性。
- 有审核状态、命中统计、反馈统计、过期检查和维护状态。
- 可撤回、归档、拒绝、合并、修订、降级或暂停检索。
- 可被检索命中后直接回答或注入 Agent。
- 不保存实时业务数据。

### 3.3 AiKnowledgeCluster：问题聚类层

`AiKnowledgeCluster` 用来识别“同一个问题被多次询问并多次解决”。

它不是最终知识条目，而是聚合信号：

```text
多个相似 AiProblemSession
  -> 同一 topicKey / similarityKey
  -> 统计 resolvedSessionCount / totalAskCount / avgScore
  -> 满足阈值后生成或更新 AiKnowledgeEntry
```

这样可以避免重复知识膨胀，也能让自动入库更稳健：单个用户的一次会话不能直接影响平台知识库；必须出现多次、被不同或多次用户验证为已解决，才有资格自动沉淀。

### 3.4 Skill Candidate：Skill 候选层

Skill Candidate 是中间层，适合保存稳定、可复用、长期有效的方法论草稿。

适合晋升为 Skill Candidate：

- 多步骤排错工作流。
- 审核员初筛 checklist。
- 漏洞报告结构化写作流程。
- 学习路径推荐方法论。
- 需要脚本、命令或固定流程收集信息的能力。

Skill Candidate 不等于已安装 Skill。必须经过管理员二次审批后，才能安装到平台 Hermes skills 目录。

### 3.5 Hermes Skill：长期方法论层

Hermes Skill 只保存长期稳定、低变化、平台级的行为规范和方法论。

当前平台 Hermes skills 根目录：

```text
宿主机: /home/cocking/cqupt-src-hermes-linux/platform-skills/cqupt-src
容器内: /opt/data/skills/cqupt-src
```

CLI Hermes 的 `/home/cocking/.hermes/skills` 与平台 Hermes 是两套环境，不应混用。

---

## 4. 用户体验流程

### 4.1 进入 AI 助手

用户进入 AI 助手页面时：

1. 前端默认创建新的问题会话。
2. 当前会话只服务于本次问题。
3. 刷新页面可以恢复当前未结束会话，避免误断。
4. 用户点击“新建对话”时，结束当前会话并创建新会话。
5. 页面左侧显示当前用户的历史问题会话列表，作为“找回上下文”和“查看过往解决方案”的入口。
6. 历史会话不会自动参与新会话的上下文；只有用户点击某条历史会话后，才进入查看、继续或基于历史创建新会话。

左侧历史会话的产品定位：

| 状态 | 左侧操作 | 上下文处理 | 知识沉淀处理 |
|---|---|---|---|
| `ACTIVE` | 继续对话 | 继续使用原 `sessionId` | 仍不沉淀，直到用户确认解决 |
| `AWAITING_RESOLUTION` | 继续 / 标记已解决 / 不沉淀结束 | 用户选择继续时恢复原 session | 用户选择已解决时触发总结评分 |
| `RESOLVED` / `SUMMARIZED` / `READY_REVIEW` | 查看摘要 / 基于此问题再问 | 默认只读；再问时创建新 session，并记录 `forkedFromSessionId` | 原 session 不重复总结；新 session 独立沉淀 |
| `APPROVED_TO_KB` / `AUTO_APPROVED` | 查看对应知识 / 继续追问 | 知识条目可作为检索来源，但仍需按权限检查 | 用户反馈继续影响知识质量分 |
| `DISCARDED` / `ABANDONED` | 查看最小摘要 / 删除本地显示 | 不恢复上下文 | 不进入知识库 |

左侧历史会话列表建议按时间分组：今天、最近 7 天、更早。每项展示：会话标题、状态标签、最后一条摘要、更新时间、是否使用过平台知识库、点赞/点踩反馈概览。列表支持搜索、归档、重命名、删除显示记录；删除显示记录不等于删除安全审计记录。

推荐接口：

```http
POST /api/ai/problem-sessions
```

请求示例：

```json
{
  "mode": "student",
  "initialQuestion": "SQL 注入靶场启动失败怎么办？"
}
```

返回示例：

```json
{
  "sessionId": "cuid_xxx",
  "status": "ACTIVE",
  "startedAt": "2026-05-31T10:00:00.000Z"
}
```

### 4.2 多轮对话

`POST /api/ai/chat` 增加 `sessionId`。

请求示例：

```json
{
  "mode": "student",
  "sessionId": "cuid_xxx",
  "message": "我按照步骤启动失败，报错端口占用",
  "context": {
    "source": "user-ai-assistant"
  }
}
```

后端流程：

```text
JWT / RBAC
  -> 校验 session 属于当前用户
  -> 写入 user turn 的脱敏文本
  -> Direct Response / Knowledge Retrieval / Hermes Agent
  -> 写入 assistant turn 的脱敏文本
  -> 更新 session.lastActiveAt / turnCount / tokenEstimate
```

注意：这一阶段只记录会话 turn，不立即沉淀为知识。

### 4.3 离开过久后的确认弹框

触发条件建议：

```text
页面内无操作提示阈值：10 分钟
离开 AI 页面提示阈值：15 分钟
后端 abandoned 阈值：2 小时
```

前端触发信号：

- `visibilitychange` 变为 hidden。
- 路由离开 AI 助手页面。
- 页面关闭或刷新。
- 长时间没有输入、发送或滚动。
- 用户重新进入 AI 页面时检测到旧 session 处于等待确认状态。

弹框文案建议：

```text
标题：这个问题解决了吗？

正文：你刚才和邮宝讨论的问题是否已经解决？如果已解决，平台会把本次对话总结成一条候选知识，提交给管理员审核。总结前会自动脱敏，不会保存你的隐私信息、Token、Cookie、真实资产细节或附件原文。

按钮：
- 已解决，沉淀经验
- 还没解决，继续对话
- 不沉淀，结束对话
```

三个按钮对应行为：

| 用户选择 | 会话状态 | 后续动作 |
|---|---|---|
| 已解决，沉淀经验 | `RESOLVED` | 触发总结、评分、去重、审核或自动入库 |
| 还没解决，继续对话 | `ACTIVE` | 回到当前会话继续问答 |
| 不沉淀，结束对话 | `DISCARDED` 或 `UNRESOLVED` | 不进入知识库，只保留最小审计记录 |

### 4.4 用户主动结束

AI 助手页面应提供“结束并总结”按钮。用户不必等待超时弹框。

按钮位置建议：

- 聊天窗口顶部右侧：“结束本次问题”。
- 输入框附近：“问题已解决”。
- 移动端可放入更多菜单。

点击后仍需二次确认，避免误触。

---

## 5. 后端数据模型建议

### 5.1 AiProblemSession

```prisma
model AiProblemSession {
  id                 String   @id @default(cuid())
  userId             String?
  aiSpace            AiSpace
  mode               String
  title              String?
  topicKey           String?
  initialQuestion    String   @db.Text
  status             AiProblemSessionStatus @default(ACTIVE)

  startedAt          DateTime @default(now())
  lastActiveAt       DateTime @default(now())
  leftAt             DateTime?
  resolvedAt         DateTime?
  closedAt           DateTime?

  resolutionByUser   Boolean?
  userOutcomeNote    String?  @db.Text

  turnCount          Int      @default(0)
  tokenEstimate      Int      @default(0)

  summaryJson        Json?
  knowledgeEntryId   String?
  duplicateRiskScore Float    @default(0)

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  user               User?    @relation(fields: [userId], references: [id])
  turns              AiProblemSessionTurn[]

  @@index([userId, status, updatedAt])
  @@index([topicKey, status])
  @@index([status, lastActiveAt])
}
```

### 5.2 AiProblemSessionTurn

```prisma
model AiProblemSessionTurn {
  id            String   @id @default(cuid())
  sessionId     String
  role          String
  contentHash   String?
  sanitizedText String   @db.Text

  sourceCallId  String?
  hasAttachment Boolean  @default(false)
  metadata      Json?

  createdAt     DateTime @default(now())

  session       AiProblemSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])
}
```

说明：

- 共享知识库只使用 `sanitizedText`。
- `contentHash` 用于审计和去重，不用于恢复敏感原文。
- 如果确需保留原文，只能短期存在 `AiCallLog` 或专门的安全审计表，并设置保留周期和权限隔离。

### 5.3 AiKnowledgeCluster

```prisma
model AiKnowledgeCluster {
  id                   String   @id @default(cuid())
  topicKey              String
  canonicalQuestion     String   @db.Text
  category              AiKnowledgeCategory
  roleScope             AiKnowledgeRoleScope

  resolvedSessionCount  Int      @default(0)
  totalAskCount         Int      @default(0)
  avgOverallScore       Float    @default(0)
  avgSafetyScore        Float    @default(0)
  avgPrivacyRiskScore   Float    @default(1)
  avgReuseValueScore    Float    @default(0)
  duplicateRiskScore    Float    @default(0)

  bestSessionId         String?
  bestSummary           Json?
  status                String   @default("TRACKING")
  promotedKnowledgeId   String?
  autoApprovalReason    String?  @db.Text

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([topicKey])
  @@index([status, updatedAt])
}
```

### 5.4 AiKnowledgeEntry 扩展字段

现有 `AiKnowledgeEntry` 保留，建议补充：

```prisma
model AiKnowledgeEntry {
  // existing fields...

  sourceSessionIds      String[]
  sourceClusterId       String?
  resolvedSessionCount  Int      @default(1)
  askCount              Int      @default(0)
  autoApprovalReason    String?  @db.Text

  usedAsAnswerCount     Int      @default(0)
  lastUsedAt            DateTime?

  maintenanceStatus     String   @default("HEALTHY") // HEALTHY | STALE_REVIEW | LOW_QUALITY_REVIEW | DUPLICATE_REVIEW | SUSPENDED | ARCHIVED
  qualityScore          Float    @default(0)
  freshnessScore        Float    @default(1)
  staleReason           String?  @db.Text
  suspendedReason       String?  @db.Text
  lastReviewedAt        DateTime?
  nextReviewAt          DateTime?
  revisionCount         Int      @default(0)

  requiresAttribution   Boolean  @default(true)
}
```

---

## 6. 已解决会话总结

### 6.1 触发条件

只在以下情况触发总结：

1. 用户点击“已解决，沉淀经验”。
2. 管理员在后台手动标记会话已解决。
3. 后端检测到用户已解决并提交 outcome note，且无安全风险。

不应触发总结：

- 用户未确认已解决。
- 会话只有一轮寒暄或无实质内容。
- 会话包含明显敏感信息且无法可靠脱敏。
- 会话涉及越权、绕过平台规则、破坏性攻击或 prompt injection。

### 6.2 总结输出 JSON

AI 总结必须输出严格 JSON，后端做 schema 校验。

```json
{
  "title": "SQL 注入靶场启动时端口占用的排查方法",
  "problemStatement": "用户在启动 SQL 注入靶场时遇到端口占用，导致服务无法正常启动。",
  "resolutionSummary": "确认端口占用后，更换服务端口或停止占用进程即可恢复。",
  "environmentNotes": ["本地 Docker 或 Node 服务", "端口 8080 被占用"],
  "successfulSteps": [
    "检查报错中的端口号",
    "使用系统命令确认端口占用",
    "停止占用进程或修改服务端口",
    "重新启动靶场"
  ],
  "failedAttempts": ["重复重启服务但未处理端口占用"],
  "pitfalls": [
    "不要把端口占用误判为靶场文件损坏",
    "不要直接复制他人端口配置，需结合本机环境"
  ],
  "canonicalQuestion": "SQL 注入靶场启动失败提示端口占用怎么办？",
  "canonicalAnswer": "先根据报错确认被占用端口，再停止占用进程或修改靶场端口配置，最后重新启动服务。若使用 Docker，需要同时检查宿主机端口映射。",
  "suggestedCategory": "SECURITY_LEARNING",
  "suggestedRoleScope": "STUDENT",
  "suggestedKnowledgeType": "KB",
  "safeForReuse": true
}
```

### 6.3 总结质量要求

总结必须满足：

- 用通用问题表达，不保留个人身份。
- 用 `[TARGET_URL]`、`[TOKEN]`、`[INTERNAL_IP]` 等占位符替换敏感内容。
- 区分成功步骤和失败尝试。
- 明确适用环境和不适用场景。
- 不能包含 system prompt、模型配置、真实 token、cookie、完整请求包。
- 不能将用户的一次性业务数据泛化为平台规则。

---

## 7. AI + 规则混合评分

评分调用平台 Hermes OpenAI-compatible 接口：

```text
默认 baseURL: http://localhost:5000/v1
默认 model: hermes-agent
```

AI 输出评分建议：

```json
{
  "suggestedKnowledgeType": "KB",
  "overallScore": 0.91,
  "resolutionConfidenceScore": 0.93,
  "answerQualityScore": 0.9,
  "reuseValueScore": 0.87,
  "generalityScore": 0.86,
  "safetyScore": 0.94,
  "privacyRiskScore": 0.06,
  "platformRelevanceScore": 0.82,
  "confidenceScore": 0.88,
  "reason": "用户明确确认已解决，步骤清晰，可泛化为靶场端口占用排查知识。",
  "signals": ["用户点击已解决", "存在明确成功步骤", "不包含真实资产或凭据"],
  "risks": []
}
```

后端规则必须兜底：

| 条件 | 处理 |
|---|---|
| 用户未确认已解决 | 不允许自动入库 |
| 没有成功步骤 | 不允许自动入库 |
| 隐私风险高 | 进入审核或拒绝 |
| 安全分低 | 进入审核或拒绝 |
| 检测到 Token / Cookie / API Key | 拒绝沉淀，只保留最小审计 |
| 真实资产 URL / 内网 IP 无法脱敏 | 拒绝沉淀 |
| 涉及其他用户数据 | 拒绝沉淀 |
| 涉及实时积分、库存、漏洞状态 | 不进入知识库 |
| prompt injection | 拒绝沉淀并写安全审计 |

规则合并原则：

```text
privacyRiskScore = max(AI 隐私风险, 规则隐私风险)
safetyScore      = min(AI 安全分, 规则安全分)
finalDecision    = 后端状态机决定，不由 AI 直接决定
```

---

## 8. 高频高质自动入库

### 8.1 自动入库不是 AI 直接写库

AI 只提供建议。后端根据 AI 建议、规则评分、问题聚类和安全阈值决定是否自动入库。

自动入库状态统一为：

```text
AUTO_APPROVED
```

不要把自动入库写成 `APPROVED`。`APPROVED` 应保留给管理员明确审核通过。

### 8.2 推荐阈值

```text
同一 AiKnowledgeCluster 满足：
  resolvedSessionCount >= 3
  totalAskCount >= 5
  avgOverallScore >= 0.88
  avgSafetyScore >= 0.90
  avgPrivacyRiskScore <= 0.10
  avgReuseValueScore >= 0.82
  duplicateRiskScore < 0.72
  abuseReportCount = 0
  category 不属于高风险攻击细节
  roleScope 不越权
```

说明：

- `resolvedSessionCount >= 3`：至少三次已解决会话，降低单次偶然性。
- `totalAskCount >= 5`：问题确实有频率。
- 高安全分 + 低隐私风险：防止错误或敏感知识扩散。
- 重复风险低：避免制造重复条目。
- 无举报：避免已被用户质疑的知识继续扩散。

### 8.3 自动入库内容生成

自动入库不直接使用某一次会话总结，而应基于 cluster 内的多次已解决会话生成 canonical knowledge：

```text
同类已解决会话 summaries
  -> 选择 bestSummary
  -> 合并共同成功步骤
  -> 合并高频 pitfalls
  -> 去掉一次性环境差异
  -> 生成 canonicalQuestion / canonicalAnswer
  -> 再做一次脱敏与安全检查
  -> 创建 AUTO_APPROVED AiKnowledgeEntry
```

### 8.4 自动入库后治理

自动入库条目必须：

- 在管理员页面单独展示。
- 记录 `autoApprovalReason`。
- 保留源 session ids 和 cluster id。
- 支持撤回、归档、降级为待审核。
- 支持用户反馈和举报。
- 被举报达到阈值时自动暂停检索。

---

## 9. 相似知识去重与合并

### 9.1 检查范围

系统根据会话总结生成 tokens / similarityKey，在相同类别、相同角色范围或 `ALL` 范围内检索：

```text
APPROVED
AUTO_APPROVED
PROMOTED_TO_SKILL
NEEDS_REVIEW
```

只检查 `PUBLIC` / `INTERNAL` 敏感等级的条目。

### 9.2 重复风险阈值

```text
duplicateRiskScore >= 0.86：强重复风险，必须人工审核，建议合并到已有条目。
duplicateRiskScore >= 0.72：中等重复风险，必须人工审核，管理员决定合并或保留独立变体。
duplicateRiskScore < 0.72：可作为审核参考，不阻断自动流转。
```

只要重复风险达到 0.72，即使 AI 评分满足自动沉淀条件，也应进入管理员审核。

### 9.3 合并建议

合并建议应包含：

```json
{
  "targetKnowledgeId": "knowledge_xxx",
  "mergeReason": "问题和已有条目都描述靶场启动端口占用，但新增了 Docker 端口映射提示。",
  "newPitfalls": ["Docker 场景需要同时检查宿主机端口映射"],
  "newSteps": ["检查 docker-compose.yml ports 配置"],
  "shouldCreateRevision": true
}
```

管理员合并后，应创建 `AiKnowledgeRevision`，保留变更原因和编辑者。

---

## 10. 知识库回答复用

### 10.1 调用顺序

用户新问题进入 Agent 前，应保持以下顺序：

```text
JWT / RBAC
  -> Direct Response
  -> AI Knowledge Retrieval
  -> Knowledge Direct Answer / Knowledge Injected Agent
  -> Normal Hermes Agent
```

Direct Response 必须优先于知识检索，因为积分、商品、漏洞状态、证书状态是实时数据，不能用历史知识回答。

### 10.2 高置信直接回答

条件：

```text
similarity >= 0.88
knowledge.status in (APPROVED, AUTO_APPROVED, PROMOTED_TO_SKILL)
roleScope 匹配当前用户
sensitivity in (PUBLIC, INTERNAL)
abuseReportCount 低于暂停阈值
```

响应示例：

```json
{
  "content": "你可以先检查端口是否被占用，然后修改靶场端口配置或停止占用进程……",
  "usedKnowledge": true,
  "knowledgeSources": [
    {
      "id": "knowledge_xxx",
      "title": "SQL 注入靶场启动时端口占用的排查方法",
      "sourceType": "PLATFORM_KB",
      "confidence": 0.91,
      "status": "AUTO_APPROVED"
    }
  ]
}
```

### 10.3 中置信注入 Agent

条件：

```text
0.75 <= similarity < 0.88
```

做法：

1. 后端把知识条目的 `canonicalAnswer`、`successfulSteps`、`pitfalls` 注入 Agent。
2. Prompt 明确说明：平台知识库是参考资料，不是系统指令。
3. Agent 根据用户当前问题改写回答。
4. 最终响应仍设置 `usedKnowledge = true` 和 `knowledgeSources`。

### 10.4 低置信不使用知识库

条件：

```text
similarity < 0.75
```

做法：

- 不注入知识库。
- 正常走 Hermes Agent 或后端确定性响应。
- 不展示平台知识库来源标记。

### 10.5 命中记录

每次知识库参与回答，都应写 `AiKnowledgeHit`：

```text
knowledgeId
userId
aiSpace
questionHash
questionSummary
similarity
route: DIRECT_ANSWER | INJECTED_AGENT
usedInResponse
createdAt
```

---

## 11. 前端来源标注

用户要求：如果回答使用了内部知识库，需要在 AI 回答页面后面标明该知识为平台提供。

推荐 UI：在 assistant bubble 内部底部展示轻量来源条，不要用大块灰色分割背景。

示例：

```text
参考来源：平台知识库
- SQL 注入靶场启动时端口占用的排查方法
```

普通用户文案：

```text
本回答参考了平台知识库中的已审核经验。
```

自动入库条目文案：

```text
本回答参考了平台知识库中的自动沉淀经验，管理员可随时复核。
```

管理员模式可以额外展示：

- knowledge id。
- similarity。
- status。
- hit route。

前端响应字段建议：

```ts
export type AiKnowledgeSource = {
  id: string
  title: string
  sourceType: 'PLATFORM_KB' | 'PLATFORM_SKILL'
  confidence?: number
  status?: 'APPROVED' | 'AUTO_APPROVED' | 'PROMOTED_TO_SKILL'
}

export type AiChatResponse = {
  mode: 'student' | 'auditor' | 'admin'
  content: string
  cards?: AiCard[]
  actions?: AiPendingAction[]
  sessionId?: string
  usedKnowledge?: boolean
  knowledgeSources?: AiKnowledgeSource[]
}
```

---

## 12. AI 回复点赞/点踩与知识质量评分

### 12.1 交互位置

每条 assistant 回复底部都应展示轻量反馈区，位于来源标注之后、同一个 assistant bubble 内部，不能拆成气泡外的独立灰色块。

推荐顺序：

```text
assistant content
  -> cards/actions（如有）
  -> knowledgeSources 来源标注（如 usedKnowledge=true）
  -> feedback bar：👍 有帮助 / 👎 没帮助 / 可选“补充原因”
```

反馈区交互要求：

- 默认只显示两个小按钮：有帮助、没帮助。
- 点击后即刻本地高亮，并异步写入后端。
- 用户可撤销或从赞改踩，后端保留最新状态并记录审计。
- 点踩后可展开可选原因：答非所问、步骤不可执行、知识过期、缺少权限说明、存在安全风险、其它。
- 如果本回答使用了平台知识库，反馈同时绑定到 `AiKnowledgeHit` 和相关 `AiKnowledgeEntry`。
- 如果本回答没有使用平台知识库，反馈只绑定到 `AiProblemSessionTurn`，作为本次会话解决质量和后续总结评分的信号。

### 12.2 数据绑定

为了让反馈可以参与知识评分，`POST /api/ai/chat` 的响应必须返回可追踪 ID：

```ts
export type AiChatResponse = {
  mode: 'student' | 'auditor' | 'admin'
  sessionId?: string
  userTurnId?: string
  assistantTurnId?: string
  content: string
  cards?: AiCard[]
  actions?: AiPendingAction[]
  usedKnowledge?: boolean
  knowledgeSources?: AiKnowledgeSource[]
  knowledgeHitIds?: string[]
}
```

前端提交反馈时只传 `assistantTurnId`、`rating` 和可选原因，不传 `userId`、`knowledgeId` 作为可信字段；后端通过 turn 和 hit 反查归属、权限与知识条目。

### 12.3 建议数据模型

`AiProblemSessionTurn` 建议新增字段：

```prisma
model AiProblemSessionTurn {
  id              String   @id @default(cuid())
  sessionId       String
  role            String
  sanitizedText   String   @db.Text

  userFeedback    String?  // UP | DOWN | CLEARED
  feedbackReason  String?  @db.Text
  feedbackAt      DateTime?

  metadata        Json?
  createdAt       DateTime @default(now())
}
```

知识命中层建议使用 `AiKnowledgeHit` 承接每次使用记录，新增：

```prisma
model AiKnowledgeHit {
  id              String   @id @default(cuid())
  knowledgeId     String
  sessionId       String?
  assistantTurnId String?
  similarity      Float
  route           String   // DIRECT_ANSWER | INJECTED_AGENT
  usedInResponse  Boolean  @default(true)

  userFeedback    String?  // UP | DOWN | CLEARED
  feedbackReason  String?  @db.Text
  feedbackAt      DateTime?

  createdAt       DateTime @default(now())
}
```

若现有模型已有 `AiKnowledgeFeedback`，可以保留并把 `AiKnowledgeHit.userFeedback` 作为最新状态快照；`AiKnowledgeFeedback` 保存追加式历史，便于审计。

### 12.4 反馈如何进入 AI 对知识的评分

反馈不是直接替代 AI 评分，而是作为“用户验证信号”参与综合分。推荐把知识质量分拆成：

```text
overallScore =
  0.40 * aiSolutionQualityScore
+ 0.20 * reuseValueScore
+ 0.15 * safetyScore
+ 0.15 * userFeedbackScore
+ 0.10 * freshnessScore
- privacyRiskPenalty
- abuseRiskPenalty
```

其中 `userFeedbackScore` 来自最近一段时间的反馈：

```text
positiveRate = upCount / max(upCount + downCount, 1)
confidenceWeight = min(log10(totalFeedback + 1), 1)
recencyWeight = 最近 90 天反馈权重更高
userFeedbackScore = positiveRate * confidenceWeight * recencyWeight
```

自动入库和自动撤回建议增加反馈门槛：

| 场景 | 反馈门槛 | 动作 |
|---|---|---|
| 自动入库 | `upCount >= 3` 且 `positiveRate >= 0.80` | 允许进入 `AUTO_APPROVED` 判定 |
| 管理员优先审核 | `downCount >= 2` 或 `positiveRate < 0.60` | 提升审核优先级 |
| 暂停直接回答 | 最近 20 次反馈中点踩率 >= 35% | 降级为注入 Agent 或禁用该知识 |
| 疑似过期 | 点踩原因多为“知识过期” | 标记 `STALE_REVIEW` |
| 安全风险 | 点踩原因含“存在安全风险” | 立即停止自动使用，进入安全复核 |

### 12.5 反馈与问题会话总结

已解决会话进入 `summarizeResolvedSession` 时，应把 turn 级反馈作为输入信号：

- 被点赞的 assistant turn 优先提取为“成功步骤”。
- 被点踩的 assistant turn 进入“失败尝试 / 不推荐做法”。
- 如果同一会话最终已解决但中间多次点踩，总结应保留“哪些路径无效”。
- 如果用户点踩最终回答且没有点击已解决，该会话不能自动入库。

### 12.6 管理员视角

管理员知识审核页应展示：

- 每条知识的点赞数、点踩数、正向率、最近点踩原因。
- 自动入库条目的反馈趋势。
- 被点踩最多的知识条目和对应原始脱敏 assistant turn。
- 是否因反馈被降级、暂停直接回答或标记过期。


---

## 13. 知识库持续更新机制

知识库不能“一次入库后长期不管”。`APPROVED` 或 `AUTO_APPROVED` 只表示某个时间点满足入库条件，不代表永久正确、永久适用或永久允许直接回答。平台必须把知识库当作持续演进的业务资产维护。

### 13.1 知识条目生命周期

推荐维护状态使用枚举，而不是自由字符串：

```text
HEALTHY              当前可正常检索和复用
STALE_REVIEW         疑似过期，等待复审；普通用户不可命中
LOW_QUALITY_REVIEW   反馈较差或命中后效果不佳；默认禁用直接回答
DUPLICATE_REVIEW     与其他知识重复或交叉；等待合并判断
DIRECT_DISABLED      禁止高置信直接回答，但允许作为 Agent 参考
RETRIEVAL_DISABLED   完全不参与普通用户检索
SECURITY_SUSPENDED   安全原因暂停；安全复核前不可恢复
ARCHIVED             已归档，仅保留审计和历史引用
PROMOTED_TO_SKILL    已晋升为稳定 Hermes Skill，KB 可保留摘要或转为引用
```

Prisma 建议：

```prisma
enum AiKnowledgeMaintenanceStatus {
  HEALTHY
  STALE_REVIEW
  LOW_QUALITY_REVIEW
  DUPLICATE_REVIEW
  DIRECT_DISABLED
  RETRIEVAL_DISABLED
  SECURITY_SUSPENDED
  ARCHIVED
  PROMOTED_TO_SKILL
}
```

行为开关建议与状态分离，避免 Retrieval 层猜测状态含义：

```prisma
directAnswerEnabled Boolean @default(true)
agentInjectEnabled  Boolean @default(true)
retrievalEnabled    Boolean @default(true)
```

状态转换示例：

```text
AUTO_APPROVED / APPROVED
  -> HEALTHY
  -> STALE_REVIEW           规则、流程、环境或依赖变化
  -> LOW_QUALITY_REVIEW     点踩率高、无用反馈多、命中后用户仍反复追问
  -> DUPLICATE_REVIEW       新候选或聚类发现相似条目
  -> DIRECT_DISABLED        高命中但近期质量下降，禁止直接回答
  -> RETRIEVAL_DISABLED     过期或被替代，不再参与普通检索
  -> SECURITY_SUSPENDED     安全举报、错误知识、越权风险、知识投毒风险
  -> ARCHIVED               长期不用、被更好条目替代、平台规则废弃
  -> PROMOTED_TO_SKILL      稳定方法论通过二次审批并安装
```

### 13.2 触发更新的信号

系统应从以下信号自动发现需要维护的知识：

| 信号 | 判定方式 | 推荐动作 |
|---|---|---|
| 用户反馈差 | `downCount >= 2` 或 `positiveRate < 0.60` | 标记 `LOW_QUALITY_REVIEW`，降低检索权重 |
| 隐式失败信号 | 命中后继续追问“还是不行”、未点击已解决、重复 fork 同类问题 | 降低质量分，进入复审候选 |
| 近期点踩率高 | 最近 20 次反馈点踩率 `>= 35%` | 暂停直接回答，降级为注入 Agent 或进入复审 |
| 用户标记“知识过期” | 点踩原因包含“知识过期 / 不适用 / 步骤失效” | 标记 `STALE_REVIEW` |
| 安全风险举报 | `REPORT_ABUSE` 或点踩原因含“安全风险” | 立即 `SECURITY_SUSPENDED`，安全复核前不再检索 |
| 知识投毒风险 | canonicalAnswer 含“忽略规则”“以后都按此审核”等指令型内容 | 拒绝入库或 `SECURITY_SUSPENDED` |
| 长期无命中 | 例如 90 天无命中且同类知识更多 | 降权或进入归档复审 |
| 重复知识出现 | duplicateRiskScore 达阈值 | 标记 `DUPLICATE_REVIEW`，生成合并建议 |
| 平台规则变化 | 管理员更新规则、审核标准、AI prompt 或文档 | 批量扫描相关 category/tag，进入 `STALE_REVIEW` |
| Skill 已安装 | 知识已晋升稳定方法论 | KB 条目标记 `PROMOTED_TO_SKILL` 或保留为来源摘要 |

### 13.3 定期健康检查 Worker

建议新增 `AiKnowledgeMaintenanceWorker`，每天或每周执行：

```text
AiKnowledgeMaintenanceWorker
  -> 扫描 APPROVED / AUTO_APPROVED / PROMOTED_TO_SKILL 等曾经可检索或可复用的知识
  -> 汇总 AiKnowledgeHit / AiKnowledgeFeedback / abuse report
  -> 计算 qualityScore / freshnessScore / positiveRate / recentDownvoteRate
  -> 检查长期无命中、过期标签、重复风险和安全举报
  -> 自动降权、暂停直接回答或生成维护任务
  -> 对安全风险执行 SECURITY_SUSPENDED
  -> 写入 AuditLog、AiKnowledgeMaintenanceTask 与 maintenance note
```

推荐默认规则：

```text
90 天无命中且存在同类高质量条目 -> ARCHIVE_REVIEW
positiveRate < 0.60 且反馈数 >= 5 -> LOW_QUALITY_REVIEW
最近 20 次反馈点踩率 >= 35% -> 暂停 DIRECT_ANSWER，只允许 INJECT_AGENT 或完全停用
任意安全风险举报 -> SECURITY_SUSPENDED
平台规则文档或审核标准更新 -> 相关 category/tag 批量 STALE_REVIEW
duplicateRiskScore >= 0.72 -> DUPLICATE_REVIEW
```

Worker 的权限边界：

- 可以自动计算质量分、过期分、反馈趋势和维护状态。
- 可以自动生成 `AiKnowledgeMaintenanceTask`。
- 可以自动禁用 direct answer 或因安全举报进入 `SECURITY_SUSPENDED`。
- 不应自动重写高影响知识答案、不应自动合并知识、不应自动恢复安全暂停、不应自动晋升 Skill。
- 内容变化默认由管理员审核后落库；自动修订只能用于低风险格式或措辞修正，并必须创建 revision。

维护任务建议模型：

```prisma
model AiKnowledgeMaintenanceTask {
  id           String   @id @default(cuid())
  knowledgeId  String
  taskType     String   // STALE_REVIEW | LOW_QUALITY | DUPLICATE | SECURITY | ARCHIVE
  reason       String   @db.Text
  priority     String   // P0 | P1 | P2 | P3 | P4
  status       String   @default("OPEN") // OPEN | RESOLVED | DISMISSED
  dedupeKey    String   @unique
  createdAt    DateTime @default(now())
  resolvedAt   DateTime?
}
```

`dedupeKey` 必须保证 Worker 重复运行不会为同一知识、同一原因制造重复 OPEN 任务。


### 13.4 修订与版本历史

知识条目每次修改都必须创建 `AiKnowledgeRevision`，不要直接覆盖旧答案而没有历史记录。

建议 revision 采用不可变快照，而不是只保存少数字段：

```prisma
model AiKnowledgeRevision {
  id           String   @id @default(cuid())
  knowledgeId  String
  version      Int
  changeType   String   // MANUAL_EDIT | AUTO_REFRESH | MERGE | SAFETY_FIX | OUTDATED_FIX | SKILL_PROMOTION
  changeReason String   @db.Text
  oldSnapshot  Json
  newSnapshot  Json
  diffSummary  String?  @db.Text
  editorId     String?
  editorType   String   // ADMIN | SYSTEM | WORKER
  createdAt    DateTime @default(now())

  @@unique([knowledgeId, version])
  @@index([knowledgeId, createdAt])
}
```

修订原则：

- 管理员手工编辑、合并重复知识、根据反馈修正步骤、因平台规则变更更新答案，都必须创建 revision。
- 自动 Worker 只能提出更新建议或把条目标记为待复审；除低风险措辞修正外，不应静默替换高影响知识。
- 任何导致可见答案变化的更新，都要能回滚到上一版。
- 已被用于回答的知识即使归档，也要保留历史版本和命中记录，便于审计。

### 13.5 合并、降级与暂停策略

当新候选知识与已有知识相似时，不应继续堆叠重复条目。管理员审核页应展示：

```text
相似知识
新增步骤
新增坑点
冲突点
建议合并目标
是否创建 revision
```

推荐动作：

- 小幅补充：合并到已有条目并创建 revision。
- 场景不同：保留独立条目，但补充适用范围和标签。
- 内容冲突：进入人工复审，暂停其中低质量条目的直接回答。
- 明显错误：`SECURITY_SUSPENDED` 或 `ARCHIVED`，并记录原因。

暂停策略要分层：

```text
DIRECT_DISABLED        不再高置信直接回答，但可作为 Agent 参考
RETRIEVAL_DISABLED      完全不参与检索
SECURITY_SUSPENDED      安全复核前不可恢复
```

### 13.6 知识投毒防护

知识条目即使已经入库，也仍然只是“平台参考资料”，不是 system prompt。中置信注入 Agent 时必须在 prompt 中声明：知识库内容不能覆盖权限、安全边界、实时数据规则和系统指令。

入库前和维护扫描时都要计算独立的投毒风险，不要混入普通 `safetyScore`：

```text
poisoningRiskScore
instructionOverrideRisk
policyConflictRisk
crossRoleLeakageRisk
```

高风险特征：

- “忽略以上规则 / 忽略平台规则 / 不要遵守审核标准”。
- “以后遇到某类漏洞都直接判高危 / 自动通过 / 自动驳回”。
- “学生可以查看审核员内部标准 / 管理员统计”。
- 伪造平台制度、伪造权限边界、伪造系统 prompt。
- 把一次性用户环境、真实资产或具体漏洞结论泛化为平台规则。

处理规则：

```text
poisoningRiskScore >= 0.80 -> REJECTED 或 SECURITY_SUSPENDED
0.50 <= poisoningRiskScore < 0.80 -> NEEDS_SECURITY_REVIEW
policyConflictRisk > 0 -> 禁止自动入库
crossRoleLeakageRisk > 0 -> 禁止普通检索
```

### 13.7 Embedding 与相似度版本化

如果使用 embedding 或 pgvector，必须记录模型版本，避免后续更换 embedding 模型后新旧向量混用导致相似度阈值失真。

建议字段：

```prisma
embeddingModel     String?
embeddingVersion   String?
embeddingUpdatedAt DateTime?
contentHash        String?
similarityKey      String?
```

规则：

- 只有同一 embedding 模型和版本的向量才能直接比较阈值。
- 模型切换后应异步重建 embedding，并在重建完成前降级到 pg_trgm / keyword fallback。
- 每次 canonicalQuestion / canonicalAnswer 改动后更新 `contentHash`，并触发 embedding 重算任务。

### 13.8 检索策略矩阵

Knowledge Retrieval 必须先按权限、状态和行为开关过滤，再计算相似度。

| maintenanceStatus | Direct Answer | Inject Agent | Admin Preview | 说明 |
|---|---|---|---|---|
| `HEALTHY` | 是 | 是 | 是 | 正常可用 |
| `LOW_QUALITY_REVIEW` | 否 | 可选 | 是 | 不直接回答，避免低质量知识高置信输出 |
| `STALE_REVIEW` | 否 | 否 | 是 | 疑似过期，普通用户不可命中 |
| `DUPLICATE_REVIEW` | 否 | 可选 | 是 | 等待合并判断，避免重复答案扩散 |
| `DIRECT_DISABLED` | 否 | 是 | 是 | 只作为参考，不直接回答 |
| `RETRIEVAL_DISABLED` | 否 | 否 | 是 | 完全退出普通检索 |
| `SECURITY_SUSPENDED` | 否 | 否 | 受限 | 安全复核前不可恢复 |
| `ARCHIVED` | 否 | 否 | 是 | 仅审计和历史查看 |
| `PROMOTED_TO_SKILL` | 可选 | 通过 Skill | 是 | 稳定方法论优先由 Skill 承载 |

检索伪代码：

```text
filter by roleScope / visibility / sensitivity
filter by status in APPROVED / AUTO_APPROVED / PROMOTED_TO_SKILL
filter by retrievalEnabled and maintenanceStatus
compute similarity
if route = DIRECT_ANSWER and !directAnswerEnabled -> downgrade or miss
if route = INJECT_AGENT and !agentInjectEnabled -> miss
record retrieved vs usedInResponse separately
```

### 13.9 命中记录与隐式反馈

`AiKnowledgeHit` 需要区分“召回”和“实际使用”：

```text
retrieved        被检索召回
usedInResponse   实际参与回答
shownToUser      是否展示来源
route            DIRECT_ANSWER | INJECTED_AGENT | ADMIN_PREVIEW
```

质量评分不应只依赖点赞/点踩，还应采集隐式信号：

- 命中后用户是否点击“已解决”。
- 用户是否复制答案中的代码或步骤。
- 用户是否继续追问“还是不行 / 报错 / 没解决”。
- 用户是否 fork 历史会话继续问同类问题。
- 用户是否在短时间内重新提出同一问题。

建议综合分：

```text
qualityScore =
  0.35 * explicitFeedbackScore
+ 0.25 * sessionResolutionScore
+ 0.20 * implicitSuccessScore
+ 0.10 * freshnessScore
+ 0.10 * adminReviewScore
- poisoningRiskPenalty
- abuseRiskPenalty
```

### 13.10 管理端维护队列

管理员知识库页面除“待审核 / 自动入库 / 知识条目 / Skill Candidate”外，应增加“待维护”视角或筛选条件，并按优先级排队，避免管理员被低价值任务淹没：

```text
P0 安全风险：立即暂停，必须处理
P1 高命中低质量：影响用户多，优先修订或降级
P2 规则过期：需要批量复审
P3 重复合并：可排期处理
P4 长期无命中：可批量归档

视图筛选：待更新 / 低质量 / 疑似重复 / 已暂停 / 待归档 / 已晋升 Skill
```

每条维护任务展示：

- 触发原因。
- 最近命中和反馈趋势。
- 最近点踩原因。
- 相似知识和合并建议。
- 当前 revision 与上一版差异。
- 推荐动作：修订、合并、降级、暂停、归档、恢复。

### 13.11 检索时尊重维护状态

Knowledge Retrieval 必须在相似度计算前过滤维护状态：

```text
可直接回答：status in (APPROVED, AUTO_APPROVED) 且 maintenanceStatus = HEALTHY 且 directAnswerEnabled=true
可注入 Agent：maintenanceStatus in (HEALTHY, LOW_QUALITY_REVIEW, DIRECT_DISABLED) 且 agentInjectEnabled=true
不可使用：RETRIEVAL_DISABLED / ARCHIVED / STALE_REVIEW / SECURITY_SUSPENDED
```

如果知识处于 `STALE_REVIEW` 或 `LOW_QUALITY_REVIEW`，前端不应展示成“已审核经验”；管理员模式可以显示“待复审知识被命中但已被过滤”。


## 14. 管理员审核页面

页面：`frontend/src/pages/admin/AdminAiKnowledgeManagement.tsx`

建议重构为 5 个 Tab 或 4 个主 Tab + 一个“待维护”筛选视图。

### 14.1 待审核问题会话

展示：

- 会话标题。
- 用户角色。
- 是否用户确认已解决。
- 轮次数。
- AI 评分。
- 安全风险。
- 隐私风险。
- 重复风险。
- 结构化总结。
- 脱敏对话片段。
- 相似知识和合并建议。

操作：

- 批准入库。
- 合并到已有知识。
- 标记为 Skill Candidate。
- 丢弃。
- 重新总结。
- 查看脱敏证据。

### 14.2 自动入库

展示：

- 自动入库知识标题。
- `autoApprovalReason`。
- resolvedSessionCount。
- totalAskCount。
- 平均评分。
- 最近命中时间。
- 反馈统计。

操作：

- 确认为已审核。
- 撤回。
- 归档。
- 降级为待审核。
- 合并到其他知识。

### 14.3 知识库条目

展示：

- 标题。
- 类别。
- 角色范围。
- 敏感等级。
- 状态。
- 命中次数。
- 有用 / 无用 / 举报。
- 是否可晋升 Skill。

### 14.4 Skill Candidate

保留现有链路：

- 从知识条目生成候选。
- 审批。
- 安装。
- 查看安装日志。
- 回滚或重新安装。

### 14.5 待维护知识

展示：

- `STALE_REVIEW` / `LOW_QUALITY_REVIEW` / `DUPLICATE_REVIEW` / `DIRECT_DISABLED` / `RETRIEVAL_DISABLED` / `SECURITY_SUSPENDED` 条目。
- 触发原因、最近命中、反馈趋势、点踩原因、相似知识。
- 当前版本与建议修订差异。

操作：

- 修订并创建 revision。
- 合并到已有知识。
- 降级为仅注入 Agent。
- 暂停检索。
- 恢复为 HEALTHY。
- 归档。

---

## 15. API 链路

### 15.1 问题会话 API

```http
POST /api/ai/problem-sessions
GET  /api/ai/problem-sessions/active
GET  /api/ai/problem-sessions/:id
POST /api/ai/problem-sessions/:id/heartbeat
POST /api/ai/problem-sessions/:id/leave
POST /api/ai/problem-sessions/:id/resolve
POST /api/ai/problem-sessions/:id/discard
POST /api/ai/problem-sessions/:id/summarize
GET  /api/ai/problem-sessions/history
PATCH /api/ai/problem-sessions/:id/title
POST /api/ai/problem-sessions/:id/archive
POST /api/ai/problem-sessions/:id/fork
POST /api/ai/problem-sessions/:id/turns/:turnId/feedback
```

### 15.2 AI Chat 扩展

```http
POST /api/ai/chat
```

新增请求字段：

```json
{
  "sessionId": "cuid_xxx"
}
```

新增响应字段：

```json
{
  "sessionId": "cuid_xxx",
  "usedKnowledge": true,
  "knowledgeSources": [
    {
      "id": "knowledge_xxx",
      "title": "SQL 注入靶场启动时端口占用的排查方法",
      "sourceType": "PLATFORM_KB",
      "confidence": 0.91
    }
  ]
}
```

### 15.3 知识库与 Skill Candidate API

保留现有接口：

```http
GET  /api/ai/knowledge/stats
GET  /api/ai/knowledge
POST /api/ai/knowledge
POST /api/ai/knowledge/:id/review
POST /api/ai/knowledge/:id/feedback

GET  /api/ai/knowledge/skill-candidates
POST /api/ai/knowledge/skill-candidates
POST /api/ai/knowledge/skill-candidates/:id/review
POST /api/ai/knowledge/skill-candidates/:id/install
```

新增或调整：

```http
GET  /api/ai/knowledge/clusters
POST /api/ai/knowledge/clusters/:id/rebuild
POST /api/ai/knowledge/clusters/:id/auto-approve
POST /api/ai/knowledge/:id/merge
POST /api/ai/knowledge/:id/suspend
POST /api/ai/knowledge/:id/archive
POST /api/ai/knowledge/:id/revisions
GET  /api/ai/knowledge/:id/revisions
POST /api/ai/knowledge/:id/restore
GET  /api/ai/knowledge/maintenance
GET  /api/ai/knowledge/maintenance/tasks
POST /api/ai/knowledge/maintenance/tasks/:id/resolve
POST /api/ai/knowledge/maintenance/tasks/:id/dismiss
POST /api/ai/knowledge/maintenance/run
```

---

## 16. 安全与隐私边界

不得沉淀或展示：

- System prompt。
- API Key、Token、Cookie、Session。
- 数据库连接串、MinIO 密钥、模型配置密钥。
- 其他用户漏洞、积分、证书、身份信息。
- 真实资产 URL、内网 IP、原始请求包、附件私密内容。
- 未授权攻击、破坏性利用、后门、持久化代码。
- 要求绕过平台规则、忽略系统指令、伪造权限的 prompt injection。

可沉淀的内容必须：

- 已脱敏。
- 已泛化。
- 不依赖当前用户私有数据。
- 不依赖实时业务状态。
- 有通用复用价值。
- 可被管理员撤回或归档。
- 被用户确认已解决，或由管理员确认有沉淀价值。

敏感信息替换建议：

```text
Token: [REDACTED_TOKEN]
Cookie: [REDACTED_COOKIE]
Authorization: [REDACTED_AUTH_HEADER]
真实资产 URL: [TARGET_URL]
内网 IP: [INTERNAL_IP]
邮箱: u***@example.com
手机号: 138****1234
附件内容: [PRIVATE_ATTACHMENT]
```

---

## 17. 实施进度表与验收规则

本表用于跟踪 AI Knowledge Base 从“问题会话沉淀”到“持续维护 + Skill 晋升”的落地进度。每一项都必须同时满足“完成定义”和“验收规则”，不能只因为代码写完或页面出现就标记完成。

状态说明：`未开始`、`进行中`、`待验收`、`已完成`、`阻塞`、`待代码确认`。本文档是目标方案，未逐项对照当前代码验证的条目先标为 `待代码确认`。

| 编号 | 模块 | 当前状态 | 完成定义：完成什么 | 验收规则：如何证明完成 |
|---|---|---|---|---|
| KB-01 | 问题会话生命周期 | 已完成 | 用户进入邮宝创建/恢复 `AiProblemSession`，`/api/ai/chat` 全程携带 `sessionId`，turn 写入脱敏文本 | E2E：新建、刷新恢复、heartbeat、leave、resolve、discard 全流程通过；用户 A 不能访问用户 B session |
| KB-02 | 解决确认与沉淀触发 | 已完成 | 只有用户确认已解决或管理员标记有价值时才触发总结 | 单测/E2E：未确认解决的 session 不生成 KB 候选；寒暄、积分、商品、漏洞实时查询不触发沉淀 |
| KB-03 | 结构化总结 | 已完成 | `summarizeResolvedSession()` 输出问题、环境、成功步骤、失败尝试、坑点、适用范围、不适用范围 | JSON schema 校验通过；缺字段或含敏感原文时拒绝；总结不包含 Token、Cookie、真实资产和附件原文 |
| KB-04 | AI + 规则评分 | 进行中 | 生成 quality、reuse、safety、privacy、confidence、poisoningRisk 等评分，后端规则兜底 | 单测覆盖高隐私、高安全风险、prompt injection、低质量回答；AI 高分但规则命中时仍拒绝或复审 |
| KB-05 | 脱敏与拒绝策略 | 进行中 | Token、Cookie、Authorization、真实资产、内网 IP、其他用户数据不可入库 | 用含敏感信息样例提交后，知识条目不保存敏感原文；拒绝记录只保留最小摘要和原因 |
| KB-06 | 相似聚类与去重 | 进行中 | 相似问题进入 `AiKnowledgeCluster`，重复风险阻断自动入库并生成合并建议 | duplicateRiskScore >= 0.72 时不自动入库；管理员页展示相似知识、新增步骤、新增坑点和合并目标 |
| KB-07 | 高频高质自动入库 | 待代码确认 | 满足 resolvedSessionCount、totalAskCount、评分、反馈、安全阈值后创建 `AUTO_APPROVED` | 构造 3 个已解决会话 + 5 次询问信号后自动入库；低反馈或安全风险时不入库 |
| KB-08 | Knowledge Retrieval | 待代码确认 | `/api/ai/chat` 在 Direct Response 之后执行知识检索，高置信直接回答，中置信注入 Agent | “我多少积分”不被 KB 抢答；相似安全问答返回 `usedKnowledge=true`；中置信注入后来源仍被记录 |
| KB-09 | 角色与权限过滤 | 待代码确认 | 检索前按 roleScope、visibility、sensitivity、status 过滤 | student 不能命中 auditor/admin 知识；auditor 不能看到 admin scoped 知识；管理员预览有审计记录 |
| KB-10 | 来源标注与反馈 | 待代码确认 | 前端在 assistant bubble 内展示知识来源，回复底部支持有用/无用/举报 | 使用 KB 的回复必须有 `knowledgeSources` 和 `knowledgeHitIds`；反馈写入 turn、hit 和知识反馈汇总 |
| KB-11 | maintenanceStatus + retrievalPolicy | 待代码确认 | 知识条目有维护状态和 direct/inject/retrieval 行为开关 | `STALE_REVIEW`、`SECURITY_SUSPENDED`、`ARCHIVED` 普通用户不可命中；`LOW_QUALITY_REVIEW` 不直接回答 |
| KB-12 | AiKnowledgeMaintenanceWorker | 待代码确认 | Worker 计算质量分、新鲜度、反馈趋势、重复风险，生成维护任务或暂停风险知识 | 重复运行不产生重复 OPEN task；安全举报后自动 `SECURITY_SUSPENDED` 且 retrieval disabled |
| KB-13 | AiKnowledgeMaintenanceTask | 待代码确认 | 待维护任务有 priority、reason、dedupeKey、状态流转 | 管理端可按 P0-P4 查看任务；resolve/dismiss 写 AuditLog；同一 dedupeKey 不重复创建 |
| KB-14 | AiKnowledgeRevision | 待代码确认 | 手工编辑、合并、过期修复、安全修复都创建不可变 revision snapshot | 修改答案后 version +1；oldSnapshot/newSnapshot 可读；可回滚；归档知识仍保留 revision 和 hit |
| KB-15 | 知识投毒防护 | 待代码确认 | 入库前和维护扫描计算 poisoningRiskScore，指令型/越权型内容拒绝或安全复审 | 含“忽略规则”“以后都自动通过”等样例不能入库；已入库发现后进入 `SECURITY_SUSPENDED` |
| KB-16 | Embedding 版本化 | 待代码确认 | embeddingModel、embeddingVersion、contentHash、embeddingUpdatedAt 可追踪 | 更换 embedding 模型后不混用旧阈值；内容变更触发重算任务；重算前可 fallback 到文本相似度 |
| KB-17 | 管理端待维护工作台 | 待代码确认 | 管理员能看待更新、低质量、重复、暂停、归档候选和推荐动作 | 页面展示触发原因、反馈趋势、相似知识、revision diff；支持修订、合并、暂停、恢复、归档 |
| KB-18 | Skill Candidate 晋升 | 待代码确认 | 高质量稳定方法论生成 Skill Candidate，管理员二次审批后安装 | 只有满足命中、反馈、质量、安全阈值的知识可晋升；安装写入 `AiSkillInstallLog` 和 AuditLog |
| KB-19 | 安全与滥用测试 | 待代码确认 | 覆盖 prompt injection、越权、敏感泄露、安全举报、维护状态过滤 | P0 安全测试全部通过；失败时阻断上线；安全暂停恢复必须有管理员复核和 revision |
| KB-20 | 观测与回滚 | 待代码确认 | 有指标、审计、维护运行记录、禁用开关和回滚路径 | 可关闭 capture/retrieval/maintenance；可按知识 ID 归档、暂停、恢复；Worker run 有统计和错误记录 |

---

## 18. 验收清单

### 18.1 用户会话生命周期

- [x] 用户进入 AI 助手默认创建新 `AiProblemSession`。
- [x] `/api/ai/chat` 请求携带 `sessionId`。
- [x] 每轮对话写入 `AiProblemSessionTurn` 脱敏文本。
- [x] 前端 heartbeat 更新 `lastActiveAt`。
- [x] 离开 AI 页面过久后弹框询问是否解决。
- [x] 用户点击“已解决”后触发总结。
- [x] 用户点击“还没解决”后继续当前会话。
- [x] 用户点击“不沉淀”后不进入知识库。

### 18.2 总结、评分、去重

- [x] 已解决会话生成结构化 JSON 总结。
- [x] 总结包含 problem、resolution、steps、pitfalls、failedAttempts。
- [ ] AI 评分字段完整。
- [x] 规则评分兜底生效。
- [x] 敏感内容被拒绝或脱敏。
- [ ] duplicateRiskScore >= 0.72 阻断自动入库。
- [x] 管理端可查看相似知识和合并建议。

### 18.3 高频自动入库

- [ ] 同类问题进入 `AiKnowledgeCluster`。
- [ ] resolvedSessionCount / totalAskCount 正确累计。
- [ ] 达到阈值后创建 `AUTO_APPROVED` 知识。
- [ ] 自动入库原因写入 `autoApprovalReason`。
- [ ] 管理员可撤回或归档自动入库条目。

### 18.4 知识库回答复用

- [ ] Direct Response 优先于 Knowledge Retrieval。
- [ ] 高置信知识命中直接回答。
- [ ] 中置信知识命中注入 Agent。
- [ ] 命中写入 `AiKnowledgeHit`。
- [ ] 响应返回 `usedKnowledge` 和 `knowledgeSources`。
- [ ] 前端在 AI 回复框底部显示平台知识库来源。
- [ ] 用户可反馈有用、无用、举报。

### 18.5 知识库持续维护

- [ ] 已入库知识有 `maintenanceStatus`、质量分、最近命中、最近反馈和复审时间。
- [ ] 点踩率高、举报、过期反馈会触发降级、暂停或待复审。
- [ ] 合并和手工编辑会创建 `AiKnowledgeRevision`，可审计、可回滚。
- [ ] Knowledge Retrieval 会过滤 `SECURITY_SUSPENDED` / `ARCHIVED` / `STALE_REVIEW` / `RETRIEVAL_DISABLED` 条目。
- [ ] `LOW_QUALITY_REVIEW` 不允许高置信直接回答，只能降级注入 Agent 或等待复审。
- [ ] Worker 重复运行不会生成重复 OPEN 维护任务。
- [ ] 知识投毒样例会被拒绝入库或进入 `SECURITY_SUSPENDED`。
- [ ] 管理端有待维护队列，可修订、合并、暂停、恢复、归档。

### 18.6 Skill 晋升

- [ ] 只有 APPROVED / AUTO_APPROVED 且质量足够的知识可生成 Skill Candidate。
- [ ] Skill Candidate 必须管理员二次审批。
- [ ] 安装写入 `CQUPT_HERMES_SKILLS_ROOT`。
- [ ] 安装成功写 `AiSkillInstallLog`。
- [ ] 源知识状态更新为 `PROMOTED_TO_SKILL`。

---

## 19. 分阶段实施路线

### Phase 1：问题会话生命周期

目标：让“每次进入新对话 + 用户确认已解决”跑通。

范围：

- 新增 `AiProblemSession` / `AiProblemSessionTurn`。
- `/api/ai/chat` 支持 `sessionId`。
- 前端进入 AI 助手创建 session。
- heartbeat / leave / active check。
- 解决确认弹框。
- 用户点击已解决后更新 session 状态。

不包含：

- 自动入库。
- 知识库检索回答。
- cluster 聚合。

### Phase 2：已解决会话总结与管理员审核

目标：已解决会话进入管理员审核。

范围：

- `summarizeResolvedSession()`。
- AI + 规则评分。
- duplicateRiskScore。
- 管理端展示 resolved sessions。
- 管理员批准入库 / 丢弃 / 标为 Skill Candidate。

### Phase 3：知识库检索回答与来源标注

目标：其他用户问到知识库内容时可以复用。

范围：

- Knowledge Retrieval 接入 `/api/ai/chat`。
- 高置信直接回答。
- 中置信注入 Agent。
- `AiKnowledgeHit` 记录。
- 前端显示“参考平台知识库”。
- feedback 有用 / 无用 / 举报。

### Phase 4：高频高质自动入库

目标：达到阈值时自动加入数据库。

范围：

- `AiKnowledgeCluster`。
- 按 topicKey 聚合。
- 高频阈值。
- `AUTO_APPROVED` 状态。
- 自动入库原因记录。
- 管理员可撤回。
- 自动入库监控。

### Phase 5：知识库持续维护

目标：避免知识一次入库后失效或污染后续回答。

范围：

- `AiKnowledgeMaintenanceWorker`。
- `AiKnowledgeRevision`。
- 质量分、过期分、反馈趋势和维护状态。
- 待维护管理视图。
- 修订、合并、降级、暂停、恢复、归档流程。

### Phase 6：Skill 晋升优化

目标：稳定方法论晋升 Hermes Skill。

范围：

- 从高命中知识条目生成 Skill Candidate。
- 管理员二次审批。
- 安装到平台 Hermes skills 目录。
- 保持现有受控安装链路。

---

## 20. 最终结论

CQUPT-SRC 采用“问题会话式知识沉淀”后，知识库不再由零散单轮对话驱动，而由“用户确认已解决的问题会话”驱动。

最终链路：

```text
用户进入邮宝
  -> 新问题会话
  -> 多轮解决问题
  -> 用户确认已解决
  -> AI 总结与评分
  -> 后端规则兜底
  -> 相似聚类与去重
  -> 管理员审核或高频高质自动入库
  -> AI Knowledge Base
  -> 后续相似问题复用
  -> 回复底部标注平台知识来源
  -> 基于反馈、命中、过期和重复信号持续维护
  -> 稳定方法论再晋升 Hermes Skill
```

这套方案能让邮宝在真实使用中成长，同时降低未解决对话、敏感信息、错误知识和 prompt injection 污染平台长期知识的风险。
