# 腾讯云 Hermes Agent 部署说明

适用环境：腾讯云 Ubuntu 22.04、Docker 26、CQUPT-SRC 测试环境。

平台用户看到的 AI 名称是“邮宝”。Hermes Agent 是后端使用的 OpenAI-compatible 运行时，不对浏览器公开。

本文只部署主 Hermes Agent。不要默认部署 `hermes-retest-agent`、`retest-egress-proxy`；它们属于高风险漏洞复测链路，需要独立出网控制、审批和目标范围策略。

## 1. 最终拓扑

```text
浏览器
  -> https://test.cquptsrc.asia/api/ai/*
  -> Nginx Proxy Manager
  -> CQUPT-SRC web
  -> CQUPT-SRC backend
  -> http://hermes-agent:5000/v1
  -> Hermes Agent
  -> 模型供应商
```

后端通过以下 API 调 Hermes：

```text
GET  /v1/models
POST /v1/chat/completions
Authorization: Bearer <OPENAI_API_KEY>
```

前端不访问 `5000`。用户身份、角色、实时平台数据、写操作确认和审计均在 NestJS backend 完成。

后端在 Docker 容器内运行，`localhost` 只指向 backend 容器本身。因此必须使用：

```env
OPENAI_BASE_URL=http://hermes-agent:5000/v1
```

不能使用：

```env
OPENAI_BASE_URL=http://localhost:5000/v1
```

## 2. 部署前检查

登录腾讯云服务器：

```bash
ssh ubuntu@<腾讯云公网IP>
```

检查 Docker、Compose、项目目录：

```bash
docker --version
docker compose version

cd /home/ubuntu/projcets/cqupt-src-test/deploy/test
docker compose --env-file .env -f docker-compose.test.yml ps
docker compose --env-file .env -f docker-compose.test.yml config --services
```

预期现有服务至少包含：

```text
postgres
redis
minio
backend
web
```

确认 backend 使用的 Docker 网络名称：

```bash
docker inspect cqupt-src-test-backend \
  --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}'
```

本文假定 Compose 网络名为 `test_net`，即 Compose 文件中 backend 连接的网络。若实际名称不同，下面 Hermes 服务的 `networks` 必须改为 backend 使用的网络。

备份当前部署配置：

```bash
cd /home/ubuntu/projcets/cqupt-src-test/deploy/test
mkdir -p backup
cp docker-compose.test.yml "backup/docker-compose.test.yml.$(date +%Y%m%d%H%M%S)"
cp .env "backup/env.$(date +%Y%m%d%H%M%S)"
chmod 700 backup
```

`backup/env.*` 含密钥，不要提交 Git，不要下载到不受控设备。

## 3. 创建 Hermes 宿主目录

服务器执行：

```bash
sudo install -d -m 755 /home/ubuntu/cqupt-src-hermes-linux/docker/env
sudo install -d -m 755 /home/ubuntu/cqupt-src-hermes-linux/data
sudo install -d -m 775 /home/ubuntu/cqupt-src-hermes-linux/platform-skills/cqupt-src

sudo chown -R ubuntu:ubuntu /home/ubuntu/cqupt-src-hermes-linux

find /home/ubuntu/cqupt-src-hermes-linux -maxdepth 3 -type d -print
```

目录用途：

```text
/home/ubuntu/cqupt-src-hermes-linux/docker/env/.env.agent
  Hermes 密钥与模型供应商配置，不提交 Git。

/home/ubuntu/cqupt-src-hermes-linux/data
  Hermes 容器持久化数据，容器管理。

/home/ubuntu/cqupt-src-hermes-linux/platform-skills/cqupt-src
  平台专属 skills。backend 审核安装候选 Skill 时写入此目录。
```

## 4. 创建 Hermes 密钥文件

文件路径：

```text
/home/ubuntu/cqupt-src-hermes-linux/docker/env/.env.agent
```

### 4.1 推荐方式：复制已验证配置

在已运行 Hermes 的受控开发机执行。此命令会传输模型供应商密钥，确认 SSH 主机可信后再运行：

```bash
scp /home/cocking/cqupt-src-hermes-linux/docker/env/.env.agent \
  ubuntu@<腾讯云公网IP>:/tmp/cqupt-hermes-agent.env
```

云服务器执行：

```bash
sudo install -m 600 -o ubuntu -g ubuntu \
  /tmp/cqupt-hermes-agent.env \
  /home/ubuntu/cqupt-src-hermes-linux/docker/env/.env.agent

rm -f /tmp/cqupt-hermes-agent.env
```

### 4.2 手工创建方式

没有已验证配置时，先生成 backend 与 Hermes 之间的 API Key：

