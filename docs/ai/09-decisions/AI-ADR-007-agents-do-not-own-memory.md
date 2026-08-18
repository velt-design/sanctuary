# AI-ADR-007: Agents Do Not Own Canonical Memory

Status: Accepted

Date: 2026-08-18

Owners: Jordan / Sanctuary Pergolas

## Context

Agent histories and local memory can be stale, opaque, deleted, or tied to a replaceable runtime.

## Decision

Agents may use task-scoped working memory and derived assertions. Canonical facts, decisions, evidence, and artifacts remain in their governed owner systems.

## Consequences

Important outcomes must be written through typed, auditable domain or task contracts. Conversation history alone is never business truth.

## Security and data impact

Local memory has explicit classification and retention and must be revocable without losing canonical records.

## Alternatives considered

A persistent agent transcript as the company knowledge base was rejected.

## Evidence and evaluation

Rebuild and runtime-replacement tests must preserve task and business evidence without restoring private conversation state.

## Revisit conditions

The ownership rule is not expected to change; only storage and retrieval implementations may.

## Related docs, code, tests and incidents

- `../00-vision.md`
- `../sanctuary-ai-master-plan.md`
