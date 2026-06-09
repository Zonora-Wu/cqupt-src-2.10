# Architecture

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-06-08 已按当前代码、运行环境和 AI 漏洞自动复测 Phase 1-9 + 7.5 进度更新。
>
> 关键权威文档：`docs/AI.md`、`docs/HERMES_RUNTIME.md`、`docs/plans/AI_VULNERABILITY_RETEST_IMPLEMENTATION_PLAN.md`、`docs/deployment/HERMES_DIRECT.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

架构设计文档目录。

## 文档索引

| 文档 | 内容 |
|---|---|
| `DATABASE_MODEL.md` | PostgreSQL / Prisma 领域模型摘要，覆盖用户、RBAC、漏洞、证书、学习、商城、AI Knowledge 与 Skill Candidate、AI 漏洞复测。 |
| `AI_CONTEXT_INJECTION.md` | 邮宝最小上下文注入与 dataRequests 后端托管只读工具网关。 |
| `AI_PROBLEM_SESSION_KNOWLEDGE_CAPTURE.md` | 新版问题会话式知识沉淀架构：AiProblemSession、解决确认、知识聚类、自动入库、知识库回答复用和来源标注。 |
| `../plans/AI_VULNERABILITY_RETEST_IMPLEMENTATION_PLAN.md` | AI 漏洞自动复测完整实施方案：双通道架构（Runner + Hermes Direct）、状态机、策略引擎、凭据保险箱、Worker 编排。 |

## AI 架构阅读顺序

1. `../AI.md`：先看 AI Gateway 总体框架。
2. `AI_CONTEXT_INJECTION.md`：理解实时平台数据如何按需查询。
3. `../AI_KNOWLEDGE_BASE.md`：理解问题会话式知识沉淀的产品与治理方案。
4. `AI_PROBLEM_SESSION_KNOWLEDGE_CAPTURE.md`：理解落地的数据流、状态机和 API 边界。
5. `../HERMES_RUNTIME.md`：理解平台 Hermes 与 CLI Hermes 的运行目录差异。
6. `../plans/AI_VULNERABILITY_RETEST_IMPLEMENTATION_PLAN.md`：理解 AI 漏洞复测的双通道架构、安全边界和 Worker 编排。
