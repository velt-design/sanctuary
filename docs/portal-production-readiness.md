# Portal Production Readiness

Status: Active evolving tracker.

Last updated: 2026-05-03.

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
- Unused code, stale exports, and old dependencies follow `docs/code-retirement-and-bloat-control.md` so cleanup is systematic and proof-driven.
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
| Portal tests | Green | `npm run test:portal:log` passed on 2026-05-03 after stabilizing the workbench snapped-deck settle assertion: broad portal Vitest reported 193 files and 1203 tests passing. | Keep using focused portal scripts during feature work and quick doctor for routine readiness. |
| Lint and guards | Green | `npm run portal:doctor:quick` completed `npm run lint`, including docs guard, cache guard, brand guard, mojibake, and ESLint. | Keep lint in quick doctor and portal PR CI. |
| Schedule bundle budget | Green | `npm run schedule:bundle-budget` passed: 589.0 KiB initial raw, 169.1 KiB initial gzip, 333.2 KiB lazy raw, 78.3 KiB lazy gzip. | Keep the budget in portal CI and re-run after schedule chunk changes. |
| Production security audit | Green | `npm audit --omit=dev` reported 0 vulnerabilities during blocker review. Portal Quality now runs `npm run audit:security` as a blocking pull-request gate, with Governance Monthly retaining the broader audit sweep. | Keep audit visible through `portal:doctor`, Portal Quality, and governance checks. |
| Security and data boundaries | Green | Boundary sweep passed: `npm run audit:security`, `npm run browser:supabase`, `npm run service-role:report`, `npm run root:compat`, `npm run architecture:changed`, `npx vitest run apps/portal/lib/supabaseClient.boundaries.test.ts`, `npm run test:portal -- apps/portal/lib/api apps/portal/app/api`, `npm run test:portal:quotes`, `npm run test:portal:schedule`, and `npm run test:marketing`. Browser Supabase and service-role reports showed no new growth or changed violations; marketing public-token coverage now has 9 files and 37 tests passing. | Keep changed-file guards in handoffs; manual staff workflow and public-token browser QA still require valid credentials and compatible data. |
| Portal build | Green | `npm run build:portal` passed with `Compiled successfully`, TypeScript completed, 55 static pages generated, and no Turbopack/NFT trace warnings after module-relative PDF asset URL loading. Build-dependent gates now run `npm run portal:build-env` first to catch active portal dev servers and Next build locks early. | Keep build in portal CI and re-run after quote, invoice, PDF, job-pack, or Next config changes. |
| Typecheck | Green | `npm run typecheck` passed after the `ModelSpaceViewport.test.tsx` placement-case typing fix; `npm run portal:doctor:quick` also completed typecheck. | Keep typecheck in quick doctor and CI. |
| Browser smoke | Yellow | `npm run test:portal:browser` passed inside `npm run test:portal:workbench`: 3 no-auth fixture tests passed and 1 auth-backed smoke skipped by design. `npm run portal:auth-runtime` now reaches the login flow with the supplied temporary account, but Supabase auth returns `Invalid email or password` and the setup remains on `/login`; downstream authenticated smoke/performance stay blocked by valid staff test credentials. | Provision or reset a valid staff test account, then rerun auth-runtime, authenticated smoke, and performance. |
| Docs and routing | Green | Canonical docs, agent playbook, change routing, and decision log are present. | Keep this tracker and owner docs current. |
| File decomposition | Yellow | First calculator decomposition slice landed: pure calculator input defaults, normalization, draft key helpers, and fixture-safe estimate snapshot normalization moved out of `CalculatorGridClient.tsx`; `npx vitest run apps/portal/app/staff/calculator` passed with 11 files and 114 tests. Broader strict enforcement remains advisory while transitional files remain. | Continue one owner surface at a time; use `npm run files:report` before selecting the next split and `npm run files:changed` before handoff. |
| Code retirement | Yellow | `docs/code-retirement-and-bloat-control.md`, `npm run dead-code:report`, `npm run dead-code:changed`, and `npm run dead-code:changed:strict` make unused files, exports, types, and dependencies visible while blocking only newly added unused files locally. Portal Quality runs changed-file and strict new-growth reporting as advisory only. | Calibrate the registry, delete proven candidates in small PRs, then consider strict mode for new unused exports or dependencies. |
| Local-first flows | Yellow | Focused local-first gate passed with 12 files and 67 tests: store/queue aliases, retries, conflicts, estimate editability, estimate API lock behavior, and `LocalFirstPortalMutations` handler coverage for estimate/quote aliases, retry, and conflict states. | Keep manual pending, failed, retry, conflict, and lock-state browser QA open until valid staff credentials and compatible project data exist. |
| Quote/invoice/job-pack side effects | Green | `npm run portal:side-effects` passed: 8 quote/invoice/job-pack test files and 32 tests passed, then `npm run build:portal` completed with `Compiled successfully`, TypeScript, and 55 static pages generated. | Keep manual public-token and side-effect QA in release checks with a compatible portal environment. |
| Schedule workflow | Green | `npm run test:portal:schedule` passed with 38 files and 215 tests, covering Schedule V2 APIs, readiness, Board/Gantt/Site Visits client paths, command boundaries, and legacy fallback isolation. | Keep live readiness and manual Board/Gantt/Site Visit checks in release QA with staff credentials and a migrated database. |
| Design workbench | Green | `npm run test:portal:workbench` passed: 54 Vitest files and 562 tests passed across drawing UI, drawing state/geometry, workbench route/client coverage, and estimate sheet drawing coverage; then browser fixture coverage passed with 3 no-auth fixture tests and 1 auth-backed smoke skipped by design. | Keep manual edit/save/reload and high-risk visual QA in release checks with authenticated staff data while continuing to reduce named compatibility surface. |

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
- [x] Public quote and invoice flows remain token-bound and hash-checked.
- [x] Service-role Supabase access is server-only and limited to documented owner flows.
- [ ] `npm run service-role:changed` is included in handoffs that touch service-role Supabase access.
- [ ] Browser UI does not add direct table writes outside API, query, local-first, or approved spreadsheet adapters.
- [ ] `npm run browser:supabase:changed` is included in handoffs that touch browser-facing Supabase access.
- [x] Schedule V2 writes go through staff API routes and `schedule_v2_*` RPC commands.
- [x] Quote, invoice, PDF, email, and job-pack side effects go through domain helpers.
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
- [ ] Parallel or dirty-tree work uses `npm run worktree:status` with `WORKTREE_OWNER_PATTERNS` before editing and `npm run architecture:changed` before handoff.
- [ ] `npm run architecture:changed` is included in non-trivial portal handoffs, including worktree ownership, dead-code changed reporting, and changed-file architecture checks.
- [x] Portal Quality runs `npm run architecture:changed` as a PR-aware advisory report against base/head changes.
- [x] Portal Quality runs `npm run architecture:changed:strict` as a PR-aware advisory report without blocking legacy debt.
- [ ] `npm run files:report` is reviewed before expanding warning or critical files.
- [ ] `npm run files:changed` is included in handoffs that touch warning or critical files.
- [ ] `npm run root:compat:changed` is included in handoffs that touch root compatibility paths before portal SaaS extraction work continues.
- [ ] `npm run dead-code:changed` is used directly for focused deletion, dependency, or cleanup work that needs the dedicated dead-code report.
- [ ] `npm run dead-code:changed:strict` is used for local cleanup/tooling verification when new unused files should be blocked without blocking legacy debt.
- [x] Portal Quality runs `npm run dead-code:changed` as a PR-aware advisory report against base/head changes.
- [ ] Source-of-truth boundaries are preserved for costing, geometry, schedule, local-first, quotes, invoices, and job packs.
- [ ] Compatibility and legacy fallback paths are isolated, named, and tested.
- [ ] No new duplicate workflow rules are added in components when an owning domain helper or definition exists.
- [ ] New tests land at the owning layer first, then broaden only when blast radius requires it.
- [ ] Docs are updated when behavior, data flow, source-of-truth boundaries, test strategy, or known risks change.

