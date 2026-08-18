# AI-ADR-009: Structured Retrieval Precedes Semantic Retrieval

Status: Accepted

Date: 2026-08-18

Owners: Jordan / Sanctuary Pergolas

## Context

Project status, money, geometry, approvals, and workflow state have authoritative structured owners. Similarity search cannot establish their truth.

## Decision

Use structured owner queries for state and calculations. Use full-text or semantic retrieval as a derived recall aid for appropriate unstructured sources, with provenance and freshness.

## Consequences

Vector search is not a substitute for domain APIs, reconciliation, or source authority.

## Security and data impact

Permission filtering occurs before retrieval results enter model context. Embeddings inherit source classification and deletion requirements.

## Alternatives considered

Indexing all data into a vector store first was rejected.

## Evidence and evaluation

Retrieval tests must cover stale, conflicting, cross-project, and deleted sources.

## Revisit conditions

Revisit for a domain with no feasible structured owner only after a documented alternative is approved.

## Related docs, code, tests and incidents

- `../sanctuary-ai-master-plan.md`
