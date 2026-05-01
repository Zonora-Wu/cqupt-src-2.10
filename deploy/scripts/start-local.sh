#!/usr/bin/env bash
# CQUPT-SRC 本地开发环境一键启动脚本（Linux / WSL / macOS）
# 用法：bash deploy/scripts/start-local.sh [选项]
#
# 选项：
#   --skip-postgres   跳过启动 PostgreSQL 容器
#   --skip-minio      跳过启动 MinIO 容器
#   --skip-db-init    跳过数据库迁移和 seed
#   --skip-redis      跳过启动 Redis 容器

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
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
      echo "用法: bash deploy/scripts/start-local.sh [--skip-postgres] [--skip-minio] [--skip-redis] [--skip-db-init]"
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
for cmd in docker node npm; do
  if ! command -v "$cmd" &>/dev/null; then
    log_error "$cmd 未安装，请先安装后再运行此脚本"
    exit 1
  fi
done

mkdir -p "$STATE_DIR"

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

log_info "启动后端开发服务器（端口 3000）..."
(cd "$BACKEND_DIR" && npm run dev > "$LOG_DIR/backend.log" 2>&1) &
BACKEND_PID=$!

log_info "启动前端开发服务器（端口 5173）..."
(cd "$FRONTEND_DIR" && npm run dev > "$LOG_DIR/frontend.log" 2>&1) &
FRONTEND_PID=$!

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
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000/api/health &>/dev/null; then
    log_success "后端已就绪"
    break
  fi
  if [[ $i -eq 30 ]]; then
    log_warn "后端未在 60s 内响应，请查看日志：$LOG_DIR/backend.log"
  fi
  sleep 2
done

echo ""
echo -e "${GREEN}=== 启动完成 ===${NC}"
echo ""
echo "  前端          http://localhost:5173"
echo "  后端 API      http://localhost:3000/api/health"
echo "  PostgreSQL    127.0.0.1:15432"
echo "  MinIO 控制台  http://localhost:9001  (minioadmin / minioadmin)"
echo ""
echo "  后端日志      $LOG_DIR/backend.log"
echo "  前端日志      $LOG_DIR/frontend.log"
echo ""
echo -e "${CYAN}演示账号：${NC}"
echo "  学生      2025001@stu.cqupt.edu.cn  /  123456+-"
echo "  审核员    0000001@cqupt.edu.cn       /  auditor123456+-"
echo "  管理员    0000000@cqupt.edu.cn       /  admin123456+-"
echo "  验证码    123456（开发环境固定值）"
echo ""
echo -e "${CYAN}停止所有服务：${NC}"
echo "  bash deploy/scripts/stop-local.sh"
echo ""

# ---- 保持前台运行，Ctrl+C 时自动清理 ----
cleanup() {
  echo ""
  log_info "正在停止开发服务器..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  log_success "前后端进程已停止（Docker 容器仍在运行）"
  exit 0
}
trap cleanup INT TERM

log_info "按 Ctrl+C 停止前后端开发服务器（Docker 容器将继续运行）"
wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
