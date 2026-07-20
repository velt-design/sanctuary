# Project Operational Command Centre Architecture

Status: Stage 0 output template  
Repository baseline: Not yet verified  
Implementation status: Not started

## How to use this document

This document is populated during Stage 0 after inspecting the actual repository. It records repository-grounded technical ownership and implementation decisions for the approved product contract in `project-command-centre-v1.md`.

Do not fill gaps with product speculation.

For every material claim:

- Cite an exact repository path.
- Name the relevant function, type, route, migration, test, or script where useful.
- Distinguish verified current behaviour from a recommendation.
- Record the repository commit or branch inspected.
- Mark production deployment or data assumptions that cannot be verified from source.
- State the owning canonical document.

Future implementation goals must update this document when technical ownership, schema, API boundaries, query keys, or component boundaries change.

## 1. Repository baseline and commit

Record:

- Repository.
- Default branch.
- Inspected commit SHA.
- Inspection date.
- Local checkout path, if used.
- `git status --short` result.
- Relevant open pull requests or branches that may affect the plan.
- Whether code-search results correspond to the inspected commit.
- Any uncommitted changes deliberately left untouched.

## 2. Repository documentation and change routing

Record the required guidance read before investigation:

- `AGENTS.md`.
- `docs/README.md`.
- `docs/agent-playbook.md`.
- `docs/change-routing.md`.
- `docs/maintainability-principles.md`.
- `docs/portal-production-readiness.md`.
- `docs/portal-ux-roadmap.md`.
- `docs/projects-contacts-estimates-calculator.md`.
- `docs/quotes-invoices-job-packs.md`.
- `docs/automation-email-audit.md`.
- `docs/supabase-schema-map.md`.
- `docs/staff-api-auth-contracts.md`.
- `docs/testing-and-qa.md`.
- Other area-owner docs discovered during investigation.

State:

- Which existing canonical docs must be updated in each stage.
- How the new `docs/product/` documents will be linked from `docs/README.md`.
- Whether `docs/change-routing.md` needs a Project Command Centre route.
- Whether the product documents should remain in `docs/product/` or move to the canonical docs root to fit repository conventions.
- How docs guards and navigation checks will be satisfied.

## 3. Existing project-page architecture

Map:

- Project route entrypoints.
- Server and client boundaries.
- Project snapshot query flow.
- Default tab resolution.
- Current Activity module.
- Project frame, header, rails, responsive Details behaviour, and tab lazy boundaries.
- Current CSS ownership.
- Existing project-page loading and error components.
- Existing tests and browser fixtures.

For each item, identify:

- Path.
- Responsibility.
- Whether it can be reused unchanged.
- Whether Stage 1 must extract, replace, or extend it.
- Bundle or maintainability risk.

## 4. Existing current-design resolution

Inspect and document:

- Current quote selection precedence.
- Current estimate selection.
- Quote-to-estimate source linking.
- Fallback behaviour when a source estimate is missing.
- Design-summary extraction.
- Price fallback behaviour.
- Multiple-module summary.
- Declined quote treatment.
- Existing tests.
- Consumers beyond the project Activity bar.

Explicitly answer:

- Where the current resolver must remain unchanged for existing consumers.
- Whether the Command Centre needs a strict sibling resolver or a safe change to the shared resolver.
- How to prevent a missing quote source from borrowing another estimate.
- How quote price and estimate price will remain distinguishable.
- Which tests prove historical quote accuracy.

## 5. Estimate and quote domain ownership

Map:

- Estimate tables and types.
- Estimate version labels.
- Active-draft semantics.
- Estimate detail and metadata queries.
- Estimate pricing freshness and stored-costing semantics.
- Estimate editability and lock rules.
- Quote, quote-version, and line-item ownership.
- Quote source-estimate fields.
- Quote total storage.
- Quote send-readiness logic.
- Quote send, resend, accept, decline, and revision paths.
- Quote send logs and delivery evidence.
- Relevant public-token and side-effect boundaries.

Identify:

- Which values can be shown read-only in Stage 1.
- Which values require a new Command Centre read model.
- Which business rules must call existing domain helpers rather than be reimplemented.

## 6. Existing project snapshot

Document:

- Snapshot type.
- Snapshot API route.
- Summary route.
- Query keys and options.
- Placeholder and cache seeding.
- Authenticated server clients.
- Relations currently embedded.
- Relation limits.
- Freshness and generated timestamp.
- Current activity, email, note, task, and project fields.
- Access-ending behaviour.
- Refresh-failed behaviour.
- Existing tests.

Produce a table:

| Required V1 value | Already in snapshot | Available elsewhere | New read model needed | Notes |
| --- | --- | --- | --- | --- |

Recommend whether the Overview should:

- Extend the main snapshot.
- Use separate lazy queries.
- Use a dedicated Command Centre endpoint.
- Use a combination.

Justify the recommendation against performance, source ownership, and failure semantics.

## 7. Existing ownership fields

Investigate:

