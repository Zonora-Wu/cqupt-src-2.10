# CQUPT-SRC

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-06-01 已按当前代码、运行环境和 AI 问题会话 Phase 2 进度更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、最小上下文 + dataRequests、AI Knowledge Base 问题会话生命周期、已解决会话总结、AI+规则评分、相似聚类、管理员审核、高频高质自动入库、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型路由为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 当前仍待实现/验收：Knowledge Retrieval 命中回答、来源标注写回、turn 级点赞/点踩持久化、问题会话 fork/archive/title 接口、maintenanceStatus/retrievalPolicy、维护任务 Worker、不可变 revision 回滚、知识投毒暂停与恢复闭环。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`docs/architecture/AI_PROBLEM_SESSION_KNOWLEDGE_CAPTURE.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

校园漏洞响应与安全学习平台。项目连接学生、审核员、管理员与校园资产责任单位，形成从漏洞提交、审核、修复、复测、归档、证书、积分、学习资源到 AI 辅助的完整闭环。

## 当前状态

```text
已完成：认证/RBAC、漏洞全流程、PDF 附件上传与受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心。
已完成：个人中心头像上传、邮箱修改、密码修改（邮箱验证码）、账号安全日志页。
已完成：安全答题准入（题库、随机组卷、提交判分、管理员题库接口）。
已完成：后端 AI Gateway、Context Injection、按角色 Skill 路由、确定性业务响应、邮宝用户端 AI 助手。
已完成：附件问答与渗透报告草稿解析，明确报告意图才生成可编辑漏洞草稿卡片。
已完成：AI Knowledge Base 多轮会话沉淀、AI 评分自动流转、相似知识去重、Skill Candidate 审核与受控安装链路。
已完成：平台 Hermes skills 目录宿主写入权限已按最小权限修正，并通过后端真实 Skill Candidate 安装链路验证。
```

## 技术栈

| 模块 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite 6 + Tailwind CSS 4 |
| 后端 | NestJS 11 + TypeScript |
| 数据库 | PostgreSQL + Prisma |
| 队列/缓存 | BullMQ / Redis（用于异步任务与后续扩展） |
| 文件存储 | MinIO（PDF 附件受控存储与预览） |
| AI | NestJS AI Gateway + Hermes Agent OpenAI-compatible API |
| 平台 Hermes | `/home/cocking/cqupt-src-hermes-linux/` Docker 容器，宿主机 `5000` 端口 |
| 部署 | Docker Compose + Nginx，目标环境 Ubuntu 服务器 |

## 核心文档

| 文档 | 内容 |
|---|---|
| `docs/AI.md` | 邮宝 / AI Gateway 总体架构、角色路由、卡片协议、附件处理、降级策略 |
| `docs/AI_KNOWLEDGE_BASE.md` | AI 知识沉淀、Skill Candidate、去重、评分、审核与安装链路 |
| `docs/AI_SKILLS.md` | CQUPT-SRC 平台 Hermes skills 规划、职责边界和当前清单 |
| `docs/HERMES_RUNTIME.md` | 平台 Hermes 独立容器、目录、模型、skills 同步与权限说明 |
| `docs/api/README.md` | REST API 汇总，包括认证、AI、知识沉淀、安全答题等接口 |
| `database/DATABASE_DESIGN.md` | PostgreSQL / Prisma 数据模型设计 |
| `docs/PROJECT_STRUCTURE.md` | 项目目录结构与入口说明 |

## Hermes Agent 与模型路由

平台用户端 AI 助手名称为“邮宝”。Hermes Agent 是底层 OpenAI-compatible Agent / skills 运行时，不直接作为用户侧品牌名。

```text
CLI Hermes：/home/cocking/.hermes/
平台 Hermes：/home/cocking/cqupt-src-hermes-linux/
平台 API：http://localhost:5000/v1/chat/completions
平台后端模型名：OPENAI_MODEL=hermes-agent（后端虚拟名）
平台容器实际模型：由 Hermes config.yaml 路由，目前用于平台/微信回复的模型为 DeepSeek 系列
```

后端环境变量示例：

```env
OPENAI_BASE_URL=http://localhost:5000/v1
OPENAI_API_KEY=API_SERVER_KEY
OPENAI_MODEL=hermes-agent
```

若后端也运行在 Docker 容器内，`OPENAI_BASE_URL` 应改为 Docker 网络内服务名：

```env
OPENAI_BASE_URL=http://hermes-agent:5000/v1
```

健康检查：

```bash
curl -s http://localhost:5000/health
```

## 项目结构

```text
cqupt-src-2.10/
├── frontend/       # React 前端
├── backend/        # NestJS 后端
├── database/       # Prisma schema、数据库设计、seed、迁移
├── deploy/         # Docker、Nginx、部署脚本
├── docs/           # API、架构、安全、部署、AI 文档
├── tests/          # E2E 测试和测试数据
├── storage/        # 本地上传文件临时目录，不提交真实文件
├── tmp/            # 临时文件目录，不提交真实文件
├── PROJECT_HANDOFF.md
├── VibeCoding.md
└── 文档/           # 早期需求与过程记录，已加同步说明
```

完整结构说明见 `docs/PROJECT_STRUCTURE.md`。

## 本地运行

### 方式一：一键启动（推荐）

Linux / WSL / macOS：

```bash
bash deploy/scripts/start-local.sh
```

关闭：

```bash
bash deploy/scripts/stop-local.sh
```

Windows PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File deploy\scripts\start-local.ps1
```

