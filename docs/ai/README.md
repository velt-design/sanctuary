# Sanctuary AI Docs

Status: Active routing page.

This directory is the durable home for Sanctuary AI strategy, architecture, decisions, operations, and evaluation material. Current repository and domain docs remain authoritative for behavior that is already implemented.

## Read First

- `00-vision.md`: accepted Sanctuary AI constitution, business outcomes, boundaries, and initial autonomy rule.
- `09-decisions/README.md`: accepted architectural decisions and ADR authoring template.
- `sanctuary-ai-master-plan.md`: proposed 12-24+ month strategic and technical programme. It is a target, not authority to change current application behavior.
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
- PR-AI-004, hosted synthetic task ledger and private input boundary: active. It adds no model/provider call, worker handler, external effect, or production deployment.
- Mac mini: hardware received; secure node baseline is the current operational priority.
- OpenClaw: not yet an active Sanctuary runtime; it remains dark until sandbox, tool policy, private networking, recovery, and synthetic-task evidence are complete.
- Production effects: prohibited during the initial node deployment.
