#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/ubuntu/projects/cqupt-src-test}"
LEGACY_PROJECT_DIR="/home/ubuntu/projcets/cqupt-src-test"
DEPLOY_DIR="${DEPLOY_DIR:-$PROJECT_DIR/deploy/test}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.test.yml}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-cqupt-src-test}"
BACKEND_SERVICE="${BACKEND_SERVICE:-}"
NGINX_SERVICE="${NGINX_SERVICE:-}"
CHAT_SOCKET_URL="${CHAT_SOCKET_URL:-}"

if [[ ! -d "$PROJECT_DIR" && -d "$LEGACY_PROJECT_DIR" ]]; then
  PROJECT_DIR="$LEGACY_PROJECT_DIR"
  DEPLOY_DIR="$PROJECT_DIR/deploy/test"
fi

COMPOSE=(docker compose -p "$COMPOSE_PROJECT" --env-file .env -f "$COMPOSE_FILE")

log() {
  printf '\n===== %s =====\n' "$1"
}

fail() {
  printf '错误: %s\n' "$1" >&2
  exit 1
}

find_service() {
  local requested="$1"
  shift

  if [[ -n "$requested" ]]; then
    printf '%s\n' "$requested"
    return
  fi

  local services candidate
  services="$("${COMPOSE[@]}" config --services)"
  for candidate in "$@"; do
    if grep -Fxq "$candidate" <<<"$services"; then
      printf '%s\n' "$candidate"
      return
    fi
  done
}

command -v git >/dev/null || fail '缺少 git'
command -v docker >/dev/null || fail '缺少 docker'
[[ -d "$PROJECT_DIR" ]] || fail "项目目录不存在: $PROJECT_DIR"
[[ -f "$DEPLOY_DIR/$COMPOSE_FILE" ]] || fail "Compose 文件不存在: $DEPLOY_DIR/$COMPOSE_FILE"
[[ -f "$DEPLOY_DIR/.env" ]] || fail "部署环境文件不存在: $DEPLOY_DIR/.env"

log '获取 GitHub main 最新代码'
cd "$PROJECT_DIR"
git fetch origin main
git switch main
git reset --hard origin/main
git log -1 --oneline

log '构建并启动容器'
cd "$DEPLOY_DIR"
"${COMPOSE[@]}" up -d --build --remove-orphans

BACKEND_SERVICE="$(find_service "$BACKEND_SERVICE" backend api server app)"
[[ -n "$BACKEND_SERVICE" ]] || fail '未找到后端服务。设置 BACKEND_SERVICE，例如 BACKEND_SERVICE=backend ./update-cqupt-test.sh'

log '执行数据库迁移'
"${COMPOSE[@]}" exec -T "$BACKEND_SERVICE" npm run prisma:migrate:deploy

log '重启后端加载迁移后权限与聊天网关'
"${COMPOSE[@]}" up -d --no-deps --force-recreate "$BACKEND_SERVICE"

NGINX_SERVICE="$(find_service "$NGINX_SERVICE" nginx web proxy)"
if [[ -n "$NGINX_SERVICE" ]]; then
  log '检查 Nginx Socket.IO 反向代理'
  if "${COMPOSE[@]}" exec -T "$NGINX_SERVICE" nginx -T 2>&1 | grep -Fq 'location /socket.io/'; then
    "${COMPOSE[@]}" exec -T "$NGINX_SERVICE" nginx -t
    "${COMPOSE[@]}" exec -T "$NGINX_SERVICE" nginx -s reload
  else
    fail 'Nginx 缺少 location /socket.io/。按 docs/deployment/README.md 添加 WebSocket Upgrade 反向代理后重试。'
  fi
else
  printf '提示: 未检测到 Compose 内 Nginx。请在宿主机 Nginx 配置添加 /socket.io/ 反向代理并执行 nginx -t && systemctl reload nginx。\n'
fi

if [[ -n "$CHAT_SOCKET_URL" ]]; then
  log '检查 Socket.IO 入口'
  curl --fail --silent --show-error --http1.1 "${CHAT_SOCKET_URL%/}/socket.io/?EIO=4&transport=polling" >/dev/null
fi

log '服务状态'
"${COMPOSE[@]}" ps

log '更新完成'