```bash
openssl rand -hex 32
```

创建文件：

```bash
nano /home/ubuntu/cqupt-src-hermes-linux/docker/env/.env.agent
```

至少配置下列字段。模型供应商字段必须按当前 Hermes 版本和所选供应商的官方配置填写：

```env
HERMES_INFERENCE_PROVIDER=<模型供应商配置>
DEEPSEEK_API_KEY=<模型供应商密钥>

API_SERVER_ENABLED=true
API_SERVER_HOST=0.0.0.0
API_SERVER_PORT=5000
API_SERVER_KEY=<第 4.2 节生成的随机值>

LOG_LEVEL=info
```

设置权限并只查看变量名，不输出密钥：

```bash
chmod 600 /home/ubuntu/cqupt-src-hermes-linux/docker/env/.env.agent
awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/{print $1}' \
  /home/ubuntu/cqupt-src-hermes-linux/docker/env/.env.agent | sort
```

不要将 `.env.agent`、`.env`、API Key、模型供应商密钥写入：

```text
Git 仓库
docs 文件
frontend/.env
浏览器配置
Nginx Proxy Manager
```

## 5. 修改 CQUPT-SRC Compose

本项目本地 Hermes 采用独立 Docker Compose。云端可选两种方式，二选一：

```text
方式 A：把 hermes-agent 写入 CQUPT-SRC docker-compose.test.yml。
方式 B：保留独立 Hermes Compose，并连接 CQUPT-SRC backend 所在 Docker 网络。
```

方式 B 与本地方案一致，命令更独立，推荐使用。选择方式 B 时，不要同时按第 5.1 节把 `hermes-agent` 再写入 `docker-compose.test.yml`。

### 5.0 方式 B：独立 Hermes Docker Compose（推荐）

以下命令在腾讯云服务器执行。先获取 CQUPT-SRC backend 实际网络名：

```bash
APP_NETWORK="$(docker inspect cqupt-src-test-backend \
  --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' \
  | head -n 1)"

printf 'APP_NETWORK=%s\n' "$APP_NETWORK"
docker network inspect "$APP_NETWORK" --format '{{.Name}}'
```

通常输出为：

```text
APP_NETWORK=cqupt-src-test_test_net
```

创建 Hermes 目录和 Compose 文件：

```bash
export HERMES_ROOT=/home/ubuntu/cqupt-src-hermes-linux

install -d -m 755 "$HERMES_ROOT/docker/env"
install -d -m 755 "$HERMES_ROOT/data"
install -d -m 775 "$HERMES_ROOT/platform-skills/cqupt-src"
```

将已验证的本地 Hermes 密钥文件安全复制到云端。此命令在本地开发机执行：

```bash
scp /home/cocking/cqupt-src-hermes-linux/docker/env/.env.agent \
  ubuntu@<腾讯云公网IP>:/tmp/cqupt-hermes-agent.env
```

云端执行：

```bash
export HERMES_ROOT=/home/ubuntu/cqupt-src-hermes-linux

install -m 600 /tmp/cqupt-hermes-agent.env \
  "$HERMES_ROOT/docker/env/.env.agent"
rm -f /tmp/cqupt-hermes-agent.env
```

生成独立 Compose 文件。保持第 5.0 节开头获得的 `APP_NETWORK` Shell 变量，不要手工猜测 `test_net`：

```bash
export HERMES_ROOT=/home/ubuntu/cqupt-src-hermes-linux
APP_NETWORK="$(docker inspect cqupt-src-test-backend \
  --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' \
  | head -n 1)"

printf 'Using Docker network: %s\n' "$APP_NETWORK"

cat > "$HERMES_ROOT/docker/docker-compose.yml" <<EOF
services:
  hermes-agent:
    image: nousresearch/hermes-agent:latest
    container_name: hermes-agent
    restart: unless-stopped
    env_file:
      - ./env/.env.agent
    command: gateway run --replace
    ports:
      - "127.0.0.1:5000:5000"
    volumes:
      - ../data:/opt/data
      - ../platform-skills/cqupt-src:/opt/data/skills/cqupt-src
    networks:
      - cqupt_app
    healthcheck:
      test: ["CMD", "python3", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health', timeout=5).read()"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s

networks:
  cqupt_app:
    external: true
    name: ${APP_NETWORK}
EOF
```

校验并启动独立 Hermes Compose：

```bash
cd /home/ubuntu/cqupt-src-hermes-linux/docker

docker compose config
docker compose pull hermes-agent
docker compose up -d hermes-agent
docker compose ps
docker compose logs --tail=100 hermes-agent
```

