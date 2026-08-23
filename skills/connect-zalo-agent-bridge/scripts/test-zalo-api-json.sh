#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib-zalo-bridge.sh"

env_file=""
while [ $# -gt 0 ]; do
  case "$1" in
    --env) env_file="${2:-}"; shift 2 ;;
    -h|--help) echo "Usage: test-zalo-api-json.sh --env <env-file>"; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[ -n "$env_file" ] || die "--env is required"
[ -f "$env_file" ] || die "env file not found: $env_file"
require_cmd node

node - "$env_file" <<'NODE'
const fs = require('node:fs');
const envFile = process.argv[2];
const raw = fs.readFileSync(envFile, 'utf8');
const match = raw.match(/^ZALO_BOT_TOKEN=(.*)$/m);
if (!match) throw new Error('ZALO_BOT_TOKEN missing');
let token = match[1].trim().replace(/^['"]|['"]$/g, '');
if (!token || token.includes('<fill-me>') || token.includes('...') || token.includes('…') || /\s/.test(token)) {
  throw new Error('ZALO_BOT_TOKEN is placeholder, truncated, or contains whitespace');
}
(async () => {
  const res = await fetch(`https://bot-api.zaloplatforms.com/bot${token}/getUpdates`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ timeout: '1' }),
  });
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  if (!contentType.includes('application/json')) {
    throw new Error(`getUpdates returned non-JSON status=${res.status} preview=${text.slice(0, 80)}`);
  }
  const json = JSON.parse(text);
  console.log(JSON.stringify({ ok: json.ok, error_code: json.error_code, hasResult: json.result != null }));
})().catch(error => {
  console.error(`error: ${error.message}`);
  process.exit(1);
});
NODE
