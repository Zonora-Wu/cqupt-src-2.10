# CQUPT-SRC 自有 Agent Runtime、BYOK 与 Skill 平台化方案

> 文档状态：需求已确认，尚未实施  
> 形成日期：2026-07-23  
> 适用范围：CQUPT-SRC 用户侧 AI、管理员平台 AI、审核员平台 AI、平台后台 AI 任务  
> 相关文档：`docs/AI.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/architecture/AI_CONTEXT_INJECTION.md`

## 1. 文档目的

本文档定义 CQUPT-SRC 下一阶段 AI 架构：

- 不再要求额外部署 Hermes Agent Docker。
- 在现有 NestJS 后端内建设 CQUPT-SRC 自有轻量 Agent Runtime。
- Agent Runtime 不从零设计，而是审计 Hermes Agent 的 MIT 开源代码，移植适合平台的核心算法到 TypeScript。
- 普通用户可按管理员策略使用平台 AI 或自有 API Key。
- 管理员和审核员始终使用管理员配置的平台 AI。
- 建立按角色、所有者和工具权限隔离的 Skill 机制。
- 用户可以创建声明式私有 Skill，并申请人工审核为用户公共 Skill。
- 平台继续掌握身份、权限、数据、工具、脱敏、审计和写操作确认权。

本文档是目标方案，不代表当前代码已经完成迁移。当前生产链路仍以 `docs/HERMES_RUNTIME.md` 记录的独立 Hermes Agent 为准，直至迁移验收和切换完成。

---

## 2. 已确认决策

### 2.1 Runtime

- 采用 TypeScript 方案。
- Runtime 位于现有 NestJS 后端。
- 不增加独立 Hermes Docker。
- 不在后端容器内嵌 Python Hermes Runtime。
- 不使用泄露、来源不明或许可证不明确的 Claude Code 代码。
- 允许在 MIT License 条件下移植 Hermes Agent 核心算法。
- 首次移植后暂不建设 Hermes 上游自动更新机制。

### 2.2 模型使用策略

管理员设置普通用户的三档策略：

```text
USER_PLATFORM_ONLY
USER_BYOK_ONLY
USER_HYBRID
```

- 管理员始终使用平台 AI。
- 审核员始终使用平台 AI。
- 平台后台任务始终使用平台 AI，但普通用户自己的异步任务在选择 BYOK 后使用该用户 Key。
- 用户选择自有模型后，用户侧所有模型调用均使用自有模型，不按功能混用平台模型。
- 用户模型失败时不自动回退平台模型。
- 平台不评价用户模型质量和能力，用户自行承担效果和费用。
- 平台仍执行协议、参数、权限、工具和输出安全校验。

### 2.3 Provider

- 首期只支持 OpenAI-compatible API。
- 支持官方供应商、聚合平台和第三方中转站。
- 供应商目录参考 CC Switch 的 MIT 开源 Provider Preset。
- 用户不能输入任意 Base URL，只能选择管理员启用的供应商。
- 模型由用户自行选择；平台不维护模型质量评级。
- 同一用户可为同一供应商保存多个 Key。

### 2.4 Skill

- 用户、审核员、管理员 Skill 作用域分离。
- 用户可创建声明式私有 Skill。
- 用户私有 Skill 可使用提示词和平台白名单只读工具。
- 用户私有 Skill 禁止写操作和可执行代码。
- 用户可以申请将私有 Skill 发布为普通用户公共 Skill。
- 审核员不能创建 Skill，只能使用管理员发布给审核员的 Skill。
- 管理员创建平台 Skill，并指定适用角色。
- Skill 发布采用单管理员全人工审核。
- AI 不参与 Skill 审核、评分或发布决策。
- 确定性文件安全检查保留，但不产生内容审核结论。

### 2.5 前端

- 管理员新增配置尽量少。
- 用户设置只增加必要的“自有 AI 模型”管理。
- AI 助手只增加模型选择和 Skill 选择。
- Skill 管理放在 AI 助手内部，不增加一级主菜单。

---

## 3. 目标与非目标

### 3.1 目标

1. 降低部署门槛：部署 CQUPT-SRC 时不再要求单独准备 Hermes 数据目录、容器、端口和网关配置。
2. 控制平台模型成本：管理员可以要求用户 BYOK，或允许用户自主选择。
3. 保持平台能力：更换模型不影响 RBAC、知识库、Skill、平台工具、漏洞评分和审计。
4. 降低 Token 浪费：只注入命中的 Skill 和最小必要业务上下文。
5. 建立安全多租户 Skill：用户私有 Skill 不得影响其他用户或其他角色。
6. 保持可审计：每次模型、Skill、工具和策略选择均可追踪。
7. 保持模型中立：Runtime 面向 OpenAI-compatible API，不绑定特定模型。

### 3.2 非目标

首期不建设：

- 用户上传 Shell、Python、Node.js 或其他可执行 Skill。
- 用户自定义 MCP Server。
- 用户提供任意 Base URL。
- OAuth、Cookie、Claude Code 订阅或 Codex 订阅复用。
- Anthropic Messages、Gemini Native、Bedrock 协议。
- 完整复制 Hermes 的 TUI、Gateway、Cron、Memory、Terminal、浏览器或文件工具。
- 自动同步 Hermes 上游更新。
- AI 自动审核 Skill。
- 平台替用户估算第三方模型费用。
- 平台认证或保证第三方中转站模型真实性。

---

## 4. 总体架构

