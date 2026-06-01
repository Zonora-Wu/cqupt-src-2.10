# 数据库架构摘要

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-05-31 已按新版 AI 知识沉淀方案更新。数据库目标模型在既有 `AiKnowledgeEntry`、`AiKnowledgeConversation`、`AiKnowledgeConversationTurn`、`AiSkillCandidate`、`AiSkillInstallLog` 基础上，引入 `AiProblemSession`、`AiProblemSessionTurn`、`AiKnowledgeHit`、`AiKnowledgeFeedback` 和 `AiKnowledgeCluster`，用于问题会话、历史会话恢复、AI 回复点赞/点踩、已解决确认、相似问题聚类和自动入库。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型配置为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`database/prisma/schema.prisma`。
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
