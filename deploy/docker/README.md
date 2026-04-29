# Docker

Docker 构建与本地依赖编排目录。

## 本地开发依赖

本地开发基础依赖：

- PostgreSQL：`localhost:15432`
- Redis：`localhost:6379`
- MinIO API：`localhost:9000`
- MinIO Console：`http://localhost:9001`

本地执行：

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10
docker compose -f deploy\docker\docker-compose.local.yml up -d
```

如果只需要登录和附件上传相关依赖，也可以只启动 PostgreSQL 与 MinIO：

```powershell
docker compose -f deploy\docker\docker-compose.local.yml up -d postgres minio
```

查看状态：

```powershell
docker compose -f deploy\docker\docker-compose.local.yml ps
```

停止依赖：

```powershell
docker compose -f deploy\docker\docker-compose.local.yml down
```

如果需要清空本地数据库、Redis 和 MinIO 数据：

```powershell
docker compose -f deploy\docker\docker-compose.local.yml down -v
```

## 后续待补

- `frontend.Dockerfile`
- `backend.Dockerfile`
- 生产环境 MinIO bucket 初始化脚本
- 生产环境 Docker Compose
