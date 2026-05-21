# 用户端 AI 助手设计记录

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-05-21 已按当前代码与运行环境更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、AI Knowledge Base 多轮会话沉淀、AI 评分自动流转、相似知识去重、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型配置为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

用户端 AI 助手当前名称为“邮宝”，实现位置：

```text
frontend/src/pages/user/UserAIAssistant.tsx
frontend/src/services/ai.ts
backend/src/modules/ai/
backend/src/modules/ai-knowledge/
```

当前已落地能力：

- 后端 AI Gateway 代理 Hermes，不允许前端直连。
- 用户上下文注入：积分、商品、漏洞、学习资源等后端可信数据。
- 强业务查询确定性返回，开放式问题调用 Hermes Agent。
- 商品卡片、兑换 action、代码块复制、回到底部按钮。
- 附件待发送区；用户明确报告草稿意图时才调用 `/api/ai/report-drafts`。
- 普通附件问答走 `/api/ai/attachments/text` + `/api/ai/chat`，跳过 Direct Response。
- 多轮问题解决会话可进入 AI Knowledge Base 沉淀链路。

权威设计文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`。