- `sales_owner_id`.
- `designer_owner_id`.
- `pm_owner_id`.
- Design List designer fields.
- Portal users and staff identity.
- Any estimating-owner equivalent.
- Owner UI or APIs.
- Migration sources.
- RLS and grants.
- Production compatibility fallbacks.
- Current data population.

For each owner concept, record:

| Owner role | Candidate canonical source | Current consumers | Migration status | Data completeness risk | Recommendation |
| --- | --- | --- | --- | --- | --- |

Explicitly determine:

- Whether legacy owner fields are in ordered migrations or only setup/baseline SQL.
- Whether they are safe to use in production.
- Whether Design Owner should derive from a request or remain a project role.
- The smallest model for Estimating Owner.
- How owner display names resolve without copying names.
- Which authenticated API owns assignment.

## 8. Existing next-action and task systems

Map separately:

1. Project compatibility next-action fields.
2. Dashboard next-action actions and helpers.
3. Stage checklist checks in `project_task_checks`.
4. Action tasks derived from stage state.
5. Automation `tasks`.
6. Quote `followup_tasks`.
7. Personal `portal_dashboard_tasks`.
8. Any task or reminder APIs and UI.
9. Audit events related to actions.
10. Dashboard work queue.

For each, document:

- Table and fields.
- API and domain owner.
- Assignment support.
- Due-date support.
- Completion support.
- Rescheduling support.
- Idempotency.
- Current UI consumer.
- Whether it may be a primary-action source.
- Whether it must remain excluded.

Produce the recommended canonical primary-action architecture, including:

- Selection versus copied task data.
- Manual-action support.
- Source references.
- Owner resolution.
- Due-date semantics.
- Audit history.
- Completion and reschedule commands.
- Cache updates.
- RLS and grants.
- Migration implications.
- Backfill or compatibility strategy.

Explicitly prove that the design does not create another general task system.

## 9. Existing communication and activity sources

Inspect:

- Project notes and RLS.
- Email outbox.
- Quote send logs.
- Estimate or indicative email records.
- Site-visit communication.
- Audit events.
- Quote outcomes.
- Existing `ProjectActivityItem` types.
- Current snapshot activity mapping.
- Emails tab.
- Dashboard recent activity.
- Existing event times.
- Existing preview or body boundaries.

Recommend:

- The canonical merged communication and timeline read model.
- Whether structured call/message metadata should extend `project_notes` or use another existing event record.
- How historical notes remain compatible.
- How personal and automated communication are distinguished.
- How event grouping works.
- How partial-source failures remain truthful.
- Which technical events remain hidden.

## 10. Existing auth and permissions

Document:

- `portal_users`.
- Current `admin` and `staff` roles.
- Staff and admin route helpers.
- Portal session and client provider.
- Existing project-note permissions.
- Existing quote, estimate, and task permissions.
- Service-role boundaries.
- Browser direct-write guards.
- Current user or directory data available for owner selection.

Recommend:

- V1 staff permissions.
- V1 admin permissions.
- Whether any new capability table is required now.
- Why a broader role model should or should not wait.
- RLS and grants for ownership, primary action, structured communication, and approval records.

## 11. Existing loading, caching, and local-first model

Map:

- Project summary and full-snapshot states.
- Query keys.
- Placeholder-data semantics.
- Cache patching and invalidation.
- Local-first mutation keys.
- Working-copy behaviour.
- Pending, retry, conflict, lock, and unavailable states.
- Navigation and prefetch boundaries.
- Project-opening performance markers.

For every planned controlled action, identify:

- Owning API.
- Optimistic or local-first behaviour.
- Pending UI.
- Rollback.
- Retry.
- Conflict handling.
- Cache updates.
- Access-ending response behaviour.

## 12. Existing tests and performance gates

List:

- Current-design resolver tests.
- Current-design summariser tests.
- Project snapshot tests.
- Project page tests.
- Activity and note tests.
- Task mutation tests.
- Quote and estimate tests.
- Dashboard tests.
- Auth and RLS tests.
- Browser project-opening fixtures.
- Authenticated smoke tests.
- Performance tests.
- Bundle-budget scripts.
- Build, typecheck, lint, docs, architecture, and changed-file commands.

For each future stage, identify the exact tests and commands required.

Record current known budgets without changing them.

## 13. Canonical V1 data ownership map

Complete this table for every V1 value:

| V1 value | Canonical source | Existing helper/query | In current snapshot | New read model | Schema change | Data completeness risk | Prohibited duplicate | Proposed API | Required tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Include at minimum:

- Project identity.
- Customer identity.
- Site address.
- Address verification.
- Site-visit requirement.
- Pipeline stage.
- Sales Owner.
- Design Owner.
- Estimating Owner.
- Current quote.
- Current source estimate.
- Design summary.
- Customer price.
- Costing freshness.
- Estimate lock.
- Quote delivery result.
- Primary next action.
- Primary action owner and due date.
- Workstream states.
- Latest outbound customer update.
- Latest customer response.
- Timeline.
- Blockers and warnings.
- Commercial approval.
- Internal true cost and margin.

