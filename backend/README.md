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
