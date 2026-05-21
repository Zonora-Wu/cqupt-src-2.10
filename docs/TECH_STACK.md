# 技术栈

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-05-21 已按当前代码与运行环境更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、AI Knowledge Base 多轮会话沉淀、AI 评分自动流转、相似知识去重、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型配置为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

## 当前采用的主技术栈

| 模块 | 技术 | 当前状态 |
|---|---|---|
| 前端 | React 19 + TypeScript + Vite 6 | 已用于生产级页面结构与构建 |
| 样式 | Tailwind CSS 4 | 已统一圆角、卡片、后台左右布局与 AI 回复代码块风格 |
| 图标 | lucide-react | 已接入 |
| 动效 | motion + @chenglou/pretext | 用于轻量交互与视觉增强 |
| 后端 | NestJS 11 + TypeScript | 已完成模块化业务 API |
| 数据库 | PostgreSQL | 主业务库，包含 AI 知识沉淀数据 |
| ORM | Prisma | schema、migration、client 生成均使用 Prisma |
| 队列/缓存 | Redis + BullMQ | 作为异步捕获、后续 worker 与缓存扩展基础 |
| 文件存储 | MinIO | 已接入 PDF 附件、证书模板、证书 PDF |
| 认证 | JWT Access Token + Refresh Token | 已接入登录、当前用户、权限守卫与 refresh token 撤销 |
| API | REST API | 后端所有业务接口通过 `/api/*` 暴露 |
| AI | NestJS AI Gateway + Hermes Agent OpenAI-compatible API | 已接入邮宝、角色 skill 路由、知识沉淀和 Skill Candidate |
| 模型 | 平台 Hermes config 路由，当前平台/微信回复使用 DeepSeek 系列 | CLI 对话可继续使用 GPT，不与平台容器混用 |
| 部署 | Docker Compose + Nginx | 本地依赖与平台 Hermes 容器已可运行，Ubuntu 部署待最终联调 |
| 测试 | TypeScript build、Vite build、核心 API 冒烟、服务层 E2E | AI 知识沉淀链路已用临时 targetRoot 验证 |

## 架构原则

```text
浏览器
  -> React 前端
  -> Nginx / Vite dev server
  -> NestJS 后端 API
  -> PostgreSQL / Redis / MinIO
  -> AI Gateway
  -> 平台 Hermes Agent Docker 容器
  -> DeepSeek / OpenAI / 其他模型供应商
```

## AI 技术边界

- 前端不保存模型密钥，不直连 Hermes 或模型供应商。
- 后端 AI Gateway 是唯一可信入口，负责 JWT、RBAC、上下文注入、脱敏、审计和降级。
- Hermes Skill 保存平台语义、角色边界、输出协议和稳定流程，不保存实时用户数据。
- AI Knowledge Base 存在 PostgreSQL；Skill Candidate 只有管理员批准后才可安装到平台 Hermes skills 目录。
- 平台 Hermes 目录：`/home/cocking/cqupt-src-hermes-linux/`；CLI Hermes 目录：`/home/cocking/.hermes/`。

## 为什么这样选

1. React + Vite 适合当前前端快速迭代与较大胆的交互重设计。
2. NestJS 适合权限、审计、文件上传、AI Gateway、状态机和事务型业务。
3. PostgreSQL + Prisma 适合复杂关系、RBAC、审计、知识沉淀和可迁移 schema。
4. MinIO 适合校园服务器与 Docker 场景，便于受控 PDF 存储与预览。
5. Hermes Agent 独立容器让平台可独立切换模型、skills 和网关部署，不影响 CLI Hermes。