```text
┌────────────────────────────────────────────────────────────┐
│ React 前端                                                 │
│                                                            │
│ AI 助手 / 用户模型设置 / 用户 Skill / 管理员 AI 设置          │
└────────────────────────────┬───────────────────────────────┘
                             │ JWT / REST / SSE
                             ▼
┌────────────────────────────────────────────────────────────┐
│ NestJS AI Gateway                                          │
│                                                            │
│ Auth / RBAC / Model Policy / Quota / Redaction / Audit      │
└───────────┬──────────────────────────────┬─────────────────┘
            │                              │
            ▼                              ▼
┌──────────────────────────┐   ┌─────────────────────────────┐
│ CQUPT Agent Runtime      │   │ Platform Business Services  │
│                          │   │                             │
│ Agent Loop               │   │ Vulnerability / Learning    │
│ Provider Registry        │   │ Points / Certificates       │
│ Skill Registry           │   │ Notifications / Settings    │
│ Context Builder          │   │ Knowledge / Audit           │
│ Tool Coordinator         │   └──────────────┬──────────────┘
│ Run Events               │                  │
│ Compaction               │                  ▼
└───────────┬──────────────┘   ┌─────────────────────────────┐
            │                  │ PostgreSQL / Redis / MinIO  │
            │                  └─────────────────────────────┘
            ▼
┌────────────────────────────────────────────────────────────┐
│ Provider Adapter                                           │
│                                                            │
│ 平台 Provider / 用户 BYOK Provider / 主模型 / 备用模型        │
└────────────────────────────┬───────────────────────────────┘
                             ▼
                OpenAI-compatible Provider
```

### 4.1 信任边界

可信：

- JWT 身份。
- 后端 RBAC。
- 后端查询结果。
- 后端 Tool Gateway。
- 后端生成的真实业务 ID。
- 后端策略快照。

不可信：

- 用户消息。
- 用户 Skill 内容。
- 模型输出。
- Tool Call 参数。
- 用户填写的模型名。
- 供应商返回的 Usage。
- 第三方中转站返回内容。

模型永远不能直接决定权限、用户身份、数据归属或写操作是否执行。

---

## 5. Hermes Agent 源码派生策略

Hermes Agent 使用 MIT License，可以在保留许可证和版权声明的前提下复制、修改和再发布。

### 5.1 拟审计和移植的能力

- Agent Loop 状态机。
- 多轮 Tool Call 处理。
- Run 启动、停止、超时和事件流。
- Skill 文件发现、Frontmatter 解析和按需加载。
- Provider 与模型配置抽象。
- 上下文压缩与轨迹摘要。
- Tool Schema 归一化。
- 结构化输出恢复。
- 相关单元测试和行为样本。

### 5.2 明确排除

- Terminal Backend。
- 本地文件读写工具。
- Docker、SSH、Modal、Daytona 执行。
- Cron。
- TUI。
- Telegram、Discord、Slack 等 Gateway。
- Hermes 本地 Memory。
- Profile 文件目录。
- 任意 MCP 自动加载。
- Agent 自动创建可执行 Skill。

### 5.3 派生代码记录

计划新增：

```text
backend/third-party/hermes-derived/
├── LICENSE
├── NOTICE.md
├── UPSTREAM_COMMIT
├── SOURCE_MAP.json
└── ADAPTATION.md
```

要求：

- `UPSTREAM_COMMIT` 固定首次移植的 Hermes Commit。
- `SOURCE_MAP.json` 记录 TypeScript 模块对应的 Hermes 原文件。
- `ADAPTATION.md` 记录安全裁剪和行为差异。
- 不将 Hermes 完整源码复制进项目。
- 不提供自动更新入口。

具体上游 Commit 在实施开始时锁定，目前未确认。

---

## 6. Agent Runtime 模块

计划目录：

```text
backend/src/modules/agent-runtime/
├── agent-runtime.module.ts
├── agent-loop.service.ts
├── agent-run.service.ts
├── agent-run-events.service.ts
├── agent-context.service.ts
├── agent-compaction.service.ts
├── agent-output.service.ts
├── agent.types.ts
├── providers/
│   ├── provider-registry.service.ts
│   ├── provider-policy.service.ts
│   ├── openai-compatible.adapter.ts
│   ├── provider-credential.service.ts
│   └── provider.types.ts
├── skills/
│   ├── skill-registry.service.ts
│   ├── skill-parser.service.ts
│   ├── skill-router.service.ts
│   ├── skill-package-validator.service.ts
│   ├── skill-review.service.ts
│   └── skill.types.ts
└── tools/
    ├── tool-registry.service.ts
    ├── tool-policy.service.ts
    ├── tool-execution.service.ts
    └── tool.types.ts
```

### 6.1 Agent Loop

统一状态机：

```text
CREATED
QUEUED
RUNNING
WAITING_TOOL
WAITING_CONFIRMATION
COMPLETED
FAILED
CANCELLED
TIMED_OUT
```

基本循环：

```text
构建请求
  -> 调用模型
  -> 没有 Tool Call：验证并完成
  -> 有 Tool Call：验证工具和参数
  -> 执行只读工具或生成写操作确认
  -> 回灌工具结果
  -> 继续模型调用
  -> 达到轮数、时间或调用预算后停止
```

### 6.2 请求级上下文

每个 Run 固定：

```ts
type AgentRunContext = {
  runId: string
  userId: string
  role: 'STUDENT' | 'AUDITOR' | 'ADMIN'
  policyVersion: string
  modelSource: 'PLATFORM' | 'USER'
  providerCredentialId: string
  modelName: string
  skillRevisionIds: string[]
  allowedToolNames: string[]
  tokenBudget: number
  timeoutMs: number
}
```

Run 创建后，不因管理员中途切换策略而改变。紧急终止除外。

### 6.3 Tool 安全

