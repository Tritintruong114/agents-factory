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

const envFile = arg('--env') || process.env.ZALO_BRIDGE_ENV_FILE;
if (envFile) loadEnvFile(envFile);

const token = process.env.ZALO_BOT_TOKEN;
const agentId = process.env.OPENCLAW_AGENT_ID;
const botKey = process.env.ZALO_BOT_KEY || agentId || 'zalo';
const label = process.env.ZALO_BRIDGE_LABEL || botKey;
const pollTimeout = Number(process.env.ZALO_POLL_TIMEOUT_SECONDS || 30);
const agentTimeout = Number(process.env.OPENCLAW_AGENT_TIMEOUT_SECONDS || 120);
const chunkLimit = Number(process.env.ZALO_REPLY_CHUNK_LIMIT || 2000);
const requireMention = /^(1|true|yes)$/i.test(process.env.ZALO_REQUIRE_MENTION || '');
const mentionTriggers = (process.env.ZALO_MENTION_TRIGGERS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (!token) throw new Error('ZALO_BOT_TOKEN missing');
if (!agentId) throw new Error('OPENCLAW_AGENT_ID missing');
if (requireMention && mentionTriggers.length === 0) {
  throw new Error('ZALO_REQUIRE_MENTION is enabled but ZALO_MENTION_TRIGGERS is empty');
}

const base = `https://bot-api.zaloplatforms.com/bot${token}`;

async function api(method, body) {
  const res = await fetch(`${base}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  if (!contentType.includes('application/json')) {
    throw new Error(`Zalo ${method} returned non-JSON (${res.status}): ${text.slice(0, 120)}`);
  }
  return JSON.parse(text);
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

function shouldHandle(text) {
  if (!requireMention) return true;
  return mentionTriggers.some(trigger => text.includes(trigger));
}

function agentAnswer(raw) {
  const start = raw.indexOf('{\n  "runId"');
  if (start < 0) return '';
  try {
    const json = JSON.parse(raw.slice(start));
    return json.result?.payloads?.map(p => p.text).filter(Boolean).join('\n') || '';
  } catch (error) {
    console.error(`[${label}] cannot parse agent result:`, error.message);
    return '';
  }
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
  const { chatId, text, from } = pick(update);
  if (!chatId || !text || text.startsWith('/start')) return;
  if (!shouldHandle(text)) return;

  console.log(`[${label}] inbound chat=${chatId} from=${from}: ${text.slice(0, 100)}`);
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
  const reply = agentAnswer(stdout);
  if (!reply || reply === 'NO_REPLY') return;

  const chunks = chunkReply(reply);
  for (const chunk of chunks) {
    const sent = await api('sendMessage', { chat_id: chatId, text: chunk });
    if (!sent.ok) throw new Error(`sendMessage failed: ${JSON.stringify(sent)}`);
  }
  console.log(`[${label}] reply sent chunks=${chunks.length} chars=${reply.length}`);
}

console.log(`[${label}] polling started (POST long-poll) agent=${agentId} botKey=${botKey}`);
for (;;) {
  try {
    const response = await api('getUpdates', { timeout: String(pollTimeout) });
    if (!response.ok) {
      if (response.error_code !== 408) console.error(`[${label}] poll error`, JSON.stringify(response));
      continue;
    }
    const updates = Array.isArray(response.result) ? response.result : [response.result];
    for (const update of updates.filter(Boolean)) await handleUpdate(update);
  } catch (error) {
    console.error(`[${label}] error`, error.message);
    await sleep(2000);
  }
}
