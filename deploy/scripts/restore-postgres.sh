#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/ubuntu/projcets/cqupt-src-test}"
DEPLOY_DIR="${DEPLOY_DIR:-$PROJECT_DIR/deploy/test}"
BACKUP_FILE="${BACKUP_FILE:?BACKUP_FILE is required}"
TARGET_DB="${TARGET_DB:-cqupt_src_restore_$(date +%Y%m%d)}"
CONFIRM_RESTORE="${CONFIRM_RESTORE:-}"
COMPOSE=(docker compose -p cqupt-src-test --env-file "$DEPLOY_DIR/.env" -f "$DEPLOY_DIR/docker-compose.test.yml")

[[ "$TARGET_DB" == *_restore_* || "${ALLOW_NON_ISOLATED_RESTORE:-0}" == '1' ]] || {
  printf 'Refusing non-isolated target database: %s\n' "$TARGET_DB" >&2
  exit 1
}
[[ "$CONFIRM_RESTORE" == "RESTORE:$TARGET_DB" ]] || {
  printf 'Set CONFIRM_RESTORE=RESTORE:%s to continue.\n' "$TARGET_DB" >&2
  exit 1
}
BACKUP_FILE="$BACKUP_FILE" "$PROJECT_DIR/deploy/scripts/verify-postgres-backup.sh"
"${COMPOSE[@]}" exec -T postgres sh -ceu 'dropdb -U "$POSTGRES_USER" --if-exists "$1"; createdb -U "$POSTGRES_USER" "$1"' sh "$TARGET_DB"
"${COMPOSE[@]}" exec -T postgres sh -ceu 'pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --no-privileges --exit-on-error' sh "$TARGET_DB" <"$BACKUP_FILE"
"${COMPOSE[@]}" exec -T postgres sh -ceu 'psql -U "$POSTGRES_USER" -d "$1" -v ON_ERROR_STOP=1 -c "SELECT 1"' sh "$TARGET_DB" >/dev/null
printf 'Restore rehearsal completed in isolated database: %s\n' "$TARGET_DB"
