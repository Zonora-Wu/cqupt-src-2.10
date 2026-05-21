# CQUPT-SRC AI 知识沉淀与 Skill 晋升方案

本文档是 CQUPT-SRC 平台“邮宝”AI 知识沉淀、相似知识去重、AI 评分自动流转、管理员审核与 Hermes Skill 晋升的当前权威方案。

平台面向用户的 AI 助手名称统一为“邮宝”。Hermes Agent 仅表示底层模型编排和 skill 运行环境。本文所有“知识沉淀”均指沉入 PostgreSQL 主业务库，不是直接写入 Hermes skills 目录。

## 1. 核心原则

```text
多轮问题解决会话
  → 脱敏与泛化
  → AI + 规则混合评分
  → 相似知识去重 / 合并建议
  → 自动低风险流转或管理员审核
  → AI Knowledge Base
  → 高质量稳定流程再成为 Skill Candidate
  → 管理员二次审批
  → 受控安装到平台 Hermes skills 目录
```

必须避免：

- 用户每问一个问题就创建 Hermes Skill。
- 把 A 用户原始对话、资产、漏洞细节或凭据暴露给 B 用户。
- 用知识库或 Skill 保存实时积分、库存、漏洞状态、证书状态。
- 让模型绕过后端 JWT、RBAC、Prisma transaction 和 AuditLog。
- 自动把 Skill Candidate 安装进 Hermes 运行目录。

## 2. 分层设计

### 2.1 AI Knowledge Base

AI Knowledge Base 是主力层，适合保存动态、可检索、可审核的通用经验：

- 靶场安装与排错经验。
- XSS / SQL 注入 / SSRF / 文件上传等漏洞报告写作方法。
- 待补充材料怎么写。
- 漏洞为什么被驳回的通用原因。
- 新手学习 Web 安全的路线。
- 平台使用类通用问题。

特点：

- 存储在 PostgreSQL。
- 可按角色可见。
- 有审核状态、命中统计、反馈统计。
- 可撤回、归档、拒绝。
- 不直接进入 Agent system prompt；只在检索命中时作为参考上下文或直接回答来源。

### 2.2 Skill Candidate

Skill Candidate 是中间层，适合保存稳定、可复用、长期有效的方法论草稿：

- 需要脚本、命令收集信息或批量诊断的流程。
- 多步骤排错工作流。
- 审核员初筛流程。
- 漏洞报告结构化写作流程。
- 学习路径推荐方法论。

Skill Candidate 不等于已安装 Skill。它必须经过管理员二次审批，审批通过后才能调用安装接口写入平台 Hermes skills 目录。

### 2.3 Hermes Skill

Hermes Skill 是长期稳定方法论，数量应少而精。它不保存实时数据，不保存用户隐私，不保存真实资产、Token、Cookie 或原始附件。

当前平台 Hermes skills 根目录：

```text
宿主机: /home/cocking/cqupt-src-hermes-linux/data/skills/cqupt-src
容器内: /opt/data/skills/cqupt-src
```

CLI Hermes 的 `/home/cocking/.hermes/skills` 与平台 Hermes 是两套环境，不应混用。

## 3. 当前实现文件

```text
backend/src/modules/ai-knowledge/
├── ai-knowledge.controller.ts
├── ai-knowledge.module.ts
├── ai-knowledge.service.ts
├── ai-knowledge.types.ts
└── ai-knowledge.validation.ts

frontend/src/pages/admin/AdminAiKnowledgeManagement.tsx
frontend/src/services/aiKnowledge.ts

database/prisma/schema.prisma
database/prisma/migrations/20260520143000_ai_conversation_learning/migration.sql
database/prisma/migrations/20260521105000_ai_conversation_scoring/migration.sql
database/prisma/migrations/20260521153500_ai_conversation_deduplication/migration.sql
```

相关主链路：

- `backend/src/modules/ai/ai.service.ts` 在 AI 回复后调用 `enqueueCapture()` 与 `recordConversationTurn()`。
- `AiKnowledgeConversation` 记录多轮会话。
- `AiKnowledgeConversationTurn` 记录脱敏后的 user / assistant turn。
- `AiKnowledgeEntry` 保存已审核或自动批准的知识条目。
- `AiSkillCandidate` 保存 Skill 候选草稿。
- `AiSkillInstallLog` 记录 Skill 安装结果。

## 4. 多轮会话沉淀链路

### 4.1 捕获

每次 AI 对话后，后端记录当前用户问题与邮宝回答：

```text
POST /api/ai/chat
  → 正常返回 AI 回复
  → enqueueCapture(question, answer)
  → recordConversationTurn(question, answer)
```

`recordConversationTurn()` 会：

