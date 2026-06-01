# Security

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-06-01 已按当前代码、运行环境和 AI 问题会话 Phase 2 进度更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、最小上下文 + dataRequests、AI Knowledge Base 问题会话生命周期、已解决会话总结、AI+规则评分、相似聚类、管理员审核、高频高质自动入库、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型路由为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 当前仍待实现/验收：Knowledge Retrieval 命中回答、来源标注写回、turn 级点赞/点踩持久化、问题会话 fork/archive/title 接口、maintenanceStatus/retrievalPolicy、维护任务 Worker、不可变 revision 回滚、知识投毒暂停与恢复闭环。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`docs/architecture/AI_PROBLEM_SESSION_KNOWLEDGE_CAPTURE.md`、`database/prisma/schema.prisma`。
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
