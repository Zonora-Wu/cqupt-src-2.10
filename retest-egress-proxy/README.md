# Hermes Direct Egress Proxy

`retest-egress-proxy` 是 Hermes Direct 的强制出站控制面：

- 代理数据端口 `8080`，要求 Basic proxy token。
- scope 控制端口 `8081`，要求 Bearer control token。
- Hermes TCP 转发端口 `5002`，由宿主只绑定到 `127.0.0.1:5001`。
- 同一时间只保留一个活动复测 scope，过期后自动拒绝。
- 控制面负责按严格 session id 规则删除任务结束后的 Hermes session/request dump。
- 连接前校验主机、注册域继承、端口、DNS 结果和私网/metadata 地址。
- 控制面通过 `GET /v1/events?sessionId=...` 向 NestJS 提供有界事件队列，记录 DNS 结果、连接判定和 HTTP 重定向。
- 事件中的 URL 会移除 query 和 fragment，越界主机/端口由后端转换为 `TARGET_SCOPE_EXPANSION` 审批；私网/metadata 阻断不可转换。
- `hermes-retest-agent` 只加入 Docker internal 网络，不能绕过代理直接访问外网。

```bash
npm install
npm test
npm run build
```

动态 scope 和事件读取均由 NestJS `HermesEgressClient` 通过 control token 完成，普通用户和 Hermes 都不能调用控制端。
