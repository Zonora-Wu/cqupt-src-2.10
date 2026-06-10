# CQUPT-SRC-20260608-45LXL4 平台与 Hermes 交互记录

> 漏洞：cquptsrc.asia 弱口令（测试账号 `0000001` / `admin`）
> 复测模式：HERMES_DIRECT
> 记录时间：2026-06-10

本文档完整记录从管理员点击"AI 复测"到 Hermes 返回报告的全链路交互——包括平台发给 Hermes 的每一段 prompt、Hermes 应返回的 Schema 和实际示例。

---

## 交互架构

```
管理员点击 AI复测
  → NestJS 后端
    → [阶段1] 主 Hermes (localhost:5000) 生成计划
    → [阶段2] 主 Hermes (localhost:5000) 执行计划  ← 合并后单 Hermes
    → 管理员查看报告
```

主 Hermes 运行 `gateway run --replace` 模式，同时处理平台 AI 助手和复测。retest-agent + egress-proxy 已废弃。

---

## 阶段 1：计划生成

### 调用链路

```
POST /api/vulnerabilities/:id/ai-retests (用户创建任务)
  → Worker 拾取 → PLANNING 状态
  → AiService.completeChat() → POST localhost:5000/v1/chat/completions
```

### 1.1 平台发给主 Hermes 的 System Prompt

代码位置：`backend/src/modules/ai-vulnerability-retest/ai-vulnerability-retest-planning.service.ts` `buildHermesDirectPlanningPrompt()`

```
你是 CQUPT-SRC 平台 AI 漏洞复测规划器。根据漏洞报告生成一个结构化复测计划。

=== 你的任务 ===
1. 仔细阅读漏洞报告，理解漏洞类型、攻击面和复现步骤。
2. 生成一份结构化 JSON 复测计划，包含：步骤（plannedActions）、影响范围（impactScope）、风险等级（overallRisk）、前置条件（preconditions）、请求预算（requestBudget）、回滚方案（rollbackPlan）。
3. 每个步骤必须包含：标题（title）、目标URL（target）、风险等级（riskLevel）、工具类别（toolClass）、动作类型（actionType）、期望证据（expectedEvidence）。
4. 步骤要具体可操作，能直接指导后续执行。

=== 可用工具类别 ===
browser — 浏览器自动化（导航、填表、点击、截图）
http_client — HTTP 请求（GET/POST、Header 检查、响应分析）
python — Python 脚本（数据处理、自动化逻辑）
security_tool — 安全工具（扫描、分析）
shell — Shell 命令
skill — 调用已安装的网络安全 skill

=== 输出格式 ===
只输出一个 JSON 对象，不输出 Markdown、解释文字或代码块。
```

### 1.2 平台发给主 Hermes 的 User Message

