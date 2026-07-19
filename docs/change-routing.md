# Change Routing And Doc Triggers

Status: Active protocol.

This doc tells coding agents where to look before editing and which docs to update after a change. It is meant to reduce rediscovery, wrong-layer edits, duplicate logic, and stale docs.

Use it for non-trivial portal work, cross-app work, schema/API changes, side effects, or bugfixes that teach a reusable lesson.

## Operating Rule

- Start with the path or behavior being changed.
- For broad or ambiguous work, first identify the matching target-area lane in `docs/target-architecture.md`, then use this routing doc for owner docs and verification.
- Find the owning feature doc and source-of-truth layer before editing.
- Update docs in the same task when behavior, data flow, source-of-truth boundaries, tests, or known risks change.
- Add a `docs/decision-log.md` entry when a bug, regression, user correction, or near miss teaches a reusable guardrail.
- Promote decision-log lessons into this doc or another canonical doc only after the behavior is durable and repeatable.

## Doc Update Trigger Matrix

| Change Trigger | Check Or Update | Also Scan | Verification Cue |
| --- | --- | --- | --- |
| Portal workflow behavior changes | Owning feature doc and `docs/platform-workflow.md` if the cross-workflow sequence changes | `docs/decision-log.md` | Focused feature tests plus manual QA if UI or side effects changed. |
| Staff/admin/public-token route changes | `docs/staff-api-auth-contracts.md` and owning feature doc | `docs/supabase-schema-map.md` when tables/RPCs are touched | Route tests, auth failure states, diagnostics/error shape checks. |
| Supabase table, RPC, RLS, grant, or migration changes | `docs/supabase-schema-map.md`, owning feature doc, and `docs/environment-auth-supabase.md` if setup/readiness changes | `docs/staff-api-auth-contracts.md` | Ordered migration review, access boundary checks, focused route/domain tests. |
| Durable background-job kind, queue, payload, worker lifecycle, lease, effect checkpoint, rollout, or repair changes | `docs/supabase-schema-map.md` and `docs/target-architecture.md` | `docs/security-privacy-quality.md`, `docs/environment-auth-supabase.md`, `docs/testing-and-qa.md`, and the owning workflow doc when a producer or handler changes | `npm run test:jobs`; before rollout, run the disposable Docker-backed `npm run test:jobs:db` contract and record the result. |
| Local-first mutation, queue, alias, or lock behavior changes | `docs/local-first-sync.md` and owning workflow doc | `docs/projects-contacts-estimates-calculator.md` for estimate flows | Local-first tests plus pending/failed/conflict/lock manual checks. |
| Quote, invoice, PDF, email, token, artifact, or job-pack side effects change | `docs/quotes-invoices-job-packs.md` | `docs/staff-api-auth-contracts.md`, `docs/supabase-schema-map.md`, `docs/automation-email-audit.md` | Side-effect tests and public token invalid/expired/failure states. |
| Automation, email outbox, audit, follow-up, task, or site-visit notification behavior changes | `docs/automation-email-audit.md` | `docs/projects-contacts-estimates-calculator.md`, `docs/security-privacy-quality.md`, `docs/supabase-schema-map.md` | Idempotency, outbox status, audit event, and notification failure checks. |
| Schedule Board, Gantt, Site Visits, command, readiness, or legacy fallback changes | `docs/schedule.md` | `docs/supabase-schema-map.md`, `docs/parallel-work-guardrails.md` for parallel lanes | Schedule unit/route tests, readiness, bundle/performance, manual Board/Gantt/Site Visit checks. |
| Design List spreadsheet, request, or cell behavior changes | `docs/design-list.md` | `docs/projects-contacts-estimates-calculator.md`, `docs/supabase-schema-map.md` | Design package tests and spreadsheet manual checks. |
| Running Jobs spreadsheet, schedule-owned field, or legacy import changes | `docs/running-jobs.md` | `docs/schedule.md`, `docs/supabase-schema-map.md` | Running job tests, schedule-safe write checks, import checks if touched. |
| Design workbench, drawing persistence, interaction model, or compatibility migration changes | `docs/design-workbench-architecture.md`, drawing READMEs, and `docs/parallel-work-guardrails.md` | `docs/costing-and-geometry.md`, `docs/decision-log.md` | Drawing unit tests, geometry tests, browser smoke, visual checks when UI changes. |
| Costing or geometry package behavior changes | `docs/costing-and-geometry.md` | `docs/design-workbench-architecture.md` if workbench output changes | Package tests plus app tests for affected consumers. |
| Marketing tracking, consent, CSP, Lighthouse, or public conversion behavior changes | `docs/security-privacy-quality.md` | `docs/platform-workflow.md`, `docs/automation-email-audit.md` for enquiry/email effects | Marketing tests, Lighthouse/audit guards, consent/manual checks. |
| Large component, page, route, package, domain module, or test expansion | `docs/file-decomposition-and-ownership.md`, `docs/maintainability-principles.md`, and the owning feature doc | `docs/portal-production-readiness.md` for portal hotspots | Run `npm run files:report`; prefer extracting a cohesive owner before adding another responsibility. |
| Dead code, unused exports, unused dependencies, or legacy retirement | `docs/code-retirement-and-bloat-control.md` and the owning feature doc | `docs/target-architecture.md`, `docs/decision-log.md` | Run `npm run dead-code:report` or `npm run dead-code:changed`; prove unused before deleting. |
| Common commands, test strategy, or CI expectations change | `docs/testing-and-qa.md` | `docs/agent-playbook.md` if the rule becomes a checklist item | Run or update the command listed by the changed doc. |
| A bug or correction reveals a reusable lesson | `docs/decision-log.md` first | Promote later to this doc, `docs/agent-playbook.md`, or owner doc | Include related tests or guard commands in the decision-log entry. |

