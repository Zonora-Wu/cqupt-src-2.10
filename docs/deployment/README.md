# Deployment

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-06-01 已按当前代码、运行环境和 AI 问题会话 Phase 2 进度更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、最小上下文 + dataRequests、AI Knowledge Base 问题会话生命周期、已解决会话总结、AI+规则评分、相似聚类、管理员审核、高频高质自动入库、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型路由为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 当前仍待实现/验收：Knowledge Retrieval 命中回答、来源标注写回、turn 级点赞/点踩持久化、问题会话 fork/archive/title 接口、maintenanceStatus/retrievalPolicy、维护任务 Worker、不可变 revision 回滚、知识投毒暂停与恢复闭环。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`docs/architecture/AI_PROBLEM_SESSION_KNOWLEDGE_CAPTURE.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

## 本地部署验证

```bash
cd /home/cocking/projects/cqupt-src-2.10
bash deploy/scripts/start-local.sh
curl -s http://localhost:3000/api/health
curl -s http://localhost:5000/health
```

## 生产部署组成

| 组件 | 说明 |
|---|---|
| Nginx | TLS 终止、静态前端、反向代理 `/api` |
| Frontend | `frontend/dist` 静态文件 |
| Backend | NestJS API，连接 PostgreSQL / Redis / MinIO / Hermes Gateway |
| PostgreSQL | 主业务库，包含 AI Knowledge Base |
| Redis | 队列、缓存与异步任务扩展 |
| MinIO | PDF 附件、证书模板、证书 PDF |
| Hermes Agent | 独立 Docker 容器，目录 `/home/cocking/cqupt-src-hermes-linux` |

## 生产环境关键变量

```env
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
MINIO_ENDPOINT=...
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
OPENAI_BASE_URL=http://hermes-agent:5000/v1   # 同网络容器时
OPENAI_API_KEY=...
OPENAI_MODEL=hermes-agent
```

## Hermes 部署注意事项

- 平台 Hermes 与 CLI Hermes 分离，生产请求只走平台容器。
- 微信/平台回复模型由平台 Hermes `config.yaml` 控制，可设为 DeepSeek；终端 CLI 可继续使用 GPT。
- Skill Candidate 安装前必须解决 `/home/cocking/cqupt-src-hermes-linux/data/skills` 写权限。

## 上线前检查

```bash
cd backend && npm run build && npm run prisma:validate
cd ../frontend && npm run build && npm run lint
curl -s http://localhost:3000/api/health
curl -s http://localhost:5000/health
```

上线前还需确认：真实 SMTP、生产密钥、MinIO bucket、数据库备份、Nginx HTTPS、日志保留和 AI 审计策略。