## 14. Required read models

For each proposed read model, state:

- Product need.
- Owner.
- Inputs.
- Output type.
- API or server boundary.
- Cache key.
- Freshness.
- Failure semantics.
- Access semantics.
- Performance impact.
- Tests.
- Stage introduced.

Compare alternatives and choose one.

Potential read models to assess:

- Command Centre summary.
- Strict current design.
- Workstream resolver.
- Issue resolver.
- Latest communication.
- Merged timeline.
- Primary-action candidate resolver.

## 15. Required migrations

For each potential migration, state:

- Whether it is required.
- Stage.
- New or altered table/column.
- Canonical ownership.
- Data type and constraints.
- Indexes.
- RLS.
- Grants.
- Backfill.
- Compatibility.
- Rollback posture.
- Schema map update.
- Focused tests.

Potential needs to investigate:

- Reliable project owners.
- Estimating Owner.
- Primary-action selection or manual action.
- Address-verification evidence.
- Site-visit requirement decision.
- Structured communication metadata.
- Version-bound commercial approvals.

Do not recommend one broad Command Centre table containing derived state.

## 16. Required API boundaries

For every controlled action, define:

- Route or server action.
- Auth helper.
- Request shape.
- Validation.
- Domain owner.
- Response shape.
- Idempotency.
- Conflict behaviour.
- Audit event.
- Cache patching or invalidation.
- Tests.

Actions to assess:

- Assign owner.
- Select or create primary action.
- Complete action.
- Reschedule action.
- Reassign action.
- Verify address.
- Mark site visit not required.
- Log customer communication.
- Request approval.
- Decide approval.

## 17. Component reuse plan

Map proposed components to existing owners.

Include:

- Overview root.
- Identity header.
- Critical exception strip.
- Current design and commercial card.
- Primary next-action card.
- Workstream strip.
- Latest communication card.
- Timeline.
- Existing notes presenter.
- Existing tasks presenter.
- Existing surface and page-state components.
- Responsive CSS ownership.
- Lazy boundaries.

For each component, state:

- Reuse.
- Extend.
- Extract.
- Replace.
- Retire.
- Stage.

Respect file-decomposition and bundle boundaries.

## 18. Test and fixture strategy

Define representative deterministic fixtures for:

- New website lead.
- Standard residential estimate.
- Multiple estimate versions.
- Sent revised quote.
- Accepted quote with newer estimate.
- Declined quote.
- Missing quote source estimate.
- No owner.
- No primary action.
- Overdue action.
- Failed customer email.

For each scenario, map:

- Database or in-memory fixture.
- Unit tests.
- Component tests.
- API tests.
- Browser test.
- Expected diagnostics.
- Cleanup or data-safety rules.

Prefer fixture routes or deterministic staging scenarios over customer-data mutation.

## 19. Recommended PR and goal sequence

For every future unit, provide:

- Stage.
- Pull request number within the stage.
- Durable outcome.
- Exact scope.
- Explicit exclusions.
- Dependencies.
- Repository areas.
- Schema implications.
- Verification.
- Completion criteria.
- Main risks.
- Recommended reasoning level.

Stage 0 may split a stage into smaller pull requests when that reduces risk, but it may not broaden V1.

## 20. Technical risks

Record at minimum:

- Current-design fallback affects other consumers.
- Quote source estimate can be archived or unavailable.
- Current owner fields may be legacy or undeployed.
- Next-action data is fragmented.
- Task duplication.
- Partial timeline reads.
- Permission model cannot distinguish business roles.
- New Overview bundle growth.
- Project snapshot payload growth.
- Cache coherence after controlled actions.
- Stale data shown as current.
- Historical commercial record mutation.
- New docs not discoverable by repository guards.

For each risk, include:

- Likelihood.
- Business consequence.
- Technical consequence.
- Mitigation.
- Stage.
- Verification.

## 21. Confirmed implementation decisions

List only repository-grounded decisions accepted after Stage 0.

Each entry includes:

- Decision.
- Evidence.
- Alternatives considered.
- Reason.
- Product rule supported.
- Stage affected.

## 22. Unresolved technical questions

Include only questions that cannot be resolved from the current repository inspection.

Separate:

- Repository uncertainty.
- Production deployment or data uncertainty.
- Business decision required from Jordan.
- Decision deferred to a later stage.

Do not ask Jordan to answer a repository question that further inspection can resolve.

## 23. Repository evidence index

Provide a concise evidence index:

| Area | Path | Symbol or section | Finding |
| --- | --- | --- | --- |

This index should let future Codex sessions navigate directly to the owning code and docs without broad rediscovery.

## 24. Update rules

Future implementation goals must update this architecture document when they change:

- Canonical source.
- Schema.
- API boundary.
- Query key.
- Cache behaviour.
- Permission.
- Component owner.
- Test owner.
- Failure semantics.
- Stage sequence.

Do not turn this document into a chronological diary. Keep it current, and use the repository decision log for reusable lessons and incidents.
