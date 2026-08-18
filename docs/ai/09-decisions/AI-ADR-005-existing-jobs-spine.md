# AI-ADR-005: Existing Jobs And Worker Form The Durable Execution Spine

Status: Accepted

Date: 2026-08-18

Owners: Jordan / Sanctuary Pergolas

## Context

The repository already has versioned durable-job, lease, retry, effect, reconciliation, and dark-rollout contracts.

## Decision

AI execution extends `@sp/jobs` and `apps/worker`. AI task state remains a separate business-facing ledger linked to technical jobs.

## Consequences

Do not add a competing queue or retry system on the Mac mini. New job kinds remain dark until a bounded producer and handler are approved.

## Security and data impact

Private payloads remain behind narrow service-role RPCs and lease-fenced worker operations.

## Alternatives considered

Using an OpenClaw queue as canonical execution state was rejected.

## Evidence and evaluation

The synthetic task must prove task-to-job linkage, lease-safe execution, result evidence, and terminal status.

## Revisit conditions

Revisit only after documented evidence that a required workload cannot fit the existing job contract.

## Related docs, code, tests and incidents

- `../../target-architecture.md`
- `../../portal-production-readiness.md`
