#!/usr/bin/env bash
set -euo pipefail

TEMPLATE_DIR="${1:-}"
OUT="${2:-}"
CHROME_BIN="${CHROME_BIN:-chromium}"

if [[ -z "$TEMPLATE_DIR" ]]; then
  TEMPLATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../templates/linkedin-single-image" && pwd)"
else
  TEMPLATE_DIR="$(cd "$TEMPLATE_DIR" && pwd)"
fi

if [[ -z "$OUT" ]]; then
  OUT="$TEMPLATE_DIR/export/linkedin-post.png"
fi

mkdir -p "$(dirname "$OUT")"

"$CHROME_BIN" \
  --headless \
  --no-sandbox \
  --disable-gpu \
  --allow-file-access-from-files \
  --hide-scrollbars \
  --run-all-compositor-stages-before-draw \
  --virtual-time-budget=1200 \
  --window-size=1080,1080 \
  --screenshot="$OUT" \
  "file://$TEMPLATE_DIR/index.html" >/dev/null 2>&1

echo "exported $OUT"
