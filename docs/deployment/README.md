# Deployment

部署文档目录。当前阶段已完成本地前后端基础运行与本地 Docker 依赖编排，Ubuntu 云服务器部署尚未开始。

## 本地前端

推荐使用一键脚本启动本地开发环境：

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10
powershell -ExecutionPolicy Bypass -File deploy\scripts\start-local.ps1
```

启动脚本会等待 PostgreSQL 和 MinIO 进入 healthy 状态，并自动执行 migration 与 seed，然后再启动前后端，避免后端先启动导致登录或文件上传接口 500。

关闭：

```powershell
powershell -ExecutionPolicy Bypass -File deploy\scripts\stop-local.ps1
```

也可以手动分别启动。

本地执行：

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10\frontend
npm.cmd run dev
```

默认地址：

```text
http://localhost:5173
```

## 本地后端

先启动本地依赖：

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10
docker compose -f deploy\docker\docker-compose.local.yml up -d postgres
```

如果要测试 PDF 附件上传，还需要启动 MinIO：

```powershell
docker compose -f deploy\docker\docker-compose.local.yml up -d minio
```

本地 PostgreSQL：

```text
127.0.0.1:15432
```

本地 MinIO：

```text
API: http://localhost:9000
Console: http://localhost:9001
```

本地执行：

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10\backend
npm.cmd run dev
```

健康检查：

```text
http://localhost:3000/api/health
```

## 本地验证

本地执行：

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10\backend
npm.cmd run typecheck
npm.cmd run build
npm.cmd run prisma:validate
```

本地数据库初始化：

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10\backend
npm.cmd run prisma:migrate:dev -- --name init
npm.cmd run db:seed
```

## 后续 Docker 规划

后续会补齐：

```text
deploy/docker/frontend.Dockerfile
deploy/docker/backend.Dockerfile
deploy/nginx/default.conf
docker-compose.yml
```

服务规划：

```text
frontend
backend
postgres
redis
minio
nginx
hermes-agent
```

## Ubuntu 云服务器规划

云服务器执行，后续步骤再落地：

```bash
mkdir -p /opt/cqupt-src
cd /opt/cqupt-src
docker compose up -d
```

注意：Hermes Agent 已按独立 Docker 容器接入，不和业务后端写在同一个容器里。

本地 Hermes Agent 当前约定：

```text
配置目录：/home/cocking/cqupt-src-hermes-linux
宿主机地址：http://localhost:5000
健康检查：curl http://localhost:5000/health
后端本机运行：OPENAI_BASE_URL=http://localhost:5000/v1
后端容器运行：OPENAI_BASE_URL=http://hermes-agent:5000/v1
API Key：OPENAI_API_KEY=API_SERVER_KEY
模型：OPENAI_MODEL=hermes-agent
```
