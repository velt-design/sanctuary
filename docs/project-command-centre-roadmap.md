# Project Operational Command Centre Roadmap

Status: Active programme tracker
Current stage: Overview V2 composition deployed; portfolio-wide Project Work adoption and legacy-task retirement implemented but pending production rollout
Product definition: Complete
Implementation: Historical Stages 1 and 2 plus the production Project Work foundation are present. The current slice adds the replay-safe all-project rollout, five journey phases, authoritative Active/Waiting/Closed/Archived portfolio views, one paged Work Queue, one Overview work surface, and complete legacy project-task UI/read/write retirement. It preserves the portal system and existing semantic V2 commands.
Next action: Apply the rollout migration first, release its application consumers, then complete catalog/schema-cache, repository-gate, and authenticated read-only Projects/Dashboard/Work Queue/Overview verification without shared-data mutation.
Next implementation stage: After rollout proof only. Deposit, Schedule/Running Jobs readiness, normalized activity, and complete exception summaries still require separately reviewed bounded server projections.

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

Keep this document concise. Current redesign detail belongs in the approved handover in `project-command-centre-architecture.md`; historical V1 detail remains in `project-command-centre-v1.md`.

## Document hierarchy

1. `project-command-centre-vision.md` controls long-term direction and non-negotiable principles.
2. `project-command-centre-architecture.md` section `Approved Overview V2 Implementation Handover (READ FIRST)` controls the current redesign and records its repository ownership, implementation boundaries, tests, and risks.
3. `project-work-items-and-follow-up.md` and `project-work-items-technical-plan.md` control the current Project Work product and technical boundaries.
4. `project-command-centre-v1.md` is the historical V1 baseline and retains only non-conflicting design/commercial truth rules.
5. This roadmap records programme stage and completion evidence.
6. Individual Codex goals control one bounded stage or approved pull request.

When documents conflict:

- Product behavior for the current redesign follows the approved V2 handover and Project Work contract.
- Non-conflicting current-design and commercial precedence follows the V1 specification.
- Repository facts follow the architecture document after Stage 0.
- An implementation goal may not silently alter either.

## Stage sequence

Stages 0-6 below record the historical V1 programme. **Overview V2 composition is deployed; portfolio adoption is the active rollout.** The five journey phases group existing stages for presentation and filtering only. Any future readiness or full-lifecycle summary remains deferred and must use bounded server-owned evidence under a separate reviewed contract.

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

Complete in commit `8770198f`, which is present in the current repository history.

---

### Stage 2: Ownership and primary next action

#### Outcome

- One reliable Project Owner from lead through deposit, chosen from Jordan, JP, Joe, or Bruce.
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

Repository implementation complete. The product contract, both canonical migrations, selector/domain APIs, project/dashboard UI, automation cutover, compatibility projection, legacy writer retirement, and repository-local gates are complete. Stage completion remains Yellow until both ordered migrations pass an executable PostgreSQL/Supabase smoke and authenticated real-project Playwright passes with provisioned staff credentials plus dedicated safe mutation and conflict projects.

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
| Stage 1: Read-only shell | Complete in `8770198f` | Present in current repository history | Strict read model/API/query, Overview UI, legacy retirement, deterministic fixtures, focused/project/browser/performance tests, typecheck, lint, isolated production build, and unchanged bundle-budget assertions |
| Stage 2: Ownership and primary action | Repository complete; environment gates pending | Present in current repository history | Canonical ownership/actions/audit migrations, selector, APIs, Overview/header/dashboard UI, automation persistence extraction, and legacy writer retirement implemented. Local evidence: 335/335 project tests, 18/18 fixture Playwright checks, full typecheck/lint, isolated 66-page production build, unchanged six-route bundle budgets, architecture/docs/dead-code guards. Executable smoke for both ordered migrations and authenticated real-project Playwright remain required. |
| Stage 3: Lead-to-quote workstreams | Historical/deferred | - | Superseded as the next step by the approved Overview V2 handover |
| Stage 4: Communication and timeline | Not started | - | - |
| Stage 5: Exceptions and approvals | Not started | - | - |
| Stage 6: Responsive QA and rollout | Not started | - | - |
| Overview V2 redesign | Complete and deployed; narrow handoff exception later closed | `20a8adee`, production release `c9e73651` | Five required top-level owners plus extracted V2/legacy controls, command orchestration, conflict/history, visibility-policy, and shared-cache owners; one mixed-model Project Work surface; filtered read-only legacy rows; focused Project Work and project coverage, 70 browser checks, responsive/accessibility evidence, full build/static gates, unchanged Project Detail budget, manual authenticated inspection, and the automated authenticated read-only staging command passed. The pre-existing Contacts/Calculator overruns were accepted only for the handoff; their ceilings remained unchanged, and later isolated route optimization brought both within budget. Production cutover and snapshot-cache verification then passed without migrating pre-cutover projects. |

## Operating rules

- One stage per Codex goal unless the architecture document explicitly recommends smaller pull requests within that stage.
- Use one reviewable pull request per implementation unit where practical.
- Do not pull later-stage work forward without explicit approval.
- Product rules may change only through an approved update to the current V2 handover or its named successor.
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
- Historical Stage 0 could split an implementation stage but could not broaden V1. Current implementation may not broaden the approved V2 handover.

## Stage 1 handoff

```text
Historical stage handoff: Stage 1 - Read-only Command Centre shell
Pull request at the time: None recorded; commit `8770198f` is now present in current repository history
Repository baseline: 8770198f
Product behaviour delivered at Stage 1: Overview default label; strict current quote/estimate, source, price, delivery, and costing-freshness read model; existing customer context, notes, tasks, Details, and specialist workflows retained. Later project-shell work consolidated Details into Overview, replaced the legacy project estimate surface with Calculator, grouped Quotes/Invoices in Commercial, and retired the Emails UI.
Verification completed: selector/loader/route/component/access tests; 322 project tests; 15 browser checks passed with 1 conditional workbench skip; 9 fixture performance checks; repository typecheck and lint; isolated production build; all unchanged bundle budgets; docs, architecture, file, ownership, and strict dead-code reports
Known limitations: authenticated smoke and production performance could not be rerun locally because PORTAL_TEST_EMAIL and PORTAL_TEST_PASSWORD were unavailable; the canonical build preflight was correctly blocked by the user's pre-existing port-3001 dev server, so the same production build and budget assertions ran against an isolated Next output directory
Architecture document updates: Stage 0 repository contract completed and Stage 1 implementation/evidence recorded
Roadmap updates at the time: Stage 0 and Stage 1 complete; Stage 2 baseline begins at `8770198f`
Historical next stage at that checkpoint: Stage 3. Current state: the approved Overview V2 redesign is complete in `20a8adee`, deployed through the controlled Project Work cutover, and its narrow historical bundle exception is closed by later optimization without raising ceilings. No later lifecycle summary is approved merely because its eventual position is shown in the handover.
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
