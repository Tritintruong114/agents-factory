#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib-zalo-bridge.sh"

agent_id=""
bot_key=""
message="bridge health check"
while [ $# -gt 0 ]; do
  case "$1" in
    --agent) agent_id="${2:-}"; shift 2 ;;
    --bot-key) bot_key="${2:-}"; shift 2 ;;
    --message) message="${2:-}"; shift 2 ;;
    -h|--help) echo "Usage: test-agent-session.sh --agent <agent-id> --bot-key <bot-key> [--message text]"; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[ -n "$agent_id" ] || die "--agent is required"
[ -n "$bot_key" ] || die "--bot-key is required"
validate_bot_key "$bot_key"
require_cmd openclaw

openclaw agent \
  --agent "$agent_id" \
  --session-key "agent:$agent_id:zalo-bot:$bot_key:bridge-test" \
  --message "$message" \
  --json \
  --timeout 120
