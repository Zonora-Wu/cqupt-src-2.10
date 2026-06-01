# 数据库架构摘要

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-06-01 已按当前代码、运行环境和 AI 问题会话 Phase 2 进度更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、最小上下文 + dataRequests、AI Knowledge Base 问题会话生命周期、已解决会话总结、AI+规则评分、相似聚类、管理员审核、高频高质自动入库、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型路由为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 当前仍待实现/验收：Knowledge Retrieval 命中回答、来源标注写回、turn 级点赞/点踩持久化、问题会话 fork/archive/title 接口、maintenanceStatus/retrievalPolicy、维护任务 Worker、不可变 revision 回滚、知识投毒暂停与恢复闭环。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`docs/architecture/AI_PROBLEM_SESSION_KNOWLEDGE_CAPTURE.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

## 总体关系

PostgreSQL 是 CQUPT-SRC 主业务库，由 Prisma 管理 schema 和 migration。权威模型见：

```text
database/prisma/schema.prisma
database/DATABASE_DESIGN.md
```

核心域：

- 用户与权限：`User`、`Role`、`Permission`、`RolePermission`、`UserPermissionOverride`。
- 准入：`ResponsibilityAgreement`、`ResponsibilitySignature`、`SecurityQuestion`、`SecurityExamAttempt`。
- 漏洞：`VulnerabilityReport`、`VulnerabilityAttachment`、`VulnerabilityEvent`、`ReviewAssignment`、`ReviewComment`、`RetestRecord`。
- 证书：`Certificate`、`CertificateTemplate`。
- 内容与积分：`Announcement`、`LearningResource`、`PointLedgerEntry`、`MallProduct`、`MallRedemption`。
- 审计：`AuditLog`。
- AI：`AiCallLog`、`AiKnowledgeEntry`、`AiKnowledgeCaptureJob`、`AiKnowledgeConversation`、`AiKnowledgeConversationTurn`、`AiProblemSession`、`AiProblemSessionTurn`、`AiKnowledgeHit`、`AiKnowledgeFeedback`、`AiKnowledgeCluster`、`AiSkillCandidate`、`AiSkillInstallLog`。

## 关键设计

- 单学校部署，配置通过 `SchoolProfile` 与 `SystemSetting` 承载。
- 用户单角色，多权限；特殊授权通过用户级权限覆盖实现。
- 漏洞提交受准入策略控制：邮箱、责任书、安全答题、账号状态。
- 附件仅 PDF，MinIO 存储，访问鉴权并写审计日志。
- AI Knowledge 存 PostgreSQL，不直接写 Hermes skill；Skill Candidate 经审批后才安装。
- AI 知识会话包含评分与去重字段，避免低质或重复知识自动沉淀。
- 新版问题会话式知识沉淀以 `AiProblemSession` 为入口，只有用户确认已解决后才进入总结和知识候选。
- `AiKnowledgeCluster` 聚合同类已解决问题，用于高频高质量自动入库；自动入库状态使用 `AUTO_APPROVED`，管理员仍可撤回、归档或合并。
- 知识库参与回答时应记录 `AiKnowledgeHit` 并返回 `knowledgeSources`，前端显示平台知识来源。
- 每条 assistant 回复应可被点赞/点踩：反馈先绑定 `AiProblemSessionTurn`，若该回复使用知识库，则同时绑定 `AiKnowledgeHit` 和 `AiKnowledgeFeedback`，并进入知识质量评分。
- 用户端历史会话侧栏以 `AiProblemSession` 为数据源，只返回当前 JWT 用户自己的轻量摘要；已结束会话继续追问时应创建 fork 新会话，避免污染原已解决会话。

## 验证命令

```bash
cd /home/cocking/projects/cqupt-src-2.10/backend
npm run prisma:validate
npm run prisma:generate
npm run build
```