## Highest Leverage Tasks

Keep this ordered list current as work lands.

1. Restore remaining browser quality gates: authenticated smoke and performance smoke.
2. Keep manual quote/invoice/public-token/job-pack, Schedule V2, and Design Workbench edit/save/reload QA visible in release checks with staff credentials and compatible data.
3. Use `npm run files:report` and `npm run files:changed` to guide large-file decomposition after gates are green, one owner surface at a time.

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
| Code retirement and bloat control | `docs/code-retirement-and-bloat-control.md` |
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

### 2026-05-03

- Started the file-decomposition lane with the largest calculator hotspot by extracting pure calculator input/default/normalization helpers from `CalculatorGridClient.tsx` into focused calculator helper modules. `npx vitest run apps/portal/app/staff/calculator` passed with 11 files and 114 tests; broad typecheck is still blocked by unrelated dirty marketing route-test types and portal design-workbench type errors.
- Added `npm run portal:auth-runtime` and wired it into authenticated smoke, performance, and broad `portal:doctor` so staff credentials, role access, schedule readiness, and minimum project data fail before deeper browser assertions.
- Added `npm run portal:side-effects` as the focused quote, invoice, public-token, PDF/email, and job-pack readiness gate. It runs quote/invoice/job-pack focused tests plus the portal build without authenticated browser flows or real email delivery.
- Added `npm run portal:build-env` and wired it into portal build-dependent gates so an active portal dev server or Next build lock fails before `next build`. The preflight is non-destructive and does not stop processes or delete lock files.
- Extended `npm run test:portal:browser` with a no-auth mono fixture assertion for object-first workbench visibility, finite 3D diagnostics, top-projection parity, and absence of user-facing fallback/login/unavailable states.
- Locked projection-backed deck commits to the named `top_projection_to_object_frame` transform, removed stale `commitStartPolygon` bounds remapping, and persisted deck width/depth so rebuilt snapped outlines match the released projection diagnostics.
- Verified the full Design Workbench gate: `npm run test:portal:workbench` passed with 53 Vitest files and 557 tests, then browser fixture coverage passed with 3 no-auth fixture tests and 1 auth-backed smoke skipped by design.
- Added PR-aware architecture changed reporting and strict new-growth advisory reporting to Portal Quality as non-blocking base/head comparisons; strict checks remain visible but unenforced until new-growth enforcement is intentionally enabled.
- Added Knip-backed dead-code reporting with `npm run dead-code:report` and PR-aware `npm run dead-code:changed` advisory output so unused files, exports, types, dependencies, and duplicates can be retired with proof instead of guesswork.
- Confirmed Portal Quality CI enforcement: docs guard, typecheck, lint, portal Vitest, portal build, schedule bundle budget, production security audit, fixture browser smoke, and authenticated smoke are blocking; Portal Performance Report keeps authenticated route timing blocking and now writes auth-runtime prerequisites to the GitHub step summary.
- Attempted authenticated runtime readiness with the supplied temporary account. `portal:auth-env` passed, but Playwright auth setup stayed on `/login` with the app-visible error `Invalid email or password`; authenticated smoke and performance remain Yellow until a valid staff test account exists. Auth setup now clears the password field before throwing so generated text snapshots do not retain the submitted password.
- Verified the full quote/invoice/job-pack side-effects gate after stopping the local portal dev server that held the Next build lock: `npm run portal:side-effects` passed with 8 test files and 32 tests, then `npm run build:portal` completed with `Compiled successfully`, TypeScript, and 55 static pages generated.
- Confirmed the Schedule V2 local readiness gate: `npm run test:portal:schedule` passed with 38 files and 215 tests, including readiness route, Board/Gantt/Site Visits client coverage, Schedule V2 API/RPC command boundaries, and legacy fallback isolation.
- Re-ran `npm run schedule:bundle-budget`; it passed at 589.0 KiB initial raw, 169.1 KiB initial gzip, 333.2 KiB lazy raw, and 78.3 KiB lazy gzip. Live route performance and authenticated smoke remain blocked until staff credentials and a compatible migrated database are available.
- Verified the local security/data-boundary lane: `npm run audit:security`, `npm run browser:supabase`, `npm run service-role:report`, `npm run root:compat`, `npm run architecture:changed`, `npx vitest run apps/portal/lib/supabaseClient.boundaries.test.ts`, `npm run test:portal -- apps/portal/lib/api apps/portal/app/api`, `npm run test:portal:quotes`, `npm run test:portal:schedule`, and `npm run test:marketing` passed. Added marketing public-token route and hash-boundary coverage for missing, invalid, expired, declined/void, accepted, attachment unavailable, and PDF unavailable states.
- Hardened the local-first workflow readiness gate. The focused `npx vitest run apps/portal/lib/localFirst apps/portal/components/sync/LocalFirstPortalMutations.test.tsx apps/portal/lib/estimates apps/portal/app/api/estimates` pass covered 12 files and 67 tests, including new handler assertions for provisional-id retry, durable alias registration, locked estimate/quote conflicts, design-request terminal conflicts, and estimate-notes validation conflicts. The broader `npm run test:portal -- ...` form prepends all of `apps/portal`; it initially exposed the unrelated Design Workbench `ModelSpaceViewport.test.tsx` timing failure fixed in the next note.
- Restored the broad portal Vitest gate by waiting for the workbench snapped-deck selection diagnostic to settle after a failure-feedback canvas click under full-suite load. `npm run test:portal:log` passed with 193 files and 1203 tests, and `npm run test:portal:workbench` passed with 54 Vitest files, 562 tests, and the no-auth fixture browser smoke at 3 passed / 1 skipped by design.

### 2026-05-02

- Added `npm run portal:fixture-env` and wired it into the no-auth drawing fixture gates so a normal portal dev server or auth-gated `PORTAL_BASE_URL` fails before Playwright startup. The preflight is non-destructive and does not stop existing dev servers.
- Added `npm run portal:auth-env` and wired it into authenticated portal Playwright gates plus broad `portal:doctor` so missing `PORTAL_TEST_EMAIL` or `PORTAL_TEST_PASSWORD` fails before authenticated server startup. The no-auth drawing fixture gate remains independent through `npm run test:portal:browser`.
- Local authenticated smoke and performance verification remain externally blocked until staff test credentials and a compatible portal database are available.
- Replaced quote PDF and job-pack PDF root/app asset probing with module-relative asset URLs. `npm run build:portal` passed with `Compiled successfully`, TypeScript completed, 55 static pages generated, and no Turbopack/NFT trace warnings.
- Removed stale compatibility-client mocks from contacts/projects/project snapshot tests by routing contact writes and project snapshots through auth-bound staff Supabase clients. `npm run test:portal:projects` passed with 40 files and 197 tests; `npm run portal:doctor:quick` passed.

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