检查容器、网络和健康状态：

```bash
docker inspect hermes-agent --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}'
docker inspect --format '{{.State.Health.Status}}' hermes-agent
curl -s http://127.0.0.1:5000/health
```

必须同时满足：

```text
hermes-agent 连接 APP_NETWORK。
backend 连接同一 APP_NETWORK。
健康检查返回 status=ok。
```

独立 Compose 的维护命令：

```bash
cd /home/ubuntu/cqupt-src-hermes-linux/docker

docker compose ps
docker compose logs -f --tail=200 hermes-agent
docker compose restart hermes-agent
docker compose pull hermes-agent
docker compose up -d hermes-agent
docker compose down
```

`docker compose down` 只停止 Hermes 独立项目，不删除挂载的 `data`、`platform-skills`，也不删除 CQUPT-SRC 的 PostgreSQL、Redis、MinIO。

### 5.1 方式 A：加入 CQUPT-SRC Compose

编辑服务器 Compose 文件：

```bash
cd /home/ubuntu/projcets/cqupt-src-test/deploy/test
nano docker-compose.test.yml
```

### 5.2 新增 Hermes 服务

在 `services:` 下新增以下服务。`test_net` 必须与 backend 使用相同网络：

```yaml
  hermes-agent:
    image: nousresearch/hermes-agent:latest
    container_name: hermes-agent
    restart: unless-stopped
    env_file:
      - /home/ubuntu/cqupt-src-hermes-linux/docker/env/.env.agent
    command: gateway run --replace
    ports:
      - "127.0.0.1:5000:5000"
    volumes:
      - /home/ubuntu/cqupt-src-hermes-linux/data:/opt/data
      - /home/ubuntu/cqupt-src-hermes-linux/platform-skills/cqupt-src:/opt/data/skills/cqupt-src
    networks:
      - test_net
    healthcheck:
      test: ["CMD", "python3", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health', timeout=5).read()"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
```

`127.0.0.1:5000:5000` 只供服务器本机健康检查。不要改为 `0.0.0.0:5000:5000`，不要在 Nginx Proxy Manager 创建 5000 的 Proxy Host。

镜像当前与项目开发环境一致，使用 `nousresearch/hermes-agent:latest`。完成首次验证后，应记录已验证镜像摘要；升级前先在测试环境验证。

### 5.3 修改 backend 服务

backend 必须读取部署 `.env` 中的 AI 配置，并增加平台 skills 挂载。保留已有 `volumes`，在其后追加：

```yaml
  backend:
    volumes:
      - /home/ubuntu/cqupt-src-hermes-linux/platform-skills/cqupt-src:/opt/cqupt/hermes-skills/cqupt-src
```

如果 backend 已使用 `env_file: .env`，无需在 Compose 内重复写 `OPENAI_*`。如果没有，增加：

```yaml
  backend:
    environment:
      OPENAI_BASE_URL: http://hermes-agent:5000/v1
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      OPENAI_MODEL: hermes-agent
      CQUPT_HERMES_SKILLS_ROOT: /opt/cqupt/hermes-skills/cqupt-src
```

不要把 `OPENAI_API_KEY` 字面量写入 Compose 文件。

### 5.4 校验 Compose

```bash
cd /home/ubuntu/projcets/cqupt-src-test/deploy/test
docker compose --env-file .env -f docker-compose.test.yml config >/tmp/cqupt-compose-rendered.yml
grep -nE 'hermes-agent|OPENAI_BASE_URL|CQUPT_HERMES_SKILLS_ROOT' /tmp/cqupt-compose-rendered.yml
rm -f /tmp/cqupt-compose-rendered.yml
```

若 `docker compose config` 报错，使用第 2 节备份恢复：

```bash
cp backup/<对应时间戳的docker-compose文件> docker-compose.test.yml
```

## 6. 修改 backend 环境变量

编辑：

```bash
cd /home/ubuntu/projcets/cqupt-src-test/deploy/test
nano .env
```

加入或修改：

```env
OPENAI_BASE_URL=http://hermes-agent:5000/v1
OPENAI_API_KEY=<与 .env.agent 的 API_SERVER_KEY 完全相同>
OPENAI_MODEL=hermes-agent
OPENAI_REQUEST_TIMEOUT_MS=300000
OPENAI_ATTACHMENT_REQUEST_TIMEOUT_MS=300000
CQUPT_HERMES_SKILLS_ROOT=/opt/cqupt/hermes-skills/cqupt-src
```

确认 `FRONTEND_ORIGIN` 保持现有域名：

```env
FRONTEND_ORIGIN=https://test.cquptsrc.asia
```

检查变量存在，不输出值：

