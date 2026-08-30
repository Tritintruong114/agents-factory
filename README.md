# Agents Factory

Reusable agent-building assets for the ClawExperts project.

This repository is the shared factory for packaging OpenClaw agents, skills, templates, and operational playbooks that can be reused across ClawExperts instances.

## Purpose

ClawExperts should not be a one-off collection of bots. It should become an Agent Workforce OS: reusable agents with clear routing, permissions, human-in-the-loop gates, memory/playbooks, and deployment patterns.

Use this repo to keep those reusable building blocks portable between OpenClaw instances.

## Current Contents

- `skills/customer-value-discovery/`
  Reusable skill for discovering customer value from real behavior before proposing product features, agent capabilities, roadmap items, outreach, demos, or adoption plans. Includes a worksheet template and examples for B2B Sales Agent and Agent OS / Agent Marketplace discovery.
- `skills/connect-zalo-agent-bridge/`  
  Reusable OpenClaw skill for connecting one or more Zalo bot bridge instances to OpenClaw agents. The default model is:
- `skills/connect-zalo-agent-bridge/templates/zalo-polling-bridge.mjs`  
  Generic polling bridge source based on the working local bridge. Configure it with a private env file on each target instance.
- `skills/connect-zalo-agent-bridge/templates/zalo-bot.env.example`  
  Non-secret env template for one Zalo bot to one OpenClaw agent.
- `skills/connect-zalo-agent-bridge/scripts/`  
  Installer, status, restart, logs, and no-send test scripts for per-bot bridge operations.
- `skills/connect-zalo-agent-bridge/systemd/`  
  Service template for long-running bridge processes on production servers.

```text
1 Zalo bot = 1 OpenClaw agent = 1 isolated bridge process
```

This supports flexible setups such as:

```text
Bot A -> Agent A
Bot B -> Agent B
Bot C -> Agent C
```

Each bot should have its own token/env file, bridge process, PID, and log.

## One-Shot Zalo Bridge Install

On a target OpenClaw instance:

```bash
git clone https://github.com/Tritintruong114/agents-factory.git
cd agents-factory

mkdir -p /home/node/.openclaw/secrets
cp skills/connect-zalo-agent-bridge/templates/zalo-bot.env.example \
  /home/node/.openclaw/secrets/zalo-kien-truc-su-bot.env
chmod 600 /home/node/.openclaw/secrets/zalo-kien-truc-su-bot.env
```

Fill in the private token and target agent id in the env file. Then run:

```bash
./skills/connect-zalo-agent-bridge/scripts/install-zalo-bridge.sh \
  --agent agent-kien-truc-su \
  --bot-key kien-truc-su \
  --env /home/node/.openclaw/secrets/zalo-kien-truc-su-bot.env
```

For group chats, set `ZALO_REQUIRE_MENTION='true'` and configure `ZALO_MENTION_TRIGGERS` if only mentioned messages should enter the agent session.

Operate one bot without touching the others:

```bash
./skills/connect-zalo-agent-bridge/scripts/zalo-bridge-status.sh --bot-key kien-truc-su
./skills/connect-zalo-agent-bridge/scripts/zalo-bridge-restart.sh --bot-key kien-truc-su
./skills/connect-zalo-agent-bridge/scripts/zalo-bridge-logs.sh --bot-key kien-truc-su -n 120
```

## Install A Skill From This Repo

From another OpenClaw instance:

```bash
openclaw skills install git:https://github.com/Tritintruong114/agents-factory.git --agent <agent-id> --as connect-zalo-agent-bridge
openclaw skills install git:https://github.com/Tritintruong114/agents-factory.git --agent <agent-id> --as customer-value-discovery
```

Or install globally for all agents in that instance:

```bash
openclaw skills install git:https://github.com/Tritintruong114/agents-factory.git --global --as connect-zalo-agent-bridge
openclaw skills install git:https://github.com/Tritintruong114/agents-factory.git --global --as customer-value-discovery
```

Verify:

```bash
openclaw skills info connect-zalo-agent-bridge --agent <agent-id>
openclaw skills info customer-value-discovery --agent <agent-id>
openclaw skills check --agent <agent-id>
```

## Security Rules

Never commit:

- Zalo bot tokens
- `.env` files
- logs
- PID files
- customer chat data
- private memory files
- private agent workspace data

Only commit reusable instructions, templates, scripts, and non-secret examples.

## Repository Shape

Recommended structure as this factory grows:

```text
skills/
  customer-value-discovery/
    SKILL.md
    agents/
    templates/
    examples/
  connect-zalo-agent-bridge/
    SKILL.md
    README.md
    templates/
    scripts/
    systemd/
    fixtures/
agents/
templates/
playbooks/
scripts/
```

Keep each asset reusable, documented, and free of instance-specific secrets.