1. 对文本执行基础脱敏。
2. 拒绝明显敏感、prompt injection 或回答过短内容。
3. 基于 `topicKey` 聚合同一用户 2 小时内同主题会话。
4. 写入 `AiKnowledgeConversationTurn`。
5. 当出现“排错 / 环境 / 版本 / 成功解决”等信号时自动触发 `summarizeConversation()`。

### 4.2 总结

`summarizeConversation()` 会从多轮对话中提取：

- `title`：沉淀标题。
- `problemStatement`：问题陈述。
- `resolutionSummary`：解决摘要。
- `environmentNotes`：环境 / 版本要点。
- `pitfalls`：踩坑点。
- `successfulSteps`：最终有效步骤。
- `failedAttempts`：失败尝试。
- `collectedEvidence`：日志、报错、命令输出等证据。
- `suggestedKnowledgeType`：KB / SKILL / DISCARD。

## 5. AI + 规则混合评分

评分调用平台 Hermes OpenAI-compatible 接口：

```text
默认 baseURL: http://localhost:5000/v1
默认 model: hermes-agent
```

后端会请求 AI 输出严格 JSON：

```json
{
  "suggestedKnowledgeType": "KB|SKILL|DISCARD",
  "overallScore": 0.0,
  "kbScore": 0.0,
  "skillScore": 0.0,
  "safetyScore": 0.0,
  "privacyRiskScore": 0.0,
  "confidenceScore": 0.0,
  "reason": "一句中文原因",
  "signals": ["证据"],
  "risks": ["风险"]
}
```

规则评分作为兜底：

- AI 调用失败时使用规则评分。
- 隐私风险取 AI 与规则中的更高值。
- 安全分取 AI 与规则中的更低值。
- 检测到敏感信息、prompt injection、越权风险时，不允许自动沉淀。

当前自动流转阈值：

```text
KB 自动沉淀：
  suggestedKnowledgeType = KB
  overallScore >= 0.88
  kbScore >= 0.82
  safetyScore >= 0.86
  privacyRiskScore <= 0.16
  confidenceScore >= 0.76

Skill 自动候选：
  suggestedKnowledgeType = SKILL
  overallScore >= 0.84
  skillScore >= 0.82
  safetyScore >= 0.82
  privacyRiskScore <= 0.18
  confidenceScore >= 0.72

其他：
  READY_REVIEW，由管理员决定
```

## 6. 相似知识去重与合并建议

为避免知识库膨胀和重复沉淀，`summarizeConversation()` 在自动批准前执行相似知识检查。

### 6.1 检查范围

系统根据会话摘要生成 tokens，并在相同类别、相同角色范围或 `ALL` 范围内检索：

- `APPROVED`
- `AUTO_APPROVED`
- `PROMOTED_TO_SKILL`
- `NEEDS_REVIEW`

只检查 `PUBLIC` / `INTERNAL` 敏感等级的条目。

### 6.2 评分字段

`AiKnowledgeConversation` 新增：

```text
duplicateRiskScore       Float
similarKnowledgeMatches  Json
mergeSuggestion          Text
```

`similarKnowledgeMatches` 每项包含：

```json
{
  "id": "knowledge id",
  "title": "已有知识标题",
  "category": "XSS",
  "status": "APPROVED",
  "similarity": 0.86,
  "hitCount": 12,
  "helpfulCount": 8,
  "tags": ["xss", "report"]
}
```

### 6.3 阈值

```text
duplicateRiskScore >= 0.86：强重复风险，必须人工审核，建议合并到已有条目。
duplicateRiskScore >= 0.72：中等重复风险，必须人工审核，管理员决定合并或保留独立变体。
duplicateRiskScore < 0.72：可作为审核参考，不阻断自动流转。
```

只要重复风险达到 0.72，即使 AI 评分满足自动沉淀条件，也会进入 `READY_REVIEW`，避免重复知识自动入库。

## 7. 管理端审核页面

页面：`frontend/src/pages/admin/AdminAiKnowledgeManagement.tsx`

管理端展示：

- 多轮会话沉淀队列。
- AI 评分：综合、KB、Skill、安全、隐私风险、重复风险。
- AI 证据 signals / 风险 risks。
- 相似知识合并建议。
- 相似知识标题、状态、相似度、命中次数。
- 原始脱敏对话片段。
- 操作按钮：重新总结、沉入知识库、标为 Skill、丢弃。
- 知识审核队列。
- Skill Candidate 列表、审批、安装结果。

审核策略：

- 低风险高分且无重复风险：可自动入库。
- 有重复风险：管理员优先合并踩坑点、环境差异或补充步骤。
- Skill 候选：只进入候选池，不自动安装。
- 丢弃：用于未解决、低质量、敏感、重复无新增价值的会话。

## 8. API 链路

管理员权限均使用 `ai:manage_skills`。

