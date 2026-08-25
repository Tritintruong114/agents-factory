#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib-zalo-bridge.sh
. "$SCRIPT_DIR/lib-zalo-bridge.sh"

usage() {
  cat <<'USAGE'
Usage:
  zalo-bridge-outbox.sh --bot-key <bot-key> [--limit <n>]

Shows pending and failed outbound Zalo reply jobs for one bridge.
USAGE
}

bot_key=""
limit="20"

while [ $# -gt 0 ]; do
  case "$1" in
    --bot-key) bot_key="${2:-}"; shift 2 ;;
    --limit) limit="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[ -n "$bot_key" ] || die "--bot-key is required"
validate_bot_key "$bot_key"
load_config "$bot_key"

node - "$OUTBOX_DIR" "$limit" <<'NODE'
const fs = require('fs');
const path = require('path');

const [outboxDir, limitRaw] = process.argv.slice(2);
const limit = Number(limitRaw || 20);

function readJobs(kind) {
  const dir = path.join(outboxDir, kind);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => name.endsWith('.json'))
    .sort()
    .map(name => {
      const file = path.join(dir, name);
      try {
        return { file, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
      } catch (error) {
        return { file, error: error.message };
      }
    });
}

for (const kind of ['pending', 'processing', 'failed']) {
  const jobs = readJobs(kind);
  console.log(`${kind}: ${jobs.length}`);
  for (const job of jobs.slice(0, limit)) {
    console.log(JSON.stringify({
      file: job.file,
      jobId: job.jobId,
      chatId: job.chatId,
      updateId: job.updateId || undefined,
      attempts: job.attempts,
      nextChunkIndex: job.nextChunkIndex,
      chunks: Array.isArray(job.chunks) ? job.chunks.length : undefined,
      nextAttemptAt: job.nextAttemptAt,
      failedAt: job.failedAt,
      lastError: job.lastError || job.error,
    }));
  }
}
NODE
