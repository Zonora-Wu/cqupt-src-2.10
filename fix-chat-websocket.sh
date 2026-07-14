#!/usr/bin/env bash
set -Eeuo pipefail

# Run on server with sudo. Override when Nginx or backend use different paths.
NGINX_CONF="${NGINX_CONF:-/etc/nginx/sites-available/test.cquptsrc.asia}"
BACKEND_UPSTREAM="${BACKEND_UPSTREAM:-http://127.0.0.1:3001}"
CHAT_SOCKET_URL="${CHAT_SOCKET_URL:-https://test.cquptsrc.asia}"

log() {
  printf '\n===== %s =====\n' "$1"
}

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

[[ "${EUID}" -eq 0 ]] || fail 'Run with sudo: sudo ./fix-chat-websocket.sh'
command -v nginx >/dev/null || fail 'nginx is not installed'
command -v curl >/dev/null || fail 'curl is not installed'
[[ -f "$NGINX_CONF" ]] || fail "Nginx config not found: $NGINX_CONF"

if grep -Fq 'location /socket.io/' "$NGINX_CONF"; then
  log 'Socket.IO proxy already exists'
else
  log 'Back up Nginx configuration'
  backup="${NGINX_CONF}.before-chat-websocket.$(date +%Y%m%d%H%M%S)"
  cp --preserve=mode,ownership,timestamps "$NGINX_CONF" "$backup"

  temp_file="$(mktemp)"
  trap 'rm -f "$temp_file"' EXIT

  # The deployed virtual-host file ends with the HTTPS server block closing brace.
  last_nonempty_line="$(awk 'NF { line = $0 } END { print line }' "$NGINX_CONF")"
  [[ "$last_nonempty_line" == '}' ]] || fail "Expected final server-block brace in: $NGINX_CONF"
  awk 'NF { last = NR } { lines[NR] = $0 } END { for (index = 1; index < last; index++) print lines[index] }' "$NGINX_CONF" > "$temp_file"
  cat >> "$temp_file" <<EOF

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

  cat "$temp_file" > "$NGINX_CONF"
  if ! nginx -t; then
    cp --preserve=mode,ownership,timestamps "$backup" "$NGINX_CONF"
    nginx -t || true
    fail "Nginx validation failed. Restored: $backup"
  fi
fi

log 'Reload Nginx'
systemctl reload nginx

log 'Check Socket.IO endpoint'
response="$(curl --fail --silent --show-error --http1.1 "${CHAT_SOCKET_URL%/}/socket.io/?EIO=4&transport=polling")"
[[ "$response" == *'"sid"'* ]] || fail 'Socket.IO response has no sid. Check BACKEND_UPSTREAM and backend service.'

printf '\nWebSocket proxy fixed. Run ./update-cqupt-test.sh next to deploy migration and restart backend.\n'