```bash
awk -F= '/^(OPENAI_BASE_URL|OPENAI_API_KEY|OPENAI_MODEL|CQUPT_HERMES_SKILLS_ROOT|FRONTEND_ORIGIN)=/{print $1}' .env
```

## 7. 设置 skills 目录权限

backend 必须能写技能目录，Hermes 必须能读。

先查看 backend 容器运行用户。此时 backend 可能是旧容器，UID/GID 仍可用于初始判断：

```bash
cd /home/ubuntu/projcets/cqupt-src-test/deploy/test
docker compose --env-file .env -f docker-compose.test.yml exec -T backend id
```

假设输出为 `uid=1000 gid=1000`，执行：

```bash
sudo chown -R 1000:1000 /home/ubuntu/cqupt-src-hermes-linux/platform-skills
sudo chmod -R u+rwX,g+rwX /home/ubuntu/cqupt-src-hermes-linux/platform-skills
```

若实际 UID/GID 不同，用实际值替换 `1000:1000`。不要修改 `/home/ubuntu/cqupt-src-hermes-linux/data` 的属主；它是 Hermes 容器私有持久化目录。

## 8. 首次启动

方式 A 启动 Hermes：

```bash
cd /home/ubuntu/projcets/cqupt-src-test/deploy/test
docker compose --env-file .env -f docker-compose.test.yml pull hermes-agent
docker compose --env-file .env -f docker-compose.test.yml up -d hermes-agent
docker compose --env-file .env -f docker-compose.test.yml ps hermes-agent
```

方式 B 启动 Hermes：

```bash
cd /home/ubuntu/cqupt-src-hermes-linux/docker
docker compose pull hermes-agent
docker compose up -d hermes-agent
docker compose ps hermes-agent
```

等待健康检查：

```bash
docker inspect --format '{{.State.Health.Status}}' hermes-agent
curl -s http://127.0.0.1:5000/health
```

方式 A 查看日志：

```bash
cd /home/ubuntu/projcets/cqupt-src-test/deploy/test
docker compose --env-file .env -f docker-compose.test.yml logs --tail=100 hermes-agent
```

方式 B 查看日志：

```bash
cd /home/ubuntu/cqupt-src-hermes-linux/docker
docker compose logs --tail=100 hermes-agent
```

预期：

```json
{"status":"ok","platform":"hermes-agent"}
```

重建 backend，使其读取新环境变量和 skills 挂载：

```bash
cd /home/ubuntu/projcets/cqupt-src-test/deploy/test
docker compose --env-file .env -f docker-compose.test.yml up -d --build backend
docker compose --env-file .env -f docker-compose.test.yml ps backend
```

方式 A 额外检查：

```bash
docker compose --env-file .env -f docker-compose.test.yml ps hermes-agent
```

方式 B 额外检查：

```bash
cd /home/ubuntu/cqupt-src-hermes-linux/docker
docker compose ps hermes-agent
```

方式 A：`update-cqupt-test.sh` 的全量更新会管理 `hermes-agent`。

方式 B：`update-cqupt-test.sh` 不管理独立 Hermes Compose，使用第 5.0 节命令维护。

## 9. 连通性与平台验收

### 9.1 backend 到 Hermes 健康检查

```bash
cd /home/ubuntu/projcets/cqupt-src-test/deploy/test
docker compose --env-file .env -f docker-compose.test.yml exec -T backend \
  node -e "fetch('http://hermes-agent:5000/health').then(async r => { console.log(r.status, await r.text()); process.exit(r.ok ? 0 : 1) })"
```

### 9.2 backend 到模型 API

```bash
cd /home/ubuntu/projcets/cqupt-src-test/deploy/test
docker compose --env-file .env -f docker-compose.test.yml exec -T backend \
  node -e "fetch('http://hermes-agent:5000/v1/models',{headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY}}).then(async r => { console.log(r.status, await r.text()); process.exit(r.ok ? 0 : 1) })"
```

预期 HTTP `200`，响应中含 `hermes-agent`。

### 9.3 平台 AI 健康接口

使用已登录用户 access token：

```bash
curl -s https://test.cquptsrc.asia/api/ai/health \
  -H 'Authorization: Bearer <accessToken>'
```

预期结构：

```json
{
  "ok": true,
  "latencyMs": 42,
  "models": {
    "data": [{ "id": "hermes-agent" }]
  }
}
```

### 9.4 浏览器验收

1. 登录用户端。
2. 打开“邮宝”页面。
3. 发送普通平台问题。
4. 确认回复正常，没有前端直连 `:5000`。
5. 管理员页面检查 AI 调用审计。

