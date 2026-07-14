#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/ubuntu/projcets/cqupt-src-test}"
DEPLOY_DIR="$PROJECT_DIR/deploy/test"
DEPLOY_SCOPE="${DEPLOY_SCOPE:-}"
COMPOSE=(docker compose -p cqupt-src-test --env-file .env -f docker-compose.test.yml)

log() {
  printf '\n===== %s =====\n' "$1"
}

fail() {
  printf '错误: %s\n' "$1" >&2
  exit 1
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

[[ -d "$PROJECT_DIR" ]] || fail "项目目录不存在: $PROJECT_DIR"
[[ -f "$DEPLOY_DIR/docker-compose.test.yml" ]] || fail 'Compose 文件不存在。'
[[ -f "$DEPLOY_DIR/.env" ]] || fail '部署环境文件不存在。'

choose_scope

if [[ "$DEPLOY_SCOPE" != '6' ]]; then
  log '拉取 GitHub main'
  cd "$PROJECT_DIR"
  git fetch origin main
  git switch main
  git reset --hard origin/main
  git log -1 --oneline
fi

cd "$DEPLOY_DIR"
case "$DEPLOY_SCOPE" in
  1)
    log '构建并启动前端'
    "${COMPOSE[@]}" up -d --build --no-deps web
    apply_web_config
    ;;
  2)
    log '构建并启动后端'
    "${COMPOSE[@]}" up -d --build --no-deps backend
    ;;
  3)
    log '构建并启动后端'
    "${COMPOSE[@]}" up -d --build backend
    run_migrations
    ;;
  4)
    log '构建并启动前后端'
    "${COMPOSE[@]}" up -d --build --no-deps web backend
    apply_web_config
    ;;
  5)
    log '全量构建并启动服务'
    "${COMPOSE[@]}" up -d --build --remove-orphans
    run_migrations
    apply_web_config
    ;;
  6)
    log '重启前后端服务'
    "${COMPOSE[@]}" restart backend web
    ;;
  7)
    log '代码已更新，未构建或重启服务'
    ;;
esac

log '服务状态'
"${COMPOSE[@]}" ps

log '更新完成'
