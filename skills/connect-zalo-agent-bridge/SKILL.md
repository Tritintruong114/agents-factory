---
name: "connect-zalo-agent-bridge"
description: "Configure and share reusable Zalo bot bridge skills across OpenClaw instances."
---

# Connect Zalo Agent Bridge

Use this skill to configure Zalo bot polling bridges so inbound Zalo messages are routed to the intended OpenClaw agent and replies are sent back to the same Zalo chat.

## Core Concept

Default to **one Zalo bot = one OpenClaw agent = one bridge process**.

For 3 bots and 3 agents, create or maintain 3 isolated bridge instances:

- Bot A token/env -> agent A -> bridge process A -> log/PID A
- Bot B token/env -> agent B -> bridge process B -> log/PID B
- Bot C token/env -> agent C -> bridge process C -> log/PID C

This is the safest default because changing or restarting one bot-agent mapping does not overwrite or interrupt the others. Use a single multi-bot process only if the user explicitly asks for a central config runner and accepts the extra complexity.

## Default Context

Known original single-bot bridge from the first setup:

- Bridge script: `/home/node/.openclaw/zalo-b2b-bridge.mjs`
- Env file: `/home/node/.openclaw/secrets/zalo-b2b-bot.env`
- Token variable: `ZALO_B2B_BOT_TOKEN`
- PID file: `/home/node/.openclaw/zalo-b2b-bridge.pid`
- Logs: `/home/node/.openclaw/zalo-b2b-bridge.log` and `/home/node/.openclaw/logs/zalo-b2b-bridge.log`

For additional bots, derive stable names from the bot purpose, for example:

- `/home/node/.openclaw/zalo-<bot-key>-bridge.mjs`
- `/home/node/.openclaw/secrets/zalo-<bot-key>-bot.env`
- `/home/node/.openclaw/zalo-<bot-key>-bridge.pid`
- `/home/node/.openclaw/logs/zalo-<bot-key>-bridge.log`

Use lowercase kebab-case for `<bot-key>`, such as `b2b`, `support`, `sales`, `ops`, or a short business label supplied by the user.

The reviewed bridge pattern:

- Read a Zalo bot token from that bot's env file.
- Poll `https://bot-api.zaloplatforms.com/bot<TOKEN>/getUpdates`.
- Extract `chatId`, text, and sender from Zalo event variants.
- Run `openclaw agent --agent <agentId> --session-key agent:<agentId>:zalo-bot:<botKey>:<chatId> --message <text> --json --timeout 120`.
- Parse the final OpenClaw JSON response from stdout.
- Split replies into <= 2000-character chunks before calling Zalo `sendMessage`.

## Bundled Templates

When using this skill from the `agents-factory` repo, prefer the bundled generic bridge template instead of reconstructing the bridge from memory:

- `templates/zalo-polling-bridge.mjs`: generic Zalo Bot API long-poll bridge.
- `templates/zalo-bot.env.example`: non-secret env template for one bot-agent mapping.

Copy the env template to a private path on the target instance, fill in the real token locally, then run the bridge template with `ZALO_BRIDGE_ENV_FILE=/path/to/env`.

## Required Intake

Before changing anything, determine the intended mapping. Ask the user if any value is missing and cannot be discovered safely:

1. Target OpenClaw agent id for each bot.
2. Zalo bot identity/name for each bot.
3. Short bot key for filenames/session keys, or infer a clear kebab-case key from the bot name and confirm it.
4. Zalo bot token for each new bot, or confirmation to reuse an existing env token for an existing bot.
5. Whether this is a new bot-agent mapping, a rewire of one existing mapping, or a full 3-bot setup.
6. Whether to restart only the affected bridge process after the edit.

Ask in Vietnamese when talking to Tri. Keep the question compact. For a single mapping:

```text
Anh muon gan agent nao vao Zalo bot nao?
- Agent id:
- Ten Zalo bot:
- Bot key ngan de dat file:
- Token: gui token moi hoac noi "dung token cu"
- Restart bridge bot nay sau khi cap nhat khong?
```

For a 3-bot setup:

```text
Anh gui em 3 mapping nay nhe:
1. Bot name/key -> agent id -> token moi hay token cu
2. Bot name/key -> agent id -> token moi hay token cu
3. Bot name/key -> agent id -> token moi hay token cu
Co restart ca 3 bridge sau khi cap nhat khong?
```

## Safety Rules

- Never print, summarize, or expose actual Zalo tokens in chat, logs, diffs, final answers, or memory.
- Redact token values when reading env files or reporting state.
- Keep each bot's token in its own env file. Do not store raw tokens in bridge scripts.
- Do not overwrite an existing bot env file without preserving unrelated variables.
- Back up every bridge script before editing, using a timestamped `.bak-YYYYMMDDTHHMMZ` suffix.
- Restart only the affected bridge process unless the user explicitly asks to restart all Zalo bridges.
- Prefer `trash` over destructive deletion. Do not remove old backups unless the user explicitly asks.
- Ask before sending external messages through Zalo, email, or public channels. Polling/restart verification is allowed only when the user asked to configure the bridge.
- Treat Zalo group routing carefully: one visible bot/agent should reply per customer-facing group unless the channel and workflow explicitly support multiple visible bots.
- Do not include env files, raw tokens, customer logs, PID files, or local memory files when publishing or sharing this skill.

