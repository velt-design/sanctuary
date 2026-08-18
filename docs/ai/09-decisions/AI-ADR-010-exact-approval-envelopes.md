# AI-ADR-010: Consequential Effects Require Exact Approval Envelopes

Status: Accepted

Date: 2026-08-18

Owners: Jordan / Sanctuary Pergolas

## Context

A generic confirmation does not prove who approved which exact action, target, payload, authority, and time window.

## Decision

Consequential effects initially require an immutable approval envelope bound to the task, action, target, payload hash, required role, approver, expiry, and single-use consumption.

## Consequences

Payload changes or expiry invalidate approval. Retries preserve idempotent intent and cannot substitute a new effect identity.

## Security and data impact

Approval records are auditable but expose only safe summaries to normal readers. Restricted payloads remain private.

## Alternatives considered

Chat confirmation, standing agent permission, and reusable approval tokens were rejected.

## Evidence and evaluation

Adversarial tests must cover replay, expiry, wrong role, changed payload, duplicate consumption, cancellation, and uncertain effects.

## Revisit conditions

One narrow action class may move to supervised autonomy only after representative evaluation and explicit promotion.

## Related docs, code, tests and incidents

- `../00-vision.md`
- `../../target-architecture.md`