## Path Ownership Map

Use these globs as routing hints. They do not replace source inspection.

If a path pattern is intentionally kept for a legacy or future surface and does not match current repo paths, say `legacy` or `future` in the row note so `npm run docs:guard` can distinguish intentional routing coverage from stale drift.

| Paths | Read First | Notes |
| --- | --- | --- |
| `apps/portal/app/api/staff/v1/schedule/**`, `apps/portal/app/staff/schedule/**`, `apps/portal/lib/scheduling/**`, `apps/portal/lib/repo/schedule*` | `docs/schedule.md` | Keep Schedule V2 writes behind API/RPC commands and preserve readiness/fallback posture. |
| `apps/portal/app/api/staff/v1/projects/**`, `apps/portal/lib/projects/**` | `docs/projects-contacts-estimates-calculator.md` | Project actions may also touch automation, schedule, invoices, tasks, or email side effects. |
| `apps/portal/app/api/projects/**`, `apps/portal/app/api/estimates/**`, `apps/portal/lib/estimates/**`, `apps/portal/lib/localFirst/**`, `apps/portal/components/sync/**` | `docs/projects-contacts-estimates-calculator.md`, `docs/local-first-sync.md` | Preserve estimate locks, aliases, local IDs, optimistic state, and conflict recovery. |
| `apps/portal/app/api/quotes/**`, `apps/portal/app/api/staff/v1/quotes/**`, `apps/portal/lib/quotes/**`, `apps/portal/lib/invoices/**`, `apps/portal/lib/jobPacks/**`, `apps/portal/lib/outputs/**`, `apps/marketing/app/quote/**`, `apps/marketing/app/invoice/**` | `docs/quotes-invoices-job-packs.md` | Verify side effects, generated artifacts, token scoping, and public failure states. |
| `apps/portal/lib/emails/**`, `apps/portal/lib/automation/**`, `apps/portal/app/api/staff/v1/projects/**/emails/**`, `apps/marketing/app/api/contact/**`, `apps/marketing/app/api/enquiry/**`, `apps/marketing/lib/email/**`, `apps/marketing/emails/**` | `docs/automation-email-audit.md` | Keep email/outbox/audit/follow-up side effects idempotent and server-owned where possible. |
| `apps/portal/app/api/staff/v1/design-packages/**`, `apps/portal/app/staff/projects/design-packages/**`, `apps/portal/lib/designPackages/**` | `docs/design-list.md` | Spreadsheet writes should touch request-owned fields only. |
| `apps/portal/app/api/staff/v1/running-jobs/**`, `apps/portal/app/staff/projects/running-jobs/**`, `apps/portal/lib/runningJobs/**`, `scripts/import-running-jobs-legacy.ts` | `docs/running-jobs.md` | Keep manual, schedule-owned, and estimate-derived fields separate. |
| `apps/portal/components/drawings/**`, `apps/portal/lib/drawings/**`, `apps/portal/app/staff/projects/**/design-workbench/**`, `playwright/portal.drawing-workbench.spec.ts` | `docs/design-workbench-architecture.md`, `docs/parallel-work-guardrails.md` | Keep object-first model authoritative and compatibility bridges visible. |
| `packages/geometry/**` | `docs/costing-and-geometry.md` | If workbench render/plan output changes, also check `docs/design-workbench-architecture.md`. |
| `packages/jobs/**`, `scripts/test-background-jobs-db.mjs`, `supabase/tests/background_jobs*.sql`, `test/background-jobs-migration.test.ts`, `.github/workflows/background-jobs.yml` | `docs/supabase-schema-map.md`, `docs/target-architecture.md`, `docs/security-privacy-quality.md`, `docs/testing-and-qa.md` | Keep the queue message minimal, frozen input private, service-role RPC access explicit, and every worker-owned payload read/lifecycle mutation lease-fenced. JOB-01 is foundation-only until later jobs wire producers, handlers, and rollout. |
| `packages/costing/**`, `apps/portal/lib/costing/**`, `apps/portal/app/api/admin/**/cost*`, `apps/portal/app/pricebook/**` | `docs/costing-and-geometry.md` | Costing engine truth stays in `packages/costing`; portal tables store overrides. |
| `supabase/migrations/**`, `supabase/*.sql` | `docs/supabase-schema-map.md`, `docs/environment-auth-supabase.md` | Add forward migrations; treat root SQL as setup/snapshot unless a doc says otherwise. |
| `apps/marketing/components/*Analytics*`, `apps/marketing/components/*Pixel*`, `apps/marketing/app/runtime-*`, `apps/marketing/app/api/security/**`, Lighthouse/audit scripts | `docs/security-privacy-quality.md` | Keep consent category, purpose, owner, and privacy behavior aligned. |
| `docs/**`, `AGENTS.md`, `README.md` | `docs/README.md`, `docs/agent-playbook.md`, this doc | Keep one owner doc plus links. Avoid duplicating full rules across many docs. |