- 工具列表来自后端注册表。
- 模型不能创建工具。
- Tool Call 中的 `userId`、`role`、`permission`、`token`、`jwt` 一律丢弃。
- 后端强制使用当前 Run 身份。
- 参数使用结构化 Schema 验证。
- 只读工具直接执行。
- 写工具只产生待确认操作。
- 用户私有 Skill不能绑定写工具。
- 真实业务 ID 必须来自后端查询结果。

---

## 7. 用户模型三档策略

### 7.1 `USER_PLATFORM_ONLY`

- 普通用户所有 AI 功能使用平台 AI。
- 用户 BYOK 凭据保留但暂停使用。
- 已有 BYOK 会话变为只读。
- 用户继续提问时创建平台模型新会话。
- 已运行 BYOK Run 按快照完成。
- 新 Run 使用平台模型。

### 7.2 `USER_BYOK_ONLY`

- 普通用户所有 AI 功能必须使用自己的模型。
- 未配置可用模型时禁止发起 AI 请求。
- 已有平台模型会话变为只读。
- 用户配置模型后创建新会话。
- 已运行平台 Run 按快照完成。
- 管理员、审核员和平台后台任务仍使用平台 AI。

### 7.3 `USER_HYBRID`

- 用户新建会话时选择平台模型或自己的模型。
- 会话建立后固定模型来源。
- 切换来源创建新会话。
- 可选择只携带脱敏摘要，不携带原始完整对话。
- 现有会话继续使用原来源。

### 7.4 用户侧全量替换规则

用户选择 BYOK 后，以下模型调用全部使用用户模型：

- 普通对话。
- 模糊意图辅助判断。
- Skill 推理。
- PDF 漏洞报告评分。
- “我的漏洞”AI 建议。
- 首页个人数据分析。
- 会话摘要。
- 上下文压缩。
- 用户会话知识沉淀总结。
- 用户私有 Skill 内容生成。
- 用户自己的异步 AI 任务。

平台不在失败时自动使用平台模型。

---

## 8. 平台 AI

管理员、审核员和平台后台任务始终使用平台 AI。

### 8.1 配置

管理员通过弹窗配置一组全局主备模型：

- 一个主模型。
- 最多两个备用模型。
- 管理员、审核员和平台后台任务共用该路由，不再按用途分别配置。
- 旧版按用途路由继续兼容读取；保存全局路由后，全局配置优先生效。
- 管理员与用户使用相同的供应商预设选择器；自定义配置置顶，中国供应商优先展示。
- 预设自动填充供应商名称、备注、官网、API 请求地址和默认模型，配置 JSON 随表单实时生成。
- 用户凭据单独保存 API 请求地址，允许同一供应商使用不同兼容端点。
- 用户在模型配置弹窗中选择平台模型或自有默认模型；AI 对话框不再提供临时模型下拉框。
- “平台模型”固定显示在用户配置列表首位。混合模式下，无自有默认模型即使用平台模型。
- AI 助手输入框上方提供模型配置、Skill 管理和已固定 Skill 模块，不再使用 Skill 下拉框。
- Skill 管理弹窗平铺可用 Skill，负责当前 Skill 选择与固定；添加或上传 Skill 使用右上角二级弹窗。
- 当前 Skill 与固定列表按用户保存在本机，失效或删除的 Skill 会自动清理。
- 单次对话最多启用 3 个 Skill。点击固定 Skill 后，Skill 以不可编辑标签插入消息编辑器当前光标位置；标签不会混入用户正文，只通过结构化 `skillIds` 发送。

### 8.2 故障转移

- 主模型连续失败后触发熔断。
- 自动选择全局备用模型。
- 同一次失败请求不无限重试。
- 切换行为写审计。
- 管理员可以关闭自动故障转移。
- 不向前端暴露平台 Key。

### 8.3 配额

- 平台 AI 使用现有日、周、月 Token 额度。
- 管理员仍可覆盖单用户额度。
- BYOK 调用不占平台 AI Token 额度。

---

## 9. Provider 目录

### 9.1 来源

- 参考 CC Switch Provider Preset。
- 保留 CC Switch MIT License 和来源说明。
- 固定一个实施时选定的 CC Switch Commit。
- 暂不建设自动同步。
- 具体 Commit 目前未确认。

### 9.2 首期协议

仅支持 OpenAI-compatible：

- Chat Completions。
- 可选流式响应。
- OpenAI 风格 Tool Call。
- `/v1/models` 可用时进行模型发现。

暂不支持：

- Anthropic Messages。
- Gemini Native。
- Bedrock。
- OAuth 订阅。
- Cookie 或浏览器会话。
- 需要本地代理接管的订阅复用。

### 9.3 分类

```text
OFFICIAL
AGGREGATOR
RELAY
```

- 官方供应商可以默认进入可选目录。
- 聚合平台和第三方中转由管理员选择后使用。
- 不导入 CC Switch 推广链接、优惠码和赞助内容。
- 不导入 localhost、本地代理或桌面客户端配置。

### 9.4 Provider Preset

```ts
type ProviderPreset = {
  id: string
  name: string
  category: 'OFFICIAL' | 'AGGREGATOR' | 'RELAY'
  baseUrl: string
  protocol: 'OPENAI_COMPATIBLE'
  modelsPath?: string
  enabled: boolean
  source: 'CC_SWITCH' | 'PLATFORM'
  sourceCommit: string
}
```

用户不能修改 `baseUrl`。

---

## 10. 用户凭据与模型配置

### 10.1 凭据和模型分离

一个 Provider Credential 保存一个 Key。相同供应商允许多个 Credential。

