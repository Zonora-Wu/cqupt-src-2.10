# CQUPT-SRC Restricted Retest Runner

独立受限 Runner 服务，仅执行后端策略审查后的内置动作模板。

## 边界

- 不接收用户 JWT、数据库连接、MinIO 凭据或 Hermes 任意脚本。
- 不执行 shell/curl/python/nmap/sqlmap/metasploit 等自由命令。
- 只支持固定模板：`http_head`、`http_get`、`http_options`、`http_post_limited`、`header_check`、`cors_check`、`clickjacking_check`、`content_diff`、`dns_canary_check`、`playwright_visit`、`playwright_screenshot`。
- 每次请求和每次 redirect 都重新校验协议、同源范围、DNS 解析和内网/metadata/保留地址。
- 返回结构化摘要、脱敏预览和 hash，不返回完整敏感响应体。

## 运行

```bash
cd retest-runner
npm install
RETEST_RUNNER_TOKEN=dev-token npm run dev
```

默认端口：`5015`。

后端对接环境变量示例：

```bash
AI_RETEST_RUNNER_BASE_URL=http://localhost:5015
AI_RETEST_RUNNER_TOKEN=dev-token
```

## 验证

```bash
cd retest-runner
npm run build
npm run test
```
