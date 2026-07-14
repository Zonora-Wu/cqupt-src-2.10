# CQUPT-SRC 部署说明

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-06-01 已按当前代码、运行环境和 AI 问题会话 Phase 2 进度更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、最小上下文 + dataRequests、AI Knowledge Base 问题会话生命周期、已解决会话总结、AI+规则评分、相似聚类、管理员审核、高频高质自动入库、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型路由为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 当前仍待实现/验收：Knowledge Retrieval 命中回答、来源标注写回、turn 级点赞/点踩持久化、问题会话 fork/archive/title 接口、维护任务 Worker、不可变 revision 回滚、知识投毒暂停与恢复闭环。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`docs/architecture/AI_PROBLEM_SESSION_KNOWLEDGE_CAPTURE.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

本文件给运维和交付人员使用。目标是把 CQUPT-SRC 跑在 Ubuntu 服务器上，并能完成健康检查、AI Gateway 检查、数据库迁移和基础回归。

当前仓库没有生产 Dockerfile，也没有生产 `docker-compose.yml`。现阶段推荐的生产形态是：

- PostgreSQL / Redis / MinIO：Docker Compose 或托管服务。
- Backend：Node.js 进程运行 `backend/dist/main.js`。
- Frontend：`frontend/dist` 由 Nginx 托管。
- Hermes Agent：独立 Docker 容器，位于 `/home/cocking/cqupt-src-hermes-linux/`。
- Nginx：TLS 终止、静态资源、`/api` 反向代理。

## 1. 架构与端口

| 组件 | 默认端口 | 说明 |
|---|---:|---|
| Nginx | 80 / 443 | 对外入口，HTTPS、前端静态文件、`/api` 反代 |
| Backend | 3001 | NestJS API，健康检查 `/api/health` |
| Frontend | 静态文件 | Vite 构建产物 `frontend/dist` |
| PostgreSQL | 5432 / 本地 15432 | 主业务库，Prisma schema 在 `database/prisma/schema.prisma` |
| Redis | 6379 | 队列、缓存与后续异步任务扩展 |
| MinIO | 9000 / 9001 | 附件、证书模板、证书 PDF |
| Hermes Agent | 5000 | OpenAI-compatible API，后端通过 `/v1` 调用 |

AI 链路必须保持：

```text
Frontend -> /api/ai/* -> NestJS AI Gateway -> Hermes Agent
```

前端不能直接访问 Hermes Agent，模型密钥不能出现在前端环境变量中。

## 2. 服务器前置条件

最低建议：

- Ubuntu 22.04 或更新版本
- Node.js 22 LTS 或兼容版本
- npm
- Docker + Docker Compose plugin
- Nginx
- Git
- 可选：systemd 或 PM2，用于托管后端进程

检查命令：

```bash
node -v
npm -v
docker --version
docker compose version
nginx -v
```

## 3. 本地部署验证

本地开发和交付前验证使用已有脚本：

```bash
cd /home/cocking/projects/cqupt-src-2.10
bash start-local.sh
```

脚本会启动 PostgreSQL、Redis、MinIO，安装依赖，执行 Prisma Client 生成、迁移和 seed，并启动前后端开发服务器。

验证：

```bash
curl -s http://localhost:3001/api/health
curl -s http://localhost:3001/api/ai/health
curl -s http://localhost:5000/health
```

停止前后端开发进程：

```bash
bash stop-local.sh
```

如果只想停 Docker 依赖：

```bash
docker compose -f deploy/docker/docker-compose.local.yml down
```

## 4. 生产目录建议

```text
/opt/cqupt-src/
  app/                 # Git 工作目录或发布包
  releases/            # 可选：按版本保存构建产物
  shared/
    backend.env        # 后端生产环境变量，600 权限
    frontend.env       # 前端构建期环境变量
    logs/              # 后端日志
    storage/           # 如需本地临时文件
```

示例：

```bash
sudo mkdir -p /opt/cqupt-src/{app,shared/logs,shared/storage}
sudo chown -R $USER:$USER /opt/cqupt-src
```

## 5. 拉取代码与安装依赖

```bash
cd /opt/cqupt-src
git clone <repo-url> app
cd app

cd backend
npm ci
npm run prisma:generate

cd ../frontend
npm ci
```

如果服务器不能直接访问仓库，可以在 CI 或开发机上打包发布。注意不要把 `.env`、真实附件、MinIO 数据、数据库数据打进发布包。

## 6. 生产环境变量

### 6.1 Backend

创建 `/opt/cqupt-src/shared/backend.env`，权限设为 `600`：

```bash
touch /opt/cqupt-src/shared/backend.env
chmod 600 /opt/cqupt-src/shared/backend.env
```

参考内容：

```env
NODE_ENV=production
PORT=3001
API_PREFIX=api

# CORS。多个来源用英文逗号分隔。
FRONTEND_ORIGIN=https://src.example.edu.cn

# PostgreSQL
DATABASE_URL=postgresql://cqupt_src:CHANGE_ME@127.0.0.1:5432/cqupt_src?schema=public

# JWT。生产必须使用长随机值。
JWT_ACCESS_SECRET=CHANGE_ME_LONG_RANDOM_ACCESS_SECRET
JWT_REFRESH_SECRET=CHANGE_ME_LONG_RANDOM_REFRESH_SECRET
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Redis
REDIS_URL=redis://127.0.0.1:6379

# MinIO / S3-compatible storage
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=CHANGE_ME
MINIO_SECRET_KEY=CHANGE_ME
MINIO_BUCKET=cqupt-src

# SMTP。生产环境必须接入真实邮件服务。
SMTP_HOST=smtp.example.edu.cn
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=no-reply@example.edu.cn
SMTP_PASS=CHANGE_ME
SMTP_FROM=CQUPT-SRC <no-reply@example.edu.cn>

# Hermes Agent / OpenAI-compatible API
OPENAI_BASE_URL=http://127.0.0.1:5000/v1
OPENAI_API_KEY=CHANGE_ME_OR_AGENT_KEY
OPENAI_MODEL=hermes-agent
OPENAI_REQUEST_TIMEOUT_MS=300000
OPENAI_ATTACHMENT_REQUEST_TIMEOUT_MS=300000

# 平台 Skill Candidate 受控安装目录。
# 不要指向容器私有 data/skills。
CQUPT_HERMES_SKILLS_ROOT=/home/cocking/cqupt-src-hermes-linux/platform-skills/cqupt-src
```

注意：

- `FRONTEND_ORIGIN` 必须和真实访问域名一致，否则浏览器跨域会失败。
- `DATABASE_URL` 指向生产库；不要把本地 `15432` 配置带到生产。
- `OPENAI_BASE_URL` 只给后端使用，前端不配置模型地址。
- `CQUPT_HERMES_SKILLS_ROOT` 使用宿主可写目录，并通过 Hermes Compose bind mount 到容器 `/opt/data/skills/cqupt-src`。

### 6.2 Frontend

前端只允许出现公开配置：

```env
VITE_APP_NAME=CQUPT-SRC
VITE_API_BASE_URL=/api
VITE_DEFAULT_THEME=system
VITE_DEFAULT_PRIMARY_COLOR=#2A6438
```

不要在 `frontend/.env` 写入模型密钥、JWT 密钥、MinIO 密钥或数据库连接串。

## 7. 数据服务部署

仓库当前提供的是本地依赖 compose：

```bash
cd /opt/cqupt-src/app
docker compose -f deploy/docker/docker-compose.local.yml up -d postgres redis minio
```

这份 compose 可用于开发、演示和小规模内网验证。正式生产建议至少调整：

- 改强密码，禁用默认 `minioadmin`。
- PostgreSQL 端口不要暴露到公网。
- Redis 不暴露公网。
- MinIO 控制台只允许内网或 VPN 访问。
- 数据卷纳入备份。
- 按学校策略配置磁盘、保留周期和访问审计。

检查容器：

```bash
docker compose -f deploy/docker/docker-compose.local.yml ps
docker logs cqupt-src-local-postgres --tail 50
docker logs cqupt-src-local-redis --tail 50
docker logs cqupt-src-local-minio --tail 50
```

## 8. Hermes Agent 部署

平台 Hermes 独立于本仓库，默认目录：

```text
/home/cocking/cqupt-src-hermes-linux/
```

关键要求：

1. 容器对外提供 `http://127.0.0.1:5000/v1`。
2. 后端 `OPENAI_BASE_URL` 指向该地址。
3. 平台 Hermes 与 CLI Hermes 分离：CLI 是 `/home/cocking/.hermes/`，不要混用配置。
4. Skill Candidate 写入宿主目录：

```text
/home/cocking/cqupt-src-hermes-linux/platform-skills/cqupt-src
```

5. 该目录在 Hermes 容器内挂载为：

```text
/opt/data/skills/cqupt-src
```

权限建议：

```bash
sudo mkdir -p /home/cocking/cqupt-src-hermes-linux/platform-skills/cqupt-src
sudo chown -R cocking:cocking /home/cocking/cqupt-src-hermes-linux/platform-skills
sudo chmod -R 775 /home/cocking/cqupt-src-hermes-linux/platform-skills
```

检查：

```bash
curl -s http://127.0.0.1:5000/health
curl -s http://127.0.0.1:5000/v1/models
```

更多 Hermes 运行细节见 `docs/HERMES_RUNTIME.md`。

## 9. 构建与迁移

后端：

```bash
cd /opt/cqupt-src/app/backend
set -a
. /opt/cqupt-src/shared/backend.env
set +a

npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate:deploy
npm run build
```

首次部署或需要重置演示数据时执行 seed：

```bash
npm run db:seed
```

生产环境运行 seed 前要确认脚本行为符合交付需求。不要在已有真实数据的生产库上盲目执行会覆盖业务数据的脚本。

前端：

```bash
cd /opt/cqupt-src/app/frontend
cp .env.example .env
npm run build
```

构建产物：

```text
/opt/cqupt-src/app/frontend/dist
```

## 10. 后端进程托管

### 10.1 systemd 示例

创建 `/etc/systemd/system/cqupt-src-backend.service`：

```ini
[Unit]
Description=CQUPT-SRC Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/cqupt-src/app/backend
EnvironmentFile=/opt/cqupt-src/shared/backend.env
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=5
User=cquptsrc
Group=cquptsrc
StandardOutput=append:/opt/cqupt-src/shared/logs/backend.log
StandardError=append:/opt/cqupt-src/shared/logs/backend.error.log

[Install]
WantedBy=multi-user.target
```

启用：

```bash
sudo systemctl daemon-reload
sudo systemctl enable cqupt-src-backend
sudo systemctl restart cqupt-src-backend
sudo systemctl status cqupt-src-backend --no-pager
```

如果没有单独的 `cquptsrc` 用户，先创建：

```bash
sudo useradd --system --home /opt/cqupt-src --shell /usr/sbin/nologin cquptsrc
sudo chown -R cquptsrc:cquptsrc /opt/cqupt-src/shared/logs
```

注意：`WorkingDirectory` 下的代码目录必须让该用户可读；日志目录必须可写。

### 10.2 PM2 示例

如果团队更熟悉 PM2：

```bash
cd /opt/cqupt-src/app/backend
pm2 start dist/main.js --name cqupt-src-backend --time --update-env
pm2 save
pm2 startup
```

systemd 更适合学校服务器的长期运维；PM2 更适合快速交付和临时演示。

## 11. Nginx 配置

示例 `/etc/nginx/sites-available/cqupt-src.conf`：

```nginx
server {
    listen 80;
    server_name src.example.edu.cn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name src.example.edu.cn;

    ssl_certificate     /etc/letsencrypt/live/src.example.edu.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/src.example.edu.cn/privkey.pem;

    root /opt/cqupt-src/app/frontend/dist;
    index index.html;

    client_max_body_size 20m;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # Socket.IO uses this Engine.IO path even when application namespace is /chat.
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

前端使用 BrowserRouter。生产环境必须保留 `try_files $uri $uri/ /index.html;`，否则刷新 `/user/ai`、`/auditor/review`、`/admin/users` 等前端路由会被 Nginx 当作静态路径并返回 404。

启用：

```bash
sudo ln -sf /etc/nginx/sites-available/cqupt-src.conf /etc/nginx/sites-enabled/cqupt-src.conf
sudo nginx -t
sudo systemctl reload nginx
```

注意：AI 附件解析请求可能耗时较长，`proxy_read_timeout` 不要低于后端 `OPENAI_ATTACHMENT_REQUEST_TIMEOUT_MS` 对应的秒数。

## 12. 上线前检查

在服务器上执行：

```bash
cd /opt/cqupt-src/app/backend
set -a
. /opt/cqupt-src/shared/backend.env
set +a

npm run build
npm run prisma:validate
npm run prisma:migrate:deploy

cd ../frontend
npm run build
```

健康检查：

```bash
curl -s http://127.0.0.1:3001/api/health
curl -s http://127.0.0.1:3001/api/ai/health
curl -s http://127.0.0.1:5000/health
curl -I https://src.example.edu.cn/
curl -s https://src.example.edu.cn/api/health
curl -i --http1.1 'https://src.example.edu.cn/socket.io/?EIO=4&transport=polling'
```

核心回归：

```bash
cd /opt/cqupt-src/app/backend
npm run test:core-e2e
npm run test:ai-problem-session
```

这两条 E2E 会覆盖安全答题、附件、报告草稿、AI Knowledge、问题会话和 Skill Candidate 关键链路。生产库执行前先确认测试会使用临时数据并能清理。

## 13. 备份与恢复

最低备份范围：

| 数据 | 建议方式 |
|---|---|
| PostgreSQL | `pg_dump` 定时备份，保留多版本 |
| MinIO | 备份数据卷或使用 `mc mirror` 同步到备份存储 |
| Hermes 平台 skills | 备份 `/home/cocking/cqupt-src-hermes-linux/platform-skills/cqupt-src` |
| 环境变量 | 离线密钥库保存，服务器只保留最小权限副本 |
| Nginx/systemd 配置 | 纳入运维配置仓库或备份目录 |

PostgreSQL 示例：

```bash
mkdir -p /opt/cqupt-src/backups/postgres
pg_dump "$DATABASE_URL" > /opt/cqupt-src/backups/postgres/cqupt-src-$(date +%F-%H%M%S).sql
```

恢复前先在隔离环境验证备份可用，不要直接覆盖生产库。

## 14. 日常运维命令

后端：

```bash
sudo systemctl status cqupt-src-backend --no-pager
sudo systemctl restart cqupt-src-backend
journalctl -u cqupt-src-backend -n 100 --no-pager
```

Docker 依赖：

```bash
docker compose -f deploy/docker/docker-compose.local.yml ps
docker compose -f deploy/docker/docker-compose.local.yml logs -f postgres redis minio
```

Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo tail -n 100 /var/log/nginx/error.log
```

Hermes：

```bash
curl -s http://127.0.0.1:5000/health
curl -s http://127.0.0.1:5000/v1/models
```

## 15. 故障排查

| 现象 | 优先检查 |
|---|---|
| 前端打开空白 | `frontend/dist` 是否存在；Nginx `root` 是否正确；浏览器控制台资源路径 |
| `/api/health` 404 | Nginx `proxy_pass` 是否保留 `/api/`；后端 `API_PREFIX=api` |
| 登录失败或跨域 | `FRONTEND_ORIGIN` 是否包含真实域名；Nginx 是否走 HTTPS |
| 数据库连接失败 | `DATABASE_URL`、PostgreSQL 端口、防火墙、容器健康状态 |
| 附件上传失败 | `client_max_body_size`、MinIO 变量、bucket 初始化、后端日志 |
| AI 回复超时 | Hermes 健康状态、`OPENAI_BASE_URL`、Nginx proxy timeout、后端 AI timeout |
| Skill Candidate 安装失败 | `CQUPT_HERMES_SKILLS_ROOT` 是否指向宿主 `platform-skills/cqupt-src`；目录权限是否可写；容器挂载是否可读 |
| 生产环境返回临时验证码/临时密码 | `NODE_ENV` 是否为 `production` |

## 16. 发布流程建议

每次发布按这个顺序：

1. 拉取代码或解压发布包。
2. 安装依赖：`npm ci`。
3. 后端校验：`npm run prisma:validate && npm run build`。
4. 前端构建：`npm run build`。
5. 数据库迁移：`npm run prisma:migrate:deploy`。
6. 重启后端进程。
7. Reload Nginx。
8. 执行健康检查和核心 E2E。
9. 观察 10-15 分钟日志、AI 调用、附件上传和登录链路。

回滚策略：

- 前端：切回上一版 `frontend/dist`。
- 后端：切回上一版 `backend/dist` 与代码依赖。
- 数据库：涉及不可逆迁移时，发布前必须准备恢复脚本或备份恢复方案。
- Hermes skills：通过备份恢复 `platform-skills/cqupt-src`；不要直接写容器私有目录。

## 17. 安全基线

上线前必须完成：

- 生产 JWT 密钥使用长随机值。
- SMTP 接入真实邮件服务。
- 数据库、Redis、MinIO 不暴露公网。
- Nginx 启用 HTTPS。
- 服务器防火墙只开放 80/443 和必要运维端口。
- 后端 `.env` 权限为 `600`。
- 前端不包含任何服务端密钥。
- AI Knowledge 入库继续执行脱敏、泛化、评分、重复检测和管理员审核。
- AI 写操作保持“提案/确认/后端事务/审计”，模型不能直接执行敏感操作。
