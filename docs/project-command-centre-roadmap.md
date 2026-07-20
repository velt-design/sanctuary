# Project Operational Command Centre Roadmap

Status: Active programme tracker  
Current stage: Stage 1 complete in the working tree
Product definition: Complete  
Implementation: Stage 1 complete; not published
Next action: Review Stage 1 evidence, then explicitly approve or revise Stage 2 before implementation

## Index

- [Document hierarchy](#document-hierarchy)
- [Stage sequence](#stage-sequence)
- [Stage status](#stage-status)
- [Operating rules](#operating-rules)
- [Stage 1 handoff](#stage-1-handoff)

## Programme purpose

This roadmap tells any future ChatGPT, Codex, or human contributor:

- What controls the programme.
- Which stage is current.
- What has been completed.
- What may be changed now.
- What must remain out of scope.
- What evidence is required before advancing.

Keep this document concise. Product detail belongs in `project-command-centre-v1.md`. Repository-grounded implementation detail belongs in `project-command-centre-architecture.md`.

## Document hierarchy

1. `project-command-centre-vision.md` controls long-term direction and non-negotiable principles.
2. `project-command-centre-v1.md` controls V1 product behaviour, scope, exclusions, and acceptance criteria.
3. `project-command-centre-architecture.md` records verified repository ownership, implementation decisions, migrations, APIs, components, tests, and risks.
4. This roadmap records programme stage and completion evidence.
5. Individual Codex goals control one bounded stage or approved pull request.

When documents conflict:

- Product behaviour follows the V1 specification.
- Repository facts follow the architecture document after Stage 0.
- An implementation goal may not silently alter either.

## Stage sequence

### Product definition

#### Outcome

- Permanent product vision agreed.
- V1 product contract agreed.
- Stage sequence agreed.
- Stage 0 goal prepared.

#### Scope

Product and workflow decisions only.

#### Exclusions

- No code.
- No migration.
- No technical architecture presented as verified repository fact.

#### Status

Complete.

---

### Stage 0: Repository assessment

#### Outcome

- Produce the complete proposed content for `project-command-centre-architecture.md`.
- Verify every relevant repository assumption.
- Produce the final implementation and pull-request sequence.
- Identify required read models, APIs, migrations, RLS, tests, fixtures, and documentation.
- Produce a tight proposed Stage 1 prompt.

#### Scope

Read-only repository investigation.

#### Exclusions

- No application code changes.
- No migration.
- No branch or pull request.
- No Stage 1 implementation.
- No product-rule changes.

#### Completion evidence

- Architecture document is specific enough that Stage 1 does not need to rediscover repository ownership.
- Genuine technical unknowns and business decisions are separated.
- Stage 1 scope and verification are approved.

#### Status

Complete.

---

### Stage 1: Read-only Command Centre shell

#### Outcome

- `Overview` becomes the staff-facing default project experience.
- Project identity, current design, current commercial record, and existing customer context are clear.
- Current-design and commercial fallbacks are trustworthy.
- Existing loading, stale, failure, and unavailable states remain truthful.

#### Scope

Read-only information derived from existing trusted data wherever possible.

#### Exclusions

- No new owner workflow.
- No canonical primary-action implementation.
- No workstream editing.
- No approval system.
- No structured call or message records.
- No later lifecycle functionality.

#### Completion evidence

- Current design and price pass all approved source scenarios.
- Missing quote source never borrows another estimate.
- Existing specialist workflows remain accessible.
- Project performance and bundle gates remain green.

#### Status

Complete in the working tree; not published.

---

### Stage 2: Ownership and primary next action

#### Outcome

- Reliable Sales, Design, and Estimating ownership where applicable.
- One primary next action per active project.
- Owner, due state, completion, rescheduling, and reassignment.
- No-owner and no-action dashboard exceptions.
- No duplicate general task system.

#### Scope

Ownership, primary-action selection, controlled actions, audit history, and dashboard exceptions.

#### Exclusions

- No general task manager.
- No subtasks or dependencies.
- No Project Manager or builder ownership.
- No advanced notifications.
- No installation workflow.

#### Completion evidence

- Source tasks are referenced, not copied.
- One action is shown.
- Failure recovery is complete.
- Due dates are timezone-safe.
- Business SLA and severity decisions are recorded in the V1 specification.

#### Status

Not started.

---

### Stage 3: Lead-to-quote workstreams

#### Outcome

Four evidence-derived workstreams:

1. Sales and customer commitment.
2. Site information.
3. Design and estimating.
4. Quote and commercial.

#### Scope

Server-derived state, evidence, actions, address verification, and the smallest explicit site-visit requirement decision if required.

#### Exclusions

- No manually editable workstream health.
- No engineering.
- No consent.
- No procurement.
- No installation readiness.
- No completion or defects.

#### Completion evidence

- Every state is reproducible from canonical evidence.
- Unknown is used when evidence is inadequate.
- Each warning and blocker routes to its owner.
- Business decisions for address verification and site-visit requirements are approved.

#### Status

Not started.

---

### Stage 4: Communication summary and timeline

#### Outcome

- Latest meaningful outbound customer update.
- Latest customer response.
- Structured call and message records.
- Unified meaningful project timeline.
- Failed material communication visibility.

#### Scope

Communication read model, optional structured note metadata, event grouping, and logging controls.

#### Exclusions

- No inbox integration.
- No private-email ingestion.
- No SMS sending.
- No customer portal.
- No AI summaries.

#### Completion evidence

- Automated acknowledgement is distinct from personal contact.
- Historical notes remain valid.
- Timeline is business-readable rather than technical noise.
- Existing note permissions remain intact.

#### Status

Not started.

---

### Stage 5: Blockers, warnings, and approvals

#### Outcome

- Reliable critical exceptions and warnings.
- Version-bound commercial approvals where source data is trustworthy.
- Approval audit and invalidation.
- Dashboard exception integration.

#### Scope

Issue resolver, issue actions, approved commercial controls, permissions, and audit.

#### Exclusions

- No generic approval builder.
- No engineering or consent approvals.
- No scheduling override.
- No construction release.
- No AI risk detection.

#### Completion evidence

- Red, amber, blocker, and approval meanings are deterministic.
- A manual green state is impossible.
- Approval thresholds are approved.
- Material quote or estimate changes invalidate relevant approval.

#### Status

Not started.

---

### Stage 6: Responsive polish and complete QA

#### Outcome

- Production-ready desktop, tablet, and mobile Overview.
- Accessibility and recovery behaviour.
- Complete representative fixtures.
- Performance, bundle, and workflow verification.
- Staff pilot and rollout readiness.

#### Scope

Cross-stage quality, documentation, pilot preparation, and final acceptance evidence.

#### Exclusions

- No new business workflow.
- No later-lifecycle feature.
- No general design-system rewrite.
- No unrelated portal redesign.

#### Completion evidence

- Five staff complete the unfamiliar-project test.
- All V1 acceptance criteria pass or have an approved exception.
- Existing portal quality gates remain green.
- Documentation matches implementation.
- Pilot, rollback, and measurement process are documented.

#### Status

Not started.

## Stage status

| Stage | Status | Current PR | Completion evidence |
| --- | --- | --- | --- |
| Product definition | Complete | - | Vision, V1 specification, roadmap, and Stage 0 prompt approved |
| Stage 0: Repository assessment | Complete | - | Repository-grounded architecture, ownership, boundary, risk, and Stage 1 sequence recorded against baseline `ea1641c6` |
| Stage 1: Read-only shell | Complete in working tree | Not published | Strict read model/API/query, Overview UI, legacy retirement, deterministic fixtures, focused/project/browser/performance tests, typecheck, lint, isolated production build, and unchanged bundle-budget assertions |
| Stage 2: Ownership and primary action | Not started | - | - |
| Stage 3: Lead-to-quote workstreams | Not started | - | - |
| Stage 4: Communication and timeline | Not started | - | - |
| Stage 5: Exceptions and approvals | Not started | - | - |
| Stage 6: Responsive QA and rollout | Not started | - | - |

## Operating rules

- One stage per Codex goal unless the architecture document explicitly recommends smaller pull requests within that stage.
- Use one reviewable pull request per implementation unit where practical.
- Do not pull later-stage work forward without explicit approval.
- Product rules may change only through an approved update to `project-command-centre-v1.md`.
- Repository architecture findings belong in `project-command-centre-architecture.md`.
- Every completed stage updates this roadmap with status, PR, and completion evidence.
- Every Codex prompt states:
  - Current stage.
  - Previous completed stage.
  - Exact outcome.
  - Scope.
  - Exclusions.
  - Verification.
  - Completion criteria.
- Schema changes require:
  - Ordered forward migration.
  - RLS and grants decision.
  - API ownership.
  - Backfill or compatibility decision.
  - Rollback posture.
  - Focused tests.
  - Documentation update.
- No implementation goal may redefine the product.
- No implementation goal may make workstream state manually editable.
- No implementation goal may duplicate canonical design, quote, price, communication, or issue state.
- Do not weaken access, loading, local-first, performance, bundle, or historical-record guarantees to make a stage easier.
- Stage 0 may recommend splitting an implementation stage, but may not broaden V1.

## Stage 1 handoff

```text
Stage completed: Stage 1 - Read-only Command Centre shell
Pull request: None; working-tree implementation only, not published
Repository baseline: ea1641c6c6647d22603d07b9f980cc3a1dad95fc
Product behaviour delivered: Overview default label; strict current quote/estimate, source, price, delivery, and costing-freshness read model; existing customer context, notes, tasks, Details, and specialist workflows retained
Verification completed: selector/loader/route/component/access tests; 322 project tests; 15 browser checks passed with 1 conditional workbench skip; 9 fixture performance checks; repository typecheck and lint; isolated production build; all unchanged bundle budgets; docs, architecture, file, ownership, and strict dead-code reports
Known limitations: authenticated smoke and production performance could not be rerun locally because PORTAL_TEST_EMAIL and PORTAL_TEST_PASSWORD were unavailable; the canonical build preflight was correctly blocked by the user's pre-existing port-3001 dev server, so the same production build and budget assertions ran against an isolated Next output directory
Architecture document updates: Stage 0 repository contract completed and Stage 1 implementation/evidence recorded
Roadmap updates: Stage 0 and Stage 1 complete; Stage 2 remains unapproved
Next approved stage: None. Stage 2 requires explicit approval.
```

## Stage handoff template

At the end of every stage, record:

```text
Stage completed:
Pull request:
Repository head:
Product behaviour delivered:
Verification completed:
Known limitations:
Architecture document updates:
Roadmap updates:
Next approved stage:
```
