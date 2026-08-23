#!/usr/bin/env bash
set -euo pipefail

OPENCLAW_HOME="${OPENCLAW_HOME:-/home/node/.openclaw}"

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

info() {
  printf '%s\n' "$*"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

validate_bot_key() {
  printf '%s' "$1" | grep -Eq '^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$' \
    || die "--bot-key must be lowercase kebab-case"
}

config_file_for() {
  printf '%s/zalo-%s-bridge.config\n' "$OPENCLAW_HOME" "$1"
}

load_config() {
  local bot_key="$1"
  local cfg
  cfg="$(config_file_for "$bot_key")"
  [ -f "$cfg" ] || die "config not found for bot-key '$bot_key': $cfg"
  # shellcheck disable=SC1090
  . "$cfg"
  : "${BOT_KEY:?missing BOT_KEY in config}"
  : "${AGENT_ID:?missing AGENT_ID in config}"
  : "${ENV_FILE:?missing ENV_FILE in config}"
  : "${BRIDGE_FILE:?missing BRIDGE_FILE in config}"
  : "${PID_FILE:?missing PID_FILE in config}"
  : "${LOG_FILE:?missing LOG_FILE in config}"
  : "${CHECKPOINT_FILE:?missing CHECKPOINT_FILE in config}"
}

is_pid_running() {
  local pid="${1:-}"
  [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1
}

pid_from_file() {
  local pid_file="$1"
  [ -f "$pid_file" ] && sed -n '1p' "$pid_file" || true
}

start_bridge_from_config() {
  : "${ENV_FILE:?}"
  : "${BRIDGE_FILE:?}"
  : "${PID_FILE:?}"
  : "${LOG_FILE:?}"
  : "${CHECKPOINT_FILE:?}"

  local pid
  pid="$(pid_from_file "$PID_FILE")"
  if is_pid_running "$pid"; then
    die "bridge already running for $BOT_KEY pid=$pid"
  fi

  mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$PID_FILE")" "$(dirname "$CHECKPOINT_FILE")"
  nohup env \
    ZALO_BRIDGE_ENV_FILE="$ENV_FILE" \
    ZALO_CHECKPOINT_FILE="$CHECKPOINT_FILE" \
    node "$BRIDGE_FILE" >>"$LOG_FILE" 2>&1 &
  pid="$!"
  printf '%s\n' "$pid" >"$PID_FILE"
  info "started bot=$BOT_KEY agent=$AGENT_ID pid=$pid log=$LOG_FILE"
}

stop_bridge_from_config() {
  : "${PID_FILE:?}"
  local pid
  pid="$(pid_from_file "$PID_FILE")"
  if ! is_pid_running "$pid"; then
    info "not running bot=$BOT_KEY"
    return 0
  fi
  kill "$pid"
  for _ in $(seq 1 20); do
    if ! is_pid_running "$pid"; then
      info "stopped bot=$BOT_KEY pid=$pid"
      return 0
    fi
    sleep 0.25
  done
  kill -9 "$pid" >/dev/null 2>&1 || true
  info "force-stopped bot=$BOT_KEY pid=$pid"
}
