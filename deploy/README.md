# Deploy

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-06-01 已按当前代码、运行环境和 AI 问题会话 Phase 2 进度更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、最小上下文 + dataRequests、AI Knowledge Base 问题会话生命周期、已解决会话总结、AI+规则评分、相似聚类、管理员审核、高频高质自动入库、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型路由为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 当前仍待实现/验收：Knowledge Retrieval 命中回答、来源标注写回、turn 级点赞/点踩持久化、问题会话 fork/archive/title 接口、maintenanceStatus/retrievalPolicy、维护任务 Worker、不可变 revision 回滚、知识投毒暂停与恢复闭环。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`docs/architecture/AI_PROBLEM_SESSION_KNOWLEDGE_CAPTURE.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

部署配置目录。

权威部署说明见：`docs/deployment/README.md`。

当前仓库已提供：

```text
deploy/docker/docker-compose.local.yml   # 本地 PostgreSQL / Redis / MinIO 依赖编排
deploy/scripts/start-local.sh            # Linux / WSL / macOS 本地一键启动
deploy/scripts/start-local.ps1           # Windows PowerShell 本地一键启动
deploy/scripts/stop-local.sh             # Linux / WSL / macOS 停止脚本
deploy/scripts/stop-local.ps1            # Windows PowerShell 停止脚本
deploy/nginx/README.md                   # Nginx 职责说明，完整示例见部署文档
```

生产交付现状：仓库目前没有生产 Dockerfile，也没有生产 `docker-compose.yml`。推荐生产形态是数据服务容器化、后端 Node.js 进程托管、前端由 Nginx 托管、Hermes Agent 独立容器运行。
