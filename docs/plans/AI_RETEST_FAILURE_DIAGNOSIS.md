# AI 漏洞复测失败诊断与修复建议

> 漏洞：CQUPT-SRC-20260608-DNUMD7 — 证书查询板块 水平越权
> 诊断时间：2026-06-08
> 修复时间：2026-06-08
> 诊断方式：数据库审计日志 + Hermes Direct 端点连通性验证 + 手动复测

---

## 一、三次复测失败概览

| # | Job ID | 模式 | 结果 | 关键错误 |
|---|--------|------|------|----------|
| 1 | `cmq4sreae...` | HERMES_DIRECT | FAILED | `AI_RETEST_PLAN_GENERATION_FAILED` |
| 2 | `cmq4t3y9...` | HERMES_DIRECT | FAILED | `AI_RETEST_HERMES_CALL_FAILED` (fetch failed) |
| 3 | `cmq4t9e8...` | PLAN_ONLY → RUNNING | SUCCEEDED* | 3 个 Runner 步骤全 `AI_RETEST_RUNNER_NOT_CONFIGURED` |

> *注：第 3 次状态标记 SUCCEEDED 仅表示流程走完，3 个 Runner 步骤全部失败，实际未执行任何有效复测。

---

## 二、逐条诊断

### 失败 1：计划生成阶段 Hermes 超时

```
错误码：AI_RETEST_PLAN_GENERATION_FAILED
错误信息：模型服务在 120 秒内没有返回结果，已终止本次请求。
发生阶段：PENDING → QUEUED → PLANNING（计划生成阶段）
```

**调用链路**：

```
Worker.tick()
  → processPlanningJob()
    → AiVulnerabilityRetestPlanningService.generateOrResumePlanForJob()
      → AiService（主 Hermes Agent，端口 5000）
        → 120 秒超时 → AI_RETEST_PLAN_GENERATION_FAILED
```

**根因**：计划生成依赖主平台 Hermes Agent（`localhost:5000`），调用超时。可能原因：
- Hermes Agent 容器（`hermes-agent`）负载过高，响应慢
- 计划生成的 prompt 过长，模型推理时间超过 120 秒限制
- DeepSeek API 偶发延迟（容器 DNS 已配置 223.5.5.5 / 119.29.29.29，但上游仍可能波动）

**代码位置**：`backend/src/modules/ai-vulnerability-retest/ai-vulnerability-retest-planning.service.ts`
- 超时常量：`RETEST_PLAN_TIMEOUT_MS = 120_000`

---

### 失败 2：Hermes Direct 事件流中断

```
错误码：AI_RETEST_HERMES_CALL_FAILED
错误信息：fetch failed
发生阶段：DIRECT_RUNNING（Hermes Direct 执行阶段）
```

**调用链路**：

```
Worker.tick()
  → HermesDirectSessionService.processJob()
    → HermesDirectClient.createSession()  ✅ 成功（run_a52c07f3d3034a2fbbc2a46e61c1157d）
    → HermesEgressClient.activateScope()  ✅ 成功
    → ensureMonitor() → monitor()
      → HermesDirectClient.getEvents()   ❌ fetch failed（SSE 事件流中断）
```

**审计日志时序**：

```
06:05:08  AI_RETEST_CREATED          success
06:05:08  AI_RETEST_CONTEXT_CREATED  success
06:05:29  AI_RETEST_POLICY_CHECKED   success (REQUIRE_HUMAN_APPROVAL)
06:05:58  DIRECT_PROPOSAL_CONFIRMED  success (人工批准)
06:05:59  DIRECT_STARTED             success (hermesRunId: run_a52c07f3...)
         ↓
         事件流监控中断 → 无后续审计事件
         ↓
         directSession.status = FAILED
         job.status = FAILED（errorCode 未写入）
```

**根因分析**：

Hermes Direct 架构为：

```
Backend (localhost)
  → localhost:5001 (retest-egress-proxy 的 host 端口映射)
    → hermes-retest-agent:5000 (Docker 内部网络 retest-isolated)
```

连通性验证（宿主机 → 5001）：
- `GET /v1/health` → 200 OK ✅
- `POST /v1/runs` → 202，session 创建成功 ✅

但 **SSE 事件流** (`GET /v1/runs/:runId/events`) 在后续轮询中 `fetch failed`。可能原因：

1. **retest-egress-proxy 超时断开** — SSE 长连接若在代理层有 idle timeout，会在无事件时断开
2. **hermes-retest-agent 容器崩溃或 OOM** — retest Agent 在执行过程中可能因资源不足退出
3. **网络抖动** — `retest-isolated` 网络是 internal 的，代理层 TCP 转发可能不稳定
4. **15 秒超时过短** — `DEFAULT_TIMEOUT_MS = 15_000`，但对于 SSE 流式响应，15s 内无新事件可能触发 abort

**代码位置**：`backend/src/modules/ai-vulnerability-retest/hermes-direct.client.ts`
- 超时设置：`DEFAULT_TIMEOUT_MS = 15_000`（第 3 行）
- 问题：`fetch()` 的 AbortController 对所有请求统一施加 15s 超时，但 `getEvents()` 调用 `this.fetch()` 传入 `timeoutMs = 0`，实际绕过超时。真正失败点可能在 `getSession()`（用于 reconcileRunStatus）的 15s 超时。

---

### 失败 3：Runner 未部署

```
错误码：AI_RETEST_RUNNER_NOT_CONFIGURED
错误信息：未配置 AI_RETEST_RUNNER_BASE_URL，拒绝执行本地命令回退
影响步骤：全部 3 个 Runner 步骤
```