```json
{
  "confirmedTargets": ["https://cquptsrc.asia/"],
  "outputSchema": {
    "summary": "string — 本次复测的目标和思路",
    "targets": ["https://cquptsrc.asia/"],
    "impactScope": ["string — 该漏洞可能影响的范围"],
    "overallRisk": "LOW|MEDIUM|HIGH|CRITICAL — 综合风险评级",
    "toolClasses": ["string — 本次计划使用的工具类别"],
    "preconditions": ["string — 执行前需满足的条件"],
    "requestBudget": {
      "maxDurationSeconds": 300,
      "maxRequests": 10
    },
    "rollbackPlan": "string — 异常情况下的回滚方案",
    "plannedActions": [{
      "title": "string — 步骤标题",
      "target": "https://cquptsrc.asia/",
      "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL — 本步骤单独风险",
      "toolClass": "browser|http_client|python|security_tool|shell|skill",
      "actionType": "string — 动作类型描述",
      "commandPreview": "string — 脱敏后的操作预览（可选）",
      "expectedEvidence": "string — 期望收集到的证据",
      "requiresPerActionApproval": true
    }]
  },
  "reportNo": "CQUPT-SRC-20260608-45LXL4",
  "sanitizedContext": {
    "confirmedTargets": ["https://cquptsrc.asia/"],
    "extractedTargets": ["https://cquptsrc.asia/", "cquptsrc.asia/"],
    "report": {
      "reportNo": "CQUPT-SRC-20260608-45LXL4",
      "title": "cquptsrc.asia存在弱密码",
      "vulnerabilityType": "弱口令",
      "assetUrl": "https://cquptsrc.asia/",
      "status": "SUBMITTED",
      "reproductionSteps": "1. 在授权范围内访问 https://cquptsrc.asia/，确认测试目标与报告一致。\n2. 使用统一认证码 0000001 和密码 admin 尝试登录管理员账户。\n3. 保存复现过程中的关键页面、请求响应或截图作为利用证明，并确保敏感数据已脱敏。",
      "impactAssessment": "综合漏洞表现、影响范围和报告证据，AI 初步判断该问题风险等级为"高危"。报告漏洞类别为"web 漏洞"。若被利用，可能对 https://cquptsrc.asia/ 造成安全影响。通过用户枚举得到账号后，可以通过 bp 弱口令爆破出密码，并以此登入管理员账户"
    },
    "attachments": [
      {
        "id": "cmq4smz1k00ewuky971t40mxl",
        "fileName": "report.pdf",
        "mimeType": "application/pdf",
        "sizeBytes": 12345
      }
    ]
  },
  "traceId": "ai-retest-<uuid>"
}
```

### 1.3 Hermes 返回的 Schema（平台期望格式）

Hermes 必须返回一个 JSON 对象，经 `normalizeHermesDirectProposal()` 校验。严格格式：

```json
{
  "summary": "字符串，20-2000字符，描述本次复测的目标和思路",
  "targets": ["https://cquptsrc.asia/"],
  "impactScope": [
    "影响范围描述1（20-500字符）",
    "影响范围描述2"
  ],
  "overallRisk": "LOW|MEDIUM|HIGH|CRITICAL",
  "toolClasses": ["browser", "http_client"],
  "preconditions": [
    "前置条件1（20-500字符）",
    "前置条件2"
  ],
  "requestBudget": {
    "maxDurationSeconds": 300,
    "maxRequests": 10
  },
  "rollbackPlan": "回滚方案，10-2000字符",
  "plannedActions": [{
    "title": "步骤标题（3-200字符）",
    "target": "https://cquptsrc.asia/",
    "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
    "toolClass": "browser|http_client|python|security_tool|shell|skill",
    "actionType": "动作类型（2-120字符）",
    "commandPreview": "可选，脱敏后的命令或操作预览（1-2000字符）",
    "expectedEvidence": "期望收集的证据（5-1000字符）",
    "requiresPerActionApproval": true
  }]
}
```

> **重要规则**：
> - `targets` 和每个 `plannedAction.target` 必须在 `confirmedTargets` 同源范围内
> - HIGH 或 CRITICAL 的 `plannedAction` **必须**设置 `requiresPerActionApproval: true`
> - `toolClasses` 必须是 `plannedActions` 中用到的工具超集
> - 至少 1 个 `plannedAction`，最多 20 个
> - 如果输出不是合法 JSON 或缺少必须字段，平台会返回修正提示并要求 Hermes 重新生成

### 1.4 Hermes 实际返回示例

