# Security

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-06-08 已按当前代码、运行环境和 AI 漏洞自动复测 Phase 1-9 + 7.5 进度更新。
>
> 平台有三套 Hermes 环境：主 Hermes Agent（端口 5000）、Hermes Retest Agent（端口 5001，独立容器+动态 egress proxy）、CLI Hermes（不参与平台请求）。
>
> 关键权威文档：`docs/AI.md`、`docs/HERMES_RUNTIME.md`、`docs/plans/AI_VULNERABILITY_RETEST_IMPLEMENTATION_PLAN.md`、`docs/deployment/HERMES_DIRECT.md`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

## 当前安全基线

- JWT Access Token + Refresh Token；权限来自后端 JWT/RBAC，不信任前端声明。
- 所有管理类接口需要权限守卫；用户只访问自己的漏洞、积分、证书和账号数据。
- PDF 附件上传限制文件类型、大小、MIME、扩展名和 magic bytes，并记录 SHA-256。
- PDF 附件预览必须鉴权，提交者、分配审核员、管理员才可访问，并写入 `VIEW_SENSITIVE_ATTACHMENT` 审计。
- 漏洞审核、证书签发、商城兑换、用户管理、系统设置等写操作必须记录审计日志。
- 安全答题准入由后端随机组卷、判分并记录尝试，不能只相信前端分数。

## AI 安全边界

- 前端禁止直连 Hermes Agent 或模型供应商。
- AI Gateway 必须做 JWT 鉴权、RBAC、上下文裁剪、脱敏、审计和超时降级。
- 模型输出的 `userId`、`role`、`productId`、`vulnerabilityId`、`pointsBalance`、`stock`、`status` 全部不可信，必须由后端重建。
- 邮宝不能声称已完成兑换、审核、发放积分、发布公告、修改权限等写操作；必须走 Action Proposal / 用户确认 / 后端事务。
- AI Knowledge Base 不保存用户隐私、真实资产、Token、Cookie、原始附件或可攻击真实目标的步骤。
- Skill Candidate 只有管理员批准后才可安装到平台 Hermes skills 目录。

## 敏感信息处理

必须脱敏或拒绝输出：

- API Key、Token、Cookie、Session、数据库连接串、MinIO 密钥、模型供应商密钥。
- 其他用户漏洞、积分、证书、身份信息。
- 原始漏洞附件、真实资产 URL、内网 IP、请求包敏感字段。
- 未授权攻击、破坏性 exploit、后门、持久化代码。

## 部署安全检查

- `.env`、平台 Hermes `.env.agent`、MinIO 密钥不得入库。
- 生产数据库开启备份与最小权限账号。
- Nginx 配置 HTTPS、上传大小限制和安全响应头。
- 平台 Hermes `/home/cocking/cqupt-src-hermes-linux/data` 权限需既满足容器运行，又避免后端越权任意写入。
- 管理员知识沉淀审核页只允许有管理权限的用户访问。

## AI 漏洞复测安全边界

### 执行通道安全

- **Runner 通道**：只执行低风险内置模板（http_get/head/options/post_limited、playwright_visit/screenshot、header/cors/clickjacking_check、content_diff、dns_canary_check）。不持用户 JWT、DB 凭据、MinIO 凭据。不挂 Docker socket，不访问宿主机网络。
- **Hermes Direct 通道**：独立 `hermes-retest-agent` 容器（端口 5001），经 `retest-egress-proxy` 动态 scope 授权出网。与主 Hermes Agent（端口 5000）网络和凭据隔离。

### 审批门

1. **初始方案审批**（`DIRECT_PLAN_REVIEW`）：Hermes 先生成大致方案（目标、工具类别、风险、影响范围），人工批准后才开始执行。方案内容变化时批准自动失效。
2. **逐次高风险审批**（`DIRECT_ACTION_REVIEW`）：目标扩大、高风险动作（RCE/命令执行/getshell 等）必须暂停并再次人工批准。审批绑定 action hash，内容变化后旧批准不可复用。
3. **超高危硬阻断**：DoS/爆破/扫描/持久化/横向移动/批量导出/破坏数据即使管理员审批也被阻断。

### 网络安全

- 拒绝内网：127.0.0.0/8、10.0.0.0/8、172.16.0.0/12、192.168.0.0/16、169.254.0.0/16、100.64-127.0.0.0/10、198.18-19.0.0.0/16、0.0.0.0/0、224.0.0.0/4（组播）、::1、fc00::、fe80::。
- 拒绝危险协议：file://、gopher://、ftp://、dict://。
- 人工确认不能绕过 DNS 解析后 IP 校验（防 DNS rebinding）。
- HTTP 重定向后重新校验目标（防 redirect 越界）。
- `@` 在 URL host 中被拒绝（防 userinfo host override）。

### 凭据安全

- 六种凭据类型：USERNAME_PASSWORD / COOKIE / BEARER_TOKEN / CUSTOM_HEADERS / CLIENT_CERT_REFERENCE / INTERACTIVE_OTP。
- AES-256-GCM 密钥环加密存储，AAD 绑定 `jobId + credentialType + targetScopeHash + keyId`。
- 凭据仅注入指定 session，不进入 Hermes prompt、审计日志、报告或普通 artifact。
- 过期或销毁后解密拒绝。

### 状态机安全

- 终态（SUCCEEDED/FAILED/CANCELLED/BLOCKED/EXPIRED）不可迁移。
- ADVISORY_ONLY 不可进入 RUNNING。
- PLAN_REVIEW 只能人工批准后进入 RUNNING，Worker 不自动推进。
- CANCELLING/RUNNING 期间的取消信号和迟到 Runner 回包不破坏状态机（CAS + statusVersion 保护）。
- Worker 抢锁使用 `lockedBy + lockedAt + statusVersion` CAS 防双消费，lock TTL 10 分钟。

### 数据脱敏

- 进入 Hermes 前：Cookie、Authorization、Token、Session、手机号、邮箱、内网 IP、DB 连接串全部脱敏。
- 审计日志 metadata 不保存完整凭据、敏感响应体或脱敏前的原文。
- Artifact 保存 sha256 + 脱敏预览，单独接口二次鉴权。存储键不暴露 MinIO 内部路径。
