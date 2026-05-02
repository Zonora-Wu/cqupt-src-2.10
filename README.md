# CQUPT-SRC

校园漏洞响应与安全学习平台。项目目标是连接学生、审核员、管理员与校园资产责任单位，形成从漏洞提交、审核、修复、复测、归档、证书、积分、学习资源到 AI 辅助的完整闭环。

## 当前进度

```text
已完成：认证/RBAC、漏洞全流程、附件上传、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心
已完成：个人中心头像上传、邮箱修改、密码修改（邮箱验证码）、账号安全日志页
进行中：系统设置完善（责任书版本管理、安全答题题库）
下一步：AI Gateway 接入 / Ubuntu 部署
```

## 技术栈

| 模块 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite 6 + Tailwind CSS |
| 后端 | NestJS 11 + TypeScript |
| 数据库 | PostgreSQL + Prisma |
| 缓存/队列 | Redis + BullMQ，后续接入 |
| 文件存储 | MinIO，后续接入 |
| AI | Hermes Agent，通过后端 AI Gateway 代理 |
| 部署 | Docker Compose + Nginx，目标环境 Ubuntu 服务器 |

## 项目结构

```text
cqupt-src-2.10/
├── frontend/       # React 前端
├── backend/        # NestJS 后端
├── database/       # Prisma schema、数据库设计、seed
├── deploy/         # Docker、Nginx、部署脚本
├── docs/           # API、架构、安全、部署文档
├── tests/          # E2E 测试和测试数据
├── storage/        # 本地上传文件临时目录，不提交真实文件
├── tmp/            # 临时文件目录，不提交真实文件
├── PROJECT_HANDOFF.md
├── VibeCoding.md
└── 文档/
```

完整结构说明见：

```text
docs/PROJECT_STRUCTURE.md
```

## 本地运行

### 方式一：一键启动（推荐）

**Linux / WSL / macOS**

```bash
bash deploy/scripts/start-local.sh
```

启动后访问地址：

| 服务 | 地址 |
|---|---|
| 前端页面 | http://localhost:5173 |
| 后端 API 健康检查 | http://localhost:3000/api/health |
| MinIO 控制台 | http://localhost:9001 |

一键关闭：

```bash
bash deploy/scripts/stop-local.sh
```

**Windows（PowerShell）**

```powershell
powershell -ExecutionPolicy Bypass -File deploy\scripts\start-local.ps1
```

> 更多启动选项（跳过数据库、跳过 MinIO 等）见 [deploy/scripts/README.md](deploy/scripts/README.md)

---

### 方式二：手动分步启动

**1. 启动基础服务（PostgreSQL + Redis + MinIO）**

```bash
docker compose -f deploy/docker/docker-compose.local.yml up -d
```

**2. 初始化数据库**

```bash
cd backend
npm run prisma:migrate:dev
npm run prisma:seed
```

**3. 启动后端**

```bash
# Linux / macOS / WSL
cd backend && npm run dev

# Windows
cd backend && npm.cmd run dev
```

**4. 启动前端**

```bash
# Linux / macOS / WSL
cd frontend && npm run dev

# Windows
cd frontend && npm.cmd run dev
```

前端默认地址：

```text
http://localhost:5173
```

后端健康检查：

```text
http://localhost:3000/api/health
```

后端验证命令：

```bash
# Linux / macOS / WSL
cd backend
npm run typecheck
npm run build
npm run prisma:validate
```

## 演示账号

```text
学生：2025001@stu.cqupt.edu.cn  /  123456+-
审核员：0000001@cqupt.edu.cn       /  auditor123456+-
管理员：0000000@cqupt.edu.cn       /  admin123456+-
邮箱/修改密码验证码：123456（开发环境固定值）
```

## 数据库设计

数据库设计文档：

```text
database/DATABASE_DESIGN.md
database/prisma/schema.prisma
docs/architecture/DATABASE_MODEL.md
```

当前模型要点：

- 用户只允许校内注册，访客不入库。
- 用户只能绑定一个角色。
- 角色：学生、审核员、管理员。
- 授权等级：`BASIC / TRUSTED / STAFF`。
- 授权来源可配置，适配不同学校交付。
- 资产范围：`PUBLIC / INTERNAL / SPECIAL`。
- 用户资料只保留学院，不保留专业。
- 漏洞支持草稿，提交后不可撤回。
- 一个漏洞只分配一个审核员。
- 一个漏洞最多一张证书。
- 附件只允许 PDF，单文件 10MB。
- AI 原始对话不长期保存，只保存脱敏摘要、skill、FAQ 和人工确认记录。

## 安全原则

- 不提交 `.env`、真实密钥、真实漏洞附件。
- 前端校验只做体验，后端必须重新校验所有字段。
- 敏感附件访问必须鉴权并写审计日志。
- AI 调用必须经过后端代理、脱敏、限流和审计。
- 证书公开查询必须脱敏。
- 审核结论和 AI 操作必须人工确认。

## 下一步

1. 完善责任书版本管理与安全答题题库后台。
2. 接入 AI Gateway 与 Hermes Agent。
3. Docker Compose 本地全服务联调。
4. Ubuntu 云服务器部署。
