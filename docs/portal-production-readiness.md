# Portal Production Readiness

Status: Active evolving tracker.

Last updated: 2026-05-02.

Purpose: keep agents and maintainers aligned on the path to a first-class, production-grade internal portal. This doc is the dashboard for current readiness, blockers, priorities, parallel lanes, and next actions. Detailed behavior rules stay in the canonical docs linked below.

## End Goal

The portal should be a reliable internal production system for day-to-day Sanctuary staff work.

Production grade means:

- Quality gates are green, repeatable, and enforced in CI.
- Staff, admin, and public-token access boundaries are explicit and tested.
- Supabase migrations, RLS, grants, RPCs, and server clients match the documented source-of-truth boundaries.
- Core workflows are safe under real use: contacts, projects, estimates, quotes, invoices, job packs, schedule, design workbench, Design List, and Running Jobs.
- Server-owned side effects such as email, PDFs, public tokens, invoice creation, and job-pack generation are tested at the domain boundary, not only in UI render tests.
- Heavy portal surfaces load and respond within their budgets.
- Local-first flows show pending, failed, retry, conflict, and locked states clearly.
- Compatibility and legacy fallback paths are named, visible, tested, and removed when no longer needed.
- Large files and high-risk surfaces have clear ownership, small modules, and focused tests.
- Large portal files follow `docs/file-decomposition-and-ownership.md` before major feature expansion so the portal remains SaaS-extractable.
- Docs match the implementation and are updated as part of the work.

## How To Use This Doc

Agents must use this doc as a living checklist, not a static plan.

Before taking non-trivial portal production-readiness work:

1. Read `../AGENTS.md`.
2. Read `docs/agent-playbook.md`.
3. Read `docs/change-routing.md`.
4. Read this doc.
5. Read the smallest relevant canonical doc for the area being changed.
6. Scan `docs/decision-log.md` for matching risks or past mistakes.
7. Check `git status --short` and leave unrelated changes untouched.

When work changes readiness status, blockers, priorities, verification commands, parallel lanes, or newly discovered risks, update this doc in the same pass. Prefer updating existing rows and checklist items over adding long new sections.

Use `npm run docs:readiness` for an advisory summary of tracker age, at-risk rows, and unchecked checklist counts. The report makes stale readiness visible, but it does not replace rerunning the listed commands or manual checks.

Do not duplicate detailed rules from canonical docs here. Link to them, then keep this doc focused on current readiness state, next actions, and coordination.

## Current Readiness Snapshot

This snapshot records the most recent known production-readiness state from the portal review on 2026-05-01. Re-run the listed commands before treating any item as current after new work lands. If a row is older than the current work, treat it as a last known signal, not live truth, until the relevant command or manual check is repeated.

| Area | Status | Last Known Signal | Next Action |
| --- | --- | --- | --- |
| Portal tests | Green | `npm run portal:doctor:quick` completed `npm run test:portal`: 172 files and 1077 tests passed. | Keep using focused portal scripts during feature work and quick doctor for routine readiness. |
| Lint and guards | Green | `npm run portal:doctor:quick` completed `npm run lint`, including docs guard, cache guard, brand guard, mojibake, and ESLint. | Keep lint in quick doctor and portal PR CI. |
| Schedule bundle budget | Green | `npm run schedule:bundle-budget` passed after a fresh portal build: 588.8 KiB initial raw, 169.1 KiB initial gzip, 333.2 KiB lazy raw, 78.3 KiB lazy gzip. | Keep the budget in portal CI and re-run after schedule chunk changes. |
| Production security audit | Green | `npm audit --omit=dev` reported 0 vulnerabilities during blocker review. | Keep audit visible through `portal:doctor` and governance checks. |
| Portal build | Yellow | `npm run build:portal` passed, but Turbopack reported an unexpected NFT trace through `apps/portal/app/api/quotes/preview-pdf/route.ts` -> `apps/portal/lib/quotes/pdf.ts` -> `apps/portal/next.config.ts`. | Keep build green and investigate quote PDF font/image asset tracing so the warning is removed. |
| Typecheck | Green | `npm run typecheck` passed after the `ModelSpaceViewport.test.tsx` placement-case typing fix; `npm run portal:doctor:quick` also completed typecheck. | Keep typecheck in quick doctor and CI. |
| Browser smoke | Yellow | `npm run test:portal:browser` passed locally: 2 fixture tests passed. `npm run test:portal:smoke` and `npm run test:portal:performance` now fail fast before Playwright server startup when `PORTAL_TEST_EMAIL` or `PORTAL_TEST_PASSWORD` is missing. | Run auth/performance smoke when staff test credentials are configured. |
| Docs and routing | Green | Canonical docs, agent playbook, change routing, and decision log are present. | Keep this tracker and owner docs current. |
| File decomposition | Yellow | `docs/file-decomposition-and-ownership.md`, `npm run files:report`, and `npm run files:changed` make large-file hotspots visible, but enforcement is advisory while transitional files remain. | Use changed-file reporting before handoff when expanding large files; add strict enforcement later. |
| Local-first flows | Yellow | Strong primitives exist; production readiness depends on workflow smoke and visible failure states. | Verify pending, failed, retry, conflict, and lock states in changed flows. |
| Quote/invoice/job-pack side effects | Yellow | Domain docs and tests exist; production readiness depends on token/email/PDF/job-pack smoke. | Run focused tests plus manual public-token and side-effect QA. |
| Schedule workflow | Yellow | V2 API/RPC boundaries and tests exist; performance budget and readiness need confirmation. | Verify readiness route, Board/Gantt/Site Visits, and bundle budget. |
| Design workbench | Yellow | Object-first direction and compatibility guardrails exist; behavior drift was present in review failures. | Keep reducing compatibility surface and verify browser fixture gates. |

