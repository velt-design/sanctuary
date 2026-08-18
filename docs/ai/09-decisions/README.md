# Sanctuary AI Architecture Decisions

Status: Decision record index.

Owner: Jordan / Sanctuary Pergolas

Review cadence: Review an ADR when its stated revisit condition occurs and during the quarterly programme review.

## Accepted Decisions

| ID | Decision |
| --- | --- |
| AI-ADR-001 | Sanctuary AI is the platform; OpenClaw is replaceable. |
| AI-ADR-002 | Canonical business control state remains hosted. |
| AI-ADR-003 | The Mac mini is the private always-on execution node. |
| AI-ADR-004 | Heavy compute is separated from orchestration. |
| AI-ADR-005 | Existing `@sp/jobs` and `apps/worker` form the durable execution spine. |
| AI-ADR-006 | Shared AI contracts belong in provider-neutral `@sp/ai`. |
| AI-ADR-007 | Agents do not own canonical memory. |
| AI-ADR-008 | The Project Digital Twin is a typed projection, not a replacement database. |
| AI-ADR-009 | Structured retrieval precedes semantic retrieval. |
| AI-ADR-010 | Consequential effects require exact approval envelopes initially. |

## ADR Template

```markdown
# AI-ADR-XXX: Decision title

Status: Proposed | Accepted | Superseded | Retired
Date:
Owners:

## Context

## Decision

## Consequences

## Security and data impact

## Alternatives considered

## Evidence and evaluation

## Revisit conditions

## Related docs, code, tests and incidents
```
