#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/ubuntu/projcets/cqupt-src-test}"
DEPLOY_DIR="$PROJECT_DIR/deploy/test"
DEPLOY_SCOPE="${DEPLOY_SCOPE:-}"
LOW_RESOURCE_MODE="${LOW_RESOURCE_MODE:-auto}"
MIN_BUILD_DISK_MB="${MIN_BUILD_DISK_MB:-2048}"
CLAMAV_COMPOSE_FILE="$DEPLOY_DIR/docker-compose.clamav.yml"
COMPOSE=()
LOW_RESOURCE_ACTIVE=false
BUILD_SERVICES_STOPPED=false

log() {
  printf '\n===== %s =====\n' "$1"
}

fail() {
  printf '错误: %s\n' "$1" >&2
  exit 1
}

memory_mb() {
  local field="$1"
  awk -v field="$field" '$1 == field ":" { print int($2 / 1024); exit }' /proc/meminfo
}

check_build_resources() {
  local total_mb available_mb swap_mb disk_mb
  total_mb="$(memory_mb MemTotal)"
  available_mb="$(memory_mb MemAvailable)"
  swap_mb="$(memory_mb SwapTotal)"
  disk_mb="$(df -Pm "$PROJECT_DIR" | awk 'NR == 2 { print $4 }')"

  printf '主机资源：内存总量 %sMiB，可用 %sMiB，Swap %sMiB，磁盘可用 %sMiB\n' \
    "$total_mb" "$available_mb" "$swap_mb" "$disk_mb"

  [[ "$disk_mb" -ge "$MIN_BUILD_DISK_MB" ]] \
    || fail "磁盘可用空间不足 ${MIN_BUILD_DISK_MB}MiB，停止构建以避免 Docker 数据损坏。"

  case "$LOW_RESOURCE_MODE" in
    auto)
      if [[ "$total_mb" -lt 5120 || "$available_mb" -lt 1536 ]]; then
        LOW_RESOURCE_ACTIVE=true
      fi
      ;;
    on) LOW_RESOURCE_ACTIVE=true ;;
    off) LOW_RESOURCE_ACTIVE=false ;;
    *) fail 'LOW_RESOURCE_MODE 仅支持 auto、on、off。' ;;
  esac

  if [[ "$LOW_RESOURCE_ACTIVE" == true ]]; then
    export COMPOSE_PARALLEL_LIMIT=1
    log '已启用低资源构建模式'
    printf '将临时停止本项目后端与 ClamAV，前后端镜像串行构建，完成后自动恢复。\n'
    if [[ "$swap_mb" -eq 0 ]]; then
      printf '警告: 当前未配置 Swap；建议为低内存主机配置至少 2GiB Swap。\n' >&2
    fi
  fi
}

prepare_build_environment() {
  [[ "$LOW_RESOURCE_ACTIVE" == true ]] || return 0
  local available_mb swap_mb
  log '释放本项目构建所需内存'
  "${COMPOSE[@]}" stop backend clamav
  BUILD_SERVICES_STOPPED=true
  sleep 2
  available_mb="$(memory_mb MemAvailable)"
  swap_mb="$(memory_mb SwapTotal)"
  printf '释放后可用内存：%sMiB\n' "$available_mb"
  if [[ "$available_mb" -lt 512 && "$swap_mb" -eq 0 ]]; then
    fail '释放项目服务后可用内存仍不足 512MiB，且未配置 Swap；请停止其他高占用服务或配置 Swap 后重试。'
  fi
}

build_services() {
  if [[ "$LOW_RESOURCE_ACTIVE" == true ]]; then
    local service
    for service in "$@"; do
      log "构建 ${service} 镜像（串行）"
      "${COMPOSE[@]}" build "$service"
    done
    return
  fi
  "${COMPOSE[@]}" build "$@"
}