## 10. 同步平台 skills

本仓库不保存已安装的 Hermes skills。需要从已验证开发环境同步。

在受控开发机执行：

```bash
rsync -a --delete \
  /home/cocking/cqupt-src-hermes-linux/platform-skills/cqupt-src/ \
  ubuntu@<腾讯云公网IP>:/home/ubuntu/cqupt-src-hermes-linux/platform-skills/cqupt-src/
```

云服务器执行：

```bash
cd /home/ubuntu/projcets/cqupt-src-test/deploy/test
docker compose --env-file .env -f docker-compose.test.yml restart hermes-agent

docker compose --env-file .env -f docker-compose.test.yml exec -T hermes-agent \
  sh -lc 'find /opt/data/skills/cqupt-src -maxdepth 2 -name SKILL.md | sort'
```

不要直接写入容器 `/opt/data`。平台 Skill Candidate 安装应通过 backend 写入宿主：

```text
/home/ubuntu/cqupt-src-hermes-linux/platform-skills/cqupt-src
```

再由挂载同步到容器：

```text
/opt/data/skills/cqupt-src
```

## 11. 日常维护命令

状态：

```bash
cd /home/ubuntu/projcets/cqupt-src-test/deploy/test
docker compose --env-file .env -f docker-compose.test.yml ps hermes-agent
docker stats hermes-agent
```

日志：

```bash
docker compose --env-file .env -f docker-compose.test.yml logs -f --tail=200 hermes-agent
```

重启 Hermes：

```bash
docker compose --env-file .env -f docker-compose.test.yml restart hermes-agent
```

更新 Hermes 镜像。先在低峰期执行，随后复做第 9 节验收：

```bash
docker compose --env-file .env -f docker-compose.test.yml pull hermes-agent
docker compose --env-file .env -f docker-compose.test.yml up -d hermes-agent
docker image prune -f
```

## 12. 与 update-cqupt-test.sh 的关系

`update-cqupt-test.sh` 只管理 CQUPT-SRC 当前 Compose 文件。

1. 方式 A：已将 `hermes-agent` 写入 `docker-compose.test.yml` 后，选择全量更新会保持 Hermes 服务。
2. 方式 B：`update-cqupt-test.sh` 不管理独立 Hermes Compose，按第 5.0 节单独更新。
3. 仅前端、仅后端、仅重启不会自动拉取 Hermes 新镜像。
4. Hermes 镜像更新后重启 backend：

```bash
cd /home/ubuntu/projcets/cqupt-src-test
DEPLOY_SCOPE=6 ./update-cqupt-test.sh
```

## 13. 排错

| 现象 | 命令与处理 |
| --- | --- |
| Hermes 容器未启动 | `docker compose --env-file .env -f docker-compose.test.yml logs hermes-agent` |
| `curl 127.0.0.1:5000/health` 失败 | 检查 `.env.agent`、镜像拉取、容器日志 |
| backend 连不上 Hermes | 用第 9.1 节命令；确认两者同在 `test_net`，且 URL 为 `http://hermes-agent:5000/v1` |
| `/api/ai/health` 返回 401 | backend `.env` 的 `OPENAI_API_KEY` 与 Hermes `.env.agent` 的 `API_SERVER_KEY` 不一致 |
| `/api/ai/health` 返回 503 或超时 | 检查模型供应商密钥、余额/配额、Hermes 日志、`OPENAI_REQUEST_TIMEOUT_MS` |
| `hermes-agent` 无法解析 | `docker inspect cqupt-src-test-backend` 与 `docker inspect hermes-agent` 检查共享网络 |
| Skill Candidate 安装失败 | 检查 backend 挂载、`CQUPT_HERMES_SKILLS_ROOT`、目录 UID/GID |
| 浏览器访问 5000 | 停止。前端只能调用 `/api/ai/*`，不得暴露 Hermes API |

## 14. 回滚

仅 Hermes 无法启动时，先停服务，不影响 CQUPT-SRC 其他模块：

```bash
cd /home/ubuntu/projcets/cqupt-src-test/deploy/test
docker compose --env-file .env -f docker-compose.test.yml stop hermes-agent
```

恢复 Compose 与 backend `.env` 备份：

```bash
cd /home/ubuntu/projcets/cqupt-src-test/deploy/test
cp backup/<对应时间戳的docker-compose文件> docker-compose.test.yml
cp backup/<对应时间戳的env文件> .env
docker compose --env-file .env -f docker-compose.test.yml up -d --build backend web
```

AI 功能会不可用或降级，但漏洞、用户、积分、证书、聊天等非 AI 模块不应受 Hermes 容器停止影响。