## Inspect

Run focused reads before editing. For the known B2B bridge:

```bash
sed -n '1,260p' /home/node/.openclaw/zalo-b2b-bridge.mjs
sed -E 's/(TOKEN|SECRET|KEY|PASSWORD|PASS|APP_SECRET|ACCESS_TOKEN|REFRESH_TOKEN|OA_TOKEN)=.*/\1=<redacted>/' /home/node/.openclaw/secrets/zalo-b2b-bot.env
ps -ef | rg 'zalo-.*bridge|openclaw.*agent'
tail -n 80 /home/node/.openclaw/zalo-b2b-bridge.log
tail -n 80 /home/node/.openclaw/logs/zalo-b2b-bridge.log
```

For multiple bots, discover existing bridge files and env files:

```bash
find /home/node/.openclaw -maxdepth 3 \( -name 'zalo-*-bridge.mjs' -o -name 'zalo-*-bridge.pid' -o -name 'zalo-*-bot.env' \)
ps -ef | rg 'zalo-.*bridge|openclaw.*agent'
```

If available, list candidate agents before asking the user to choose:

```bash
openclaw agents list --json
```

If that command is unavailable, use the closest local OpenClaw agent listing command or inspect known config files, then state uncertainty.

## Implementation Model

### Preferred: isolated bridge per bot

Use this when the user wants flexible 3 bot / 3 agent routing.

1. For each mapping, create or update one bridge file and one env file.
2. Use the bot key in filenames, PID path, log path, and session key.
3. Keep the target agent id inside that bot's bridge file or in a non-secret config variable.
4. Restart only the changed bot's process.
5. Verify each bot independently.

Recommended naming:

```text
/home/node/.openclaw/zalo-<bot-key>-bridge.mjs
/home/node/.openclaw/secrets/zalo-<bot-key>-bot.env
/home/node/.openclaw/zalo-<bot-key>-bridge.pid
/home/node/.openclaw/logs/zalo-<bot-key>-bridge.log
```

Recommended env contents:

```text
ZALO_BOT_TOKEN='<secret>'
ZALO_BOT_KEY='<bot-key>'
OPENCLAW_AGENT_ID='<agent-id>'
```

Use bot-specific variable names only when reusing an existing env convention. Prefer the generic names above for new bot bridge instances.

### Optional: single multi-bot config runner

Use this only if the user explicitly wants one process to manage all bots.

- Store mappings in a config file with token env variable names, not raw token values.
- Keep tokens in env files or a secrets store.
- Make per-bot logging visible enough to debug one bot without mixing all output.
- Validate that one failing bot cannot block polling for the other bots.

## Edit Procedure

1. Confirm or collect the required intake values.
2. Identify whether this is single-bot, 3-bot isolated, or explicit multi-bot config runner.
3. Back up any bridge file that will be edited.
4. For each affected bot, update only that bot's routing values:
   - Agent id in the `openclaw agent --agent ...` call, or `OPENCLAW_AGENT_ID` if the bridge reads it from env.
   - Session key prefix to include both agent and bot key: `agent:<agentId>:zalo-bot:<botKey>:<chatId>`.
   - Env file path and token variable for that bot only.
   - Log and PID paths for that bot only.
5. Preserve existing behavior for:
   - Zalo event parsing.
   - Ignoring empty text and `/start`.
   - JSON response parsing from OpenClaw CLI stdout.
   - 2000-character reply chunking.
6. Use `apply_patch` for manual edits.

## Public And Reuse Across Instances

Use this section when Tri asks to public, share, export, install, or reuse this skill in another OpenClaw instance.

### What can be shared

Share only the reusable skill folder and optional generic templates:

- `skills/connect-zalo-agent-bridge/SKILL.md`
- Any generic scripts/templates added later under `scripts/`, `templates/`, or `references/`
- Example env templates with placeholder values only, such as `ZALO_BOT_TOKEN='<fill-me>'`

Do not share instance-specific runtime files:

- `/home/node/.openclaw/secrets/*.env`
- Raw Zalo tokens
- Bridge logs
- PID files
- Customer chat data
- Local `MEMORY.md` or `memory/*.md`
- Agent-specific private workspace files unless the user explicitly wants to package that agent too

### Option 1: local directory transfer

Use when moving the skill between machines or private OpenClaw instances.

1. Package or copy the skill folder only.
2. Install it on the target instance from a local directory:

```bash
openclaw skills install /path/to/connect-zalo-agent-bridge --agent <target-agent-id> --as connect-zalo-agent-bridge
```

Use `--global` only when the skill should be available to all agents in that target instance:

