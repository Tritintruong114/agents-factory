#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=./lib-zalo-bridge.sh
. "$SCRIPT_DIR/lib-zalo-bridge.sh"

usage() {
  cat <<'USAGE'
Usage:
  install-zalo-bridge.sh --agent <agent-id> --bot-key <bot-key> --env <env-file> [--no-start]

Creates one isolated Zalo bridge instance:
  /home/node/.openclaw/bridges/zalo/zalo-<bot-key>-bridge.mjs
  /home/node/.openclaw/zalo-<bot-key>-bridge.pid
  /home/node/.openclaw/logs/zalo-<bot-key>-bridge.log
  /home/node/.openclaw/zalo-<bot-key>-bridge.offset.json
  /home/node/.openclaw/zalo-<bot-key>-bridge.undelivered.jsonl

Never put real tokens in git. Keep the env file private and chmod 600.
USAGE
}

agent_id=""
bot_key=""
env_file=""
start_after_install="true"

while [ $# -gt 0 ]; do
  case "$1" in
    --agent) agent_id="${2:-}"; shift 2 ;;
    --bot-key) bot_key="${2:-}"; shift 2 ;;
    --env) env_file="${2:-}"; shift 2 ;;
    --no-start) start_after_install="false"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[ -n "$agent_id" ] || die "--agent is required"
[ -n "$bot_key" ] || die "--bot-key is required"
[ -n "$env_file" ] || die "--env is required"
validate_bot_key "$bot_key"
require_cmd node
require_cmd openclaw

[ -f "$env_file" ] || die "env file not found: $env_file"
mode="$(stat -c '%a' "$env_file" 2>/dev/null || stat -f '%Lp' "$env_file")"
[ "$mode" = "600" ] || die "env file must be chmod 600: $env_file currently mode=$mode"

env_value() {
  local key="$1"
  grep -E "^${key}=" "$env_file" | tail -n 1 | sed -E "s/^${key}=//; s/^'//; s/'$//; s/^\"//; s/\"$//"
}

token="$(env_value ZALO_BOT_TOKEN || true)"
[ -n "$token" ] || die "ZALO_BOT_TOKEN missing in env"
printf '%s' "$token" | grep -q '[[:space:]]' && die "ZALO_BOT_TOKEN contains whitespace"
printf '%s' "$token" | grep -Eq '(<fill-me>|\.{3}|…)' && die "ZALO_BOT_TOKEN is placeholder or truncated"

existing_bot_key="$(env_value ZALO_BOT_KEY || true)"
existing_agent_id="$(env_value OPENCLAW_AGENT_ID || true)"

if [ -n "$existing_bot_key" ] && [ "$existing_bot_key" != "$bot_key" ]; then
  die "env ZALO_BOT_KEY=$existing_bot_key does not match --bot-key $bot_key"
fi
if [ -n "$existing_agent_id" ] && [ "$existing_agent_id" != "$agent_id" ]; then
  die "env OPENCLAW_AGENT_ID=$existing_agent_id does not match --agent $agent_id"
fi

if [ -z "$existing_bot_key" ]; then
  printf "\nZALO_BOT_KEY='%s'\n" "$bot_key" >>"$env_file"
fi
if [ -z "$existing_agent_id" ]; then
  printf "OPENCLAW_AGENT_ID='%s'\n" "$agent_id" >>"$env_file"
fi

if openclaw agents list --json >/tmp/openclaw-agents-list.json 2>/tmp/openclaw-agents-list.err; then
  grep -F "\"$agent_id\"" /tmp/openclaw-agents-list.json >/dev/null \
    || die "agent id not found in openclaw agents list: $agent_id"
else
  info "warning: could not verify agent id with 'openclaw agents list --json'"
fi

bridge_dir="$OPENCLAW_HOME/bridges/zalo"
logs_dir="$OPENCLAW_HOME/logs"
systemd_dir="$OPENCLAW_HOME/systemd"
bridge_file="$bridge_dir/zalo-$bot_key-bridge.mjs"
pid_file="$OPENCLAW_HOME/zalo-$bot_key-bridge.pid"
log_file="$logs_dir/zalo-$bot_key-bridge.log"
checkpoint_file="$OPENCLAW_HOME/zalo-$bot_key-bridge.offset.json"
undelivered_file="$OPENCLAW_HOME/zalo-$bot_key-bridge.undelivered.jsonl"
config_file="$(config_file_for "$bot_key")"
service_file="$systemd_dir/zalo-bridge-$bot_key.service"

mkdir -p "$bridge_dir" "$logs_dir" "$systemd_dir"
cp "$SKILL_DIR/templates/zalo-polling-bridge.mjs" "$bridge_file"
chmod 700 "$bridge_file"
node --check "$bridge_file" >/dev/null

cat >"$config_file" <<EOF
BOT_KEY='$bot_key'
AGENT_ID='$agent_id'
ENV_FILE='$env_file'
BRIDGE_FILE='$bridge_file'
PID_FILE='$pid_file'
LOG_FILE='$log_file'
CHECKPOINT_FILE='$checkpoint_file'
UNDELIVERED_FILE='$undelivered_file'
SERVICE_FILE='$service_file'
EOF
chmod 600 "$config_file"

sed \
  -e "s#__BOT_KEY__#$bot_key#g" \
  -e "s#__AGENT_ID__#$agent_id#g" \
  -e "s#__ENV_FILE__#$env_file#g" \
  -e "s#__BRIDGE_FILE__#$bridge_file#g" \
  -e "s#__CHECKPOINT_FILE__#$checkpoint_file#g" \
  -e "s#__UNDELIVERED_FILE__#$undelivered_file#g" \
  -e "s#__LOG_FILE__#$log_file#g" \
  "$SKILL_DIR/systemd/zalo-polling-bridge.service.template" >"$service_file"

info "installed bot=$bot_key agent=$agent_id"
info "bridge=$bridge_file"
info "env=$env_file"
info "pid=$pid_file"
info "log=$log_file"
info "undelivered=$undelivered_file"
info "service_template_rendered=$service_file"

if [ "$start_after_install" = "true" ]; then
  load_config "$bot_key"
  start_bridge_from_config
else
  info "not started because --no-start was provided"
fi