```json
{
  "summary": "验证 cquptsrc.asia 弱密码漏洞是否存在。通过访问登录页面，尝试使用报告提供的已知凭证进行单次登录验证，确认能否成功登录管理员账户，并评估登录后的访问权限范围。",
  "targets": ["https://cquptsrc.asia/"],
  "impactScope": [
    "https://cquptsrc.asia/ 身份认证入口",
    "管理员后台功能模块",
    "用户会话与权限管理"
  ],
  "overallRisk": "HIGH",
  "toolClasses": ["browser", "shell"],
  "preconditions": [
    "目标 https://cquptsrc.asia/ 可正常访问",
    "登录页面可用且未触发 WAF 或 IP 限制",
    "测试在授权范围内进行，不影响正常业务运行",
    "不进行任何字典爆破或密码枚举操作"
  ],
  "requestBudget": {
    "maxRequests": 10,
    "maxDurationSeconds": 300
  },
  "rollbackPlan": "若复现过程中发现非预期的数据泄露、权限越权或系统异常，立即停止所有操作，清除浏览器会话和 Cookie，不保存任何凭证信息。仅保留必要的脱敏截图作为复现证据。如登录成功，仅验证权限边界，不进行写操作、数据导出或配置修改。",
  "plannedActions": [
    {
      "title": "访问目标站点并定位登录入口",
      "target": "https://cquptsrc.asia/",
      "riskLevel": "LOW",
      "toolClass": "browser",
      "actionType": "访问登录页面",
      "commandPreview": "browser_navigate 到目标域名，查找登录链接或直接登录路径",
      "expectedEvidence": "确认登录表单页面存在并可正常交互",
      "requiresPerActionApproval": false
    },
    {
      "title": "使用已知凭证单次登录验证",
      "target": "https://cquptsrc.asia/",
      "riskLevel": "HIGH",
      "toolClass": "browser",
      "actionType": "凭证登录验证",
      "commandPreview": "在登录表单输入报告已确认的凭证进行单次登录尝试（非爆破）",
      "expectedEvidence": "登录成功跳转到后台仪表盘，或登录失败的返回信息",
      "requiresPerActionApproval": true
    },
    {
      "title": "验证登录后访问权限与功能范围",
      "target": "https://cquptsrc.asia/",
      "riskLevel": "MEDIUM",
      "toolClass": "browser",
      "actionType": "权限边界验证",
      "commandPreview": "登录成功后浏览可访问的管理功能页面，确认权限范围",
      "expectedEvidence": "确认登录后的会话角色、可操作模块列表及数据可见范围",
      "requiresPerActionApproval": true
    }
  ]
}
```

---

## 阶段 2：计划审批

管理员在平台确认计划 → 调用 `POST /api/ai-retests/:jobId/direct-plan/approve`

请求体：
```json
{
  "acknowledgedRisks": true,
  "proposalHash": "<plan.planHash>",
  "confirmedTargetScope": ["https://cquptsrc.asia/"],
  "confirmedImpactScope": ["身份认证入口"],
  "approvedToolClasses": ["browser", "shell"],
  "confirmationText": "审核通过，批准执行"
}
```

凭证添加：
```json
POST /api/ai-retests/:jobId/direct-credentials
{
  "credentialType": "ACCOUNT",
  "payload": {"username": "0000001", "password": "***"},
  "targetScope": ["https://cquptsrc.asia/"]
}
```

凭证经 AES-256-GCM 加密后存入 `AiVulnerabilityRetestCredential`，执行时解密注入 Hermes prompt。

---

## 阶段 3：执行

### 调用链路

```
Worker → HermesDirectSessionService.processJob()
  → HermesDirectClient.createSession()   (POST localhost:5000/v1/runs)
  → HermesDirectClient.getEvents()       (SSE 事件流监听)
```

> 合并后不再经过 egress proxy，主 Hermes 直接访问 DeepSeek API 和目标站点。

### 3.1 平台发给 retest-agent 的 Instructions

代码位置：`backend/src/modules/ai-vulnerability-retest/hermes-direct-session.service.ts` `buildDirectInstructions()`

```
You are the CQUPT-SRC Hermes Direct vulnerability retest executor.

=== EXECUTION RULES ===
1. Follow the approved plan steps in approvedProposal.steps EXACTLY and in sequence.
2. For each step, record what you did, what you observed, and attach any evidence (screenshots, response snippets, file hashes).
3. Do not skip steps or execute them out of order unless a prior step makes a later one impossible.
4. Only act on the approved targets, tools, budget, and impact scope in the user payload.
5. Never perform denial of service, credential attacks, mass scanning, persistence, lateral movement, bulk export, or destructive changes.
6. Before any high-risk terminal/security action, rely on the gateway approval mechanism and wait for approval.
7. Approved tool classes: browser, http_client.
8. Never print, summarize, store, or return credential values.
9. Finish with one strict JSON report object and no surrounding prose.
```