## Production-Grade Checklist

### Quality Gates

- [x] `npm run portal:doctor:quick` passes for routine local readiness.
- [ ] `npm run portal:doctor` passes for broad pre-merge readiness when Playwright auth/env and audit expectations are ready.
- [x] `npm run typecheck` passes.
- [x] `npm run docs:guard` passes.
- [x] `npm run text:mojibake` passes.
- [x] `npm run lint` passes.
- [x] `npm run test:portal` passes.
- [x] `npm run build:portal` passes.
- [x] `npm run schedule:bundle-budget` passes after a fresh portal build.
- [x] `npm run audit:security` has no unresolved high or critical production vulnerabilities.
- [ ] `npm run test:portal:smoke` passes for authenticated portal routing.
- [x] `npm run test:portal:browser` passes for drawing/workbench browser smoke without silent full-suite skips.
- [ ] `npm run test:portal:performance` passes route timing budgets.

### Critical Staff Workflows

- [ ] Login, logout, no-access, and access-status flows verified.
- [ ] Contacts list, create, update, and detail flows verified.
- [ ] Projects list, create, detail snapshot, pipeline, and task flows verified.
- [ ] Calculator estimate creation, update, versioning, summary, and warnings verified.
- [ ] Estimate edit locks verified for sent, accepted, and declined quote-backed estimates.
- [ ] Local-first estimate and quote flows verified for pending, success, failure, retry, alias, and conflict states.
- [ ] Quote draft, refresh, preview, PDF, send, resend, accept, decline, and revise flows verified.
- [ ] Deposit invoice creation, send, retry/failure, public token, and PDF flows verified.
- [ ] Job-pack generation, reuse, PDF, and powdercoating override conflict flows verified.
- [ ] Design request creation and Design List spreadsheet editing verified.
- [ ] Schedule Board assignment, reorder, move, unschedule, and refresh persistence verified.
- [ ] Schedule Gantt date alignment, range controls, crew collapse, and bar behavior verified.
- [ ] Site Visits booking, assignment, confirmation, reschedule, cancellation, unschedule, and orphan cleanup verified.
- [ ] Running Jobs spreadsheet edits, legacy row handling, and schedule-owned read-only fields verified.
- [ ] Design workbench edit, save, reload, object-first geometry, plan, 3D, and fallback visibility verified.

### Security And Data Boundaries

- [ ] Staff APIs use `requireStaffSession` or `requireStaffContext`.
- [ ] Admin APIs use `requireAdminSession` or `requireAdminContext`.
- [ ] Public quote and invoice flows remain token-bound and hash-checked.
- [ ] Service-role Supabase access is server-only and limited to documented owner flows.
- [ ] `npm run service-role:changed` is included in handoffs that touch service-role Supabase access.
- [ ] Browser UI does not add direct table writes outside API, query, local-first, or approved spreadsheet adapters.
- [ ] `npm run browser:supabase:changed` is included in handoffs that touch browser-facing Supabase access.
- [ ] Schedule V2 writes go through staff API routes and `schedule_v2_*` RPC commands.
- [ ] Quote, invoice, PDF, email, and job-pack side effects go through domain helpers.
- [ ] Migrations are ordered forward migrations; old applied migrations are not edited without explicit direction.
- [ ] RLS and grants are documented for changed tables or RPCs.
- [ ] Raw tokens, token hashes, service-role keys, and private artifact access do not reach client components, logs, PDFs, or public props.

### Performance And UX

