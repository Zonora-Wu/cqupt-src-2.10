# CQUPT-SRC

校园漏洞响应与安全学习平台。

## 当前状态

- `frontend/`：已实现前端原型，包含访客端、用户端、审核员端、管理员端页面。
- `backend/`：后端正式结构已整理，下一步初始化 NestJS。
- `database/`：数据库结构目录已预留，下一步设计 Prisma 模型。
- `deploy/`：Docker、Nginx、云服务器部署目录已预留。
- `docs/`：API、架构、安全、部署文档目录已预留。

## 本地前端运行

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10\frontend
npm.cmd run dev
```

## 本地前端构建

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10\frontend
npm.cmd run build
```

## 后续开发顺序

1. 整理正式项目结构
2. 设计数据库模型
3. 初始化后端服务
4. 实现认证与 RBAC
5. 接入漏洞提交和审核流程
6. 接入证书、公告、积分、学习资源
7. 接入 Hermes Agent
8. Docker Compose 本地联调
9. Ubuntu 云服务器部署
