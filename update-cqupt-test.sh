#!/usr/bin/env bash
set -e

PROJECT_DIR="/home/ubuntu/projcets/cqupt-src-test"
DEPLOY_DIR="$PROJECT_DIR/deploy/test"

echo "===== 获取 GitHub main 最新代码 ====="

cd "$PROJECT_DIR"

git fetch origin main
git switch main
git reset --hard origin/main

echo "当前代码版本："
git log -1 --oneline

echo
echo "===== 重新构建并启动服务 ====="

cd "$DEPLOY_DIR"

docker compose \
  -p cqupt-src-test \
  --env-file .env \
  -f docker-compose.test.yml \
  up -d --build --remove-orphans

echo
echo "===== 服务状态 ====="

docker compose \
  -p cqupt-src-test \
  --env-file .env \
  -f docker-compose.test.yml \
  ps

echo
echo "===== 更新完成 ====="
EOF