# AI-ADR-001: Sanctuary AI Is The Platform

Status: Accepted

Date: 2026-08-18

Owners: Jordan / Sanctuary Pergolas

## Context

Models, agent frameworks, and hardware change faster than Sanctuary's business rules and evidence requirements.

## Decision

Sanctuary AI is the durable platform. OpenClaw, models, local runtimes, machines, and connectors are replaceable adapters behind Sanctuary-owned task, policy, evidence, and approval contracts.

## Consequences

No vendor runtime may become the only owner of permissions, memory, task state, or staff experience. Integration work must preserve an adapter boundary.

## Security and data impact

Secrets and authority are scoped to the adapter capability. Replacing or revoking an adapter must not remove canonical records.

## Alternatives considered

Making OpenClaw or one model provider the product was rejected because it creates lock-in and conflates execution with business authority.

## Evidence and evaluation

The first synthetic task must return results into Sanctuary-owned records rather than relying on OpenClaw history.

## Revisit conditions

Revisit implementation details when an adapter is replaced; the platform ownership rule is not expected to change.

## Related docs, code, tests and incidents

- `../00-vision.md`
- `../sanctuary-ai-master-plan.md`
