#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT_DIR/.env.docker.local"
ENV_TEMPLATE="$ROOT_DIR/.env.docker.example"
COMPOSE_FILE="$ROOT_DIR/compose.yml"

cd "$ROOT_DIR"

fail() {
  printf '错误：%s\n' "$1" >&2
  exit 1
}

require_docker() {
  command -v docker >/dev/null 2>&1 || fail '未安装 Docker。'
  docker compose version >/dev/null 2>&1 || fail '当前 Docker 未提供 Compose v2。'
  docker ps >/dev/null 2>&1 || fail 'Docker 服务未运行或当前用户无权访问。'
}

random_hex() {
  local byte_count="$1"
  od -An -N "$byte_count" -tx1 /dev/urandom | tr -d ' \n'
}

read_env() {
  awk -F= -v key="$1" '$1 == key { print substr($0, index($0, "=") + 1); exit }' "$ENV_FILE"
}

set_env() {
  local key="$1"
  local value="$2"
  local temporary
  temporary="$(mktemp)"
  awk -v key="$key" -v value="$value" '
    BEGIN { found = 0 }
    $0 ~ "^" key "=" { print key "=" value; found = 1; next }
    { print }
    END { if (!found) print key "=" value }
  ' "$ENV_FILE" > "$temporary"
  mv "$temporary" "$ENV_FILE"
}

ensure_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    cp "$ENV_TEMPLATE" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    printf '已创建本地配置：%s\n' "$ENV_FILE"
  fi

  [[ -n "$(read_env POSTGRES_PASSWORD)" ]] || set_env POSTGRES_PASSWORD "$(random_hex 24)"
  [[ -n "$(read_env MINIO_ROOT_PASSWORD)" ]] || set_env MINIO_ROOT_PASSWORD "$(random_hex 24)"
  [[ -n "$(read_env JWT_ACCESS_SECRET)" ]] || set_env JWT_ACCESS_SECRET "$(random_hex 48)"
  [[ -n "$(read_env JWT_REFRESH_SECRET)" ]] || set_env JWT_REFRESH_SECRET "$(random_hex 48)"
  [[ -n "$(read_env ALTCHA_HMAC_SECRET)" ]] || set_env ALTCHA_HMAC_SECRET "$(random_hex 48)"
  [[ -n "$(read_env AI_CREDENTIAL_ENCRYPTION_KEY)" ]] || set_env AI_CREDENTIAL_ENCRYPTION_KEY "$(random_hex 32)"
  [[ -n "$(read_env NPM_REGISTRY)" ]] || set_env NPM_REGISTRY 'https://registry.npmmirror.com'
}

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

wait_for_health() {
  local service="$1"
  local timeout_seconds="$2"
  local started_at=$SECONDS
  local container_id status

  while (( SECONDS - started_at < timeout_seconds )); do
    container_id="$(compose ps -q "$service")"
    if [[ -n "$container_id" ]]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
      [[ "$status" == 'healthy' ]] && return 0
      [[ "$status" == 'exited' || "$status" == 'dead' ]] && return 1
    fi
    sleep 3
  done
  return 1
}

print_summary() {
  local frontend_port backend_port minio_console_port
  frontend_port="$(read_env FRONTEND_PORT)"
  backend_port="$(read_env BACKEND_PORT)"
  minio_console_port="$(read_env MINIO_CONSOLE_PORT)"

  printf '\n平台地址：http://localhost:%s\n' "${frontend_port:-5173}"
  printf '后端健康检查：http://localhost:%s/api/health/live\n' "${backend_port:-3001}"
  printf 'MinIO 控制台：http://localhost:%s\n' "${minio_console_port:-9001}"
  printf '\n演示账号：\n'
  printf '  管理员  0000000 / admin123456+-\n'
  printf '  审核员  0000001 / auditor123456+-\n'
  printf '  用户    2025001 / 123456+-\n'
  printf '\n查看日志：bash deploy-local.sh logs\n'
  printf '停止服务：bash deploy-local.sh stop\n'
}

start() {
  printf '正在构建并启动本地开发环境……\n'
  compose up -d --build

  if wait_for_health backend 600 && wait_for_health frontend 300; then
    printf '平台服务已就绪。\n'
  else
    compose ps
    printf '\n后端或前端未在规定时间内就绪，请运行 bash deploy-local.sh logs 查看原因。\n' >&2
    return 1
  fi

  if wait_for_health clamav 300; then
    printf '文件安全扫描服务已就绪。\n'
  else
    printf '提示：平台已可访问，安全扫描服务仍在初始化；初始化完成前暂不可上传文件。\n'
  fi
  print_summary
}

reset() {
  printf '此操作会永久删除本地数据库、对象存储、Redis、病毒库缓存和依赖卷。\n'
  read -r -p '第一次确认：输入 RESET 继续：' first_confirmation
  [[ "$first_confirmation" == 'RESET' ]] || { printf '已取消。\n'; return; }
  read -r -p '第二次确认：再次输入 DELETE LOCAL DATA：' second_confirmation
  [[ "$second_confirmation" == 'DELETE LOCAL DATA' ]] || { printf '已取消。\n'; return; }
  compose down --volumes --remove-orphans
  printf '本地 Docker 数据已删除。下次启动将重新初始化。\n'
}

command_name="${1:-start}"
require_docker
ensure_env

case "$command_name" in
  start) start ;;
  stop) compose down --remove-orphans ;;
  restart) compose restart ;;
  status) compose ps ;;
  logs) shift || true; compose logs --follow --tail=200 "$@" ;;
  reset) reset ;;
  *) fail '用法：bash deploy-local.sh [start|stop|restart|status|logs|reset]' ;;
esac
