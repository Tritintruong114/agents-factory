# Connect Zalo Agent Bridge

Reusable OpenClaw skill package for running one Zalo bot bridge per OpenClaw agent.

Default production model:

```text
1 Zalo bot = 1 OpenClaw agent = 1 isolated bridge process
```

## One-Shot Install

```bash
git clone https://github.com/Tritintruong114/agents-factory.git
cd agents-factory

mkdir -p /home/node/.openclaw/secrets
cp skills/connect-zalo-agent-bridge/templates/zalo-bot.env.example \
  /home/node/.openclaw/secrets/zalo-kien-truc-su-bot.env
chmod 600 /home/node/.openclaw/secrets/zalo-kien-truc-su-bot.env
```

Edit the env file locally and fill in the real token:

```text
ZALO_BOT_TOKEN='<real-token>'
ZALO_BOT_KEY='kien-truc-su'
OPENCLAW_AGENT_ID='agent-kien-truc-su'
```

Install and start the bridge:

```bash
./skills/connect-zalo-agent-bridge/scripts/install-zalo-bridge.sh \
  --agent agent-kien-truc-su \
  --bot-key kien-truc-su \
  --env /home/node/.openclaw/secrets/zalo-kien-truc-su-bot.env
```

The installer creates:

```text
/home/node/.openclaw/bridges/zalo/zalo-kien-truc-su-bridge.mjs
/home/node/.openclaw/zalo-kien-truc-su-bridge.pid
/home/node/.openclaw/logs/zalo-kien-truc-su-bridge.log
/home/node/.openclaw/zalo-kien-truc-su-bridge.offset.json
/home/node/.openclaw/zalo-kien-truc-su-bridge.undelivered.jsonl
/home/node/.openclaw/zalo-kien-truc-su-bridge.config
/home/node/.openclaw/systemd/zalo-bridge-kien-truc-su.service
```

## Operations

```bash
./skills/connect-zalo-agent-bridge/scripts/zalo-bridge-status.sh --bot-key kien-truc-su
./skills/connect-zalo-agent-bridge/scripts/zalo-bridge-restart.sh --bot-key kien-truc-su
./skills/connect-zalo-agent-bridge/scripts/zalo-bridge-logs.sh --bot-key kien-truc-su -n 120
```

Each command targets exactly one bot key.

The bridge logs `agent_completed` after OpenClaw returns a reply and `reply_sent` only after all Zalo chunks are accepted. If outbound Zalo delivery fails, it logs `send_attempt_failed`, retries according to `ZALO_SEND_ATTEMPTS`, and appends the failed chunk to the per-bot `.undelivered.jsonl` file after the final attempt.

## Tests That Do Not Send Messages

Test parser fixture:

```bash
./skills/connect-zalo-agent-bridge/scripts/test-zalo-fixture.sh
```

Test agent session only:

```bash
./skills/connect-zalo-agent-bridge/scripts/test-agent-session.sh \
  --agent agent-kien-truc-su \
  --bot-key kien-truc-su
```

Test Zalo getUpdates returns JSON without printing token:

```bash
./skills/connect-zalo-agent-bridge/scripts/test-zalo-api-json.sh \
  --env /home/node/.openclaw/secrets/zalo-kien-truc-su-bot.env
```

## Mention Gate

For group chats, turn on mention filtering in the env file:

```text
ZALO_REQUIRE_MENTION='true'
ZALO_MENTION_TRIGGERS='@Bot Kien Truc Su'
```

When enabled, only messages containing the configured trigger are forwarded into the OpenClaw agent session.

## Security

Never commit real tokens, env files, logs, PID files, customer chat data, or memory files.
