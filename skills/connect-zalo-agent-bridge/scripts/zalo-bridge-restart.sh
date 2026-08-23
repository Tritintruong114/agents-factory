#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib-zalo-bridge.sh"

bot_key=""
while [ $# -gt 0 ]; do
  case "$1" in
    --bot-key) bot_key="${2:-}"; shift 2 ;;
    -h|--help) echo "Usage: zalo-bridge-restart.sh --bot-key <bot-key>"; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[ -n "$bot_key" ] || die "--bot-key is required"
validate_bot_key "$bot_key"
load_config "$bot_key"

node --check "$BRIDGE_FILE" >/dev/null
stop_bridge_from_config
start_bridge_from_config
