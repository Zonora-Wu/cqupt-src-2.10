# Prisma

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-06-01 已按当前代码、运行环境和 AI 问题会话 Phase 2 进度更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、最小上下文 + dataRequests、AI Knowledge Base 问题会话生命周期、已解决会话总结、AI+规则评分、相似聚类、管理员审核、高频高质自动入库、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型路由为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 当前仍待实现/验收：Knowledge Retrieval 命中回答、来源标注写回、turn 级点赞/点踩持久化、问题会话 fork/archive/title 接口、maintenanceStatus/retrievalPolicy、维护任务 Worker、不可变 revision 回滚、知识投毒暂停与恢复闭环。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`docs/architecture/AI_PROBLEM_SESSION_KNOWLEDGE_CAPTURE.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

这里存放正式数据库 schema。

当前已创建：

- `schema.prisma`
- 数据库模型说明见 `../DATABASE_DESIGN.md`

注意：Prisma CLI 已作为后端 devDependency 安装，当前 schema 已通过验证。

验证命令：

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10\backend
npm.cmd run prisma:validate
```

生成 Prisma Client：

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10\backend
npm.cmd run prisma:generate
```

说明：

- schema 文件保留在 `database/prisma/schema.prisma`。
- Prisma Client 生成到 `backend/node_modules/@prisma/client/.prisma/client`。
- 生成命令通过 `backend/scripts/prisma-generate.cjs` 执行，避免 Prisma 在项目根目录误生成 `package.json` 和 `node_modules`。

当前已创建并应用初始 migration：

```text
database/prisma/migrations/20260429080513_init/migration.sql
```

本地开发数据库端口：

```text
127.0.0.1:15432
```

本地执行迁移：

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10\backend
npm.cmd run prisma:migrate:dev -- --name init
```

说明：迁移脚本默认 `--skip-generate`，避免 Prisma 因 schema 位于 `database/prisma` 而在项目根目录误生成 `package.json` 和 `node_modules`。需要生成 Client 时单独执行 `npm.cmd run prisma:generate`。

当前授权模型：

- `AuthorizationLevel`：`BASIC` / `TRUSTED` / `STAFF`
- `AuthorizationSource`：可配置授权来源
- `AssetScope`：`PUBLIC` / `INTERNAL` / `SPECIAL`
- `AuthorizationPolicy`：授权等级与资产范围的访问策略

用户资料当前只保留学院，不再保留专业字段。
