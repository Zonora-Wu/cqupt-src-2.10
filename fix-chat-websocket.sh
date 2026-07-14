#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/ubuntu/projcets/cqupt-src-test}"
DEPLOY_DIR="${DEPLOY_DIR:-$PROJECT_DIR/deploy/test}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.test.yml}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-cqupt-src-test}"
WEB_SERVICE="${WEB_SERVICE:-web}"
NGINX_CONF="${NGINX_CONF:-/etc/nginx/conf.d/default.conf}"
BACKEND_UPSTREAM="${BACKEND_UPSTREAM:-http://backend:3000}"
CHAT_SOCKET_URL="${CHAT_SOCKET_URL:-https://test.cquptsrc.asia}"
CHECK_PUBLIC_ENDPOINT="${CHECK_PUBLIC_ENDPOINT:-1}"

log() {
  printf '\n===== %s =====\n' "$1"
}

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

command -v docker >/dev/null || fail 'docker is not installed'
if [[ "$CHECK_PUBLIC_ENDPOINT" == '1' ]]; then
  command -v curl >/dev/null || fail 'curl is not installed'
fi
[[ -f "$DEPLOY_DIR/$COMPOSE_FILE" ]] || fail "Compose file not found: $DEPLOY_DIR/$COMPOSE_FILE"
[[ -f "$DEPLOY_DIR/.env" ]] || fail "Environment file not found: $DEPLOY_DIR/.env"

cd "$DEPLOY_DIR"
COMPOSE=(docker compose -p "$COMPOSE_PROJECT" --env-file .env -f "$COMPOSE_FILE")
WEB_CONTAINER="$("${COMPOSE[@]}" ps -q "$WEB_SERVICE")"
[[ -n "$WEB_CONTAINER" ]] || fail "Web service is not running: $WEB_SERVICE"

"${COMPOSE[@]}" exec -T "$WEB_SERVICE" test -f "$NGINX_CONF" || fail "Nginx config not found in container: $NGINX_CONF"

if "${COMPOSE[@]}" exec -T "$WEB_SERVICE" grep -Fq 'location /socket.io/' "$NGINX_CONF"; then
  log 'Socket.IO proxy already exists in web container'
else
  log 'Add Socket.IO proxy to web container'
  temp_dir="$(mktemp -d)"
  original="$temp_dir/default.conf.original"
  updated="$temp_dir/default.conf.updated"
  trap 'rm -rf "$temp_dir"' EXIT

  docker cp "$WEB_CONTAINER:$NGINX_CONF" "$original"
  last_nonempty_line="$(awk 'NF { line = $0 } END { print line }' "$original")"
  [[ "$last_nonempty_line" == '}' ]] || fail "Expected final server-block brace in: $NGINX_CONF"

  awk 'NF { last = NR } { lines[NR] = $0 } END { for (index = 1; index < last; index++) print lines[index] }' "$original" > "$updated"
  cat >> "$updated" <<EOF

    location /socket.io/ {
        proxy_pass ${BACKEND_UPSTREAM};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
    }
}
EOF

  docker cp "$updated" "$WEB_CONTAINER:$NGINX_CONF"
  if ! "${COMPOSE[@]}" exec -T "$WEB_SERVICE" nginx -t; then
    docker cp "$original" "$WEB_CONTAINER:$NGINX_CONF"
    "${COMPOSE[@]}" exec -T "$WEB_SERVICE" nginx -t || true
    fail 'Nginx validation failed. Original container configuration restored.'
  fi
fi

log 'Reload web-container Nginx'
"${COMPOSE[@]}" exec -T "$WEB_SERVICE" nginx -s reload

if [[ "$CHECK_PUBLIC_ENDPOINT" == '1' ]]; then
  log 'Check public Socket.IO endpoint'
  if response="$(curl --fail --silent --show-error --http1.1 "${CHAT_SOCKET_URL%/}/socket.io/?EIO=4&transport=polling")"; then
    [[ "$response" == *'"sid"'* ]] || fail 'Public Socket.IO response has no sid.'
    printf 'Public Socket.IO endpoint is reachable.\n'
  else
    printf 'WARNING: web container fixed, but public endpoint still fails. Configure WebSocket Upgrade in proxy_net HTTPS proxy.\n' >&2
  fi
fi

printf '\nWeb-container Socket.IO proxy complete. Run ./update-cqupt-test.sh after code updates; it reapplies this fix after container recreation.\n'
