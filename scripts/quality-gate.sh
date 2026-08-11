#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run() {
  printf '\n===== %s =====\n' "$1"
  shift
  "$@"
}

run 'Frontend lint' npm --prefix "$ROOT_DIR/frontend" run lint -- --max-warnings=0
run 'Frontend production build' npm --prefix "$ROOT_DIR/frontend" run build
run 'Frontend bundle budget' npm --prefix "$ROOT_DIR/frontend" run test:performance-budget
run 'Backend typecheck' npm --prefix "$ROOT_DIR/backend" run typecheck
run 'Backend production build' npm --prefix "$ROOT_DIR/backend" run build

printf '\n===== Backend unit tests =====\n'
(
  cd "$ROOT_DIR/backend"
  node --import tsx --test test/*.test.ts
)

run 'Prisma schema validation' npm --prefix "$ROOT_DIR/backend" run prisma:validate
run 'Whitespace validation' git -C "$ROOT_DIR" diff --check

printf '\nAll quality gates passed.\n'
