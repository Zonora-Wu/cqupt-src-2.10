# CQUPT-SRC 生产运行手册

## 上传文件安全扫描

生产环境默认强制执行 ClamAV 扫描。后端容器必须能访问 `CLAMAV_HOST:CLAMAV_PORT`；扫描服务不可用、超时或返回异常时，上传会失败关闭，不会进入解析或对象存储。

```bash
docker run -d --name cqupt-src-clamav --restart unless-stopped \
  --network cqupt-src-test_default \
  -v cqupt-src-clamav-data:/var/lib/clamav \
  clamav/clamav:1.4
docker inspect --format '{{json .State.Health}}' cqupt-src-clamav
```

后端环境变量：

```dotenv
MALWARE_SCAN_ENABLED=true
MALWARE_SCAN_REQUIRED=true
CLAMAV_HOST=cqupt-src-clamav
CLAMAV_PORT=3310
CLAMAV_TIMEOUT_MS=15000
```

首次启动需要等待病毒库下载和 `clamd` 健康检查完成。实际 Docker 网络名需以 `docker network ls` 为准，本文中的网络名仅对应测试环境常见命名。

## 1. 发布前门禁

```bash
cd /home/cocking/projects/cqupt-src-2.10
bash scripts/quality-gate.sh
```

结果必须全部通过。不得使用跳过 Lint、跳过迁移或关闭测试的方式发布。

## 2. 发布后验收

测试环境更新脚本会自动运行验收。单独执行：

```bash
cd /home/ubuntu/projcets/cqupt-src-test
BASE_URL=https://test.cquptsrc.asia \
DEPLOY_ENV_FILE=/home/ubuntu/projcets/cqupt-src-test/deploy/test/.env \
bash deploy/scripts/verify-production.sh
```

验收项：公开首页、后端 liveness、PostgreSQL/Redis/MinIO readiness、AI 降级状态、Socket.IO WebSocket Upgrade、SMTP 配置与端口连通。

`/api/health/ready` 中 AI 为非关键依赖。AI 故障返回 `degraded`，核心平台仍保持可用；PostgreSQL、生产 Redis 或 MinIO 故障返回 HTTP 503。

## 3. PostgreSQL 备份

```bash
cd /home/ubuntu/projcets/cqupt-src-test
PROJECT_DIR=$PWD RETENTION_DAYS=14 bash deploy/scripts/backup-postgres.sh
```

备份默认写入 `backups/postgres/`，权限受 `umask 077` 约束，同时生成 SHA-256。脚本会调用 `pg_restore --list` 验证归档结构，并删除超过保留期的备份。

建议通过 root 或部署专用用户的 cron 每日执行：

```cron
20 3 * * * cd /home/ubuntu/projcets/cqupt-src-test && PROJECT_DIR=$PWD RETENTION_DAYS=14 bash deploy/scripts/backup-postgres.sh >> logs/backup.log 2>&1
```

至少再保存一份异机或腾讯云 COS 加密副本。仓库脚本不包含 COS 凭据。

## 4. 恢复演练

只允许先恢复到名称含 `_restore_` 的隔离数据库：

```bash
cd /home/ubuntu/projcets/cqupt-src-test
export PROJECT_DIR=$PWD
export BACKUP_FILE=$PWD/backups/postgres/cqupt-src-YYYYMMDD-HHMMSS.dump
export TARGET_DB=cqupt_src_restore_YYYYMMDD
export CONFIRM_RESTORE=RESTORE:$TARGET_DB
bash deploy/scripts/restore-postgres.sh
```

恢复后使用隔离连接串运行 Prisma 查询或只读冒烟测试。验证完成后人工删除隔离数据库。生产库恢复必须先停止写入、保留故障现场备份，并由两人复核；不要设置 `ALLOW_NON_ISOLATED_RESTORE=1` 进行日常演练。

## 5. 日志与告警

后端为每个响应返回 `X-Request-Id`。默认输出 HTTP 4xx/5xx 和耗时超过 1000ms 的结构化 JSON；设置 `HTTP_LOG_ALL=true` 可记录全部请求元数据，但不会记录请求体、Cookie、Token 或查询参数。

建议日志平台按以下条件告警：

- 5 分钟内 HTTP 5xx 超过 10 次。
- `/api/health/ready` 连续 3 次非 200。
- readiness 中 AI 连续 10 分钟为 `down`。
- WebSocket 验收失败。
- SMTP 邮件投递审计出现 `failed`。
- 数据库备份 26 小时未产生新文件或校验失败。
- 磁盘使用率超过 75%，数据库容量超过平台告警阈值。

## 6. 腾讯云上线验收状态

以下项目必须在腾讯云服务器执行后记录日期、执行人和结果：

- Nginx Proxy Manager WebSocket Upgrade。
- 真实 SMTP 登录与测试邮件投递。
- MinIO 持久卷重启后读写。
- Hermes 模型调用、超时与降级。
- PostgreSQL 备份、隔离恢复及异机副本。
- 管理员、审核员、学生三角色核心 E2E。

未在目标服务器执行前，以上结果均为**未确认**。