### 3.2 平台发给 retest-agent 的 Input（user prompt）

代码位置：`buildDirectPrompt()`

```json
{
  "approvedProposal": { /* 阶段1 Hermes 返回的完整计划 */ },
  "approvedTargets": ["https://cquptsrc.asia/"],
  "credentials": [{
    "type": "ACCOUNT",
    "payload": {
      "username": "0000001",
      "password": "***"
    },
    "targetScope": ["https://cquptsrc.asia/"]
  }],
  "reportRequirements": {
    "conclusion": {
      "confidence": "LOW|MEDIUM|HIGH",
      "manualReviewRequired": true,
      "reproducibility": "REPRODUCED|NOT_REPRODUCED|PARTIALLY_REPRODUCED|INSUFFICIENT_EVIDENCE",
      "riskLevelSuggestion": "LOW|MEDIUM|HIGH|CRITICAL"
    },
    "evidenceSummary": "string — a concise summary of all evidence collected across steps",
    "impactAssessment": "string — assess the real-world impact based on what was actually reproduced",
    "limitations": "string[] — any constraints or limitations encountered during execution",
    "remediationAdvice": {
      "regressionTest": "string — how to verify the fix with a regression test",
      "rootCauseFix": "string — what to fix at the root cause level",
      "shortTerm": "string — immediate mitigation before the root cause is fixed"
    },
    "reviewCommentDraft": "string — a draft review comment suitable for the auditor",
    "steps": "array — for EACH executed step, include: { sequence: number, title: string, executionState: \"EXECUTED\"|\"REJECTED\"|\"BLOCKED\"|\"NOT_EXECUTED\"|\"EVIDENCE_INSUFFICIENT\", resultSummary: string, evidence: [{ type: string, description: string }] }"
  },
  "task": "Execute the approved vulnerability retest plan. Follow approvedProposal.steps in order. For every step you execute, describe what you observed and attach evidence. Produce a complete structured JSON report matching reportRequirements exactly.",
  "vulnerability": {
    "reportNo": "CQUPT-SRC-20260608-45LXL4",
    "title": "cquptsrc.asia存在弱密码"
  }
}
```

### 3.3 Hermes SSE 事件流

Hermes 通过 `GET /v1/runs/:runId/events` 逐步推送执行进度：

```
data: {"event": "message.delta", "run_id": "...", "delta": "正在导航到 https://cquptsrc.asia/"}

data: {"event": "tool.started",  "run_id": "...", "tool": "browser_navigate", "args": {...}}

data: {"event": "tool.completed","run_id": "...", "tool": "browser_navigate", "output": "页面已加载，发现登录表单"}

data: {"event": "approval.request","run_id": "...", "tool": "browser_type", "description": "填写登录凭证..."}
        → 平台 auto-approve 或人工审批 → approveAction/rejectAction

data: {"event": "tool.completed","run_id": "...", "tool": "browser_type", "output": "登录成功"}

data: {"event": "run.completed", "run_id": "...", "output": { /* 完整报告 JSON */ }}
```

**事件类型**：
| event | 含义 |
|-------|------|
| `message.delta` | Hermes 推理过程中的文本增量 |
| `tool.started` | Hermes 开始执行工具调用 |
| `tool.completed` | 工具执行完成 |
| `approval.request` | 工具需要人工/自动审批才能执行 |
| `run.completed` | 执行完成，output 字段含最终报告 JSON |
| `run.failed` | 执行失败 |
| `run.cancelled` | 任务被取消 |

**审批机制**：
- 硬阻断（7 条红线）：自动拒绝，不等待
- `AI_RETEST_AUTO_APPROVE_DIRECT_ACTIONS=true`：自动批准，不等待
- 否则：创建 `DIRECT_ACTION_REVIEW`，等待人工调用 API 批准/拒绝