```text
OpenRouter - 个人 Key
├── Model Profile A
└── Model Profile B

OpenRouter - 实验室 Key
└── Model Profile C
```

限制：

- 每用户最多 5 个 Provider Credential。
- 每个 Credential 最多关联 10 个模型。
- 每用户最多 20 个 Model Profile。
- 只能设置一个默认 Model Profile。

### 10.2 用户可设置

- 凭据名称。
- 供应商。
- API Key。
- 模型名称。
- 模型显示名。
- 默认模型。
- 启用、停用和删除。

用户不能设置：

- Base URL。
- 平台 System Prompt。
- Tool Schema。
- 权限规则。
- Agent 最大轮数。
- 平台安全策略。

### 10.3 模型能力

- 平台不评价或认证用户模型能力。
- 平台不阻止用户选择低能力模型。
- 平台仍验证协议和结构。
- 无法解析 Tool Call 或结构化输出时停止当前 Run。
- 不猜测错误参数。
- 不回退平台模型。
- 错误提示说明当前模型未完成请求，不声称模型永久不支持某能力。

---

## 11. API Key 安全

### 11.1 加密

- 独立环境变量 `AI_CREDENTIAL_ENCRYPTION_KEY`。
- 不复用 JWT Secret、邮箱加密 Key 或数据库密码。
- AES-256-GCM。
- 每条 Key 使用独立随机 IV。
- 保存加密版本，为未来轮换预留。

建议持久化：

```text
ciphertext
iv
authTag
keyVersion
lastFour
createdAt
updatedAt
lastUsedAt
```

### 11.2 访问

- 用户只能创建、替换、测试、停用和删除自己的 Key。
- 保存后不能读取明文。
- 管理员不能读取用户 Key 明文。
- 后端仅在发起上游请求前短暂解密。
- 队列仅保存 Credential ID。
- Key 不进入 Skill、聊天记录、日志、审计或异常堆栈。

### 11.3 删除

- 删除前确认关联模型和后台任务。
- 停用关联 Model Profile。
- 取消未开始任务。
- 尝试终止运行中的用户任务。
- 删除密文。
- 保留不含 Key 的审计记录。

### 11.4 备份

- 数据库备份可包含密文。
- 备份不得包含 `AI_CREDENTIAL_ENCRYPTION_KEY`。
- 主密钥单独保管。
- 主密钥丢失后，用户必须重新填写 Key。

---

## 12. 第三方数据授权

首次启用每个 Provider Credential 时，用户必须确认：

```text
我理解本次 AI 请求将发送至所选第三方模型服务。
CQUPT-SRC 不控制该供应商的数据保存、训练和日志策略。
请勿使用不可信中转服务处理敏感报告。
```

规则：

- 官方、聚合和中转显示不同类别。
- 中转站显示“非平台运营”。
- 每个 Provider Credential 单独记录授权。
- 授权文本版本变化后重新确认。
- 管理员不能代用户确认。
- 撤回授权后立即停用 Credential。
- PDF 和漏洞内容继续执行平台既有脱敏。

可能发送给用户供应商的内容：

- 用户问题。
- 必要对话上下文。
- 激活的 Skill 指令。
- 平台查询结果摘要。
- 漏洞报告脱敏字段。
- PDF 解析后的脱敏文本。
- Tool Call 结果。
- 会话摘要。

---

## 13. Skill 作用域

```text
PLATFORM_COMMON
USER_BUILTIN
USER_PRIVATE
AUDITOR_BUILTIN
ADMIN_BUILTIN
ADMIN_PRIVATE
```

### 13.1 用户

- 创建、修改、停用和删除自己的私有 Skill。
- 只能使用自己的私有 Skill。
- 可以申请发布为普通用户公共 Skill。
- 私有 Skill可申请白名单只读工具。
- 不允许写工具。
- 不允许发布为审核员或管理员 Skill。

### 13.2 审核员

- 不能创建 Skill。
- 只能使用管理员发布给审核员的 Skill。
- 当前审核员没有 AI 对话功能；相关 Skill 供已有或后续审核 AI 功能调用。

### 13.3 管理员

- 创建平台 Skill。
- 指定适用角色。
- 创建管理员私有 Skill。
- 审核用户公共 Skill 申请。
- 默认不能随意查看用户私有 Skill 原文。
- 安全审核场景查看私有 Skill 必须留痕。

---

## 14. 用户声明式 Skill 格式

### 14.1 支持内容

- `SKILL.md`。
- Markdown 指令。
- 使用场景。
- 示例问法。
- 输出约束。
- 对白名单只读工具的申请。
- `.md`、`.txt`、`.json`、`.yaml`、`.yml` 参考文件。

### 14.2 禁止内容

- Shell。
- Python。
- Node.js。
- 二进制程序。
- 任意代码执行。
- 任意 HTTP 请求。
- 数据库语句执行。
- MCP Server。
- 软链接。
- 隐藏文件。
- 嵌套压缩包。
- 路径穿越。

### 14.3 包限制

- 支持单个 `SKILL.md`。
- 支持包含根目录 `SKILL.md` 的 `.zip`。
- 解压后总大小不超过 2MB。
- 文件不超过 30 个。
- 单文件不超过 512KB。
- 实际注入模型的内容另受 Token 预算限制。

### 14.4 Frontmatter

```yaml
---
name: my-report-helper
description: 帮助整理本人漏洞报告的结构和表达
version: 1.0.0
examples:
  - 帮我检查这份漏洞报告
requested_tools:
  - vulnerability.read_own_summary
---
```

后端不信任 Frontmatter 声明。所有字段和工具均重新校验。

---

## 15. Skill 生命周期