restore_services_after_failed_build() {
  local exit_code=$?
  trap - EXIT
  if [[ "$exit_code" -ne 0 && "$BUILD_SERVICES_STOPPED" == true && "${#COMPOSE[@]}" -gt 0 ]]; then
    set +e
    printf '\n更新失败，正在恢复原有后端与安全扫描服务...\n' >&2
    "${COMPOSE[@]}" up -d clamav
    "${COMPOSE[@]}" up -d --no-deps backend
  fi
  exit "$exit_code"
}

trap restore_services_after_failed_build EXIT

validate_ai_credential_key() {
  local env_file="$DEPLOY_DIR/.env"
  local raw
  raw="$(awk -F= '/^AI_CREDENTIAL_ENCRYPTION_KEY=/{print substr($0, index($0, "=") + 1); exit}' "$env_file")"
  [[ -n "$raw" ]] || fail "缺少 AI_CREDENTIAL_ENCRYPTION_KEY。执行: openssl rand -base64 32，然后写入 $env_file"

  if [[ "$raw" =~ ^[[:xdigit:]]{64}$ ]]; then
    return
  fi

  local decoded_bytes
  decoded_bytes="$(printf '%s' "$raw" | base64 -d 2>/dev/null | wc -c | tr -d ' ')"
  [[ "$decoded_bytes" == '32' ]] || fail 'AI_CREDENTIAL_ENCRYPTION_KEY 必须是 32 字节 Base64 或 64 位十六进制密钥。'
}

choose_scope() {
  if [[ -z "$DEPLOY_SCOPE" ]]; then
    printf '\n本次更新范围：\n'
    printf '  1) 仅前端\n'
    printf '  2) 仅后端\n'
    printf '  3) 后端 + 数据库迁移\n'
    printf '  4) 前端 + 后端\n'
    printf '  5) 前端 + 后端 + 数据库迁移（全量）\n'
    printf '  6) 仅重启前后端服务\n'
    printf '  7) 仅更新代码\n'
    printf '  0) 取消\n'
    read -r -p '选择 [0-7]: ' DEPLOY_SCOPE
  fi

  case "$DEPLOY_SCOPE" in
    1|2|3|4|5|6|7) ;;
    0) exit 0 ;;
    *) fail '请输入 0 到 7。' ;;
  esac
}

apply_web_config() {
  local fix_script="$PROJECT_DIR/fix-chat-websocket.sh"
  [[ -x "$fix_script" ]] || fail "缺少 web 容器配置脚本: $fix_script"
  PROJECT_DIR="$PROJECT_DIR" DEPLOY_DIR="$DEPLOY_DIR" CHECK_PUBLIC_ENDPOINT=0 "$fix_script"
}

run_migrations() {
  log '执行数据库迁移'
  "${COMPOSE[@]}" exec -T backend npm run prisma:migrate:deploy
}

configure_compose() {
  [[ -f "$CLAMAV_COMPOSE_FILE" ]] || fail "缺少安全扫描服务配置: $CLAMAV_COMPOSE_FILE"
  COMPOSE=(
    docker compose
    -p cqupt-src-test
    --env-file .env
    -f docker-compose.test.yml
    -f docker-compose.clamav.yml
  )
}

ensure_malware_scanner() {
  log '启动并检查安全扫描服务'
  local container_name='cqupt-src-test-clamav'
  local health_status

  "${COMPOSE[@]}" up -d clamav
  health_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_name" 2>/dev/null || true)"

  if [[ "$health_status" == 'unhealthy' ]]; then
    log '检测到安全扫描容器异常，保留病毒库数据并重建容器'
    "${COMPOSE[@]}" up -d --force-recreate clamav
  fi

  if ! "${COMPOSE[@]}" up -d --wait --wait-timeout 600 clamav; then
    printf '\nClamAV 容器状态：\n' >&2
    docker inspect \
      --format 'status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} oomKilled={{.State.OOMKilled}} exitCode={{.State.ExitCode}} error={{.State.Error}}' \
      "$container_name" >&2 || true
    printf '\nClamAV 最近健康检查：\n' >&2
    docker inspect \
      --format '{{if .State.Health}}{{range .State.Health.Log}}{{println .End "exit=" .ExitCode .Output}}{{end}}{{else}}无健康检查记录{{end}}' \
      "$container_name" >&2 || true
    printf '\nClamAV 最近日志：\n' >&2
    "${COMPOSE[@]}" logs --no-color --tail=120 clamav >&2 || true
    printf '\n主机内存：\n' >&2
    free -h >&2 || true
    printf '\n部署目录磁盘：\n' >&2
    df -h "$DEPLOY_DIR" >&2 || true
    fail '安全扫描服务未通过健康检查，请根据上方诊断信息处理。'
  fi
}

