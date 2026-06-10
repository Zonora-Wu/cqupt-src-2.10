# Hermes Direct 部署

## 拓扑

```text
NestJS
  -> 127.0.0.1:5001
  -> retest-egress-proxy TCP forward
  -> hermes-retest-agent:5000

hermes-retest-agent
  -> HTTP(S) proxy only
  -> retest-egress-proxy:8080
  -> approved target or api.deepseek.com:443
```

`hermes-retest-agent` 仅加入 `retest-isolated` internal 网络。egress proxy 同时加入 internal 和普通 bridge 网络，因此是唯一出站点。两个服务都不使用 host network 或 Docker socket。

## 工作流

```
创建任务 → Hermes 生成计划(含步骤+影响范围+风险)
         → 返回平台给管理员/审核员确认
         → 确认后 Hermes 按计划步骤逐项执行
         → 完成后生成报告(含证据+影响评估+修复建议)
```

## 配置

- Hermes Compose：`/home/cocking/cqupt-src-hermes-linux/docker/docker-compose.yml`
- 复测令牌：`/home/cocking/cqupt-src-hermes-linux/docker/env/.env.retest`
- 后端配置：`backend/.env`
- 平台 Skills：`/home/cocking/cqupt-src-hermes-linux/platform-skills/cqupt-src/`

密钥要求：

- `EGRESS_CONTROL_TOKEN` 和 `EGRESS_PROXY_TOKEN` 至少 16 字符。
- `AI_RETEST_CREDENTIAL_KEYS` 为逗号分隔的 `keyId:base64Key`，每个密钥解码后必须为 32 字节。
- 轮换时先新增密钥并切换 `AI_RETEST_CREDENTIAL_ACTIVE_KEY_ID`，旧凭据过期或销毁后再移除旧密钥。
- job 完成、取消或失败后，控制面会清理对应 `session_cqupt-retest-*.json` 和 request dump，避免租用凭据残留在 Hermes 持久目录。

egress proxy 会在内存中保留最多 2000 条待归档网络事件。NestJS 在 Hermes 工具事件后读取并写入审计日志；越界主机或端口会生成 `TARGET_SCOPE_EXPANSION` action，批准后更新 session scope 和代理 allowlist。私网、metadata、DNS 失败和过期 scope 只记录阻断证据，不提供人工放行路径。

## 执行 Prompt

Hermes Direct 执行时的 system instructions（`buildDirectInstructions`）包含 9 条显式执行规则：

1. 严格按 `approvedProposal.steps` 步骤和顺序执行
2. 每步记录操作、观察结果和证据（截图、响应摘要、文件 hash）
3. 不跳步、不乱序（除非前一步使后续不可行）
4-9. 安全边界、工具类限制、approval 机制、凭据保护、仅输出 JSON

Hermes 收到的 `reportRequirements` 中包含 `steps` 字段要求，期望返回每个已执行步骤的 evidence 数组。

## 报告 Evidence 提取

`normalizeHermesDirectReport` 从 Hermes 输出 JSON 中解析 `steps[].evidence`，按 sequence 匹配到 DB 中的 direct action 记录。如果 Hermes 返回了有效的 per-step evidence（id/sha256/type），它们会被填入最终报告的 `steps[].evidence` 字段，供审核员在平台上查看。

## 可靠性

### fetch 重试

`hermes-direct.client.ts` 的 `fetch()` 方法对瞬态网络错误（ECONNREFUSED、ECONNRESET、fetch failed、socket hang up 等）自动重试最多 2 次，指数退避 1s → 2s。GET 和带 Idempotency-Key 的 POST 请求自动启用重试。

### SSE 流重连

`getEvents()` 在 SSE 流断开时自动重连最多 3 次，指数退避 2s → 4s → 8s。重连后通过事件去重（event + timestamp + payload size 三元组）跳过已处理的事件。连续成功收到事件后重置重试计数。

### 对账

当前 Hermes 版本的 SSE 在 run 终态可能以不完整 chunk 结束。NestJS 会在流关闭后查询 `/v1/runs/{run_id}` 对账；若 Hermes 正在等待审批但审批事件丢失，任务失败关闭，避免无审计继续执行。SSE 重连耗尽后（3 次）抛出 `AI_RETEST_HERMES_SSE_RECONNECT_EXHAUSTED`。

## 验证

```bash
cd /home/cocking/cqupt-src-hermes-linux/docker
docker compose config --quiet
docker compose up -d --build
curl http://127.0.0.1:5001/health
```

升级后端的 egress 事件归档功能时必须同步重建 `retest-egress-proxy`。旧代理不提供 `/v1/events`，后端会按安全失败策略终止无法完整归档网络证据的 Direct 任务。

真实联网验证只能使用人工确认的漏洞目标。未激活 scope 时，egress proxy 默认拒绝所有目标流量；DeepSeek API 仅作为固定模型基础设施例外。
