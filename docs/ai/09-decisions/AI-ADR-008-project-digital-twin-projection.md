# AI-ADR-008: Project Digital Twin Is A Typed Projection

Status: Accepted

Date: 2026-08-18

Owners: Jordan / Sanctuary Pergolas

## Context

Project truth already has specialised owners for workflow, geometry, costing, commercial records, schedule, artifacts, and communication.

## Decision

The Project Digital Twin is a versioned typed projection across those owners. It does not replace them with one monolithic table or AI-maintained summary.

## Consequences

Adapters declare provenance, version, freshness, and unresolved conflicts. Mutations continue through the owning domain.

## Security and data impact

Projection access remains project-, role-, purpose-, and classification-scoped.

## Alternatives considered

Copying all project data into a new AI database was rejected.

## Evidence and evaluation

Initial inventories must identify every source owner and reconciliation rule before broad retrieval.

## Revisit conditions

Revisit only through an independently approved domain-consolidation programme.

## Related docs, code, tests and incidents

- `../../target-architecture.md`
- `../sanctuary-ai-master-plan.md`
