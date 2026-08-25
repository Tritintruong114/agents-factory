#!/usr/bin/env node
/**
 * Generic Zalo Bot polling bridge for OpenClaw agents.
 *
 * Runtime model:
 *   one Zalo bot token -> one OpenClaw agent -> one bridge process
 *
 * Usage:
 *   ZALO_BRIDGE_ENV_FILE=/path/to/zalo-bot.env node templates/zalo-polling-bridge.mjs
 *   node templates/zalo-polling-bridge.mjs --env /path/to/zalo-bot.env
 *
 * Parser fixture test, no Zalo/API send:
 *   node templates/zalo-polling-bridge.mjs --parse-fixture fixtures/zalo-getupdates-message.json
 */
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function parseEnvValue(value) {
  const trimmed = String(value ?? '').trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvFile(path) {
  const raw = fs.readFileSync(path, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    if (process.env[match[1]] == null) process.env[match[1]] = parseEnvValue(match[2]);
  }
}

function pick(update) {
  const message = update.message ?? update.edited_message ?? update.event?.message ?? update;
  const chatId = message.chat?.id ?? message.chat_id ?? message.conversation?.id ?? update.chat_id;
  const text = message.text ?? message.message?.text ?? message.content?.text ?? '';
  const from = message.from?.id ?? message.sender?.id ?? message.user?.id ?? 'unknown';
  return {
    chatId: chatId ? String(chatId) : '',
    text: String(text || '').trim(),
    from: String(from),
  };
}

function updateId(update) {
  const id = update.update_id ?? update.id ?? update.event?.update_id ?? update.message?.update_id;
  return id == null ? '' : String(id);
}

function asUpdates(payload) {
  const result = payload?.result ?? payload;
  return Array.isArray(result) ? result : [result].filter(Boolean);
}

const fixturePath = arg('--parse-fixture');
if (fixturePath) {
  const payload = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  for (const update of asUpdates(payload)) {
    const picked = pick(update);
    console.log(JSON.stringify({ updateId: updateId(update), ...picked }));
  }
  process.exit(0);
}

const envFile = arg('--env') || process.env.ZALO_BRIDGE_ENV_FILE;
if (envFile) loadEnvFile(envFile);

const token = process.env.ZALO_BOT_TOKEN;
const agentId = process.env.OPENCLAW_AGENT_ID;
const botKey = process.env.ZALO_BOT_KEY || agentId || 'zalo';
const label = process.env.ZALO_BRIDGE_LABEL || botKey;
const pollTimeout = Number(process.env.ZALO_POLL_TIMEOUT_SECONDS || 30);
const apiTimeout = Number(process.env.ZALO_API_TIMEOUT_SECONDS || pollTimeout + 15);
const sendTimeout = Number(process.env.ZALO_SEND_TIMEOUT_SECONDS || 15);
const sendAttempts = Number(process.env.ZALO_SEND_ATTEMPTS || 3);
const outboxDir = process.env.ZALO_OUTBOX_DIR || '';
const outboxMaxAttempts = Number(process.env.ZALO_OUTBOX_MAX_ATTEMPTS || 20);
const outboxRetryBaseSeconds = Number(process.env.ZALO_OUTBOX_RETRY_BASE_SECONDS || 30);
const outboxRetryMaxSeconds = Number(process.env.ZALO_OUTBOX_RETRY_MAX_SECONDS || 300);
const outboxIdleSeconds = Number(process.env.ZALO_OUTBOX_IDLE_SECONDS || 5);
const agentTimeout = Number(process.env.OPENCLAW_AGENT_TIMEOUT_SECONDS || 120);
const chunkLimit = Number(process.env.ZALO_REPLY_CHUNK_LIMIT || 2000);
const checkpointFile = process.env.ZALO_CHECKPOINT_FILE || '';
const undeliveredFile = process.env.ZALO_UNDELIVERED_FILE || '';
const requireMention = /^(1|true|yes)$/i.test(process.env.ZALO_REQUIRE_MENTION || '');
const mentionTriggers = (process.env.ZALO_MENTION_TRIGGERS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function log(level, event, fields = {}) {
  const entry = { ts: new Date().toISOString(), level, label, botKey, agentId, event, ...fields };
  const line = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

function requireValue(name, value) {
  if (!value) throw new Error(`${name} missing`);
  if (value.includes('...') || value.includes('…') || value.includes('<fill-me>')) {
    throw new Error(`${name} is placeholder or truncated`);
  }
  if (value !== value.trim()) throw new Error(`${name} has leading/trailing whitespace`);
}

requireValue('ZALO_BOT_TOKEN', token);
requireValue('OPENCLAW_AGENT_ID', agentId);
requireValue('ZALO_BOT_KEY', botKey);
for (const [name, value] of [
  ['ZALO_POLL_TIMEOUT_SECONDS', pollTimeout],
  ['ZALO_API_TIMEOUT_SECONDS', apiTimeout],
  ['ZALO_SEND_TIMEOUT_SECONDS', sendTimeout],
  ['ZALO_SEND_ATTEMPTS', sendAttempts],
  ['ZALO_OUTBOX_MAX_ATTEMPTS', outboxMaxAttempts],
  ['ZALO_OUTBOX_RETRY_BASE_SECONDS', outboxRetryBaseSeconds],
  ['ZALO_OUTBOX_RETRY_MAX_SECONDS', outboxRetryMaxSeconds],
  ['ZALO_OUTBOX_IDLE_SECONDS', outboxIdleSeconds],
  ['OPENCLAW_AGENT_TIMEOUT_SECONDS', agentTimeout],
  ['ZALO_REPLY_CHUNK_LIMIT', chunkLimit],
]) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
}
if (requireMention && mentionTriggers.length === 0) {
  throw new Error('ZALO_REQUIRE_MENTION is enabled but ZALO_MENTION_TRIGGERS is empty');
}

const base = `https://bot-api.zaloplatforms.com/bot${token}`;
const inFlight = new Set();
let outboxDrainRunning = false;
let outboxDrainRequested = false;
let lastUpdateId = loadCheckpoint();

function loadCheckpoint() {
  if (!checkpointFile || !fs.existsSync(checkpointFile)) return '';
  try {
    const parsed = JSON.parse(fs.readFileSync(checkpointFile, 'utf8'));
    return parsed.lastUpdateId == null ? '' : String(parsed.lastUpdateId);
  } catch (error) {
    log('warn', 'checkpoint_read_failed', { error: error.message });
    return '';
  }
}

function saveCheckpoint(id) {
  if (!checkpointFile || !id) return;
  const tmp = `${checkpointFile}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify({ lastUpdateId: String(id), updatedAt: new Date().toISOString() }, null, 2)}\n`);
  fs.renameSync(tmp, checkpointFile);
  lastUpdateId = String(id);
}

function compareIds(a, b) {
  if (!a || !b) return 1;
  const ai = Number(a);
  const bi = Number(b);
  if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi;
  return String(a).localeCompare(String(b));
}

async function api(method, body) {
  const controller = new AbortController();
  const timeoutMs = (method === 'sendMessage' ? sendTimeout : apiTimeout) * 1000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    if (!contentType.includes('application/json')) {
      const error = new Error(`Zalo ${method} returned non-JSON`);
      error.status = res.status;
      error.preview = text.slice(0, 120);
      throw error;
    }
    try {
      const json = JSON.parse(text);
      if (!res.ok) {
        const error = new Error(`Zalo ${method} HTTP ${res.status}`);
        error.status = res.status;
        error.response = json;
        throw error;
      }
      return json;
    } catch (error) {
      if (error.status) throw error;
      const parseError = new Error(`Zalo ${method} invalid JSON`);
      parseError.status = res.status;
      parseError.preview = text.slice(0, 120);
      throw parseError;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`Zalo ${method} timed out after ${timeoutMs}ms`);
      timeoutError.status = 'timeout';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function shouldHandle(text) {
  if (!requireMention) return true;
  return mentionTriggers.some(trigger => text.includes(trigger));
}

function extractJsonObjects(raw) {
  const objects = [];
  for (let start = 0; start < raw.length; start++) {
    if (raw[start] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let end = start; end < raw.length; end++) {
      const char = raw[end];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) {
          objects.push(raw.slice(start, end + 1));
          start = end;
          break;
        }
      }
    }
  }
  return objects;
}

