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
const agentTimeout = Number(process.env.OPENCLAW_AGENT_TIMEOUT_SECONDS || 120);
const chunkLimit = Number(process.env.ZALO_REPLY_CHUNK_LIMIT || 2000);
const checkpointFile = process.env.ZALO_CHECKPOINT_FILE || '';
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
if (requireMention && mentionTriggers.length === 0) {
  throw new Error('ZALO_REQUIRE_MENTION is enabled but ZALO_MENTION_TRIGGERS is empty');
}

const base = `https://bot-api.zaloplatforms.com/bot${token}`;
const inFlight = new Set();
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
  const res = await fetch(`${base}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
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
      if (id) saveCheckpoint(id);
      return;
    }

    const chunks = chunkReply(reply);
    for (const chunk of chunks) {
      const sent = await api('sendMessage', { chat_id: chatId, text: chunk });
      if (!sent.ok) throw new Error(`sendMessage failed: ${JSON.stringify(sent)}`);
    }
    log('info', 'reply_sent', { chatId, updateId: id || undefined, chunks: chunks.length, chars: reply.length });
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
  agentTimeout,
  checkpointFile: checkpointFile || undefined,
  requireMention,
});

let consecutiveErrors = 0;
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