```text
DRAFT
ACTIVE_PRIVATE
SUBMITTED
UNDER_REVIEW
CHANGES_REQUESTED
REJECTED
PUBLISHED
DISABLED
ARCHIVED
```

规则：

- 用户私有 Skill 保存后可立即私用。
- 提交公共发布后生成不可变审核 Revision。
- 用户继续修改私有副本，不改变审核中的 Revision。
- 管理员通过后生成独立公共 Skill Revision。
- 公共版本与用户私有原件分离。
- 更新公共版本需要重新提交。
- 已有会话固定原 Revision。
- 新会话使用最新启用 Revision。
- 安全事件可以强制停用所有 Revision。

---

## 16. Skill 人工审核

### 16.1 原则

- AI 不审核。
- AI 不评分。
- AI 不给发布结论。
- 一名具有 `ai:manage_skills` 权限的管理员可以审核。
- 管理员不能审核自己创建的平台 Skill。

### 16.2 确定性技术检查

提交前自动执行：

- Frontmatter 格式。
- 文件扩展名。
- 文件数量和大小。
- ZIP 路径穿越。
- 软链接。
- 隐藏文件。
- 嵌套压缩包。
- 二进制和脚本。
- 内容哈希。
- 工具名称是否存在。
- 工具是否属于用户可申请只读范围。
- Skill 内容 Token 预算。
- 名称和版本冲突。

这些检查只判断包是否合法，不判断内容是否应发布。

### 16.3 管理员操作

- 通过并发布。
- 驳回并填写原因。
- 要求修改。
- 调整公共名称和分类。
- 移除工具申请。
- 停用公共版本。
- 回滚历史公共版本。

### 16.4 审计

记录：

- 提交人。
- 审核人。
- Revision 和内容哈希。
- 工具权限变化。
- 审核意见。
- 发布时间。
- 停用或回滚原因。

---

## 17. Skill 路由与触发

支持：

1. 自动选择。
2. 用户手动选择。
3. `/skill-name` 快捷调用。
4. 固定 Skill 到当前会话。

规则：

- 每轮最多一个主 Skill。
- 每轮最多两个辅助 Skill。
- 不把全部 Skill 注入模型。
- 显式选择优先于自动选择。
- 自动召回置信度不足时普通回答或询问用户。
- 名称冲突时优先用户显式选择，并显示来源。
- 每条回复显示模型来源、Skill、工具和 Token。

路由顺序：

```text
显式页面动作
  -> 用户显式 Skill
  -> 会话固定 Skill
  -> 确定性规则
  -> Skill 描述与示例召回
  -> 必要时使用当前会话模型做候选裁决
  -> 普通回答或澄清
```

用户使用 BYOK 时，候选裁决也使用用户模型，不消耗平台模型 Token。

---

## 18. Token 和上下文控制

### 18.1 原则

Skill 后端化不代表每轮注入全部 Skill。

模型只接收：

- 平台固定安全边界。
- 当前用户问题。
- 必要历史摘要。
- 命中的少量 Skill。
- 当前任务所需最小业务数据。
- 当前轮 Tool 结果。

不接收：

- 全部 Skill。
- 全部平台模块说明。
- 全部用户数据。
- 其他用户数据。
- 原始数据库对象。
- 无关对话历史。

### 18.2 BYOK Token

- 不占平台 AI Token 额度。
- 记录供应商返回的输入、输出、缓存和推理 Token。
- 供应商未返回 Usage 时标记“未确认”。
- 平台不估算价格。
- 用户自行在供应商控制台管理费用。

---

## 19. 并发、队列和硬限制

### 19.1 默认值

```text
单用户前台并发 Run：5
单用户后台并发 Run：3
单用户每分钟新建 Run：30
单用户每分钟上游模型调用：90
单次 Agent Tool 轮数：6
单次 Run 工具调用总数：20
单用户等待队列：30
普通请求超时：5 分钟
PDF/长任务超时：10 分钟
单请求上下文：128K Token
单次输出：16K Token
```

### 19.2 系统硬上限

```text
单用户前台并发 Run：20
单用户后台并发 Run：10
每分钟新建 Run：120
每分钟上游调用：300
Tool 轮数：12
单次工具调用总数：50
等待队列：100
最长超时：30 分钟
上下文：256K Token
输出：32K Token
```

默认参数不全部暴露到管理员 UI。普通调整通过服务器配置完成。

### 19.3 平台保护

- 全平台并发 Run 上限。
- Provider 级并发上限。
- Tool Gateway 限流。
- 数据库查询限流。
- 连续失败熔断。
- 前台请求优先于后台任务。
- 队列接近上限时拒绝新后台任务。
- 管理员可紧急终止全部用户 AI Run。

---

## 20. 后台任务

用户允许平台在页面关闭后继续使用自己的 Key：

- 仅处理该用户自己的任务。
- 每个任务记录用途、模型和 Token。
- 队列只保存 Credential ID。
- 用户停用或删除 Key 后取消未开始任务。
- 已运行任务尝试终止。
- 失败不回退平台模型。

平台级自动任务仍使用平台 AI：

- 全局知识维护。
- 平台公共 Skill 生成或维护。
- 管理员 AI 出题。
- 管理员运营分析。
- 系统定时 AI 任务。

---

## 21. 精简前端方案

### 21.1 管理员系统设置

只增加两块。

#### 用户 AI 模式

三段选择器：

```text
仅平台模型 | 仅用户模型 | 用户可选
```

切换时显示影响说明和二次确认。

#### 平台 AI

只显示：

- 主供应商。
- 主模型。
- API Key。
- 备用模型。
- 测试连接。
- 保存。

