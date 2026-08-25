#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib-zalo-bridge.sh
. "$SCRIPT_DIR/lib-zalo-bridge.sh"

usage() {
  cat <<'USAGE'
Usage:
  zalo-bridge-replay-failed.sh --bot-key <bot-key> [--job-id <job-id>]

Moves failed outbound jobs back to pending. The running bridge worker will retry them.
USAGE
}

bot_key=""
job_id=""

while [ $# -gt 0 ]; do
  case "$1" in
    --bot-key) bot_key="${2:-}"; shift 2 ;;
    --job-id) job_id="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[ -n "$bot_key" ] || die "--bot-key is required"
validate_bot_key "$bot_key"
load_config "$bot_key"

node - "$OUTBOX_DIR" "$job_id" <<'NODE'
const fs = require('fs');
const path = require('path');

const [outboxDir, requestedJobId] = process.argv.slice(2);
const failedDir = path.join(outboxDir, 'failed');
const pendingDir = path.join(outboxDir, 'pending');
fs.mkdirSync(failedDir, { recursive: true });
fs.mkdirSync(pendingDir, { recursive: true });

function safeFilePart(value) {
  return String(value || 'unknown').replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80);
}

let moved = 0;
for (const name of fs.readdirSync(failedDir).filter(name => name.endsWith('.json')).sort()) {
  const source = path.join(failedDir, name);
  const job = JSON.parse(fs.readFileSync(source, 'utf8'));
  if (requestedJobId && job.jobId !== requestedJobId) continue;

  job.attempts = 0;
  job.lastError = undefined;
  job.lastStatus = undefined;
  job.lastResponseCode = undefined;
  job.lastPreview = undefined;
  job.failedAt = undefined;
  job.nextAttemptAt = new Date().toISOString();
  job.updatedAt = job.nextAttemptAt;

  const target = path.join(pendingDir, `${safeFilePart(job.jobId || name.slice(0, -5))}.json`);
  if (fs.existsSync(target)) throw new Error(`pending job already exists: ${target}`);
  fs.writeFileSync(`${target}.${process.pid}.tmp`, `${JSON.stringify(job, null, 2)}\n`);
  fs.renameSync(`${target}.${process.pid}.tmp`, target);
  fs.unlinkSync(source);
  moved++;
  console.log(`requeued ${job.jobId || name}`);
}

if (requestedJobId && moved === 0) {
  throw new Error(`failed job not found: ${requestedJobId}`);
}
console.log(`moved=${moved}`);
NODE
