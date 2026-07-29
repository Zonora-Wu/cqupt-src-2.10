#!/usr/bin/env bash
# CQUPT-SRC 本地开发环境一键启动脚本（Linux / WSL / macOS）
# 用法：bash start-local.sh [选项]
#
# 选项：
#   --skip-postgres   跳过启动 PostgreSQL 容器
#   --skip-minio      跳过启动 MinIO 容器
#   --skip-db-init    跳过数据库迁移和 seed
#   --skip-redis      跳过启动 Redis 容器

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$REPO_ROOT/deploy/docker/docker-compose.local.yml"
BACKEND_DIR="$REPO_ROOT/backend"
FRONTEND_DIR="$REPO_ROOT/frontend"
STATE_DIR="$REPO_ROOT/tmp"
STATE_FILE="$STATE_DIR/local-dev-processes.json"

# ---- 参数解析 ----
SKIP_POSTGRES=false
SKIP_MINIO=false
SKIP_REDIS=false
SKIP_DB_INIT=false

for arg in "$@"; do
  case "$arg" in
    --skip-postgres) SKIP_POSTGRES=true ;;
    --skip-minio)    SKIP_MINIO=true ;;
    --skip-redis)    SKIP_REDIS=true ;;
    --skip-db-init)  SKIP_DB_INIT=true ;;
    *)
      echo "未知参数: $arg"
      echo "用法: bash start-local.sh [--skip-postgres] [--skip-minio] [--skip-redis] [--skip-db-init]"
      exit 1
      ;;
  esac
done

# ---- 颜色输出 ----
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()    { echo -e "${CYAN}▶ $1${NC}"; }
log_success() { echo -e "${GREEN}✔ $1${NC}"; }
log_warn()    { echo -e "${YELLOW}⚠ $1${NC}"; }
log_error()   { echo -e "${RED}✘ $1${NC}" >&2; }

# ---- 工具检查 ----
for cmd in curl docker node npm; do
  if ! command -v "$cmd" &>/dev/null; then
    log_error "$cmd 未安装，请先安装后再运行此脚本"
    exit 1
  fi
done

mkdir -p "$STATE_DIR"

read_state_pid() {
  local service="$1"
  node -e "
    try {
      const state = require(process.argv[1])
      process.stdout.write(String(state[process.argv[2]]?.pid ?? ''))
    } catch {}
  " "$STATE_FILE" "$service" 2>/dev/null || true
}

state_process_is_running() {
  local service="$1"
  local pid
  pid="$(read_state_pid "$service")"
  [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null
}

if [[ -f "$STATE_FILE" ]]; then
  if curl -fsS --max-time 2 http://localhost:3001/api/health >/dev/null \
    && curl -fsS --max-time 2 http://localhost:5173 >/dev/null; then
    log_success "本地开发环境已运行，无需重复启动"
    echo "  前端          http://localhost:5173"
    echo "  后端 API      http://localhost:3001/api/health"
    exit 0
  fi
  if state_process_is_running backend || state_process_is_running frontend; then
    log_error "状态文件仍有存活进程，但服务未全部就绪。请先执行：bash stop-local.sh --keep-postgres --keep-redis --keep-minio"
    exit 1
  fi
  log_warn "发现失效的进程状态文件，将重新启动"
  rm -f "$STATE_FILE"
fi

if curl -fsS --max-time 2 http://localhost:3001/api/health >/dev/null 2>&1; then
  log_error "端口 3001 已被未记录的后端占用，请先确认并停止该进程"
  exit 1
fi
if curl -fsS --max-time 2 http://localhost:5173 >/dev/null 2>&1; then
  log_error "端口 5173 已被未记录的前端占用，请先确认并停止该进程"
  exit 1
fi

echo ""
echo -e "${GREEN}=== CQUPT-SRC 本地开发环境启动 ===${NC}"
echo "项目根目录：$REPO_ROOT"
echo ""

# ---- 启动 Docker 容器 ----
wait_healthy() {
  local container="$1"
  local timeout="${2:-60}"
  local elapsed=0
  log_info "等待 $container 健康检查通过..."
  while true; do
    local status
    status=$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo "not_found")
    if [[ "$status" == "healthy" ]]; then
      log_success "$container 已就绪"
      return 0
    fi
    if [[ $elapsed -ge $timeout ]]; then
      log_error "$container 在 ${timeout}s 内未就绪，请检查 Docker 日志：docker logs $container"
      exit 1
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
}

if [[ "$SKIP_POSTGRES" == false ]]; then
  log_info "启动 PostgreSQL 容器..."
  docker compose -f "$COMPOSE_FILE" up -d postgres
  wait_healthy "cqupt-src-local-postgres"
fi

if [[ "$SKIP_REDIS" == false ]]; then
  log_info "启动 Redis 容器..."
  docker compose -f "$COMPOSE_FILE" up -d redis
  wait_healthy "cqupt-src-local-redis"
fi

if [[ "$SKIP_MINIO" == false ]]; then
  log_info "启动 MinIO 容器..."
  docker compose -f "$COMPOSE_FILE" up -d minio
  wait_healthy "cqupt-src-local-minio"
fi

