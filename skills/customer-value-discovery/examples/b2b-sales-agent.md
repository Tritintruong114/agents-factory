# Example: B2B Sales Agent

## Context

- Customer / segment: building materials seller with high message volume.
- Persona: owner or sales manager.
- Workflow owned: customer consultation, lead qualification, follow-up, handoff to sales staff.
- Product / agent / feature being considered: Sales Agent for chat consultation and lead capture.
- Current phase: Phase 1 Need moving into Phase 2 Action.

## Evidence

### Verified Facts

- The business receives customer questions through chat.
- The sales team needs phone numbers and enough context to follow up.

### Reasonable Hypotheses

- Some qualified leads are missed when chat volume is high or staff are busy.
- Repeated product consultation creates training load for the sales team.

### Unknowns

- Exact number of missed leads per week.
- Current follow-up time by channel.
- Which product categories require the most expert consultation.

## Phase 1: Need

- Current context/status quo: sales staff manually read conversations, answer product questions, collect phone numbers, and decide when to hand off.
- Current workaround: rely on staff availability and product experience.
- Trigger: message volume or product complexity increases beyond what staff can handle consistently.
- Pain/cost/risk/friction: slow replies, missed qualified leads, inconsistent consultation quality, repeated training effort.
- Desired progress: customers get useful consultation faster and the sales team receives better-qualified handoffs.
- Customer Value: fewer qualified leads are missed while consultation quality stays consistent.
- Observable signal/metric: phone numbers collected, qualified handoffs, response time, support-needed cases, wrong-answer rate.

JTBD:

```text
When using a Sales Agent, I want qualified customers to be consulted and handed off faster, so that my team misses fewer leads without losing control of sales quality.
```

## Phase 2: Action

- Alternatives the customer may research: hire more sales staff, train junior staff, outsource chat support, use a chatbot, use CRM automation.
- Comparison criteria: product accuracy, control, setup time, handoff quality, risk of wrong advice, cost.
- Trust conditions: the agent must know product rules, ask for human help when uncertain, and notify the team with enough context.
- Anxiety or switching risks: wrong product recommendation, spammy tone, poor handoff, losing the owner's sales style.
- Adoption conditions: limited product scope, human escalation, monitoring, feedback loop.
- Smallest safe trial: run on a test page or one product category, review conversations daily, then expand.

## Phase 3: Result

- Observed outcome vs old way: compare lead capture, response time, wrong-answer cases, and sales team workload.
- Signals/evidence: real customer conversations, phone numbers collected, successful handoffs, fewer repeated questions for staff.
- Missing evidence: order conversion and long-term support cost.
- Expand/adopt/iterate/stop: expand if lead quality and product accuracy are stable; iterate if wrong answers or handoff gaps appear.
- New baseline after adoption: agent-assisted consultation becomes the normal first line of customer handling.
- Next Customer Value loop: optimize category-specific selling rules and objection handling after the first-line workflow is stable.

## Capability Implications

- Business outcome: more orders or higher conversion, only if lead quality and follow-up are proven.
- Customer Value: fewer missed leads and faster qualified handoff.
- Product/agent capability: product consultation, lead qualification, escalation, notification.
- Mechanism: read product catalog, apply rules, ask for phone number, summarize handoff, notify sales group.
- Next discovery questions: which categories create the most uncertainty, what makes a lead qualified, and what information the sales team needs before calling.
- Next action: define the first category trial and daily review signals.
