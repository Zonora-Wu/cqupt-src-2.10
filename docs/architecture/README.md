# Architecture

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-05-31 已按新版 AI 知识沉淀方案更新。架构文档现在包含数据库模型、AI Context Injection 和 AI 问题会话式知识沉淀架构索引。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型配置为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

架构设计文档目录。

## 文档索引

| 文档 | 内容 |
|---|---|
| `DATABASE_MODEL.md` | PostgreSQL / Prisma 领域模型摘要，覆盖用户、RBAC、漏洞、证书、学习、商城、AI Knowledge 与 Skill Candidate。 |
| `AI_CONTEXT_INJECTION.md` | 邮宝最小上下文注入与 dataRequests 后端托管只读工具网关。 |
| `AI_PROBLEM_SESSION_KNOWLEDGE_CAPTURE.md` | 新版问题会话式知识沉淀架构：AiProblemSession、解决确认、知识聚类、自动入库、知识库回答复用和来源标注。 |

## AI 架构阅读顺序

1. `../AI.md`：先看 AI Gateway 总体框架。
2. `AI_CONTEXT_INJECTION.md`：理解实时平台数据如何按需查询。
3. `../AI_KNOWLEDGE_BASE.md`：理解问题会话式知识沉淀的产品与治理方案。
4. `AI_PROBLEM_SESSION_KNOWLEDGE_CAPTURE.md`：理解落地的数据流、状态机和 API 边界。
5. `../HERMES_RUNTIME.md`：理解平台 Hermes 与 CLI Hermes 的运行目录差异。
