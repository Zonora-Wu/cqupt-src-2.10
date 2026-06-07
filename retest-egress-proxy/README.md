# Hermes Direct Egress Proxy

`retest-egress-proxy` 是 Hermes Direct 的强制出站控制面：

- 代理数据端口 `8080`，要求 Basic proxy token。
- scope 控制端口 `8081`，要求 Bearer control token。
- Hermes TCP 转发端口 `5002`，由宿主只绑定到 `127.0.0.1:5001`。
- 同一时间只保留一个活动复测 scope，过期后自动拒绝。
- 控制面负责按严格 session id 规则删除任务结束后的 Hermes session/request dump。
- 连接前校验主机、注册域继承、端口、DNS 结果和私网/metadata 地址。
- `hermes-retest-agent` 只加入 Docker internal 网络，不能绕过代理直接访问外网。

```bash
npm install
npm test
npm run build
```

动态 scope 由 NestJS `HermesEgressClient` 写入，普通用户和 Hermes 都不能调用控制端。