```http
GET  /api/ai/knowledge/stats
GET  /api/ai/knowledge
POST /api/ai/knowledge
POST /api/ai/knowledge/:id/review
POST /api/ai/knowledge/:id/feedback

GET  /api/ai/knowledge/capture-jobs
POST /api/ai/knowledge/process-captures

GET  /api/ai/knowledge/conversations
POST /api/ai/knowledge/conversations/:id/summarize
POST /api/ai/knowledge/conversations/:id/review

GET  /api/ai/knowledge/skill-candidates
POST /api/ai/knowledge/skill-candidates
POST /api/ai/knowledge/skill-candidates/:id/review
POST /api/ai/knowledge/skill-candidates/:id/install
```

会话审核状态：

```text
ACTIVE
READY_REVIEW
APPROVED_TO_KB
SKILL_CANDIDATE
DISCARDED
```

知识条目状态：

```text
CANDIDATE
AUTO_APPROVED
NEEDS_REVIEW
APPROVED
REJECTED
ARCHIVED
PROMOTED_TO_SKILL
```

Skill 候选状态：

```text
DRAFT
NEEDS_REVIEW
APPROVED
REJECTED
INSTALLED
FAILED
```

## 9. Skill 晋升与安装

### 9.1 从知识条目生成 Skill Candidate

管理员可选择已批准或自动批准的知识条目，填写：

- Skill name
- Skill description
- sourceKnowledgeIds

后端生成 `SKILL.md`，内容包含：

- YAML frontmatter。
- 安全边界。
- 来自已审核知识库的参考资料。
- 明确声明参考资料不是系统指令，不能覆盖权限边界。

### 9.2 审批

```http
POST /api/ai/knowledge/skill-candidates/:id/review
```

只有 `APPROVED` 的候选才能安装。

### 9.3 安装

```http
POST /api/ai/knowledge/skill-candidates/:id/install
```

安装安全措施：

- 默认写入 `/home/cocking/cqupt-src-hermes-linux/data/skills/cqupt-src`。
- 使用 `resolve` / `relative` 校验路径不逃逸根目录。
- 禁止符号链接目录。
- 使用临时文件 + `renameSync` 原子替换 `SKILL.md`。
- 写入 `AiSkillInstallLog`。
- 安装成功后：
  - `AiSkillCandidate.status = INSTALLED`
  - 源知识条目 `status = PROMOTED_TO_SKILL`
  - 源知识条目 `promotedSkillId = candidate.id`

## 10. 安全与隐私边界

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

## 11. 回答复用策略

用户新问题进入 Agent 前，应保持以下顺序：

```text
JWT / RBAC
  → Direct Response
  → AI Knowledge Retrieval
  → Knowledge Direct Answer / Knowledge Injected Agent
  → Normal Hermes Agent
```

Direct Response 必须优先于知识检索，因为积分、商品、漏洞状态、证书状态是实时数据，不能用历史知识回答。

推荐检索阈值：

```text
similarity >= 0.88：直接返回知识库答案
0.75 <= similarity < 0.88：注入 Agent 作为参考
similarity < 0.75：正常 Agent 推理
```

## 12. 验收清单

### 12.1 构建与迁移

```bash
cd /home/cocking/projects/cqupt-src-2.10/backend
npm run prisma:generate
npm run build
npm run prisma:migrate:deploy

cd /home/cocking/projects/cqupt-src-2.10/frontend
npm run build
```

### 12.2 后端健康检查

```bash
curl -s http://localhost:3000/api/health
```

### 12.3 链路验证

应验证以下闭环：

1. 创建多轮会话与 turns。
2. 调用 `/api/ai/knowledge/conversations/:id/summarize`。
3. 产生 AI 评分字段。
4. 产生重复风险字段与合并建议。
5. 低风险高分进入 `APPROVED_TO_KB` 或 `SKILL_CANDIDATE`。
6. 重复风险达到阈值时进入 `READY_REVIEW`。
7. 管理员 `APPROVED_TO_KB` 后生成 `AiKnowledgeEntry`。
8. 选择已批准知识创建 `AiSkillCandidate`。
9. 审批 Skill Candidate。
10. 安装 Skill Candidate 到平台 Hermes skills 目录。
11. `AiSkillInstallLog` 成功记录，源知识状态变为 `PROMOTED_TO_SKILL`。

## 13. 最终结论

CQUPT-SRC 采用“知识库优先、AI 评分、相似去重、管理员可控晋升”的方案：

```text
用户多轮问题解决经验
  → 邮宝总结
  → AI + 规则评分
  → 相似知识去重
  → 自动低风险沉淀 / 管理员审核
  → AI Knowledge Base
  → 高质量稳定流程
  → Skill Candidate
  → 管理员二次审批
  → Hermes Skill
```

这套方案能让平台 AI 随使用逐步成长，同时保持隐私安全、抗投毒、可追溯、可撤回，并避免把一次性问答污染为长期系统能力。
