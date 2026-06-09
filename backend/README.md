# Backend

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-06-01 已按当前代码、运行环境和 AI 问题会话 Phase 2 进度更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、最小上下文 + dataRequests、AI Knowledge Base 问题会话生命周期、已解决会话总结、AI+规则评分、相似聚类、管理员审核、高频高质自动入库、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型路由为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 当前仍待实现/验收：Knowledge Retrieval 命中回答、来源标注写回、turn 级点赞/点踩持久化、问题会话 fork/archive/title 接口、maintenanceStatus/retrievalPolicy、维护任务 Worker、不可变 revision 回滚、知识投毒暂停与恢复闭环。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`docs/architecture/AI_PROBLEM_SESSION_KNOWLEDGE_CAPTURE.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

NestJS 11 后端，负责 CQUPT-SRC 的可信业务入口：认证、RBAC、漏洞、附件、证书、公告、学习资源、积分商城、用户管理、审计、AI Gateway 和 AI 知识沉淀。

## 模块概览

| 模块 | 目录 | 职责 |
|---|---|---|
| Auth / Account | `src/modules/auth`、`src/modules/account` | 登录、注册、当前用户、头像、邮箱、密码、账号安全日志 |
| Access / Security Exam | `src/modules/access`、`src/modules/security-exam` | 责任书、安全答题、提交准入 |
| Vulnerabilities / Attachments | `src/modules/vulnerabilities`、`src/modules/attachments` | 漏洞生命周期、补充材料、PDF 附件上传与预览 |
| Certificates | `src/modules/certificates` | 证书签发、撤销、PDF 预览、公开核验 |
| Announcements / Learning / Mall | `src/modules/announcements`、`src/modules/learning`、`src/modules/points-mall` | 内容、资源、积分与兑换 |
| Admin | `src/modules/users`、`src/modules/system-settings`、`src/modules/audit-logs` | 用户管理、系统设置、审计日志 |
| AI Gateway | `src/modules/ai` | 邮宝聊天、上下文注入、附件解析、报告草稿、Skill 路由 |
| AI Knowledge | `src/modules/ai-knowledge` | KB、会话沉淀、AI 评分、去重、Skill Candidate、安装 |

## 本地开发命令

```bash
cd /home/cocking/projects/cqupt-src-2.10/backend
npm install
npm run prisma:generate
npm run prisma:migrate:dev
npm run db:seed
npm run dev
```

## 验证命令

```bash
cd /home/cocking/projects/cqupt-src-2.10/backend
npm run build
npm run prisma:validate
curl -s http://localhost:3000/api/health
```

## AI 运行依赖

```env
OPENAI_BASE_URL=http://localhost:5000/v1
OPENAI_API_KEY=API_SERVER_KEY
OPENAI_MODEL=hermes-agent
```

后端只调用平台 Hermes Gateway，不读取 CLI Hermes skills。平台 Hermes 运行细节见 `../docs/HERMES_RUNTIME.md`。

## 安全约束

- 所有写操作必须重新鉴权、走 Prisma transaction 并写 AuditLog。
- AI 输出不可信，业务 ID、积分、库存、权限和状态必须以后端查库为准。
- 附件、漏洞、证书、用户数据必须按当前 JWT/RBAC 权限过滤。
- AI Knowledge 入库前必须脱敏、泛化、评分、去重并接受管理员审核或安全兜底。