不在 UI 暴露 Runtime 并发、Tool 轮数、上下文和熔断细节。

### 21.2 用户系统设置

增加“自有 AI 模型”：

- 添加凭据。
- 选择供应商。
- 填写 Key。
- 选择或填写模型。
- 测试连接。
- 设置默认模型。
- 停用或删除。
- 查看调用次数和供应商已确认 Token。

首次添加时完成第三方数据授权。

### 21.3 AI 助手

只增加：

```text
模型选择
Skill 选择
```

- 模型切换创建新会话。
- Skill 可以固定到会话。
- 回复下方显示模型、Skill、工具和 Token。
- 不显示 Key 和 Base URL。

### 21.4 用户 Skill

AI 助手内增加一个 Skill 入口，打开单一弹窗：

- 我的 Skill。
- 平台 Skill。
- 创建或上传。
- 已提交审核。

不增加用户一级主菜单。

---

## 22. 建议数据模型

以下为目标实体，具体 Prisma 字段在实施时按现有 Schema 命名规范调整。

### 22.1 AI 策略与平台模型

```text
AiModelPolicy
PlatformProviderCredential
PlatformModelRoute
ProviderPreset
```

### 22.2 用户 BYOK

```text
UserProviderCredential
UserModelProfile
UserProviderConsent
```

### 22.3 Skill

```text
AiSkill
AiSkillRevision
AiSkillFile
AiSkillToolGrant
AiSkillReview
AiSkillInstallation
AiConversationSkillPin
```

### 22.4 Runtime

```text
AiAgentRun
AiAgentRunStep
AiAgentToolCall
AiAgentUsage
AiAgentPolicySnapshot
```

### 22.5 关键约束

- Credential 所有者必须与 Model Profile 所有者一致。
- 用户私有 Skill 的所有者不能为空。
- 审核员不能成为 Skill 创建者。
- 用户 Skill Tool Grant 只能引用只读工具。
- Published Revision 不可修改。
- Run Snapshot 创建后不可修改。
- 审计日志不能包含 Credential 密文或明文。

---

## 23. 建议 API

### 23.1 用户模型

```text
GET    /api/ai/providers
GET    /api/ai/user-credentials
POST   /api/ai/user-credentials
POST   /api/ai/user-credentials/:id/test
PATCH  /api/ai/user-credentials/:id
DELETE /api/ai/user-credentials/:id

GET    /api/ai/user-models
POST   /api/ai/user-models
PATCH  /api/ai/user-models/:id
DELETE /api/ai/user-models/:id
POST   /api/ai/user-models/:id/default
```

### 23.2 用户 Skill

```text
GET    /api/ai/skills
POST   /api/ai/skills
POST   /api/ai/skills/upload
GET    /api/ai/skills/:id
PATCH  /api/ai/skills/:id
DELETE /api/ai/skills/:id
POST   /api/ai/skills/:id/submit
POST   /api/ai/skills/:id/activate
POST   /api/ai/skills/:id/deactivate
```

### 23.3 管理员

```text
GET    /api/system-settings/ai-model-policy
PUT    /api/system-settings/ai-model-policy
GET    /api/system-settings/platform-ai
PUT    /api/system-settings/platform-ai
POST   /api/system-settings/platform-ai/test

GET    /api/admin/ai-skill-reviews
GET    /api/admin/ai-skill-reviews/:id
POST   /api/admin/ai-skill-reviews/:id/approve
POST   /api/admin/ai-skill-reviews/:id/reject
POST   /api/admin/ai-skill-reviews/:id/request-changes
```

### 23.4 Agent Run

```text
POST   /api/ai/runs
GET    /api/ai/runs/:id
GET    /api/ai/runs/:id/events
POST   /api/ai/runs/:id/cancel
POST   /api/ai/runs/:id/confirm-action
```

现有 `/api/ai/chat` 在迁移期保留兼容，最终内部转为创建 Agent Run。

---

## 24. 审计与可观测性

每次 Run 至少记录：

- 用户和角色。
- 策略版本。
- 平台模型或用户模型。
- Provider Preset。
- Model Profile ID。
- 模型名称。
- Skill Revision。
- Tool 名称。
- Tool 执行结果状态。
- 输入、输出和总 Token。
- Usage 是否由供应商确认。
- 延迟。
- 失败类型。
- 是否发生备用模型切换。
- 是否发生用户确认。

禁止记录：

- API Key。
- Authorization Header。
- Cookie。
- 完整敏感 PDF。
- 未脱敏漏洞资产。
- 其他用户数据。

管理员可以查看平台运行健康和汇总，但不能查看用户 Key 明文。

---

## 25. 迁移阶段

### 阶段一：冻结契约和派生基线

- 锁定 Hermes Commit。
- 锁定 CC Switch Commit。
- 保存许可证和来源映射。
- 建立 Hermes Agent Loop 行为测试样本。
- 定义 Provider、Skill、Tool 和 Run TypeScript 契约。

### 阶段二：Provider 与凭据

- 建立 Provider Preset。
- 建立平台 Credential。
- 建立用户 Credential 和 Model Profile。
- 完成 AES-256-GCM。
- 完成连接测试、Consent 和审计。
- 保持现有 Hermes 调用作为回退链路，不对用户开放。

### 阶段三：TypeScript Agent Runtime

- 移植 Agent Loop。
- 移植 Tool Call 循环。
- 建立 Run 事件和取消。
- 接入现有 `AiToolsService`、`AiDataRequestService` 和输出归一化。
- 接入平台模型。
- 与现有 Hermes 输出行为对比。

### 阶段四：用户三档模型策略