- [ ] Schedule page meets bundle and route timing budgets.
- [ ] Project list and project detail pages meet route timing budgets.
- [ ] Contacts list meets route timing budgets.
- [ ] Heavy views are lazy-split by actual workflow boundaries.
- [ ] Board, Gantt, Site Visits, design workbench, and spreadsheet surfaces remain responsive under realistic data volume.
- [ ] Loading, empty, error, pending, retry, stale, and locked states are visible and useful.
- [ ] Core workflows are manually checked at desktop and mobile/tablet widths where staff may use them.
- [ ] Browser tests or manual screenshots confirm high-risk canvas/SVG/3D views are nonblank and correctly framed.

### Maintainability

- [ ] Large files have an owner and a decomposition plan before major feature work continues in them.
- [ ] `npm run architecture:changed` is included in non-trivial portal handoffs.
- [ ] Selective strict architecture checks are used for tooling PRs and later CI candidates without blocking legacy debt.
- [ ] `npm run files:report` is reviewed before expanding warning or critical files.
- [ ] `npm run files:changed` is included in handoffs that touch warning or critical files.
- [ ] `npm run root:compat:changed` is included in handoffs that touch root compatibility paths before portal SaaS extraction work continues.
- [ ] Source-of-truth boundaries are preserved for costing, geometry, schedule, local-first, quotes, invoices, and job packs.
- [ ] Compatibility and legacy fallback paths are isolated, named, and tested.
- [ ] No new duplicate workflow rules are added in components when an owning domain helper or definition exists.
- [ ] New tests land at the owning layer first, then broaden only when blast radius requires it.
- [ ] Docs are updated when behavior, data flow, source-of-truth boundaries, test strategy, or known risks change.

## Highest Leverage Tasks

Keep this ordered list current as work lands.

1. Restore remaining browser quality gates: authenticated smoke and performance smoke.
2. Fix server-client and env isolation drift in contacts/projects/project snapshot tests.
3. Investigate the portal build NFT warning in quote PDF font/image asset tracing.
4. Keep Board, Gantt, and Site Visits split by workflow as schedule work continues.
5. Fix design workbench behavior drift and keep browser fixture gates meaningful.
6. Verify quote, invoice, public-token, PDF/email, and job-pack side effects end to end.
7. Add or confirm CI enforcement for typecheck, docs guard, portal tests, portal build, authenticated smoke, route performance, and security audit expectations.
8. Use `npm run files:report` and `npm run files:changed` to guide large-file decomposition after gates are green, one owner surface at a time.

## Parallel Work Lanes

Parallel work is encouraged when ownership is clear and file overlap is low. Read `docs/parallel-work-guardrails.md` before running concurrent lanes across shared contracts, packages, apps, docs, or workbench migration areas.

| Lane | Scope | Safe In Parallel With | Avoid Touching |
| --- | --- | --- | --- |
| Quality gate repair | Current failing tests, lint guards, build blockers. | Security/deps, docs tracker updates, isolated feature fixes. | Broad refactors not needed for the failure. |
| Security/dependency audit | Production dependency upgrades, audit remediation, residual-risk notes. | Contacts/projects, schedule performance, workbench fixes. | Large feature behavior changes unless required by upgrade. |
| Contacts/projects env boundary | Contact APIs, contact/project server data helpers, project snapshot tests. | Schedule, workbench, style isolation, security/deps. | Quote/invoice side-effect helpers unless failure crosses that boundary. |
| Schedule performance | `/staff/schedule`, schedule queries, schedule CSS, route timing, bundle split. | Contacts/projects, workbench, security/deps. | Design workbench, quote/invoice, unrelated portal shell. |
| Design workbench | `apps/portal/components/drawings`, `apps/portal/lib/drawings`, workbench fixture/browser gates. | Contacts/projects, schedule, security/deps. | Calculator or costing files unless needed by explicit geometry contract. |
| Quote/invoice/job packs | Quote/invoice/job-pack domain helpers, token routes, PDFs, email side effects. | Schedule performance, style isolation, docs updates. | Contacts/projects internals unless working on a documented handoff. |
| Style isolation and portal shell | Shared layout, surface styles, PageHeader, portal shell tests. | Security/deps, contacts/projects, schedule. | Feature behavior and workflow-specific CSS unless required by isolation test. |
| CI/typecheck/tooling | Scripts, workflows, typecheck, docs guard, command docs. | Most domain lanes. | Domain behavior changes unless a gate requires a small fix. |
| Large-file decomposition | `CalculatorGridClient`, `ModuleViewsCard`, `ScheduleClient`, `Geometry3DViewport`, `ModelSpaceViewport`, and files reported by `npm run files:report`. | Only lanes that do not touch the same files. | Active feature fixes in the same large file. |

## Canonical References

Use these docs as routing references. Do not copy their full rules into this tracker.

