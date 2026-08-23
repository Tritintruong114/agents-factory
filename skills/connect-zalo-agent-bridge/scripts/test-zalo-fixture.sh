#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

fixture="${1:-$SKILL_DIR/fixtures/zalo-getupdates-message.json}"
node "$SKILL_DIR/templates/zalo-polling-bridge.mjs" --parse-fixture "$fixture"
