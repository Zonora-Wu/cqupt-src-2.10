# Scripts

部署辅助脚本目录。

## 本地一键启动 / 关闭

一键启动本地开发环境：

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10
powershell -ExecutionPolicy Bypass -File deploy\scripts\start-local.ps1
```

它会启动：

- Docker PostgreSQL：`127.0.0.1:15432`
- Docker MinIO：`http://localhost:9001`
- 后端开发服务：`http://localhost:3000/api/health`
- 前端开发服务：`http://localhost:5173`

一键关闭本地开发环境：

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10
powershell -ExecutionPolicy Bypass -File deploy\scripts\stop-local.ps1
```

如果只想关闭前后端，保留数据库容器：

```powershell
powershell -ExecutionPolicy Bypass -File deploy\scripts\stop-local.ps1 -KeepPostgres
```

如果只想关闭前后端，保留数据库和 MinIO 容器：

```powershell
powershell -ExecutionPolicy Bypass -File deploy\scripts\stop-local.ps1 -KeepPostgres -KeepMinio
```

如果数据库已经手动启动，只想打开前后端：

```powershell
powershell -ExecutionPolicy Bypass -File deploy\scripts\start-local.ps1 -SkipPostgres
```

如果 MinIO 已经手动启动，可以跳过 MinIO 启动检查：

```powershell
powershell -ExecutionPolicy Bypass -File deploy\scripts\start-local.ps1 -SkipMinio
```

如果数据库已经确认初始化完成，想跳过迁移和 seed：

```powershell
powershell -ExecutionPolicy Bypass -File deploy\scripts\start-local.ps1 -SkipDbInit
```

## 后续可放置

- 云服务器初始化脚本
- 数据库备份脚本
- 日志清理脚本
- 发布检查脚本
