# Modules

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-05-21 已按当前代码与运行环境更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、AI Knowledge Base 多轮会话沉淀、AI 评分自动流转、相似知识去重、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型配置为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

后端业务模块目录。

建议模块：

- `auth`：登录、注册、邮箱验证码、刷新令牌
- `users`：用户资料、账号安全、责任书签署
- `roles`：角色与权限点
- `vulnerabilities`：漏洞提交、状态流转、审核
- `attachments`：附件上传、下载、病毒扫描占位
- `certificates`：电子证书签发、撤销、公开核验
- `announcements`：公告发布与管理
- `learning`：学习资源与靶场资源
- `points`：积分明细、积分商城、兑换记录
- `audit-logs`：审计日志
- `ai`：AI 任务、报告解析、审核辅助
