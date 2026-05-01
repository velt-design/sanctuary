# Agent Playbook For Portal Work

Status: Active protocol.

Audience: AI coding agents working on `apps/portal` or shared packages that affect portal behavior.

Purpose: provide a repeatable work loop for non-trivial portal tasks. Tiny copy edits and obvious docs-only fixes can use the relevant parts without treating this as a hard gate.

## When To Use

Use this playbook when a task changes, investigates, or verifies portal behavior, data flow, auth, schema, schedule, local-first state, design workbench behavior, estimates, quotes, invoices, design list, running jobs, job packs, or shared packages consumed by the portal.

For marketing-only or shared-package-only tasks, use the parts that affect portal boundaries, source-of-truth ownership, tests, or docs.

## Before Touching Code

- Run `git status --short`; identify unrelated worktree changes and leave them untouched.
- Read `AGENTS.md`, `docs/README.md`, this playbook, and the smallest relevant canonical doc.
- Scan `docs/decision-log.md` for entries matching the feature area, source-of-truth boundary, or risk pattern.
- Use `docs/change-routing.md` to map changed paths to owner docs, doc update triggers, and common task cards.
- For production-readiness, quality-gate, hardening, or parallel-lane work, read and update `docs/portal-production-readiness.md`.
- For parallel lanes, cross-app work, or workbench migration and compatibility work, read `docs/parallel-work-guardrails.md` before editing. `docs/design-workbench-parallel-migration-rules.md` is a historical redirect only.
- Use `rg` and `rg --files` to find owner files, tests, routes, APIs, docs, and old compatibility paths.
- Identify the owning layer before editing: package, domain library, API/RPC route, local-first adapter, component, or page.
- Make the change at the smallest owning layer that actually owns the behavior.
- Name the source of truth before changing logic:
  - Costing logic and base config live in `packages/costing`.
  - Geometry solving and assets live in `packages/geometry` or explicit portal drawing adapters.
  - Auth, roles, env, schema readiness, and migrations are governed by `docs/environment-auth-supabase.md`.
  - Supabase table/RPC ownership, write paths, and migration sources are governed by `docs/supabase-schema-map.md`.
  - Working copies, mutation queues, aliases, and conflicts are governed by `docs/local-first-sync.md`.
  - Schedule V2 behavior is governed by `docs/schedule.md`.
  - Tracking, consent, CSP, audits, and quality gates are governed by `docs/security-privacy-quality.md`.
- Risk-scan for service-role access, browser Supabase access, ordered migrations, local-first queues, PDF/email side effects, schedule drag/drop, Gantt rendering, workbench persistence, geometry compatibility, analytics, and consent.

## During Implementation

- Keep the diff scoped to the requested behavior and the files that own it.
- Preserve current public behavior unless the user explicitly asks for a behavior change.
- Prefer existing local helpers, API routes, query layers, and package exports over new parallel paths.
- Do not copy costing or geometry source-of-truth logic into apps.
- Staff/admin browser UI should use API, query, or local-first layers rather than direct Supabase table reads.
- Service-role Supabase access belongs only in server-owned flows, admin tooling, imports, public token flows, and automation.
- Add forward migrations for schema changes; do not edit old applied migrations without explicit direction.
- For schedule work, preserve Schedule V2 command/API boundaries and legacy fallback posture.
- For local-first work, preserve stable entity keys, queue semantics, optimistic edits, locks, and conflict recovery.
- For design workbench work, keep the object-first model authoritative, keep compatibility boundaries explicit, and follow the parallel work guardrails.
- For UI-heavy work, keep interaction states, loading states, empty states, keyboard/mouse flows, and responsive behavior in view while editing.

## Docs As Implementation

- Treat docs as part of the implementation surface.
- When changing portal behavior, data flow, source-of-truth boundaries, test strategy, or known risks, check the relevant canonical doc in the same task.
- If the doc is stale, update it in the same PR unless the user explicitly scoped docs out.
- Prefer small current-state updates to existing canonical docs over new long planning docs.
- Keep one canonical owner doc for each behavior and link to it instead of duplicating full rules across many docs.
- Do not delete active guardrail docs just because they are not pure current-state references.
- If a correction, bug, or regression reveals a reusable lesson, add it to `docs/decision-log.md` first.
- Promote a lesson from the decision log into this playbook only when it is durable, repeatable, and useful as a future checklist rule.

## Verification