- 实现三档策略。
- 实现会话模型固定。
- 实现 BYOK 全量用户调用。
- 实现后台用户任务。
- 实现策略切换和只读历史会话。

### 阶段五：Skill 平台化

- 建立 Skill 数据模型。
- 实现声明式解析和包安全校验。
- 迁移现有平台 Skill。
- 实现用户私有 Skill。
- 实现只读 Tool Grant。
- 实现人工审核和公共发布。
- 实现自动、手动和会话固定触发。

### 阶段六：切换与下线

- 灰度使用 TypeScript Runtime。
- 对比错误率、延迟、Token 和工具成功率。
- 验证平台模型、BYOK、PDF、知识沉淀和 Skill。
- 默认切换 TypeScript Runtime。
- 保留短期 Runtime 回退开关。
- 稳定后删除独立 Hermes Docker 部署要求。
- 更新 `docs/HERMES_RUNTIME.md` 为历史迁移说明。

---

## 26. 测试策略

### 26.1 Provider

- 同供应商多个 Key 隔离。
- 不同用户 Key 隔离。
- Key 不进入日志。
- 白名单 Base URL。
- 重定向重新校验。
- 流式 UTF-8。
- Tool Call。
- Usage 缺失。
- 超时、限流、5xx 和格式错误。

### 26.2 策略

- 三档策略。
- 管理员和审核员始终平台 AI。
- BYOK 不占平台额度。
- 会话固定模型。
- 切换策略后的只读会话。
- Run Snapshot。
- 紧急终止。

### 26.3 Skill

- 角色隔离。
- 所有者隔离。
- 用户只读 Tool Grant。
- 审核员不能创建 Skill。
- 管理员人工审核。
- 已发布 Revision 不可修改。
- ZIP 路径穿越。
- 软链接。
- 脚本和二进制拒绝。
- Skill 注入预算。
- 自动、手动和会话固定触发。

### 26.4 Tool

- 伪造 `userId` 被丢弃。
- 越权工具拒绝。
- 写操作必须确认。
- 真实 ID 白名单。
- 循环 Tool Call 终止。
- Tool 超时和部分失败。

### 26.5 并发

- 5 个前台 Run。
- 3 个后台 Run。
- 单用户队列。
- 全平台并发。
- Provider 熔断。
- 前台优先。
- 取消和超时释放资源。

### 26.6 端到端

- 平台模型对话。
- BYOK 对话。
- BYOK PDF 评分。
- BYOK 漏洞 AI 建议。
- BYOK 首页分析。
- 用户私有 Skill。
- Skill 申请和管理员发布。
- 平台备用模型切换。
- 用户删除 Key 后后台任务取消。

---

## 27. 验收标准

满足以下条件才允许下线独立 Hermes Docker：

1. 平台模型与 BYOK 均能完成用户侧现有 AI 功能。
2. 管理员和审核员只使用平台 AI。
3. 三档策略和策略切换符合本文规则。
4. 用户 Key 在数据库、日志、审计、队列和错误中均不出现明文。
5. 不同用户 Provider、会话、Skill 和 Tool 数据无串扰。
6. 用户私有 Skill 不能调用写工具。
7. 审核员不能创建 Skill。
8. Skill 公共发布必须经过管理员人工审核。
9. 模型无法解析时不会猜测 Tool 参数或回退平台模型。
10. 写操作始终经过后端重新校验和二次确认。
11. BYOK Token 不计入平台额度。
12. 并发、队列、取消、超时和熔断通过压力测试。
13. PDF、漏洞、首页分析和知识沉淀回归通过。
14. Runtime 派生文件保留 Hermes MIT License 和来源 Commit。
15. 前端设置保持精简，不暴露非必要 Runtime 参数。

---

## 28. 主要风险与控制

| 风险 | 控制 |
|---|---|
| 用户 Key 泄露 | 独立 AES Key、GCM、无明文读取、日志脱敏 |
| 第三方中转收集数据 | 强制授权、供应商分类、漏洞脱敏 |
| 用户低能力模型失败 | 协议校验、明确失败、不回退、不猜参数 |
| 用户 Skill 越权 | 声明式、只读 Tool Grant、每次 RBAC |
| Skill 包攻击 | 文件类型、路径、软链接、大小和数量检查 |
| Tool Call 越权 | 后端覆盖身份、Schema、工具 ACL |
| Agent 无限循环 | Tool 轮数、调用总数、超时和取消 |
| 迁移导致功能回退 | Hermes 行为基线、灰度、短期回退开关 |
| 派生代码失去来源 | LICENSE、Commit、SOURCE_MAP、ADAPTATION |
| 设置过于复杂 | 管理员两块、用户一块、AI 页两个控件 |

---

## 29. 当前未确认项

需求层面无阻塞项。实施开始前需要确认两个供应链版本：

已固定供应链版本：

1. Hermes Agent：`NousResearch/hermes-agent@7b65073dc919c9a930315b78f57520c0d772eed3`。
2. CC Switch：`farion1231/cc-switch@a377d79303bc1e592d2783d559ca5bd6b8ba1417`。

许可证、来源映射和适配说明位于 `backend/src/modules/ai/runtime-derived/`，暂不自动更新。

---

## 30. 实施记录

### 2026-07-23：第一阶段

验证分支：`feat/ai-runtime-byok-skills`

已完成：

