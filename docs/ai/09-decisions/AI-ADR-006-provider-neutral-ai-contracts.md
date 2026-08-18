# AI-ADR-006: Shared AI Contracts Are Provider Neutral

Status: Accepted

Date: 2026-08-18

Owners: Jordan / Sanctuary Pergolas

## Context

Tasks, capabilities, approvals, evidence, artifacts, usage, evaluations, and node identities are Sanctuary concepts, not provider concepts.

## Decision

Reusable schemas and types belong in `@sp/ai`. The package contains no secrets, database client, UI, model SDK, or business-domain implementation.

## Consequences

Apps and workers adapt provider-neutral contracts at explicit boundaries. Provider-specific fields remain inside adapters or safe snapshots.

## Security and data impact

Structured validation and safe/public projections are required before data crosses trust boundaries.

## Alternatives considered

Defining contracts inside OpenClaw configuration or one Portal route was rejected.

## Evidence and evaluation

Contract tests must cover invalid states, unknown versions, and serialization boundaries without live credentials.

## Revisit conditions

Revisit if the package boundary demonstrably creates more coupling than it removes.

## Related docs, code, tests and incidents

- `../../target-architecture.md`
- `../sanctuary-ai-master-plan.md`
