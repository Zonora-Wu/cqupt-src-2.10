# CQUPT-SRC 正式项目结构

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-06-08 已按当前代码、运行环境和 AI 漏洞自动复测 Phase 1-9 + 7.5 进度更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、最小上下文 + dataRequests、AI Knowledge Base 问题会话生命周期、已解决会话总结、AI+规则评分、相似聚类、管理员审核、高频高质自动入库、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型路由为 DeepSeek 系列）。Hermes Direct 复测使用独立容器 `hermes-retest-agent`（端口 5001），经 `retest-egress-proxy` 动态 scope 控制出网。当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 当前仍待实现/验收：Knowledge Retrieval 命中回答、来源标注写回、turn 级点赞/点踩持久化、问题会话 fork/archive/title 接口、维护任务 Worker、不可变 revision 回滚、知识投毒暂停与恢复闭环、Hermes Direct 原始 artifact 统一归档（Phase 7.5 Step 10）。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`docs/architecture/AI_PROBLEM_SESSION_KNOWLEDGE_CAPTURE.md`、`docs/plans/AI_VULNERABILITY_RETEST_IMPLEMENTATION_PLAN.md`、`docs/deployment/HERMES_DIRECT.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

当前项目采用前后端分离结构。前端、后端、数据库、AI Gateway、平台 Hermes 运行环境、部署配置和测试目录均已按独立边界组织。

```text
cqupt-src-2.10/
├── frontend/                 # React + TypeScript + Vite 前端
├── backend/                  # NestJS 后端，已完成基础初始化
│   ├── src/
│   │   ├── modules/          # 业务模块（auth、vulnerability、ai、ai-vulnerability-retest、ai-knowledge 等）
│   │   ├── common/           # Guards、Pipes、Decorators、Filters 等通用能力
│   │   ├── config/           # 环境变量读取和配置校验
│   │   ├── jobs/             # Redis + BullMQ 后台任务
│   │   └── integrations/     # Hermes Agent、AI retest Runner/egress proxy、邮箱、统一认证、MinIO 等集成
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
6. AI 漏洞复测使用独立 `retest-runner/` 服务 + 独立 Hermes Direct 容器（`hermes-retest-agent`，经 `retest-egress-proxy` 动态授权出网），不混用主 Hermes Agent 网络和凭据。
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
