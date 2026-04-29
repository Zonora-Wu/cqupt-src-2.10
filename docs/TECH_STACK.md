# 技术栈

## 推荐并采用的主技术栈

| 模块 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite 6 |
| 样式 | Tailwind CSS |
| 图标 | lucide-react |
| 动效 | motion + @chenglou/pretext |
| 后端 | NestJS 11 + TypeScript |
| 数据库 | PostgreSQL |
| ORM | Prisma |
| 缓存/队列 | Redis + BullMQ，后续接入 |
| 文件存储 | MinIO，已接入 PDF 附件上传与受控预览 |
| 认证 | JWT Access Token + Refresh Token，已完成基础登录与当前用户校验 |
| API | REST API，后续补 OpenAPI 文档 |
| AI | Hermes Agent + 后端 AI Gateway |
| 部署 | Docker Compose + Nginx |
| 测试 | TypeScript typecheck、后续补 Vitest/Supertest/Playwright |

## 架构原则

```text
浏览器
  -> React 前端
  -> Nginx
  -> NestJS 后端 API
  -> PostgreSQL / Redis / MinIO
  -> AI Gateway
  -> Hermes Agent
```

## 为什么这样选

1. 前端已经使用 React + Vite，继续沿用成本最低。
2. NestJS 更适合权限、审计、文件上传、AI 接入等复杂业务。
3. PostgreSQL 适合结构化权限、漏洞流转和审计数据。
4. Prisma 方便维护 schema 和迁移。
5. MinIO 适合校园服务器和 Docker 部署。
6. Hermes Agent 必须通过后端代理，不能由前端直连。