**根因**：生产环境后端 `.env` 缺少 `AI_RETEST_RUNNER_BASE_URL` 环境变量。Planner 生成了 3 个内置模板步骤（`http_get`、`playwright_visit`、`playwright_screenshot`），但 Worker 在执行时检测到 Runner 未配置，直接拒绝执行（安全设计：不允许回退到本地命令执行）。

**代码位置**：`backend/src/modules/ai-vulnerability-retest/retest-runner.client.ts`

---

## 三、修复建议

### 优先级 P0：修复证书越权漏洞本身

手动复测已确认水平越权存在。`/api/certificates/:id/preview` 缺少所有权校验。

**修复**：在 `certificates.service.ts` 的 `previewCertificatePdf()` 中增加：

```typescript
// 非管理员只能查看自己的证书
if (user.role !== 'ADMIN' && certificate.recipientId !== user.id) {
  throw new ForbiddenException('无权查看他人证书')
}
```

### 优先级 P1：Hermes Direct 可靠性

| 问题 | 建议 |
|------|------|
| `DEFAULT_TIMEOUT_MS = 15s` 对 SSE 流不适用 | `getEvents()` 已传 `0` 跳过超时，但 `getSession()` 和 `request()` 仍用 15s。将 Hermes Direct 调用的超时提升到 60s |
| SSE 流中断后 reconciliation 脆弱 | `reconcileRunStatus()` 如果也失败，任务直接标记 FAILED 且 **不写 errorCode**。至少应记录最后一次已知错误 |
| 无重试机制 | Worker 获取锁后一次性执行，失败不重试。建议在 `monitor()` catch 中触发一次 `reconcileRunStatus()` 重试 |
| retest-agent 容器健康检查 | 当前 `hermes-retest-agent` 依赖 `retest-egress-proxy` healthy，但自身无独立健康检查端点。建议增加 OOM 监控 |

### 优先级 P2：计划生成超时

| 问题 | 建议 |
|------|------|
| 120s 超时无重试 | 计划生成失败后，Worker 不重试。建议在 `generateOrResumePlanForJob()` 增加 1-2 次重试（exponential backoff） |
| 计划生成依赖主 Hermes | 主 Hermes 同时服务平台 AI 助手，高峰期可能争抢资源。考虑为复测计划生成使用独立模型或队列优先级 |

### 优先级 P3：Runner 部署

| 问题 | 建议 |
|------|------|
| 生产环境无 Runner | 如果不需要 Runner 模式，应将默认 mode 改为 `HERMES_DIRECT`，避免 Planner 生成 Runner 步骤后无法执行 |
| `AI_RETEST_RUNNER_NOT_CONFIGURED` 后任务仍标记 SUCCEEDED | 这是状态机问题——Runner 步骤失败不应导致整个 job 标记 SUCCEEDED。应修改 `createRunnerSummaryReport()` 在全部步骤失败时将 job 状态设为 FAILED |

---

## 四、验证建议

1. **Hermes Direct 端到端测试**：用 curl 模拟完整 SSE 流，确认 retest-egress-proxy → hermes-retest-agent 转发稳定性
2. **Docker 日志检查**：`docker logs hermes-retest-agent` 和 `docker logs cqupt-retest-egress-proxy` 查看崩溃/OOM 记录
3. **增加 Job errorCode 写入**：修改 `monitor()` 的 catch 块和 `reconcileRunStatus()` 的 failure 路径，确保 errorCode 写入 job 记录

---

## 五、修复记录（2026-06-08）

### P1-1：fetch 重试（hermes-direct.client.ts）

- `fetch()` 新增 `remainingRetries` 参数，瞬态错误（ECONNREFUSED/ECONNRESET/fetch failed/socket hang up 等）自动重试最多 2 次，指数退避 1s → 2s
- `request()` 对 GET 和带 Idempotency-Key 的 POST 自动启用重试
- 新增 `isTransientError()` 辅助函数，匹配 Node.js fetch 的典型网络错误消息

### P1-2：SSE 流重连（hermes-direct.client.ts）

- `getEvents()` 新增 SSE 断流重连，最多 3 次，指数退避 2s → 4s → 8s
- 重连后事件去重（event + timestamp + payload size 三元组）
- 成功收到事件后重置重试计数
- 重连耗尽抛出 `AI_RETEST_HERMES_SSE_RECONNECT_EXHAUSTED`
- 新增 `Logger` 用于记录重连/重试日志

### P2-1：执行阶段按计划步骤执行（hermes-direct-session.service.ts）

- `buildDirectInstructions` 新增 9 条显式执行规则，明确要求：
  - 严格按 `approvedProposal.steps` 步骤和顺序执行
  - 每步记录操作、观察和证据
  - 不跳步、不乱序
- `buildDirectPrompt` 的 `reportRequirements` 新增 `steps` 字段描述，要求 Hermes 为每个步骤返回 evidence 数组

### P2-2：报告 Evidence 提取（hermes-direct-session.service.ts）

- `normalizeHermesDirectReport` 从 Hermes 输出 JSON 中解析 `steps[].evidence`
- 按 sequence 匹配到 DB 中的 direct action 记录
- 新增 `normalizeEvidenceItems()` 辅助函数，解析 evidence 对象（id/sha256/type）
- 当 Hermes 未返回 evidence 时退回到空数组（向后兼容）

### 文档更新

- `docs/deployment/HERMES_DIRECT.md`：新增工作流、执行 Prompt、报告 Evidence 提取、可靠性（fetch 重试 + SSE 重连）章节
- `docs/plans/AI_RETEST_FAILURE_DIAGNOSIS.md`：追加修复记录

---

> 手动复测结论：漏洞 `CQUPT-SRC-20260608-DNUMD7` **真实存在**，`/api/certificates/:id/preview` 水平越权可被低权限用户利用，获取他人完整证书 PDF。
