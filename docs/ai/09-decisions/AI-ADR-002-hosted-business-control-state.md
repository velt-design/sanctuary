# AI-ADR-002: Canonical Business Control State Remains Hosted

Status: Accepted

Date: 2026-08-18

Owners: Jordan / Sanctuary Pergolas

## Context

An office machine can lose power, network access, storage, or credentials and must not become a business single point of failure.

## Decision

Portal, Supabase/Postgres, GitHub, and governed document storage retain canonical state. Private nodes consume durable work and publish structured results.

## Consequences

Node-local state is disposable cache or execution state. Manual Portal workflows remain usable while a node is unavailable.

## Security and data impact

Private nodes receive only task-scoped data and retain it for the minimum required period.

## Alternatives considered

Running the primary database or only task ledger on the Mac mini was rejected.

## Evidence and evaluation

The node-offline rehearsal must leave hosted business access intact and tasks truthfully queued or blocked.

## Revisit conditions

Revisit only if a documented data-residency or on-premise requirement materially changes.

## Related docs, code, tests and incidents

- `../00-vision.md`
- `../../target-architecture.md`