| Area | Read First |
| --- | --- |
| Agent protocol | `docs/agent-playbook.md` |
| Path ownership and doc update triggers | `docs/change-routing.md` |
| Repo and app boundaries | `docs/architecture.md` |
| File decomposition and ownership | `docs/file-decomposition-and-ownership.md` |
| Whole platform workflow | `docs/platform-workflow.md` |
| Commands, QA gates, browser tests | `docs/testing-and-qa.md` |
| Auth, env, Supabase setup | `docs/environment-auth-supabase.md` |
| Staff/admin/public route contracts | `docs/staff-api-auth-contracts.md` |
| Supabase tables, RPCs, migrations, RLS | `docs/supabase-schema-map.md` |
| Contacts, projects, estimates, calculator | `docs/projects-contacts-estimates-calculator.md` |
| Local-first queues and working copies | `docs/local-first-sync.md` |
| Quotes, invoices, public tokens, job packs | `docs/quotes-invoices-job-packs.md` |
| Automation, email outbox, audit events | `docs/automation-email-audit.md` |
| Costing and geometry source of truth | `docs/costing-and-geometry.md` |
| Design workbench | `docs/design-workbench-architecture.md` |
| Parallel or cross-area work | `docs/parallel-work-guardrails.md` |
| Schedule | `docs/schedule.md` |
| Design List | `docs/design-list.md` |
| Running Jobs | `docs/running-jobs.md` |
| Security, privacy, audits | `docs/security-privacy-quality.md` |
| Lessons and durable guardrails | `docs/decision-log.md` |

## Update Rules

When updating this tracker:

- Update `Last updated` at the top.
- Move checklist items only after verification or a clearly documented finding.
- Add exact commands and results to the relevant row or change note.
- Keep status labels simple: Green, Yellow, Red, Unknown.
- Prefer compact factual notes over future-plan prose.
- If a finding creates a reusable rule, add or update `docs/decision-log.md`.
- If implementation changes behavior or ownership, update the canonical owner doc as well.
- Keep this file ASCII and link to repo-relative paths.

## Change Notes

### 2026-05-02

- Added `npm run portal:auth-env` and wired it into authenticated portal Playwright gates plus broad `portal:doctor` so missing `PORTAL_TEST_EMAIL` or `PORTAL_TEST_PASSWORD` fails before authenticated server startup. The no-auth drawing fixture gate remains independent through `npm run test:portal:browser`.
- Local authenticated smoke and performance verification remain externally blocked until staff test credentials and a compatible portal database are available.

### 2026-05-01

- Restored the no-auth drawing fixture browser gate: `npm run test:portal:browser` passed locally with 2 fixture tests passing and the auth-backed project discovery smoke skipped by design. The remaining browser-gate work is authenticated smoke and performance smoke with staff test credentials.
- Added the portal speed tooling command plan: focused portal test scripts, `portal:doctor:quick`, `portal:doctor`, and matching CI/doc routing.
- Added logged gate variants for agent-friendly verification: `portal:doctor:quick:log`, `portal:doctor:log`, and `test:portal:log` run the same source-of-truth commands while keeping noisy stdout/stderr in OS temp logs.
- Easy health pass updated current gate status: typecheck, lint, docs guards, portal tests, portal build, schedule bundle budget, and production audit are green locally; portal build remains Yellow because of the Turbopack/NFT quote PDF tracing warning; fixture browser smoke now fails loudly when fixture coverage cannot run instead of silently skipping.
- Verification note: after the fixture smoke skip policy changed, `npm run test:portal:browser` fails locally with "Fixture workbench route requires staff auth in this portal environment; browser smoke coverage did not run" instead of reporting a false-green skipped suite.
- Cleared the quick-doctor typecheck blocker by typing the semantic placement cases in `apps/portal/components/drawings/viewports/ModelSpaceViewport.test.tsx`; `npm run typecheck` passed.
- `npm run portal:doctor:quick` passed when captured to a log: docs guard, mojibake, typecheck, lint, and `npm run test:portal` all completed; portal tests reported 172 files and 1077 tests passed.
- `npm audit --omit=dev` reported 0 vulnerabilities. Full local authenticated smoke still needs `PORTAL_TEST_EMAIL` and `PORTAL_TEST_PASSWORD`; fixture browser smoke can run without auth.
- Created this tracker to coordinate portal production-readiness work.
- Initial review identified quality gates as the highest leverage priority before broad feature expansion.
- Known review findings to re-verify: portal tests failing, lint guard failing, schedule bundle budget failing, and production audit reporting vulnerabilities.
- Parallel lanes identified: quality gate repair, security/deps, contacts/projects env boundaries, schedule performance, design workbench behavior, quote/invoice/job-pack side effects, style isolation, CI/typecheck/tooling, and large-file decomposition after gates are green.