```bash
openclaw skills install /path/to/connect-zalo-agent-bridge --global --as connect-zalo-agent-bridge
```

After install, verify visibility:

```bash
openclaw skills info connect-zalo-agent-bridge --agent <target-agent-id>
openclaw skills check --agent <target-agent-id>
```

### Option 2: private or public git repo

Use when Tri wants versioned reuse across many instances.

1. Put the skill folder in a repo, normally as `skills/connect-zalo-agent-bridge/`.
2. Add a `.gitignore` that excludes `*.env`, logs, PID files, backups, and local memory.
3. Push to GitHub or another git remote.
4. Install on another OpenClaw instance:

```bash
openclaw skills install git:<repo-url> --agent <target-agent-id> --as connect-zalo-agent-bridge
```

If the git-backed skill is pending scan and the user understands the risk, OpenClaw supports:

```bash
openclaw skills install git:<repo-url> --agent <target-agent-id> --as connect-zalo-agent-bridge --force-install
```

For updates on target instances, use the OpenClaw skill update flow when the skill is ClawHub-backed, or reinstall from git/local with `--force` when appropriate.

### Option 3: ClawHub public distribution

Use when Tri wants the skill discoverable by other OpenClaw users/instances.

Known CLI surface:

```bash
openclaw skills search <query>
openclaw skills install @owner/connect-zalo-agent-bridge --agent <target-agent-id>
openclaw skills verify connect-zalo-agent-bridge --agent <target-agent-id>
openclaw skills verify connect-zalo-agent-bridge --card
openclaw skills update --agent <target-agent-id>
```

If publishing to ClawHub is not available from the current CLI/auth state, prepare the skill as a clean git-backed package first, then follow the active OpenClaw/ClawHub publishing flow in that environment. Do not invent missing publish commands; inspect `openclaw skills --help` and related docs/tools first.

### Reuse checklist for each target instance

After installing the skill in another instance, configure runtime locally:

1. Confirm the target OpenClaw agent ids exist on that instance.
2. Ask for that instance's Zalo bot names/keys and tokens.
3. Create per-bot env files on that instance.
4. Create or update per-bot bridge files on that instance.
5. Start/restart only the affected bridge processes.
6. Run `node --check` for bridge files.
7. Check process and logs per bot.
8. Confirm token values never left the target instance's secrets/env boundary.

## Validation

Always run syntax check for every affected bridge file:

```bash
node --check /home/node/.openclaw/zalo-<bot-key>-bridge.mjs
```

If the user asked to restart:

1. Stop only the affected bridge process using its PID file or exact process match.
2. Start only that bridge using the existing local convention, preserving stdout/stderr to that bot's log.
3. Confirm the process is running.
4. Tail that bot's log and report only non-secret state.

Useful checks:

```bash
ps -ef | rg 'zalo-.*bridge|openclaw.*agent'
tail -n 80 /home/node/.openclaw/logs/zalo-<bot-key>-bridge.log
```

For a 3-bot setup, validate all three bridge files and process/log paths independently. Report each mapping by bot key and agent id with token redacted.

When sharing the skill across instances, validate the installed skill:

```bash
openclaw skills info connect-zalo-agent-bridge --agent <target-agent-id>
openclaw skills check --agent <target-agent-id>
```

For ClawHub-backed skills, verify metadata/card if available:

```bash
openclaw skills verify connect-zalo-agent-bridge --agent <target-agent-id>
openclaw skills verify connect-zalo-agent-bridge --card
```

## Known Failure Modes

- `Unexpected token '<'` while parsing Zalo API response means the Zalo endpoint returned HTML instead of JSON. Check token validity, endpoint reachability, request method, and any upstream gateway/auth page.
- `Command failed: openclaw agent ...` means the agent call failed or timed out. Check target agent id, available connectors, session key, and timeout.
- Replies cut in Zalo usually mean chunking is not preserving message boundaries. Keep chunks under 2000 chars and split on paragraph/line/space boundaries.
- If one bot works and another is silent, compare that bot's token/env path, process, PID, log, chat id, agent id, and session key independently. Do not assume the global bridge state applies to all bots.
- If all bots are managed by one process and one bot failure blocks the others, split back into isolated bridge processes.
- If another OpenClaw instance installs the skill but it does not trigger, run `openclaw skills check`, confirm the skill path/agent target, and inspect `openclaw skills info connect-zalo-agent-bridge --agent <target-agent-id>`.
- If a shared/public package accidentally includes secrets, stop and rotate/revoke the leaked Zalo token before continuing.

## Final Response

Report concisely in Vietnamese:

- Which bot-agent mappings were checked or changed.
- Which bridge/env/log/PID files belong to each bot, with tokens redacted.
- Whether syntax checks passed for each affected bridge.
- Whether restart was done per bot or for all bots.
- Whether logs show polling/replies or errors per bot.
- If sharing/reusing the skill, which distribution path was used: local directory, git, or ClawHub.
- What remains to configure on the target OpenClaw instance.

Never include raw tokens.
