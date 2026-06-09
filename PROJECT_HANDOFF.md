# CQUPT-SRC 项目交接文档

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-06-01 已按当前代码、运行环境和 AI 问题会话 Phase 2 进度更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、最小上下文 + dataRequests、AI Knowledge Base 问题会话生命周期、已解决会话总结、AI+规则评分、相似聚类、管理员审核、高频高质自动入库、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型路由为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 当前仍待实现/验收：Knowledge Retrieval 命中回答、来源标注写回、turn 级点赞/点踩持久化、问题会话 fork/archive/title 接口、maintenanceStatus/retrievalPolicy、维护任务 Worker、不可变 revision 回滚、知识投毒暂停与恢复闭环。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`docs/architecture/AI_PROBLEM_SESSION_KNOWLEDGE_CAPTURE.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

## 1. 项目定位

CQUPT-SRC 是校园漏洞响应与安全学习平台，覆盖学生提交漏洞、审核员审核、管理员治理、积分商城、学习资源、证书、公告、审计日志和 AI 辅助。

用户侧 AI 助手名称为“邮宝”。Hermes Agent 是底层 Agent / skills 运行时，不作为用户侧品牌名。

## 2. 当前运行快照

| 项 | 值 |
|---|---|
| 项目路径 | `/home/cocking/projects/cqupt-src-2.10` |
| 前端 | `frontend/`，React 19 + Vite + Tailwind CSS 4 |
| 后端 | `backend/`，NestJS 11 + Prisma |
| 数据库 | PostgreSQL，Prisma schema 在 `database/prisma/schema.prisma` |
| 文件存储 | MinIO |
| 平台 Hermes | `/home/cocking/cqupt-src-hermes-linux/` Docker 容器 |
| Hermes API | `http://localhost:5000/v1/chat/completions` |
| 后端健康检查 | `http://localhost:3000/api/health` |
| 前端开发地址 | `http://localhost:5173` |

## 3. 已完成主线

- 认证/RBAC、统一认证码登录、邮箱验证码登录、注册、当前用户。
- 账号中心：头像、邮箱、密码、账号安全日志。
- 准入：责任书、安全答题题库、随机组卷、提交判分。
- 漏洞：提交、草稿、附件、补充材料、审核、复测、管理。
- 附件：PDF 上传、MinIO 存储、受控预览、审计日志。
- 证书：模板、签发、撤销、PDF 预览、公开脱敏核验。
- 公告、学习资源、积分商城、用户管理、审计日志、系统设置。
- AI Gateway：Context Injection、确定性业务响应、Hermes Agent、卡片/actions、附件问答、报告草稿。
- AI Knowledge Base：多轮会话沉淀、AI 总结、AI+规则评分、相似去重、管理员审核、Skill Candidate、受控安装。

## 4. 关键文档入口

- `README.md`：项目总览与本地运行。
- `docs/DEVELOPMENT_STATUS.md`：当前能力、限制和待处理事项。
- `docs/AI.md`：邮宝 / AI Gateway 架构。
- `docs/AI_KNOWLEDGE_BASE.md`：AI 知识沉淀与 Skill 晋升链路。
- `docs/AI_SKILLS.md`：CQUPT-SRC Hermes skills 规划。
- `docs/HERMES_RUNTIME.md`：平台 Hermes 独立容器与模型路由。
- `docs/api/README.md`：接口索引。
- `database/DATABASE_DESIGN.md`：数据库模型。

## 5. 本地启动与验证

```bash
cd /home/cocking/projects/cqupt-src-2.10
bash deploy/scripts/start-local.sh
curl -s http://localhost:3000/api/health
curl -s http://localhost:5000/health
```

构建验证：

```bash
cd backend && npm run build && npm run prisma:validate
cd ../frontend && npm run build && npm run lint
```

## 6. 当前风险与交接重点

- 平台 Hermes data 根目录会被容器保持为 `10000:*` 与 `700`，不再依赖修改该目录权限。专属 skills 改为宿主可写目录 `/home/cocking/cqupt-src-hermes-linux/platform-skills/cqupt-src`，Docker Compose 单独挂载到容器 `/opt/data/skills/cqupt-src`，后端 `.env` 的 `CQUPT_HERMES_SKILLS_ROOT` 指向该宿主目录。已通过后端真实 Skill Candidate 安装链路与容器读取验证。
- 生产 SMTP 仍需接入；开发环境验证码固定为 `123456`。
- AI 相关写操作必须维持“提案/确认/后端事务/审计”链路，不能让模型直接执行。
- AI Knowledge 入库必须继续执行脱敏、泛化、评分、重复检测和管理员审核。
