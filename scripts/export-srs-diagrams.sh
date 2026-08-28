#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPEC_DIR="$ROOT/docs/assets/diagrams/specs"
OUTPUT_DIR="$ROOT/docs/assets/diagrams"
DRAWIO_BIN="${DRAWIO_BIN:-/home/cocking/.local/bin/drawio}"

"$ROOT/.venv/bin/python" "$ROOT/scripts/generate-srs-diagrams.py" >/dev/null

mapfile -t sources < <(
  find "$SPEC_DIR" -maxdepth 1 -type f \( \
    -name 'figure-3-2-*.drawio' -o \
    -name 'figure-4-[3-9]-*.drawio' -o \
    -name 'figure-4-1[0-7]-*.drawio' \
  \) | sort -V
)

if [[ ${#sources[@]} -ne 31 ]]; then
  printf 'Expected 31 generated draw.io files, found %s\n' "${#sources[@]}" >&2
  exit 1
fi

for source in "${sources[@]}"; do
  base="$(basename "$source" .drawio)"
  "$DRAWIO_BIN" --export --format svg --border 16 --svg-theme light --embed-diagram \
    --output "$OUTPUT_DIR/$base.svg" "$source" >/dev/null
  "$DRAWIO_BIN" --export --format png --border 24 --scale 1.5 \
    --output "$OUTPUT_DIR/$base.png" "$source" >/dev/null
  printf 'Exported %s\n' "$base"
done