function agentAnswer(raw) {
  for (const candidate of extractJsonObjects(raw).reverse()) {
    try {
      const json = JSON.parse(candidate);
      if (!json.runId) continue;
      return json.result?.payloads?.map(p => p.text).filter(Boolean).join('\n') || '';
    } catch {
      // Try the next candidate.
    }
  }
  log('warn', 'agent_json_parse_failed');
  return '';
}

function chunkReply(reply) {
  const chunks = [];
  let rest = reply.trim();
  while (rest.length > chunkLimit) {
    let cut = Math.max(
      rest.lastIndexOf('\n', chunkLimit),
      rest.lastIndexOf('. ', chunkLimit) + 1,
      rest.lastIndexOf(' ', chunkLimit),
    );
    if (cut < 1) cut = chunkLimit;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function retryDelayMs(attempt) {
  return Math.min(10000, 1000 * 2 ** Math.max(0, attempt - 1));
}

function outboxBackoffMs(attempt) {
  const seconds = Math.min(outboxRetryMaxSeconds, outboxRetryBaseSeconds * 2 ** Math.max(0, attempt - 1));
  return seconds * 1000;
}

function recordUndelivered(fields) {
  if (!undeliveredFile) return;
  const dir = undeliveredFile.slice(0, undeliveredFile.lastIndexOf('/'));
  if (dir) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(undeliveredFile, `${JSON.stringify({ ts: new Date().toISOString(), ...fields })}\n`);
}

function outboxPath(name) {
  return `${outboxDir}/${name}`;
}

function ensureOutbox() {
  if (!outboxDir) return false;
  fs.mkdirSync(outboxPath('pending'), { recursive: true });
  fs.mkdirSync(outboxPath('processing'), { recursive: true });
  fs.mkdirSync(outboxPath('failed'), { recursive: true });
  return true;
}

function safeFilePart(value) {
  return String(value || 'unknown').replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80);
}

function outboxJobPath(jobId) {
  return outboxPath(`pending/${safeFilePart(jobId)}.json`);
}

function failedJobPath(jobId) {
  return outboxPath(`failed/${safeFilePart(jobId)}.json`);
}

function writeJsonAtomic(path, data) {
  const tmp = `${path}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(tmp, path);
}

function readJsonFile(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function enqueueOutboxReply({ chatId, updateId: updateIdValue, chunks, replyChars }) {
  if (!ensureOutbox()) return '';
  const jobId = updateIdValue
    ? `${botKey}-${chatId}-${updateIdValue}`
    : `${botKey}-${chatId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path = outboxJobPath(jobId);
  if (fs.existsSync(path)) {
    log('warn', 'outbox_duplicate_skipped', { chatId, updateId: updateIdValue || undefined, jobId });
    return jobId;
  }
  const now = new Date().toISOString();
  writeJsonAtomic(path, {
    version: 1,
    jobId,
    botKey,
    agentId,
    chatId,
    updateId: updateIdValue || '',
    chunks,
    replyChars,
    nextChunkIndex: 0,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    nextAttemptAt: now,
  });
  log('info', 'outbox_enqueued', { chatId, updateId: updateIdValue || undefined, jobId, chunks: chunks.length, chars: replyChars });
  requestOutboxDrain();
  return jobId;
}

function listPendingOutboxFiles() {
  if (!ensureOutbox()) return [];
  return fs.readdirSync(outboxPath('pending'))
    .filter(name => name.endsWith('.json'))
    .sort()
    .map(name => outboxPath(`pending/${name}`));
}

function claimOutboxFile(file) {
  const name = file.slice(file.lastIndexOf('/') + 1);
  const claimed = outboxPath(`processing/${process.pid}-${Date.now()}-${name}`);
  try {
    fs.renameSync(file, claimed);
    return claimed;
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

function recoverProcessingOutboxJobs() {
  if (!ensureOutbox()) return;
  for (const name of fs.readdirSync(outboxPath('processing')).filter(name => name.endsWith('.json')).sort()) {
    const source = outboxPath(`processing/${name}`);
    const recoveredName = name.replace(/^\d+-\d+-/, '');
    const target = outboxPath(`pending/${recoveredName}`);
    if (fs.existsSync(target)) {
      log('warn', 'outbox_recovery_skipped_duplicate', { source, target });
      continue;
    }
    fs.renameSync(source, target);
    log('warn', 'outbox_recovered_processing_job', { source, target });
  }
}

function pendingPathForProcessingFile(file, job = {}) {
  const name = file.slice(file.lastIndexOf('/') + 1).replace(/^\d+-\d+-/, '').replace(/\.json$/, '');
  return outboxJobPath(job.jobId || name);
}

function releaseOutboxToPending(file, job) {
  const target = pendingPathForProcessingFile(file, job);
  if (target === file) {
    writeJsonAtomic(file, job);
    return;
  }
  if (fs.existsSync(target)) {
    log('warn', 'outbox_release_skipped_duplicate', { file, target, jobId: job.jobId });
    return;
  }
  writeJsonAtomic(target, job);
  fs.unlinkSync(file);
}

function moveOutboxToFailed(file, job) {
  const failed = failedJobPath(job.jobId || file.slice(file.lastIndexOf('/') + 1, -5));
  writeJsonAtomic(failed, job);
  fs.unlinkSync(file);
}

async function sendReplyChunk(chatId, text, index, total, updateIdValue) {
  let lastError;
  for (let attempt = 1; attempt <= sendAttempts; attempt++) {
    try {
      const sent = await api('sendMessage', { chat_id: chatId, text });
      if (!sent.ok) throw new Error(`sendMessage returned ok=false: ${JSON.stringify(sent)}`);
      return sent;
    } catch (error) {
      lastError = error;
      log('warn', 'send_attempt_failed', {
        chatId,
        updateId: updateIdValue || undefined,
        chunk: index + 1,
        chunks: total,
        attempt,
        error: error.message,
        status: error.status || undefined,
        responseCode: error.response?.error_code,
        preview: error.preview,
      });
      if (attempt < sendAttempts) await sleep(retryDelayMs(attempt));
    }
  }
  recordUndelivered({
    chatId,
    updateId: updateIdValue || undefined,
    chunk: index + 1,
    chunks: total,
    chars: text.length,
    text,
    error: lastError?.message,
  });
  throw lastError;
}

async function deliverOutboxJob(file) {
  const job = readJsonFile(file);
  const due = Date.parse(job.nextAttemptAt || '');
  if (Number.isFinite(due) && due > Date.now()) {
    releaseOutboxToPending(file, job);
    return false;
  }

  job.attempts = Number(job.attempts || 0) + 1;
  job.updatedAt = new Date().toISOString();
  writeJsonAtomic(file, job);

  try {
    const chunks = Array.isArray(job.chunks) ? job.chunks : [];
    for (let i = Number(job.nextChunkIndex || 0); i < chunks.length; i++) {
      await sendReplyChunk(job.chatId, chunks[i], i, chunks.length, job.updateId);
      job.nextChunkIndex = i + 1;
      job.updatedAt = new Date().toISOString();
      writeJsonAtomic(file, job);
    }
    fs.unlinkSync(file);
    log('info', 'reply_sent', {
      chatId: job.chatId,
      updateId: job.updateId || undefined,
      jobId: job.jobId,
      chunks: chunks.length,
      chars: job.replyChars,
      outboxAttempts: job.attempts,
    });
    return true;
  } catch (error) {
    job.lastError = error.message;
    job.lastStatus = error.status || undefined;
    job.lastResponseCode = error.response?.error_code;
    job.lastPreview = error.preview;
    job.updatedAt = new Date().toISOString();

    if (job.attempts >= outboxMaxAttempts) {
      job.failedAt = job.updatedAt;
      moveOutboxToFailed(file, job);
      recordUndelivered({
        chatId: job.chatId,
        updateId: job.updateId || undefined,
        jobId: job.jobId,
        chunks: Array.isArray(job.chunks) ? job.chunks.length : undefined,
        nextChunkIndex: job.nextChunkIndex,
        chars: job.replyChars,
        attempts: job.attempts,
        error: error.message,
      });
      log('error', 'outbox_delivery_failed_permanently', {
        chatId: job.chatId,
        updateId: job.updateId || undefined,
        jobId: job.jobId,
        attempts: job.attempts,
        error: error.message,
      });
    } else {
      job.nextAttemptAt = new Date(Date.now() + outboxBackoffMs(job.attempts)).toISOString();
      releaseOutboxToPending(file, job);
      log('warn', 'outbox_delivery_deferred', {
        chatId: job.chatId,
        updateId: job.updateId || undefined,
        jobId: job.jobId,
        attempts: job.attempts,
        nextAttemptAt: job.nextAttemptAt,
        error: error.message,
      });
    }
    return false;
  }
}

async function drainOutboxOnce() {
  if (!outboxDir) return;
  for (const file of listPendingOutboxFiles()) {
    const claimed = claimOutboxFile(file);
    if (!claimed) continue;
    try {
      await deliverOutboxJob(claimed);
    } catch (error) {
      log('error', 'outbox_job_read_failed', { file: claimed, error: error.message });
    }
  }
}

function requestOutboxDrain() {
  if (!outboxDir) return;
  outboxDrainRequested = true;
}

async function outboxWorker() {
  if (!outboxDir || outboxDrainRunning) return;
  outboxDrainRunning = true;
  log('info', 'outbox_worker_started', { outboxDir, outboxMaxAttempts });
  recoverProcessingOutboxJobs();
  for (;;) {
    outboxDrainRequested = false;
    await drainOutboxOnce();
    await sleep(outboxDrainRequested ? 100 : outboxIdleSeconds * 1000);
  }
}

async function handleUpdate(update) {
  const id = updateId(update);
  if (id && lastUpdateId && compareIds(id, lastUpdateId) <= 0) return;
  const guardKey = id || JSON.stringify(pick(update));
  if (inFlight.has(guardKey)) return;
  inFlight.add(guardKey);

  try {
    const { chatId, text, from } = pick(update);
    if (!chatId || !text || text.startsWith('/start')) {
      if (id) saveCheckpoint(id);
      return;
    }
    if (!shouldHandle(text)) {
      log('info', 'inbound_ignored_no_trigger', { chatId, from, updateId: id || undefined });
      if (id) saveCheckpoint(id);
      return;
    }

    log('info', 'inbound_received', { chatId, from, updateId: id || undefined, chars: text.length });
    const sessionKey = `agent:${agentId}:zalo-bot:${botKey}:${chatId}`;
    const { stdout } = await execFileAsync(
      'openclaw',
      [
        'agent',
        '--agent',
        agentId,
        '--session-key',
        sessionKey,
        '--message',
        text,
        '--json',
        '--timeout',
        String(agentTimeout),
      ],
      { timeout: (agentTimeout + 20) * 1000, maxBuffer: 1024 * 1024 },
    );
    log('info', 'agent_completed', { chatId, updateId: id || undefined });

    const reply = agentAnswer(stdout);
    if (!reply || reply === 'NO_REPLY') {
      log('info', 'agent_no_reply', { chatId, updateId: id || undefined });
      if (id) saveCheckpoint(id);
      return;
    }

    const chunks = chunkReply(reply);
    if (outboxDir) {
      enqueueOutboxReply({ chatId, updateId: id, chunks, replyChars: reply.length });
    } else {
      for (let i = 0; i < chunks.length; i++) {
        await sendReplyChunk(chatId, chunks[i], i, chunks.length, id);
      }
      log('info', 'reply_sent', { chatId, updateId: id || undefined, chunks: chunks.length, chars: reply.length });
    }
    if (id) saveCheckpoint(id);
  } finally {
    inFlight.delete(guardKey);
  }
}

function backoffMs(error, consecutiveErrors) {
  const status = Number(error.status || error.response?.error_code || 0);
  if (status === 408) return 250;
  if (status === 429) return Math.min(60000, 5000 * consecutiveErrors);
  if (status >= 500) return Math.min(60000, 2000 * 2 ** Math.min(consecutiveErrors, 5));
  if (status === 404 || status === 401 || status === 403) return Math.min(60000, 10000 * consecutiveErrors);
  return Math.min(30000, 2000 * consecutiveErrors);
}

log('info', 'polling_started', {
  envFile: envFile || undefined,
  pollTimeout,
  apiTimeout,
  sendTimeout,
  sendAttempts,
  outboxDir: outboxDir || undefined,
  outboxMaxAttempts,
  agentTimeout,
  checkpointFile: checkpointFile || undefined,
  undeliveredFile: undeliveredFile || undefined,
  requireMention,
});

let consecutiveErrors = 0;
if (outboxDir) outboxWorker().catch(error => log('error', 'outbox_worker_crashed', { error: error.message }));
for (;;) {
  try {
    const response = await api('getUpdates', { timeout: String(pollTimeout) });
    if (!response.ok) {
      if (response.error_code === 408) continue;
      const error = new Error(`Zalo getUpdates API error ${response.error_code || 'unknown'}`);
      error.status = response.error_code;
      error.response = response;
      throw error;
    }
    consecutiveErrors = 0;
    for (const update of asUpdates(response)) await handleUpdate(update);
  } catch (error) {
    consecutiveErrors++;
    const wait = backoffMs(error, consecutiveErrors);
    log('error', 'api_or_bridge_error', {
      error: error.message,
      status: error.status || undefined,
      responseCode: error.response?.error_code,
      preview: error.preview,
      backoffMs: wait,
    });
    await sleep(wait);
  }
}