backend_uses_malware_scanner() {
  [[ "$("${COMPOSE[@]}" exec -T backend printenv CLAMAV_HOST 2>/dev/null || true)" == 'clamav' ]]
}

[[ -d "$PROJECT_DIR" ]] || fail "项目目录不存在: $PROJECT_DIR"
[[ -f "$DEPLOY_DIR/docker-compose.test.yml" ]] || fail 'Compose 文件不存在。'
[[ -f "$DEPLOY_DIR/.env" ]] || fail '部署环境文件不存在。'

choose_scope

if [[ "$DEPLOY_SCOPE" =~ ^(2|3|4|5|6)$ ]]; then
  validate_ai_credential_key
fi

if [[ "$DEPLOY_SCOPE" != '6' ]]; then
  log '拉取 GitHub main'
  cd "$PROJECT_DIR"
  git fetch origin main
  git switch main
  git reset --hard origin/main
  git log -1 --oneline
fi

cd "$DEPLOY_DIR"
configure_compose
if [[ "$DEPLOY_SCOPE" =~ ^(1|2|3|4|5)$ ]]; then
  check_build_resources
  prepare_build_environment
fi
case "$DEPLOY_SCOPE" in
  1)
    log '构建并启动前端'
    build_services web
    ensure_malware_scanner
    if [[ "$BUILD_SERVICES_STOPPED" == true ]] || ! backend_uses_malware_scanner; then
      log '恢复后端并应用安全扫描配置'
      "${COMPOSE[@]}" up -d --no-deps --force-recreate backend
    fi
    "${COMPOSE[@]}" up -d --no-build --no-deps web
    BUILD_SERVICES_STOPPED=false
    apply_web_config
    ;;
  2)
    log '构建并启动后端'
    build_services backend
    ensure_malware_scanner
    "${COMPOSE[@]}" up -d --no-build --no-deps backend
    BUILD_SERVICES_STOPPED=false
    ;;
  3)
    log '构建并启动后端'
    build_services backend
    ensure_malware_scanner
    "${COMPOSE[@]}" up -d --no-build backend
    BUILD_SERVICES_STOPPED=false
    run_migrations
    ;;
  4)
    log '构建并启动前后端'
    build_services backend web
    ensure_malware_scanner
    "${COMPOSE[@]}" up -d --no-build --no-deps backend web
    BUILD_SERVICES_STOPPED=false
    apply_web_config
    ;;
  5)
    log '全量构建并启动服务'
    build_services backend web
    ensure_malware_scanner
    "${COMPOSE[@]}" up -d --no-build --remove-orphans
    BUILD_SERVICES_STOPPED=false
    run_migrations
    apply_web_config
    ;;
  6)
    log '重启前后端服务'
    ensure_malware_scanner
    "${COMPOSE[@]}" up -d --no-deps --force-recreate backend web
    ;;
  7)
    log '代码已更新，未构建或重启服务'
    ;;
esac

log '服务状态'
"${COMPOSE[@]}" ps

if [[ "$DEPLOY_SCOPE" != '7' && "${VERIFY_DEPLOYMENT:-1}" == '1' ]]; then
  log '部署后验收'
  BASE_URL="${BASE_URL:-https://test.cquptsrc.asia}" \
    DEPLOY_ENV_FILE="$DEPLOY_DIR/.env" \
    "$PROJECT_DIR/deploy/scripts/verify-production.sh"
fi

log '更新完成'