# ---- 安装依赖（如 node_modules 不存在） ----
if [[ ! -d "$BACKEND_DIR/node_modules" ]]; then
  log_info "安装后端依赖..."
  (cd "$BACKEND_DIR" && npm install)
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  log_info "安装前端依赖..."
  (cd "$FRONTEND_DIR" && npm install)
fi

# ---- 数据库初始化 ----
if [[ "$SKIP_DB_INIT" == false ]]; then
  log_info "生成 Prisma Client..."
  (cd "$BACKEND_DIR" && npm run prisma:generate)

  log_info "执行数据库迁移..."
  (cd "$BACKEND_DIR" && npm run prisma:migrate:deploy)

  log_info "写入 seed 数据（角色/权限/演示账号等）..."
  (cd "$BACKEND_DIR" && npm run db:seed) || log_warn "db:seed 执行失败（数据可能已存在，通常可忽略）"
fi

# ---- 启动开发服务器（后台） ----
LOG_DIR="$STATE_DIR/logs"
mkdir -p "$LOG_DIR"

log_info "启动后端开发服务器（端口 3001）..."
(cd "$BACKEND_DIR" && exec ./node_modules/.bin/tsx watch src/main.ts > "$LOG_DIR/backend.log" 2>&1) &
BACKEND_PID=$!

log_info "启动前端开发服务器（端口 5173）..."
(cd "$FRONTEND_DIR" && exec ./node_modules/.bin/vite --strictPort > "$LOG_DIR/frontend.log" 2>&1) &
FRONTEND_PID=$!

# ---- 仅清理本次脚本启动的进程 ----
CLEANED=false
cleanup() {
  local status=$?
  if [[ "$CLEANED" == true ]]; then
    return
  fi
  CLEANED=true
  trap - EXIT INT TERM
  echo ""
  log_info "正在停止本次启动的开发服务器..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  rm -f "$STATE_FILE"
  log_success "前后端进程已停止（Docker 容器仍在运行）"
  exit "$status"
}
trap cleanup EXIT INT TERM

# ---- 保存进程状态 ----
cat > "$STATE_FILE" <<EOF
{
  "startedAt": "$(date -Iseconds)",
  "repoRoot": "$REPO_ROOT",
  "composeFile": "$COMPOSE_FILE",
  "postgres": { "enabled": $([ "$SKIP_POSTGRES" == false ] && echo true || echo false), "container": "cqupt-src-local-postgres" },
  "redis":    { "enabled": $([ "$SKIP_REDIS" == false ]    && echo true || echo false), "container": "cqupt-src-local-redis" },
  "minio":    { "enabled": $([ "$SKIP_MINIO" == false ]    && echo true || echo false), "container": "cqupt-src-local-minio" },
  "backend":  { "pid": $BACKEND_PID,  "cwd": "$BACKEND_DIR",  "log": "$LOG_DIR/backend.log" },
  "frontend": { "pid": $FRONTEND_PID, "cwd": "$FRONTEND_DIR", "log": "$LOG_DIR/frontend.log" }
}
EOF

# ---- 等待服务就绪 ----
log_info "等待后端启动..."
BACKEND_READY=false
for i in $(seq 1 30); do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    log_error "后端进程已退出，请查看日志：$LOG_DIR/backend.log"
    exit 1
  fi
  if curl -sf http://localhost:3001/api/health &>/dev/null; then
    log_success "后端已就绪"
    BACKEND_READY=true
    break
  fi
  sleep 2
done
if [[ "$BACKEND_READY" == false ]]; then
  log_error "后端未在 60s 内响应，请查看日志：$LOG_DIR/backend.log"
  exit 1
fi

log_info "等待前端启动..."
FRONTEND_READY=false
for i in $(seq 1 30); do
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    log_error "前端进程已退出，请查看日志：$LOG_DIR/frontend.log"
    exit 1
  fi
  if curl -sf http://localhost:5173 &>/dev/null; then
    log_success "前端已就绪"
    FRONTEND_READY=true
    break
  fi
  sleep 1
done
if [[ "$FRONTEND_READY" == false ]]; then
  log_error "前端未在 30s 内响应，请查看日志：$LOG_DIR/frontend.log"
  exit 1
fi

echo ""
echo -e "${GREEN}=== 启动完成 ===${NC}"
echo ""
echo "  前端          http://localhost:5173"
echo "  后端 API      http://localhost:3001/api/health"
echo "  PostgreSQL    127.0.0.1:15432"
echo "  MinIO 控制台  http://localhost:9001  (minioadmin / minioadmin)"
echo ""
echo "  后端日志      $LOG_DIR/backend.log"
echo "  前端日志      $LOG_DIR/frontend.log"
echo ""
echo -e "${CYAN}演示账号：${NC}"
echo "  学生      2025001       /  123456+-"
echo "  审核员    0000001       /  auditor123456+-"
echo "  管理员    0000000       /  admin123456+-"
echo "  密码重置后为tmp+统一认证码"
echo -e "${CYAN}停止所有服务：${NC}"
echo "  bash stop-local.sh"
echo ""

log_info "按 Ctrl+C 停止前后端开发服务器（Docker 容器将继续运行）"
if wait -n "$BACKEND_PID" "$FRONTEND_PID"; then
  log_warn "开发服务器已退出"
else
  log_error "开发服务器异常退出，请检查日志"
  exit 1
fi
