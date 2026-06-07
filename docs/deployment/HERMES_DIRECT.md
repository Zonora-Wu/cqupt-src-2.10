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

## 验证

```bash
cd /home/cocking/cqupt-src-hermes-linux/docker
docker compose config --quiet
docker compose up -d --build
curl http://127.0.0.1:5001/health
```

真实联网验证只能使用人工确认的漏洞目标。未激活 scope 时，egress proxy 默认拒绝所有目标流量；DeepSeek API 仅作为固定模型基础设施例外。

当前 Hermes 版本的 SSE 在 run 终态可能以不完整 chunk 结束。NestJS 会在流关闭后查询 `/v1/runs/{run_id}` 对账；若 Hermes 正在等待审批但审批事件丢失，任务失败关闭，避免无审计继续执行。