### 3.4 Hermes 返回的报告 Schema

`run.completed` 事件的 `output` 字段必须包含：

```json
{
  "conclusion": {
    "confidence": "LOW|MEDIUM|HIGH",
    "manualReviewRequired": true,
    "reproducibility": "REPRODUCED|NOT_REPRODUCED|PARTIALLY_REPRODUCED|INSUFFICIENT_EVIDENCE",
    "riskLevelSuggestion": "LOW|MEDIUM|HIGH|CRITICAL"
  },
  "evidenceSummary": "字符串，所有步骤证据的简洁总结（最多8000字符）",
  "impactAssessment": "字符串，基于实际复现的影响评估（最多8000字符）",
  "limitations": [
    "执行过程中的约束或限制1",
    "执行过程中的约束或限制2"
  ],
  "remediationAdvice": {
    "shortTerm": "短期缓解措施",
    "rootCauseFix": "根因修复建议",
    "regressionTest": "回归测试方法"
  },
  "reviewCommentDraft": "审核意见草稿（最多5000字符）",
  "steps": [
    {
      "sequence": 1,
      "title": "步骤标题",
      "executionState": "EXECUTED|REJECTED|BLOCKED|NOT_EXECUTED|EVIDENCE_INSUFFICIENT",
      "resultSummary": "步骤执行结果摘要",
      "evidence": [
        {
          "type": "screenshot|http_response|file|log",
          "description": "证据描述"
        }
      ]
    }
  ]
}
```

**校验规则**（`hasCompleteDirectReportPayload()`）：
- 必须包含：`conclusion.confidence`、`conclusion.reproducibility`、`conclusion.riskLevelSuggestion`
- 必须包含：`evidenceSummary`（非空）、`impactAssessment`（非空）、`limitations`（数组）
- 必须包含：`remediationAdvice.shortTerm`、`rootCauseFix`、`regressionTest`（均非空）
- 必须包含：`reviewCommentDraft`（非空）
- 如果缺失任何字段，报告降级为 `INSUFFICIENT_EVIDENCE`，使用默认占位文本

---

## 完整状态机

```
PENDING → QUEUED → PLANNING → POLICY_CHECK → DIRECT_PLAN_REVIEW
                                                    ↓ (管理员审批)
                                            DIRECT_RUNNING
                                                    ↓
                                          [Hermes SSE 事件流]
                                           tool.started / tool.completed
                                           approval.request → 自动/人工批准
                                                    ↓
                                            run.completed → REPORTING → SUCCEEDED
                                            run.failed    → FAILED
```

---

## 环境变量参考

| 变量 | 用途 | 当前值 |
|------|------|--------|
| `AI_RETEST_HERMES_BASE_URL` | Hermes 地址（合并后指向主 Hermes） | `http://localhost:5000/v1/` |
| `AI_RETEST_HERMES_TOKEN` | Hermes API token | 与主 Hermes API_SERVER_KEY 一致 |
| `AI_RETEST_HERMES_MODEL` | DeepSeek 模型名 | `deepseek-v4-flash` |
| `AI_RETEST_AUTO_APPROVE_DIRECT_ACTIONS` | 自动批准所有非硬阻断动作 | `false`（测试时建议 `true`） |
| `AI_RETEST_MOCK_PLAN_JSON` | Mock 计划（跳过 Hermes 计划生成） | 无 |

> 已废弃：`AI_RETEST_EGRESS_CONTROL_URL`、`AI_RETEST_EGRESS_CONTROL_TOKEN`（合并后不再需要 egress proxy）

---

## 当前已知问题

1. **Chrome 未安装**：Hermes 容器不含 Chromium，`browser_navigate` 等工具不可用。弱口令测试可用 `http_client` 替代（直接 POST 登录接口）
2. **计划生成超时**：偶发 120s 超时，可用 `AI_RETEST_MOCK_PLAN_JSON` 绕过
3. **审批后状态卡在 DIRECT_PLAN_REVIEW**：待排查 API 返回值
