# CQUPT-SRC Claude Code Guide

## 项目定位

CQUPT-SRC 是校园漏洞响应与安全学习平台，前后端分离：

- `frontend/`：Vite + React + TypeScript + Tailwind CSS 4。
- `backend/`：NestJS 11 + Prisma + PostgreSQL。
- `database/prisma/schema.prisma`：数据库模型权威来源。
- `docs/`：项目架构、AI/Hermes、API、安全、实施方案文档。

## 不影响开发的阅读策略

不要无目的扫描整个仓库。先按任务类型读取最小必要入口，再扩展到相关模块。

### 通用入口

优先读取：

- `package.json`
- `backend/package.json`
- `frontend/package.json`
- `docs/PROJECT_STRUCTURE.md`
- `docs/TECH_STACK.md`
- `database/prisma/schema.prisma`

### 前端任务

优先读取：

- `frontend/src/App.tsx`
- `frontend/src/pages/`
- `frontend/src/components/`
- `frontend/src/services/`
- `frontend/vite.config.ts`
- `frontend/tsconfig*.json`

修改前端后至少运行：

```bash
cd frontend && npm run build
```

如任务涉及 lint，再运行：

```bash
cd frontend && npm run lint
```

### 后端任务

优先读取：

- `backend/src/main.ts`
- `backend/src/app.module.ts`
- `backend/src/modules/`
- `backend/src/common/`
- `backend/src/config/`
- `backend/package.json`
- `database/prisma/schema.prisma`

修改后端后至少运行：

```bash
cd backend && npm run build
```

涉及 Prisma 时优先运行：

```bash
cd backend && npm run prisma:validate
```

### AI / Hermes 任务

必须先读取：

- `docs/AI.md`
- `docs/HERMES_RUNTIME.md`
- `docs/AI_KNOWLEDGE_BASE.md`
- `docs/architecture/AI_CONTEXT_INJECTION.md`
- `backend/src/modules/ai/`
- `backend/src/modules/ai-knowledge/`

关键边界：

- 前端不能直连 Hermes 或模型。
- 所有 AI 调用必须经过 NestJS 后端 AI Gateway。
- 平台 Hermes 与当前 CLI Hermes 是两套环境。
- 平台 Hermes 运行目录在 `/home/cocking/cqupt-src-hermes-linux/`，不是当前仓库内部目录。

### AI 漏洞自动复测任务

必须先读取：

- `docs/plans/AI_VULNERABILITY_RETEST_IMPLEMENTATION_PLAN.md`
- `docs/HERMES_RUNTIME.md`
- `backend/src/modules/ai-vulnerability-retest/`
- `database/prisma/schema.prisma`
- 相关 Prisma migration

必须保持这些边界：

- 高风险漏洞进入 `ADVISORY_ONLY`，不进入 Runner。
- Runner 只执行后端策略审查后允许的低风险内置动作模板。
- 目标范围来自漏洞报告字段提取 + 审核员/管理员人工确认。
- 人工确认不能绕过 SSRF、内网、metadata、危险协议、DNS rebinding、redirect 越界等技术拦截。
- Hermes 只做计划和总结，不持有用户 JWT，不直接访问数据库，不直接 curl 后端。

## 默认不要读取的内容

除非用户明确要求分析某个具体失败证据或运行产物，不要读取：

- `node_modules/`
- `frontend/node_modules/`
- `backend/node_modules/`
- `dist/`
- `frontend/dist/`
- `backend/dist/`
- `coverage/`
- `storage/`
- `tmp/`
- `uploads/`
- `generated/`
- `.docker-data/`
- `playwright-report/`
- `test-results/`
- `tests/e2e/evidence/`
- `.env` / `.env.*`
- 日志文件
- 大型二进制压缩包
- `frontend/public/models/*.glb|*.gltf|*.bin`

如果需要排查运行失败，可以只读取用户指定的单个日志或 evidence 文件，不要批量扫整个目录。

## 开发原则

- 不要为了省事做最简单实现，应优先做适合 CQUPT-SRC 平台的生产级实现。
- 不要修改编译产物；应该修改 `backend/src/`、`frontend/src/`、`database/prisma/` 或相关源码/文档。
- 任何涉及权限、漏洞复测、AI 数据注入、敏感信息处理的改动，都必须保留 RBAC、审计日志、后端策略审查和人工确认边界。
- 文档和代码不一致时，以已验证代码为准，并同步更新权威文档。
