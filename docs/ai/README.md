# Sanctuary AI Docs

Status: Active routing page.

This directory is the durable home for Sanctuary AI strategy, architecture, decisions, operations, and evaluation material. Current repository and domain docs remain authoritative for behavior that is already implemented.

## Read First

- `00-vision.md`: accepted Sanctuary AI constitution, business outcomes, boundaries, and initial autonomy rule.
- `09-decisions/README.md`: accepted architectural decisions and ADR authoring template.
- `sanctuary-ai-master-plan.md`: proposed 12-24+ month strategic and technical programme. It is a target, not authority to change current application behavior.
- `operations/README.md`: Mac mini setup, secret, backup, rebuild, revocation, and incident-response routing.
- `../target-architecture.md`: current repository target boundaries and migration direction.
- `../portal-production-readiness.md`: current portal priorities and production-readiness evidence.
- `../change-routing.md`: owner-doc and verification routing for implementation work.

## Status Rules

- **Proposed:** under review; does not authorize implementation by itself.
- **Strategic target:** approved direction; not current behavior.
- **Current contract:** implemented behavior and source-of-truth boundary.
- **Active roadmap:** approved next work and tracked status.
- **Decision record:** durable choice, rationale, and revisit conditions.
- **Evidence record:** observed validation, benchmark, or audit result.
- **Historical:** retained context only.

Create detailed owner docs only when their implementation slice begins. Until then, keep the master plan proposed and avoid duplicating current repository contracts here.

## Current Programme State

- PR-AI-001, master plan and routing: complete.
- PR-AI-002, constitution and initial ADRs: complete.
- PR-AI-003, provider-neutral `@sp/ai` contract package: complete.
- PR-AI-004, hosted synthetic task ledger and private input boundary: complete in the repository; production migration remains separate and unapplied.
- PR-AI-005, exact expiring single-use synthetic approval envelopes: complete in the repository; production migration remains separate and unapplied.
- PR-AI-006, authenticated read-only Portal AI activity: complete in the repository. The APIs expose only explicit public safe projections through the request's auth-bound client, and the gated QA route renders synthetic data only. There is no production navigation entry or write control.
- PR-AI-007, deterministic synthetic execution through the existing jobs/worker spine: complete in the repository. The fixed `ai_synthetic_v1` handler records task/job linkage plus zero-cost usage and deterministic evaluation evidence; it has no provider, model, network, customer, project, communication, or external-effect path. Production migrations and worker rollout remain separate and unapplied.
- PR-AI-008, private node registration and heartbeat: next. It owns service-only node identity, capability, health, revocation, and stale-heartbeat evidence; it does not activate OpenClaw or production execution.
- Mac mini: hardware received. The secure-node operations packet is complete in the repository; physical setup, private account choices, and rehearsal evidence remain pending.
- OpenClaw: not yet an active Sanctuary runtime; it remains dark until sandbox, tool policy, private networking, recovery, and synthetic-task evidence are complete.
- Production effects: prohibited during the initial node deployment.
