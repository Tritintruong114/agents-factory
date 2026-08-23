#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib-zalo-bridge.sh"

bot_key=""
follow="false"
lines="80"
while [ $# -gt 0 ]; do
  case "$1" in
    --bot-key) bot_key="${2:-}"; shift 2 ;;
    -f|--follow) follow="true"; shift ;;
    -n|--lines) lines="${2:-}"; shift 2 ;;
    -h|--help) echo "Usage: zalo-bridge-logs.sh --bot-key <bot-key> [-n 80] [-f]"; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[ -n "$bot_key" ] || die "--bot-key is required"
validate_bot_key "$bot_key"
load_config "$bot_key"

[ -f "$LOG_FILE" ] || die "log file not found: $LOG_FILE"
if [ "$follow" = "true" ]; then
  tail -n "$lines" -f "$LOG_FILE"
else
  tail -n "$lines" "$LOG_FILE"
fi