- Choose tests proportional to risk and blast radius.
- For docs-only work, run `npm run docs:guard` and `npm run text:mojibake`.
- For focused portal logic, prefer the closest unit/integration test first, then broaden if shared behavior changed.
- For portal UI-heavy work, use Playwright or browser/manual checks where the change affects layout, interaction, routing, auth, or persisted state.
- For schedule work, consider `npm run schedule:bundle-budget`, smoke/performance checks, and manual drag/drop or Gantt checks when relevant.
- For auth, Supabase, and migration work, verify role boundaries, env assumptions, SQL ordering, readiness checks, and failure states.
- For PDF, email, invoice, quote, and public token flows, verify side effects and access boundaries, not only UI rendering.
- If a relevant check cannot be run, state that clearly in the final response with the reason.

Use `docs/testing-and-qa.md` for the canonical command catalog. Use the feature doc for additional focused verification commands when it lists them.

## Final Response

- Summarize what changed and where.
- List verification commands run and their result.
- Mention docs updated, or explicitly say docs were unchanged because behavior and guardrails did not change.
- Call out residual risk, assumptions, or checks not run.
- Mention unrelated worktree changes only when they were present and intentionally left untouched.

## Learning Loop

- Add a decision-log entry when user intervention, a bug, a regression, or a near miss reveals a reusable rule.
- Keep decision-log entries compact and indexed: date, area, status, decision or mistake, why it mattered, current guardrail, promoted-to, and related docs/tests.
- Leave detailed history out of this playbook; link to the relevant canonical doc or decision-log entry instead.
- Promote only stable behavior into this playbook. One-off context belongs in `docs/decision-log.md` or the relevant feature doc.

## Risk Routing

| Area | Read First | Extra Guardrail |
| --- | --- | --- |
| Path ownership and doc triggers | `docs/change-routing.md` | Use the trigger matrix before non-trivial edits and update only the owner docs that actually changed. |
| Portal production readiness | `docs/portal-production-readiness.md` | Keep current status, blockers, highest-leverage tasks, and parallel lanes up to date as readiness work lands. |
| Parallel or cross-app work | `docs/parallel-work-guardrails.md` | Declare lanes, owners, shared contracts, tests, docs, and integration dependencies. |
| Design workbench | `docs/design-workbench-architecture.md` | Read the design workbench overlay in `docs/parallel-work-guardrails.md` before migration or compatibility edits. |
| Drawing domain libraries | `apps/portal/lib/drawings/README.md` | Keep geometry/package boundaries explicit. |
| Drawing UI components | `apps/portal/components/drawings/README.md` | Keep component state aligned with object-first persistence. |
| Contacts, projects, estimates, calculator | `docs/projects-contacts-estimates-calculator.md` | Preserve project snapshot, pipeline, estimate lock, and local-first mutation boundaries. |
| Staff/admin/public-token APIs | `docs/staff-api-auth-contracts.md` | Use the right auth helper, Supabase client boundary, diagnostics pattern, and side-effect owner. |
| Supabase tables, RPCs, migrations, RLS, grants | `docs/supabase-schema-map.md` | Confirm the owner doc, primary write path, primary read path, access boundary, and migration source before editing. |
| Automation, email, audit, follow-ups | `docs/automation-email-audit.md` | Preserve idempotency, outbox visibility, server-owned sends, and audit records. |
| Local-first estimates/quotes | `docs/local-first-sync.md` | Preserve queue, lock, alias, and conflict behavior. |
| Quotes, invoices, job packs | `docs/quotes-invoices-job-packs.md` | Verify side effects, token boundaries, PDFs, emails, and generated artifacts. |
| Schedule | `docs/schedule.md` | Preserve Schedule V2 API/RPC command boundaries and legacy fallback posture. |
| Auth, env, Supabase | `docs/environment-auth-supabase.md` | Use server session helpers and ordered forward migrations. |
| Costing and geometry | `docs/costing-and-geometry.md` | Keep source-of-truth logic in packages. |
| Design List | `docs/design-list.md` | Keep spreadsheet shell and optimistic editing patterns aligned with Running Jobs where shared. |
| Running Jobs | `docs/running-jobs.md` | Preserve running-job list APIs and spreadsheet behavior. |
| Security and quality | `docs/security-privacy-quality.md` | Keep consent, tracking, CSP, and audit expectations aligned. |

## Anti-Patterns

- Deleting active guardrail docs without confirming usage or replacing them with an equivalent rule.
- Recreating a superseded guardrail path as a second active rule set instead of keeping one canonical active doc.
- Adding long future-plan docs when a small current-state update would keep agents more accurate.
- Repeating package source-of-truth logic inside portal code.
- Adding direct browser Supabase reads for staff/admin data.
- Editing old applied migrations without explicit direction.
- Treating docs-only tasks as a reason to skip stale-link and stale-status checks.
- Running broad formatting or cleanup across unrelated files.
