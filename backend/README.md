# Backend

CQUPT-SRC 后端服务目录，使用 NestJS + TypeScript 搭建。

## 规划职责

- 身份认证与会话管理
- RBAC 权限控制
- 漏洞报告提交、审核、复测、归档
- 文件上传与访问控制
- 积分、证书、公告、学习资源管理
- 审计日志
- AI Gateway，统一代理 Hermes Agent 调用

## 后续步骤

认证与 RBAC 基础模块已经完成初版，包括：

- 用户、角色、权限 seed
- Access token / refresh token 生成
- `POST /api/auth/login/password`
- `POST /api/auth/login/email-code`
- RBAC 权限查询服务

下一步继续补齐：

- 当前用户接口
- RBAC 权限守卫
- 邮箱验证码发送
- 前端登录接入

## 本地开发命令

先安装依赖：

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10\backend
npm.cmd install
```

复制环境变量：

```powershell
copy .env.example .env
```

开发启动：

```powershell
npm.cmd run dev
```

健康检查：

```text
GET http://localhost:3000/api/health
```

Prisma schema 验证：

```powershell
npm.cmd run prisma:validate
```

生成 Prisma Client：

```powershell
npm.cmd run prisma:generate
```

数据库 seed：

```powershell
npm.cmd run db:seed
```

说明：`db:seed` 需要本地 PostgreSQL 已启动，且 `.env` 中 `DATABASE_URL` 可连接。

类型检查：

```powershell
npm.cmd run typecheck
```

构建：

```powershell
npm.cmd run build
```

## 当前已验证

- `npm.cmd run prisma:generate` 通过
- `npm.cmd run typecheck` 通过
- `npm.cmd run build` 通过
- `npm.cmd run prisma:validate` 通过
