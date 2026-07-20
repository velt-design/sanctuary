# Coding Agent Guide

This repo is optimized for coding agents. OpenAI Codex uses this `AGENTS.md` file as the repo instruction entrypoint. Claude Code uses `CLAUDE.md`, which is only a Claude-specific shim that points back here.

Read this file first, then follow links into `docs/README.md`. For non-trivial or risky portal work, read `docs/agent-playbook.md` and scan relevant `docs/decision-log.md` entries before editing.

## First Moves

**Gate 0 - design workbench / geometry / costing work.** If the task touches `apps/portal/lib/drawings/**`, `apps/portal/components/drawings/**`, `apps/portal/app/staff/projects/[projectId]/design-workbench/**`, `packages/geometry/**`, or the costing engine's input layer, you MUST read [docs/design-workbench-architecture.md section "Product North Star (READ FIRST)"](docs/design-workbench-architecture.md) before writing code or proposing a next task. Every PR proposal in these paths must answer, in writing: (a) which legacy audit row(s) does this touch (cite by number from `docs/design-workbench-legacy-cull.md` or "N/A"), (b) does this REMOVE legacy or BUILD ON legacy? Build-on PRs require explicit user approval BEFORE coding (documenting a workaround in `decision-log.md` is not a substitute), (c) does this PR have Phase 2 dependencies (cost engine input migration, `inputs.modules` consumer changes)? If yes, split into a Phase 1 chunk and a deferred Phase 2 chunk, and (d) if this PR consolidates two or more functions/types, list their parameter/field differences explicitly - each difference must be equivalent, pluggable, added as a parameter in the consolidation, or explicitly acceptable to lose given Phase 1's "workbench can break temporarily" permission. Before answering: grep for ALL consumers of the file/function/type being changed - discovering a missed consumer mid-PR means the scope is wrong and needs resurfacing. **Phase 1 only requires the marketing-site enquiry -> estimate email path to keep working; workbench UX can break temporarily.**

1. Check `git status --short` before editing.
2. Read `docs/agent-playbook.md` for non-trivial portal work.
3. Read `docs/maintainability-principles.md` before bugfixes, migrations, or work in large/high-risk portal files.
4. Scan `docs/decision-log.md` for matching areas, risks, or past mistakes.
5. For non-trivial changes, use `docs/change-routing.md` to identify owner docs, path ownership, and doc update triggers.
6. For production-readiness, quality-gate, hardening, or parallel-lane work, read `docs/portal-production-readiness.md`.
7. Read `docs/target-architecture.md` when a change could expand app/package boundaries, root compatibility paths, data access patterns, or source-of-truth ownership.
8. Read `docs/file-decomposition-and-ownership.md` before expanding a large component, route, package, domain module, or test.
9. Read `docs/code-retirement-and-bloat-control.md` before deleting code, removing dependencies, or retiring legacy compatibility paths.
10. Read the smallest relevant current-state doc in `docs/`.
11. Prefer `rg` and `rg --files` for repo discovery.
12. Keep changes scoped to the requested surface.
13. Do not revert user changes or unrelated worktree changes.
14. For parallel or dirty-tree work, run `npm run worktree:status`; use `WORKTREE_OWNER_PATTERNS` to declare owned paths when the task has a clear lane.
15. Run `npm run architecture:changed` before handoff for non-trivial work; it includes handoff-time worktree ownership and dead-code changed reporting.
16. Run `npm run dead-code:changed` directly before handoff when doing deletion, dependency, or cleanup work that needs the focused dead-code report.
17. Run `npm run dead-code:changed:strict` for focused cleanup/tooling verification when newly added unused files should be blocked locally.
18. Run `npm run architecture:changed:strict` only for architecture/tooling PRs or explicit strict verification; declare `WORKTREE_OWNER_PATTERNS` first when the tree is dirty.
19. Run focused changed-file guards directly when you need a narrower report: `files:changed`, `root:compat:changed`, `browser:supabase:changed`, or `service-role:changed`.
20. If the task changes portal behavior, data flow, source-of-truth boundaries, test strategy, or known risks, update the relevant doc in the same pass.

## Repo Map

- `apps/marketing`: public site, enquiry flows, public quote and invoice routes, analytics and consent.
- `apps/portal`: staff portal, authenticated project workflow, estimates, quotes, invoices, schedule, running jobs, design list, job packs, admin.
- `apps/worker`: dedicated Node background worker; dark by default, RPC-only against the durable job boundary, and independent of Next.js/browser code.
- `packages/costing`: only source of truth for costing engine and base config.
- `packages/email-provider`: only source of truth for Resend transport, frozen-request hashing, provider idempotency, timeout, and webhook-signature verification.
- `packages/geometry`: only source of truth for geometry solving and 3D/profile assets.
- `packages/jobs`: only source of truth for durable background-job kinds, safe contracts, retry/rollout policy, and state/effect transitions.
- `packages/quote-format`: shared quote display/formatting.
- `packages/theme`: shared theme exports.
- `supabase`: ordered migrations and legacy baseline SQL snapshots.
- `scripts`: operational scripts. Check env requirements before running scripts that touch Supabase or external services.

## Commands

Use `docs/testing-and-qa.md` as the canonical command source. Feature docs may list additional focused verification commands for their area.

## Source Of Truth Boundaries

