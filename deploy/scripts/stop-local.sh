#!/usr/bin/env bash
# CQUPT-SRC 本地开发环境一键关闭脚本（Linux / WSL / macOS）
# 用法：bash deploy/scripts/stop-local.sh [选项]
#
# 选项：
#   --keep-postgres   保留 PostgreSQL 容器运行
#   --keep-minio      保留 MinIO 容器运行
#   --keep-redis      保留 Redis 容器运行

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/deploy/docker/docker-compose.local.yml"
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
      echo "用法: bash deploy/scripts/stop-local.sh [--keep-postgres] [--keep-minio] [--keep-redis]"
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
  log_warn "未找到进程状态文件，尝试按名称查找残留进程..."
fi

# ---- 清理残留的 tsx/vite 进程 ----
pkill -f "tsx watch.*$REPO_ROOT" 2>/dev/null && log_info "已清理残留 tsx 进程" || true
pkill -f "vite.*$REPO_ROOT"      2>/dev/null && log_info "已清理残留 vite 进程" || true

# ---- 停止 Docker 容器 ----
stop_container() {
  local service="$1"
  local container="$2"
  log_info "停止 $service 容器..."
  docker compose -f "$COMPOSE_FILE" stop "$service" 2>/dev/null && log_success "$service 已停止" || log_warn "$service 停止失败（可能未运行）"
}

if [[ "$KEEP_POSTGRES" == false ]]; then
  stop_container postgres "cqupt-src-local-postgres"
fi

if [[ "$KEEP_REDIS" == false ]]; then
  stop_container redis "cqupt-src-local-redis"
fi

if [[ "$KEEP_MINIO" == false ]]; then
  stop_container minio "cqupt-src-local-minio"
fi

echo ""
log_success "CQUPT-SRC 本地开发环境已关闭"
echo ""
echo -e "${YELLOW}注意：平台 Hermes（端口 5000）和 Hermes Direct（端口 5001）未自动停止。${NC}"
echo "  它们是独立容器，由 /home/cocking/cqupt-src-hermes-linux/docker/ 管理。"
echo "  如需停止 Hermes 容器："
echo "    cd /home/cocking/cqupt-src-hermes-linux && docker compose down"
echo ""
