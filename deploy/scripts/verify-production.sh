#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${BASE_URL:-https://test.cquptsrc.asia}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-15}"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-}"
failures=0

check() {
  local label="$1"
  shift
  if "$@"; then
    printf '[PASS] %s\n' "$label"
  else
    printf '[FAIL] %s\n' "$label" >&2
    failures=$((failures + 1))
  fi
}

http_ok() {
  curl --fail --silent --show-error --max-time "$TIMEOUT_SECONDS" "$1" >/dev/null
}

readiness_ok() {
  local payload
  payload="$(curl --fail --silent --show-error --max-time "$TIMEOUT_SECONDS" "$BASE_URL/api/health/ready")" || return 1
  node -e 'const value=JSON.parse(process.argv[1]); if (!value.ready) process.exit(1); console.log(`  readiness=${value.status}`)' "$payload"
}

websocket_ok() {
  local websocket_url
  websocket_url="${BASE_URL/https:/wss:}"
  websocket_url="${websocket_url/http:/ws:}/socket.io/?EIO=4&transport=websocket"
  VERIFY_WS_URL="$websocket_url" WS_TIMEOUT_MS="$((TIMEOUT_SECONDS * 1000))" node <<'NODE'
const socket = new WebSocket(process.env.VERIFY_WS_URL)
const timer = setTimeout(() => { socket.close(); process.exit(1) }, Number(process.env.WS_TIMEOUT_MS))
socket.addEventListener('open', () => { clearTimeout(timer); socket.close(); process.exit(0) })
socket.addEventListener('error', () => { clearTimeout(timer); process.exit(1) })
NODE
}

smtp_config_ok() {
  [[ -n "$DEPLOY_ENV_FILE" && -r "$DEPLOY_ENV_FILE" ]] || return 1
  local host port user pass from
  host="$(read_env SMTP_HOST "$DEPLOY_ENV_FILE")"
  port="$(read_env SMTP_PORT "$DEPLOY_ENV_FILE")"
  user="$(read_env SMTP_USER "$DEPLOY_ENV_FILE")"
  pass="$(read_env SMTP_PASS "$DEPLOY_ENV_FILE")"
  from="$(read_env SMTP_FROM "$DEPLOY_ENV_FILE")"
  [[ -n "$host" && -n "$port" && -n "$user" && -n "$pass" && -n "$from" ]] || return 1
  [[ "$host$user$pass" != *example* && "$pass" != replace-with-* ]] || return 1
  timeout 5 bash -c 'exec 3<>/dev/tcp/$1/$2' _ "$host" "$port" 2>/dev/null
}

read_env() {
  local key="$1" file="$2"
  awk -F= -v key="$key" '$1 == key { print substr($0, index($0, "=") + 1); exit }' "$file"
}

printf 'Production verification: %s\n' "$BASE_URL"
check 'Public web page' http_ok "$BASE_URL/"
check 'Backend liveness' http_ok "$BASE_URL/api/health/live"
check 'Backend dependency readiness' readiness_ok
check 'Socket.IO WebSocket upgrade' websocket_ok
check 'SMTP configuration and TCP reachability' smtp_config_ok

if (( failures > 0 )); then
  printf '%d production verification check(s) failed.\n' "$failures" >&2
  exit 1
fi
printf 'Production verification passed.\n'