- Costing imports must come from `@sp/costing`; do not copy engine/config logic into apps.
- Resend wire calls, provider idempotency keys, frozen-request hashes, and webhook signature verification must come from `@sp/email-provider`; application email modules stay thin adapters.
- Geometry imports should use `@sp/geometry` or portal drawing adapters; keep compatibility paths explicit.
- Durable background-job kinds, worker-safe runtime contracts, retry policy, and transition policy must come from `@sp/jobs`. The worker uses the explicit service-role RPC adapter only; do not infer an enabled producer, domain handler, or rollout from the worker package, registry, or migrations.
- Portal staff/admin APIs should use auth-bound server clients and `requireStaffSession` or `requireAdminSession`.
- Service-role Supabase access is reserved for server-owned flows, admin tooling, imports, public token flows, and automation.
- Browser UI should use API/query/local-first layers rather than direct Supabase table reads.
- Schedule V2 writes go through staff API/RPC command routes; do not bypass with ad hoc table mutation.
- Design List and Running Jobs share the spreadsheet shell and optimistic editing patterns.

## Maintainability Default

- Long-term maintainability is a default part of portal work, not a separate cleanup phase.
- When touching a warning or critical file from `npm run files:report`, assume the task includes one small maintainability improvement unless that would make the change riskier.
- Prefer extracting a named owner, helper, controller, adapter, view model, or child component before adding new inline behavior to a hotspot.
- If extraction is unsafe in the same pass, keep the behavior change minimal and name the deferred extraction in the handoff.
- A handoff for touched warning or critical files should state the file, owner, whether extraction was done or deferred, and the next safe extraction.

## Risky Areas

- `apps/portal/app/staff/schedule`: large interactive surface with Board, Gantt, Site Visits, legacy fallback, drag/drop, and performance budgets.
- `apps/portal/components/projects/ProjectPage/tabs/EstimatesTab.tsx` and `QuotesTab.tsx`: local-first flows, locks, quote state, PDF/email side effects.
- `apps/portal/lib/drawings` and `apps/portal/components/drawings`: object-first workbench, geometry compatibility, drawing persistence. Read `docs/parallel-work-guardrails.md` before migration work here.
- `supabase/migrations`: ordered production schema history. Add forward migrations; do not edit old applied migrations without explicit direction.
- Public marketing analytics and conversion routes: consent, privacy, and tracking docs must stay aligned.

## Documentation Stewardship

- Treat docs as part of the implementation surface.
- If a canonical doc is stale after your change, update it unless the user explicitly scoped docs out.
- Prefer small current-state doc updates over new long planning docs.
- If a bug, regression, or correction teaches a reusable lesson, add a compact entry to `docs/decision-log.md`.
- Do not delete active guardrail docs just because they are not pure current-state references.

## Canonical Docs

- `docs/agent-playbook.md`: active protocol for non-trivial portal work.
- `docs/change-routing.md`: path ownership, doc update triggers, common task cards, and docs bloat control.
- `docs/portal-production-readiness.md`: active tracker for production-grade portal status, quality gates, blockers, priorities, and parallel lanes.
- `docs/architecture.md`: repo structure and boundaries.
- `docs/target-architecture.md`: target workspace shape, north-star data path, and migration direction.
- `docs/maintainability-principles.md`: repo-specific maintainability rules, failure modes, and code-review heuristics.
- `docs/file-decomposition-and-ownership.md`: active guardrail for splitting large files by responsibility and keeping portal code SaaS-ready.
- `docs/code-retirement-and-bloat-control.md`: active guardrail for unused code, dependency cleanup, and safe legacy retirement.
- `docs/workbench-visual-snapshot-loop.md`: how to take and read rendered workbench screenshots when iterating on layout / density / tokens (uses `/qa/design-workbench-fixture` and Playwright; mandatory read before any visual-only PR in the workbench).
- `docs/platform-workflow.md`: business workflow across marketing and portal.
- `docs/environment-auth-supabase.md`: env, auth, roles, schema readiness.
- `docs/supabase-schema-map.md`: table/RPC ownership, write paths, access boundaries, and migration sources.
- `docs/staff-api-auth-contracts.md`: staff/admin/public-token route auth, Supabase client boundaries, diagnostics, and response conventions.
- `docs/automation-email-audit.md`: automation events, project tasks, follow-ups, email outbox, email previews, and audit side effects.
- `docs/testing-and-qa.md`: test commands, Playwright, manual QA.
- `docs/projects-contacts-estimates-calculator.md`: contacts, projects, project snapshots, calculator estimates, estimate locks, and local-first estimate mutations.
- `docs/quotes-invoices-job-packs.md`: quote, invoice, public-token, PDF/email, and job-pack side effects.
- `docs/parallel-work-guardrails.md`: canonical active guardrails for parallel work across apps, packages, docs, and workbench migration lanes. The old `docs/design-workbench-parallel-migration-rules.md` path is a redirect only.
- `docs/costing-and-geometry.md`: costing and geometry semantics.
- `docs/local-first-sync.md`: working copies, queue, aliases, conflict handling.
- `docs/design-workbench-architecture.md`: object-first design workbench.
- `docs/decision-log.md`: indexed lessons and guardrails from past mistakes.
- `docs/design-list.md`: Design List current behavior.
- `docs/running-jobs.md`: Running Jobs current behavior.
- `docs/schedule.md`: Schedule V2 current behavior and legacy fallback posture.
- `docs/security-privacy-quality.md`: tracking, consent, security, quality gates.