启动后访问：

| 服务 | 地址 |
|---|---|
| 前端页面 | http://localhost:5173 |
| 后端 API 健康检查 | http://localhost:3000/api/health |
| 平台 Hermes Gateway | http://localhost:5000/health |
| MinIO 控制台 | http://localhost:9001 |

更多启动选项见 `deploy/scripts/README.md`。

### 方式二：手动分步启动

```bash
# 1. 基础服务
cd /home/cocking/projects/cqupt-src-2.10
docker compose -f deploy/docker/docker-compose.local.yml up -d

# 2. 数据库迁移与种子
cd backend
npm run prisma:migrate:dev
npm run db:seed

# 3. 后端
npm run dev

# 4. 前端（另开终端）
cd ../frontend
npm run dev
```

## 验证命令

```bash
# 后端
cd backend
npm run build
npm run prisma:validate

# 前端
cd ../frontend
npm run build
npm run lint

# 健康检查
curl -s http://localhost:3000/api/health
curl -s http://localhost:5000/health
```

## 演示账号

```text
学生：2025001@stu.cqupt.edu.cn  /  123456+-
审核员：0000001@cqupt.edu.cn       /  auditor123456+-
管理员：0000000@cqupt.edu.cn       /  admin123456+-
邮箱/修改密码验证码：123456（开发环境固定值）
```

## 数据库模型要点

- 用户只允许校内注册，访客不入库。
- 用户只能绑定一个角色：学生、审核员、管理员。
- 授权等级：`BASIC / TRUSTED / STAFF`。
- 漏洞支持草稿，提交后不可撤回；一个漏洞只分配一个审核员；一个漏洞最多一张证书。
- 附件只允许 PDF，单文件 10MB，访问必须鉴权并写审计日志。
- 安全答题准入使用 `SecurityQuestion` 与 `SecurityExamAttempt`。
- AI 知识沉淀使用 `AiProblemSession`、`AiProblemSessionTurn`、`AiKnowledgeCluster`、`AiKnowledgeEntry`、`AiKnowledgeConversation`、`AiKnowledgeConversationTurn` 与 Skill Candidate 状态字段。
- AI 原始对话不作为长期知识直接复用；先按问题会话保存脱敏 turns，用户确认解决后再生成脱敏、泛化、审核后的知识条目或候选 Skill。

## 安全原则

- 不提交 `.env`、真实密钥、真实漏洞附件。
- 前端校验只做体验，后端必须重新校验所有字段。
- AI 调用必须经过后端代理、脱敏、限流、审计和角色边界控制。
- 模型输出不可信，业务 ID、库存、积分、权限、状态必须由后端查库确认。
- 写操作必须走 Action Proposal / 用户确认 / 后端事务 / AuditLog。
- 审核结论、知识沉淀、Skill 晋升必须保留人工审核与安全兜底。

## 近期待处理

1. 生产部署时复核 `/home/cocking/cqupt-src-hermes-linux/platform-skills/cqupt-src` 是否保持 `cocking:cocking` 与 `775`，且 Docker Compose 是否把它挂载到容器 `/opt/data/skills/cqupt-src`；后端 `CQUPT_HERMES_SKILLS_ROOT` 应指向该宿主目录。
2. 在生产数据规模下继续观察 AI 知识沉淀去重效果、评分阈值和审核工作量。
3. 生产部署后复跑 `cd backend && npm run test:core-e2e` 与 `npm run test:ai-problem-session`，确认安全答题、附件、报告草稿、知识沉淀、问题会话和 Skill 安装链路在服务器拓扑下仍通过。