## Common Task Cards

### Adding Or Changing A Supabase Table Or RPC

1. Read `docs/supabase-schema-map.md` and the owning feature doc.
2. Add an ordered forward migration.
3. Confirm RLS, grants, service-role use, and staff/public access boundaries.
4. Update this map if the owner, write path, or access rule changes.
5. Run focused route/domain tests and any readiness check the feature doc names.

### Adding Or Changing A Staff API Route

1. Read `docs/staff-api-auth-contracts.md`.
2. Use the existing staff/admin helper for auth, responses, JSON parsing, and diagnostics.
3. Keep side effects in the owning domain helper or route family.
4. Update the owner doc when behavior or failure states change.
5. Test unauthenticated, wrong-role, invalid payload, and success states when relevant.

### Adding Or Changing A Durable Background Job

1. Change the kind, retry/rollout policy, or transition contract in `packages/jobs` before adding workflow-specific callers.
2. Keep PGMQ messages to `jobId` and `contractVersion`; frozen execution input belongs in the private payload row created atomically with the ledger and queue message.
3. Route enqueue, claim, payload read, progress, effect, completion, retry, cancellation, and repair through the service-role-only RPC boundary. Every protected payload read and worker-owned lifecycle/effect mutation must carry the current worker ID and random lease token; administrative cancellation, retry, recovery, and repair remain separate service-role RPC boundaries.
4. Preserve append-only state history. Keep domain-owned handler milestones separate from external effect checkpoints; do not infer completion from queue disappearance or provider dispatch alone.
5. Run `npm run test:jobs`. Before any worker or workflow rollout, run `npm run test:jobs:db`, which executes the rollback-wrapped SQL contract in a disposable logged-PGMQ container; static SQL assertions are not a substitute.

### Adding Or Changing A Side Effect

1. Identify the side-effect owner: quote/invoice/job pack, automation/email/audit, schedule, or project action.
2. Preserve idempotency keys, token scoping, outbox status, and audit records.
3. Keep customer-facing sends server-owned and failure-visible.
4. Add decision-log guidance if the side effect was easy to duplicate or trigger twice.

### Fixing A Regression

1. Add or update the closest test that would have caught it.
2. Update the owning feature doc if the behavior rule was unclear.
3. Add a compact `docs/decision-log.md` entry if the lesson is reusable.
4. Promote the lesson only if it becomes a stable future checklist rule.

### Touching A Warning Or Critical File

1. Read `docs/maintainability-principles.md` and `docs/file-decomposition-and-ownership.md`.
2. Identify the current owner and the smallest cohesive extraction that would reduce risk.
3. Prefer doing that extraction before adding new inline behavior.
4. If extraction is unsafe for this task, keep the code change minimal and name the deferred extraction in the handoff.
5. Run `npm run files:changed` before handoff and include the decomposition decision.

## Docs Bloat Control

- Keep one canonical owner doc for each behavior.
- Link to the owner doc instead of repeating full rules in every related doc.
- Prefer short current-state updates over new planning docs.
- Use `docs/decision-log.md` for lessons and this doc for durable routing rules.
- Run `npm run docs:guard` after changing agent docs, redirects, or canonical doc links.
- If a new doc mostly duplicates an existing owner doc, merge the useful details into the owner doc and do not keep both.
