#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/ubuntu/projcets/cqupt-src-test}"
DEPLOY_DIR="${DEPLOY_DIR:-$PROJECT_DIR/deploy/test}"
BACKUP_FILE="${BACKUP_FILE:?BACKUP_FILE is required}"
COMPOSE=(docker compose -p cqupt-src-test --env-file "$DEPLOY_DIR/.env" -f "$DEPLOY_DIR/docker-compose.test.yml")

[[ -s "$BACKUP_FILE" ]] || { printf 'Backup file is missing or empty.\n' >&2; exit 1; }
[[ -s "$BACKUP_FILE.sha256" ]] || { printf 'Backup checksum is missing.\n' >&2; exit 1; }
(cd "$(dirname "$BACKUP_FILE")" && sha256sum --check "$(basename "$BACKUP_FILE").sha256")
"${COMPOSE[@]}" exec -T postgres pg_restore --list <"$BACKUP_FILE" >/dev/null
printf 'Backup archive verified: %s\n' "$BACKUP_FILE"
