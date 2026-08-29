#!/usr/bin/env bash
# CQUPT-SRC 本地开发环境一键关闭脚本（Linux / WSL / macOS）
# 用法：bash stop-local.sh [选项]
#
# 选项：
#   --keep-postgres   保留 PostgreSQL 容器运行
#   --keep-minio      保留 MinIO 容器运行
#   --keep-redis      保留 Redis 容器运行

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="$REPO_ROOT/tmp/local-dev-processes.json"

KEEP_POSTGRES=false
KEEP_MINIO=false
KEEP_REDIS=false

for arg in "$@"; do
  case "$arg" in
    --keep-postgres) KEEP_POSTGRES=true ;;
    --keep-minio)    KEEP_MINIO=true ;;
    --keep-redis)    KEEP_REDIS=true ;;
    *)
      echo "未知参数: $arg"
      echo "用法: bash stop-local.sh [--keep-postgres] [--keep-minio] [--keep-redis]"
      exit 1
      ;;
  esac
done

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()    { echo -e "${CYAN}▶ $1${NC}"; }
log_success() { echo -e "${GREEN}✔ $1${NC}"; }
log_warn()    { echo -e "${YELLOW}⚠ $1${NC}"; }
log_error()   { echo -e "${RED}✘ $1${NC}" >&2; }

echo ""
echo -e "${GREEN}=== CQUPT-SRC 本地开发环境关闭 ===${NC}"
echo ""

# ---- 通过状态文件停止前后端进程 ----
if [[ -f "$STATE_FILE" ]]; then
  BACKEND_PID=$(python3 -c "import json,sys; d=json.load(open('$STATE_FILE')); print(d.get('backend',{}).get('pid',''))" 2>/dev/null || echo "")
  FRONTEND_PID=$(python3 -c "import json,sys; d=json.load(open('$STATE_FILE')); print(d.get('frontend',{}).get('pid',''))" 2>/dev/null || echo "")

  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    log_info "停止后端进程 (PID $BACKEND_PID)..."
    kill "$BACKEND_PID" 2>/dev/null && log_success "后端已停止" || log_warn "后端进程不存在（可能已退出）"
  fi

  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    log_info "停止前端进程 (PID $FRONTEND_PID)..."
    kill "$FRONTEND_PID" 2>/dev/null && log_success "前端已停止" || log_warn "前端进程不存在（可能已退出）"
  fi

  rm -f "$STATE_FILE"
else
  log_warn "未找到进程状态文件，将按开发端口清理残留进程"
fi

# ---- 停止两套本地 Compose 模式中的应用容器 ----
stop_project_service() {
  local service="$1"
  local label="$2"
  local container_ids

  if ! container_ids="$(docker ps -q \
    --filter 'label=com.docker.compose.project=cqupt-src-local' \
    --filter "label=com.docker.compose.service=$service")"; then
    log_warn "无法查询 $label 容器"
    return 1
  fi

  if [[ -z "$container_ids" ]]; then
    log_success "$label 容器未运行"
    return 0
  fi

  log_info "停止 $label 容器..."
  # shellcheck disable=SC2086
  docker stop $container_ids >/dev/null
  log_success "$label 已停止"
}

stop_project_service backend "Docker 后端"
stop_project_service frontend "Docker 前端"

# ---- 释放前后端固定端口 ----
port_listener_pids() {
  local port="$1"
  if command -v ss &>/dev/null; then
    ss -H -ltnp "sport = :$port" 2>/dev/null \
      | grep -oE 'pid=[0-9]+' \
      | cut -d= -f2 \
      | sort -u || true
    return 0
  fi
  lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | sort -u || true
}

port_is_listening() {
  local port="$1"
  if command -v ss &>/dev/null; then
    [[ -n "$(ss -H -ltn "sport = :$port" 2>/dev/null)" ]]
    return
  fi
  [[ -n "$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null)" ]]
}

process_cwd() {
  local pid="$1"
  if [[ -e "/proc/$pid/cwd" ]]; then
    readlink -f "/proc/$pid/cwd" 2>/dev/null || true
    return
  fi
  lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1
}

stop_listener_groups() {
  local signal="$1"
  shift
  local own_group pid process_group
  own_group="$(ps -o pgid= -p "$$" | tr -d ' ')"

  for pid in "$@"; do
    process_group="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
    if [[ "$process_group" =~ ^[0-9]+$ ]] && [[ "$process_group" -gt 1 ]] && [[ "$process_group" != "$own_group" ]]; then
      kill "-$signal" -- "-$process_group" 2>/dev/null || true
    else
      kill "-$signal" "$pid" 2>/dev/null || true
    fi
  done
}

stop_required_port() {
  local port="$1"
  local label="$2"
  local listener_pid
  local targets=""

  for listener_pid in $(port_listener_pids "$port"); do
    local current="$listener_pid"
    while [[ "$current" =~ ^[0-9]+$ ]] && [[ "$current" -gt 1 ]]; do
      local args cwd parent
      args="$(ps -o args= -p "$current" 2>/dev/null || true)"
      cwd="$(process_cwd "$current")"
      if [[ "$cwd" != "$REPO_ROOT"* ]] || [[ ! "$args" =~ (vite|tsx[[:space:]]+watch|src/main\.ts|npm[[:space:]]+run[[:space:]]+dev) ]]; then
        break
      fi
      targets="$targets $current"
      parent="$(ps -o ppid= -p "$current" 2>/dev/null | tr -d ' ' || true)"
      current="$parent"
    done
  done

  if [[ -n "${targets// /}" ]]; then
    log_info "停止占用 $port 的$label进程..."
    # shellcheck disable=SC2086
    kill $targets 2>/dev/null || true
  fi

  for _ in $(seq 1 20); do
    if ! port_is_listening "$port"; then
      log_success "$label端口 $port 已释放"
      return 0
    fi
    sleep 0.25
  done

  local remaining
  remaining="$(port_listener_pids "$port" | tr '\n' ' ')"
  if [[ -n "${remaining// /}" ]]; then
    log_warn "$label端口 $port 仍被占用，停止监听进程组：$remaining"
    # shellcheck disable=SC2086
    stop_listener_groups TERM $remaining
    for _ in $(seq 1 8); do
      if ! port_is_listening "$port"; then break; fi
      sleep 0.25
    done

    remaining="$(port_listener_pids "$port" | tr '\n' ' ')"
    if [[ -n "${remaining// /}" ]]; then
      # shellcheck disable=SC2086
      stop_listener_groups KILL $remaining
      sleep 0.5
    fi
  fi

  if port_is_listening "$port"; then
    log_error "$label端口 $port 释放失败，请检查权限"
    return 1
  fi
  log_success "$label端口 $port 已释放"
}

if ! command -v ss &>/dev/null && ! command -v lsof &>/dev/null; then
  log_error "缺少 ss 或 lsof，无法保证释放开发端口"
  exit 1
fi

stop_required_port 3001 "后端"
stop_required_port 5173 "前端"

if [[ "$KEEP_POSTGRES" == false ]]; then
  stop_project_service postgres "PostgreSQL"
  stop_required_port 15432 "PostgreSQL"
fi

if [[ "$KEEP_REDIS" == false ]]; then
  stop_project_service redis "Redis"
  stop_required_port 6379 "Redis"
fi

if [[ "$KEEP_MINIO" == false ]]; then
  stop_project_service minio "MinIO"
  stop_required_port 9000 "MinIO API"
  stop_required_port 9001 "MinIO 控制台"
fi

stop_project_service clamav "ClamAV"
stop_required_port 13310 "ClamAV"

echo ""
log_success "关闭完成"
echo ""
