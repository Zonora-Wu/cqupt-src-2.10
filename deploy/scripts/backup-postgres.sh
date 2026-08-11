#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/ubuntu/projcets/cqupt-src-test}"
DEPLOY_DIR="${DEPLOY_DIR:-$PROJECT_DIR/deploy/test}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
COMPOSE=(docker compose -p cqupt-src-test --env-file "$DEPLOY_DIR/.env" -f "$DEPLOY_DIR/docker-compose.test.yml")
timestamp="$(date +%Y%m%d-%H%M%S)"
backup="$BACKUP_DIR/cqupt-src-$timestamp.dump"

mkdir -p "$BACKUP_DIR"
umask 077
"${COMPOSE[@]}" exec -T postgres sh -ceu 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges' >"$backup"
[[ -s "$backup" ]] || { printf 'Backup is empty.\n' >&2; exit 1; }
sha256sum "$backup" >"$backup.sha256"
BACKUP_FILE="$backup" "$PROJECT_DIR/deploy/scripts/verify-postgres-backup.sh"
find "$BACKUP_DIR" -type f \( -name '*.dump' -o -name '*.dump.sha256' \) -mtime "+$RETENTION_DAYS" -delete
printf 'Backup created: %s\n' "$backup"
