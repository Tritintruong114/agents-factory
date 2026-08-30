---
name: "customer-value-discovery"
description: "Discover customer value from real behavior before proposing product features, roadmaps, agents, or outreach."
---

# Customer Value Discovery

Use this skill when defining Customer Value for product roadmap items, agent capabilities, sales discovery, outreach, demos, or adoption plans.

The job is to make the customer's pain and value legible before proposing features. Start from real behavior and a specific moment, not from a feature list, agent list, or solution idea.

## Core Rule

Customer Value is the customer outcome, not the feature or mechanism.

Good Customer Value describes a better state such as:

- more accurate
- faster
- less manual work
- fewer missed leads
- fewer errors
- lower risk
- higher conversion
- easier control
- shorter setup or training time

Avoid solution-shaped wording in Customer Value. Put implementation details in the feature or capability section.

```text
Weak: Agent reads chat history and tags customers.
Better: Sales team misses fewer qualified leads and follows up faster without manually scanning every conversation.
```

## Three Phases

### Phase 1: Need

Use Phase 1 to understand why the customer needs progress.

```text
context/status quo -> pain/cost -> desired progress -> Customer Value
```

Ask:

- Who is the persona and what workflow do they own?
- What are they doing today?
- When does the current way become insufficient?
- What cost, risk, delay, or friction appears?
- What better state do they want?
- What Customer Value follows from that desired progress?
- What observable signal would prove the value is real?

Do not validate adoption, trust, pricing, or feature preferences too early. Phase 1 is Need.

### Phase 2: Action

Use Phase 2 when the customer is considering a concrete change.

```text
research alternatives -> compare -> trust/anxiety and adoption conditions -> limited/safe trial
```

Ask:

- What alternatives would they naturally consider?
- How do they compare options?
- What must they trust before trying?
- What makes them anxious about switching?
- What adoption conditions must be true?
- What is the smallest safe trial?

Fear and anxiety arise after the customer wants improvement and considers a change. They do not directly follow from status quo.

### Phase 3: Result

Use Phase 3 after a trial, demo, pilot, or production usage exists.

```text
observed outcome vs old way -> signals/evidence -> expand/adopt or stop
```

Ask:

- What happened compared with the old way?
- Which signals prove improvement?
- What evidence is missing?
- What broke trust or created friction?
- Should the customer expand, adopt, iterate, or stop?

Successful adoption changes the operating model. The solution becomes the customer's new baseline. A later context change, bottleneck, or growth opportunity can start a new Customer Value loop.

## Discovery Chain

When in doubt, use this chain:

```text
persona -> status quo/current workaround -> cost/pain -> trigger -> desired progress -> Customer Value -> observable signal/metric
```

Keep business outcome, customer value, capability, and mechanism separate:

- Business outcome: more revenue, more orders, better conversion.
- Customer Value: fewer missed leads, faster follow-up, less manual work, better control.
- Agent/product capability: classify leads, summarize conversations, trigger handoff.
- Mechanism: reads source data, applies rules, writes CRM row, sends notification.

Do not claim a business outcome unless the causal chain and evidence are clear.

## Output Pattern

For most tasks, produce:

1. Current phase and why.
2. Discovery chain.
3. Customer Value statement.
4. Observable signals or metrics.
5. Unknowns and next discovery questions.
6. Feature/capability implications only after the value is clear.

Use this JTBD-style sentence when useful:

```text
When using [product/agent/workflow], I want [desired outcome], so that [measurable or qualitative benefit].
```

## Templates And Examples

Load only what you need:

- `templates/customer-value-discovery.md`: reusable worksheet for a customer, feature, roadmap item, or agent idea.
- `examples/b2b-sales-agent.md`: example for a B2B Sales Agent use case.
- `examples/agent-marketplace.md`: example for Agent OS / Agent Marketplace discovery.

## Quality Bar

- Separate verified facts, reasonable hypotheses, and unknowns.
- Phrase unverified relevance conditionally.
- Do not manufacture pain, ROI, authority, or personalization.
- Discovery should test the causal chain instead of pretending it is proven.
- If evidence is thin, say so and propose the next smallest discovery step.
