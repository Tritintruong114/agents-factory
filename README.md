# Agents Factory

Reusable agent-building assets for the ClawExperts project.

This repository is the shared factory for packaging OpenClaw agents, skills, templates, and operational playbooks that can be reused across ClawExperts instances.

## Purpose

ClawExperts should not be a one-off collection of bots. It should become an Agent Workforce OS: reusable agents with clear routing, permissions, human-in-the-loop gates, memory/playbooks, and deployment patterns.

Use this repo to keep those reusable building blocks portable between OpenClaw instances.

## Current Contents

- `skills/connect-zalo-agent-bridge/`  
  Reusable OpenClaw skill for connecting one or more Zalo bot bridge instances to OpenClaw agents. The default model is:
- `skills/connect-zalo-agent-bridge/templates/zalo-polling-bridge.mjs`  
  Generic polling bridge source based on the working local bridge. Configure it with a private env file on each target instance.
- `skills/connect-zalo-agent-bridge/templates/zalo-bot.env.example`  
  Non-secret env template for one Zalo bot to one OpenClaw agent.

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

## Use The Bridge Template

On a target OpenClaw instance:

```bash
cp skills/connect-zalo-agent-bridge/templates/zalo-bot.env.example /home/node/.openclaw/secrets/zalo-b2b-bot.env
```

Fill in the private token and target agent id in the env file. Then run:

```bash
ZALO_BRIDGE_ENV_FILE=/home/node/.openclaw/secrets/zalo-b2b-bot.env \
  node skills/connect-zalo-agent-bridge/templates/zalo-polling-bridge.mjs
```

For group chats, set `ZALO_REQUIRE_MENTION='true'` and configure `ZALO_MENTION_TRIGGERS` if only mentioned messages should enter the agent session.

## Install A Skill From This Repo

From another OpenClaw instance:

```bash
openclaw skills install git:https://github.com/Tritintruong114/agents-factory.git --agent <agent-id> --as connect-zalo-agent-bridge
```

Or install globally for all agents in that instance:

```bash
openclaw skills install git:https://github.com/Tritintruong114/agents-factory.git --global --as connect-zalo-agent-bridge
```

Verify:

```bash
openclaw skills info connect-zalo-agent-bridge --agent <agent-id>
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
  connect-zalo-agent-bridge/
    SKILL.md
agents/
templates/
playbooks/
scripts/
```

Keep each asset reusable, documented, and free of instance-specific secrets.