- 用户 AI 三档策略持久化与管理员切换接口。
- 平台白名单 Provider 目录；用户不能编辑 Base URL。
- 用户多凭据、多模型、默认模型、启停、删除和连接测试接口。
- 用户密钥使用独立 `AI_CREDENTIAL_ENCRYPTION_KEY` 和 AES-256-GCM 加密；读取接口不返回密文、IV、认证标签或明文。
- 第三方数据授权版本记录。
- 普通对话、PDF 报告评分和“我的漏洞”AI 建议接入平台/BYOK 路由。
- BYOK 调用不计入平台 Token 额度，失败不回退平台模型。
- Agent Run 来源、模型、Provider、策略快照、用量和结果状态记录。
- 管理员三档模式、用户模型管理和 AI 助手模型选择界面。
- Prisma 迁移和密钥加密测试。

尚未完成，不能视为已验收：

- 平台模型主备路由、熔断和管理员平台模型配置。
- 完整 TypeScript Agent Runtime 的取消、事件流、并发队列和运行步骤表。
- 用户声明式 Skill 包上传、确定性检查、人工审核、发布、回滚和会话固定。
- Hermes 与 CC Switch 上游 Commit 固定、许可证及派生映射。
- 全部用户后台 AI 任务的 BYOK 路由审计。
- 数据库迁移实跑与端到端测试；当前本地数据库未启动，状态为“未确认”。

### 2026-07-23：第二阶段

已完成：

- 管理员和用户模型配置均改为弹窗；管理员配置一个全局主模型和最多两个备用模型，不再按用途拆分。
- 平台模型 Key 使用相同的独立 AES-256-GCM 密钥保护，保存后只回显尾号。
- 官方 Provider 使用固定 Base URL；管理员可配置 HTTPS 第三方中转站。
- 平台模型失败按优先级切换，记录连续失败并在达到阈值后进入冷却熔断。
- BYOK 失败仍立即结束，不进入平台故障转移。
- 新增 Run 并发、每分钟创建量和全平台运行量保护。
- 新增 Run 状态、步骤、Tool Call 参数哈希、结果摘要哈希和供应商 Usage 记录。
- 新增 Run 查询与取消接口；同进程活动请求可以通过 AbortController 终止。
- AI 问题会话首次调用后固定模型来源、Provider、凭据和模型；切换策略或模型后旧会话不可继续写入。
- 扩展现有 `AiSkill`，支持用户私有 Skill、文件、只读工具申请、不可变 Revision、人工审核和发布。
- 支持单个 `SKILL.md` 和 ZIP；执行扩展名、数量、大小、UTF-8、二进制、隐藏文件、路径穿越、软链接和嵌套压缩包检查。
- 审核员不能创建 Skill；用户不能申请写工具；管理员不能审核自己创建的 Skill；AI 不参与审核结论。
- 支持自动召回、显式选择、`/skill-name` 和会话固定；每轮动态 Skill 最多三个。
- AI 助手内新增模型/Skill 选择和单一 Skill 管理弹窗；管理员知识审核页新增声明式 Skill 人工审核。
- 独立临时 PostgreSQL 数据库已从零成功应用全部 32 个仓库迁移。

仍未完成或未确认：

- Hermes 与 CC Switch 上游 Commit、MIT 许可证和 `SOURCE_MAP.json` 已固定。Runtime 是基于审计结果的 TypeScript 概念适配，不包含 Hermes Python 源码。
- Run Event 使用 SSE 返回数据库快照；跨进程取消通过数据库状态轮询传播。当前未使用 Redis，数据库计数和状态是多实例共享边界。
- 用户后台 BYOK 队列及凭据删除时的跨进程任务取消尚未实现。
- 完整压力测试、生产灰度和独立 Hermes Docker 下线尚未完成。
- 当前开发数据库存在三份“数据库已应用但仓库缺失”的复测迁移，不能安全执行 `migrate dev`；本次未重置数据库。

### 2026-07-24：管理员 AI 知识工作台

已完成：

- 管理员原“AI 知识库”页面重组为 `Skill 管理 / Skill 审核 / 知识审核` 三级工作台。
- Skill 管理采用数据表格展示名称、作用范围、生命周期、版本、来源和启用状态，支持检索、创建、查看、编辑、启停和归档。
- Skill 创建、编辑、详情和人工审核进入二级弹窗，列表上下文不丢失；已发布 Skill 保持只读，避免绕过版本和审核链路直接修改。
- 管理员可查看已停用和已归档 Skill；停用不改变生命周期，已归档 Skill 禁止重新启用。
- Skill 审核继续坚持全人工结论，审核弹窗集中展示内容、申请工具、提交信息和审核备注。
- 知识审核保留待人工审核、自动入库、知识条目和维护任务四类流程；候选 Skill 生成、安装和审计记录归入 Skill 审核工作台。
- 页面复用平台 `SurfacePanel`、通用通知和现有状态视觉规则，不增加装饰性图标。
- 管理员菜单和页面名称统一调整为“AI 管理”，页面头部直接复用平台模型配置弹窗。
- Skill 管理分为系统 Skill 与用户 Skill；系统 Skill 由平台生成、无创建者或管理员创建，用户 Skill 由普通用户创建。
- 系统 Skill 新增“用户侧展示”和“默认固定”策略。隐藏后不会出现在用户 Skill 列表，也不会被用户对话运行时召回；默认固定必须同时满足用户可见、已发布并适用于用户。
- 默认固定的系统 Skill 会直接显示在用户 AI 助手输入框上方；平台策略与用户本地固定项合并。
- 用户可拖动输入框上方的 Skill 调整顺序；顺序保存在现有用户浏览器偏好中。Skill 超出可用宽度时隐藏滚动条，鼠标悬停在该区域可用滚轮水平浏览。
- 本次关联的管理页、Skill 弹窗、模型配置弹窗和用户对话输入区域已检查浅色、深色背景、边框、文字、悬停、焦点与禁用状态。
