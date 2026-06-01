# CQUPT-SRC 正式项目结构

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-05-31 已按新版 AI 知识沉淀方案更新。当前项目已形成前后端分离、NestJS 后端、PostgreSQL/Prisma、MinIO、AI Gateway、平台 Hermes 独立容器和 AI Knowledge Base 的完整结构；新版知识沉淀采用问题会话式方案。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型配置为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

当前项目采用前后端分离结构。前端、后端、数据库、AI Gateway、平台 Hermes 运行环境、部署配置和测试目录均已按独立边界组织。

```text
cqupt-src-2.10/
├── frontend/                 # React + TypeScript + Vite 前端
├── backend/                  # NestJS 后端，已完成基础初始化
│   ├── src/
│   │   ├── modules/          # 业务模块
│   │   ├── common/           # Guards、Pipes、Decorators、Filters 等通用能力
│   │   ├── config/           # 环境变量读取和配置校验
│   │   ├── jobs/             # Redis + BullMQ 后台任务
│   │   └── integrations/     # Hermes Agent、邮箱、统一认证、MinIO 等集成
│   └── test/                 # 后端测试
├── database/
│   ├── prisma/               # Prisma schema 与迁移
│   └── seed/                 # 初始化数据
├── deploy/
│   ├── nginx/                # Nginx 配置
│   ├── docker/               # Dockerfile 与容器构建文件
│   └── scripts/              # 部署、备份、运维脚本
├── docs/
│   ├── AI.md                 # AI 目标效果、当前进度、部署和接口链路
│   ├── DEVELOPMENT_STATUS.md # 当前开发状态
│   ├── TECH_STACK.md         # 技术栈说明
│   ├── api/                  # API 契约文档
│   ├── architecture/         # 架构设计文档
│   ├── security/             # 安全设计与检查清单
│   └── deployment/           # 部署文档
├── tests/
│   ├── e2e/                  # 端到端测试
│   └── fixtures/             # 测试数据
├── storage/                  # 本地开发临时存储，不提交真实上传文件
├── tmp/                      # 临时文件，不提交真实运行数据
├── CQUPT/                    # Logo 原始资源
├── 文档/                     # 现有项目文档
├── PROJECT_HANDOFF.md        # 交接说明
├── VibeCoding.md             # 开发流程约束
└── 文档/总体建议.md           # 总体技术推进建议
```

## 结构原则

1. 前端继续保留在 `frontend/`，不移动现有代码。
2. 后端独立放在 `backend/`，避免和前端依赖混在一起。
3. 数据库模型统一放在 `database/prisma/`，后端通过 Prisma 使用。
4. Docker 与 Nginx 部署配置统一放在 `deploy/`。
5. Hermes Agent 不直接由前端访问，后续通过后端 `ai` 模块和 `integrations/` 代理。
6. 安全文档、API 文档、部署文档都放入 `docs/`，便于后续交接。

## 常用入口文档

```text
README.md
PROJECT_HANDOFF.md
docs/DEVELOPMENT_STATUS.md
docs/TECH_STACK.md
docs/AI.md
database/DATABASE_DESIGN.md
文档/总体建议.md
```
