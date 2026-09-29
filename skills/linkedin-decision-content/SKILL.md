---
name: "linkedin-decision-content"
description: "Create LinkedIn Decision Content posts and single-image PNGs with approval gates, research framing, and reusable templates."
---

# LinkedIn Decision Content

Use this skill when creating LinkedIn thought-leadership posts, single-image PNGs, or draft packages that help readers make a stuck decision instead of only learning a topic.

Best fit:

- AI Agents, digital employees, workflows, marketing ops, product thinking, founder/operator content.
- Personal-authority posts that need a clear reframe, not generic tips.
- One-image LinkedIn posts using the approved `Title -> Context -> Bullets -> Closing` structure.

## Core Formula

Use Decision Content when the idea can be shaped as:

```text
Decision trap -> Hidden bias/cost -> Reframe -> Checklist/workflow -> Closing line
```

The post should help the reader diagnose a decision error and choose the next step.

## Required Intake

Before drafting, collect or infer:

1. Target reader.
2. Decision they are stuck on.
3. Wrong question or decision trap.
4. Hidden cost, risk, or bias.
5. User's point of view.
6. Proof, case, source, or observed behavior.
7. CTA goal: authority, DM, checklist, template, audit, or no CTA.

If any of these are missing, ask only the few questions needed to unlock a stronger angle.

## Workflow

1. **Angle**
   - Name the target reader and decision trap.
   - Separate verified facts, user POV, reasonable inference, and unknowns.
   - Avoid guaranteed virality or inflated conversion claims.

2. **Caption**
   - Hook: specific tension, not a topic label.
   - Context: why the decision is currently hard.
   - Reframe: change the question the reader is asking.
   - Checklist/workflow: 3-7 practical checks.
   - Close: one grounded line or soft CTA.

3. **PNG structure**
   - Use the latest single-image structure:

```text
Title cụ thể
Context ngắn
3-6 bullets/steps action được
Closing rõ lực
```

4. **Render**
   - Use the bundled template in `templates/linkedin-single-image/`.
   - Keep the final output named `linkedin-post.png` in the draft folder.
   - Verify image size is `1080x1080`.
   - Inspect the rendered PNG before reporting completion.

5. **Approval**
   - Preview the PNG content before rendering unless the user explicitly asks to run the full flow.
   - Do not publish public LinkedIn posts without a clear approval phrase such as `duyệt đăng bài này` or `OK đăng`.

## Visual Rules

Use the approved single-image style:

- White background.
- Real avatar header.
- Name + headline.
- Thin horizontal dividers.
- Large black title.
- Muted context line.
- Small gold numbered bullets.
- Bold closing line.
- Light Share/Save footer if it matches the template.
- Local Be Vietnam font.

Avoid:

- Grid backgrounds.
- Boxed bullet rows/cards.
- Fake LinkedIn UI cards with excessive whitespace.
- English framework badges such as `Decision Content` unless explicitly requested.
- Generative image as final text-bearing PNG.

## Bundled Resources

- `README.md`: setup, end-user requirements, connectors, assets, and operating model.
- `templates/linkedin-single-image/`: editable HTML/CSS/JS card template.
- `scripts/render-linkedin-single-image.sh`: deterministic Chromium PNG export.
- `templates/linkedin-draft.md`: reusable draft package format.
- `templates/onboarding.md`: end-user intake checklist.
- `examples/decision-content-ai-agent-workflow.md`: example package.
- `assets/fonts/be-vietnam/`: local Vietnamese font files.
- `assets/brand/avatar-square.svg`: placeholder avatar; replace per end-user.

## Connector Notes

The skill can produce content with no connector.

Optional production connectors:

- LinkedIn: create drafts or publish after approval.
- Google Drive: persist rendered image so connectors can obtain a storage key when local file paths are not accepted.
- Telegram/Zalo/Slack channel: send preview to the user for review.
- Scheduled Tasks: run idea mining or draft generation on a cadence.

Never put a Google Drive view link in the caption as a substitute for attaching the image.
