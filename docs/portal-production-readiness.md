# Portal Production Readiness

Status: Active evolving tracker.

Last updated: 2026-07-19.

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
4. Read `docs/maintainability-principles.md` for bugfixes, migrations, interaction wiring, or hotspot work.
5. Read this doc.
6. Read the smallest relevant canonical doc for the area being changed.
7. Scan `docs/decision-log.md` for matching risks or past mistakes.
8. Check `git status --short` and leave unrelated changes untouched.

When work changes readiness status, blockers, priorities, verification commands, parallel lanes, or newly discovered risks, update this doc in the same pass. Prefer updating existing rows and checklist items over adding long new sections.

Use `npm run docs:readiness` for an advisory summary of tracker age, at-risk rows, and unchecked checklist counts. The report warns when this tracker is more than 7 days old, but it does not replace rerunning the listed commands or manual checks.

Do not duplicate detailed rules from canonical docs here. Link to them, then keep this doc focused on current readiness state, next actions, and coordination.

## Current Readiness Snapshot

This snapshot records the most recent known production-readiness state from the portal review and follow-up checks, with project-opening performance refreshed on 2026-07-19. Re-run the listed commands before treating any item as current after new work lands. If a row is older than the current work, treat it as a last known signal, not live truth, until the relevant command or manual check is repeated.

| Area | Status | Last Known Signal | Next Action |
| --- | --- | --- | --- |
| Portal tests | Green | `npm run portal:doctor:quick` passed locally on 2026-07-19 with 275 files/1,578 tests plus 11 intentional skips. The focused Projects/Contacts suite passed with 58 files/286 tests; shell/navigation coverage includes the canonical Contacts-link regression. | Keep the service-role owner explicit and rerun quick doctor after shared auth, persistence, or API changes. |
| Lint and guards | Green | `npm run portal:doctor:quick` completed `npm run lint`, including docs guard, cache guard, brand guard, mojibake, and ESLint. | Keep lint in quick doctor and portal PR CI. |
| Portal route bundle budgets | Yellow | The reusable analyser passes Schedule, Projects Index, Contacts Index, Project Detail, Calculator, and Design Workbench from one fresh build and detects Turbopack lazy groups honestly. Contacts Index is 559.8/159.6 KiB raw/gzip initial and 120.6/19.2 KiB lazy under fresh-build-plus-5% ceilings; shared shell gzip grew about 0.7 KiB from Slice 2. Project Detail's honest combined total still exceeds its obsolete zero-lazy cap. | Keep the honest per-boundary gates blocking. Reduce the existing Estimates drawing/workbench dependency in a separately authorised lane; do not hide lazy bytes or increase budgets automatically. |
| Portal performance evidence | Green | Slice 1 project opening and Slice 2 Dashboard-to-Projects remain green. Slice 3 Portal Quality run `29678858906` completed exactly five authenticated production repetitions: Dashboard-to-Contacts was 33/35/35 ms feedback and 50/52/53 ms useful content p50/p75/p95, with no blocking overlay or observed long task. | Keep the 100/500 ms regression ceilings locked; future optimisation may ratchet them downward but must never increase them automatically. |
| Portal Web Vitals | Green | Identifier-free first-party ingestion, admin p75/p95 summaries, route sanitisation tests, RLS/grants, and the 30-day `pg_cron` migration are implemented. On staging, the named daily cron job was present, the cleanup removed a 31-day fixture, retained a recent fixture, and the remaining fixture was then removed. | Promote the verified forward migration through the normal production deployment path and keep the 30-day job monitored. |
| Production security audit | Green | `npm audit --omit=dev` reported 0 vulnerabilities after patching Next.js to 16.2.10 and overriding transitive `ws` to 8.21.1. Portal Quality runs `npm run audit:security` as a blocking pull-request gate, with Governance Monthly retaining the broader audit sweep. | Keep audit visible through `portal:doctor`, Portal Quality, and governance checks. |
| Security and data boundaries | Green | Boundary sweep passed: `npm run audit:security`, `npm run browser:supabase`, `npm run service-role:report`, `npm run root:compat`, `npm run architecture:changed`, `npx vitest run apps/portal/lib/supabaseClient.boundaries.test.ts`, `npm run test:portal -- apps/portal/lib/api apps/portal/app/api`, `npm run test:portal:quotes`, `npm run test:portal:schedule`, and `npm run test:marketing`. Browser Supabase and service-role reports showed no new growth or changed violations; marketing public-token coverage now has 9 files and 37 tests passing. | Keep changed-file guards in handoffs; manual staff workflow and public-token browser QA still require valid credentials and compatible data. |
| Portal build | Green | A fresh isolated `next build` passed on Next.js 16.2.10 with `Compiled successfully`, TypeScript completed, and 61 static pages generated. The normal preflight correctly reported a separate checkout's active portal dev server rather than terminating it. | Keep build in portal CI and re-run after quote, invoice, PDF, job-pack, dependency, or Next config changes. |
| Typecheck | Green | `npm run typecheck` passed on 2026-05-21 after the object-first workbench adapter test fixture was aligned with normalized roof-intent types. | Keep typecheck in quick doctor and CI. |
| Browser smoke | Yellow | Portal Quality passed fixture browser/performance smoke and the authenticated routing smoke on staging on 2026-07-19. Authenticated calculator customer-pricing, module switching, local restoration, stale/live state, two-column 1366px fit, and no-clipping checks passed at 1600px, 1366px, 1024px, and 768px using browser-draft-only mutations. The broader canonical provisioned calculator suite still needs its three-module scenario refreshed. | Refresh the staging calculator scenario, then rerun that broader canonical calculator lane; keep the now-green authenticated routing smoke blocking in Portal Quality. |
| Docs and routing | Green | Before the 2026-06-11 docs-readiness pass, `npm run docs:guard` was failing because `docs/decision-log.md` had Workbench House Forms index drift and an unescaped `Sheet \| Plan \| 3D` mode-switch phrase inside the index table. This pass repaired the drift, added the missing `docs/environment-auth-supabase.md` navigation cue, and reran `npm run docs:guard`, `npm run text:mojibake`, `npm run docs:navigation`, `npm run docs:readiness`, and `npm run docs:impact` successfully. | Keep this tracker and owner docs current; refresh readiness when process signals change or the tracker ages past 7 days. |
| File decomposition | Yellow | Calculator input normalization, save readiness, result freshness, command bar, project picker, browser-draft persistence/session state, module navigation, and pricing-summary presentation now live outside `CalculatorGridClient.tsx`. The client no longer owns draft hydration, local persistence effects, module action policy, or pricing-summary markup, but it still owns the main form schema, deeper save orchestration, and most infill modal state. | Extract configuration-section definitions and issue-to-section mapping before adding more inline calculator workflow; run `npm run files:changed` before handoff. |
| Code retirement | Yellow | `docs/code-retirement-and-bloat-control.md`, `npm run dead-code:report`, `npm run dead-code:changed`, and `npm run dead-code:changed:strict` make unused files, exports, types, and dependencies visible while blocking only newly added unused files locally. Worktree strict mode now blocks undeclared dirty-tree lanes during explicit strict verification. Portal Quality runs changed-file and strict new-growth reporting as advisory only. | Calibrate the registry, delete proven candidates in small PRs, then consider strict mode for new unused exports or dependencies. |
| Local-first flows | Yellow | React Query, local-first persistence, and calculator session fallbacks are now keyed to authenticated user ID; unauthenticated query state is ephemeral; runtime start/stop owns listeners/timers/subscribers; and tests cover A/B cache/draft/queue isolation, same-user return, retained queued work, cancellation, explicit active-sync discard, and stale-handler shutdown. | Retain authenticated manual pending/retry/conflict QA and verify sign-out choices on a shared staging device before release. |
| Quote/invoice/job-pack side effects | Green | `npm run portal:side-effects` passed: 8 quote/invoice/job-pack test files and 32 tests passed, then `npm run build:portal` completed with `Compiled successfully`, TypeScript, and 55 static pages generated. | Keep manual public-token and side-effect QA in release checks with a compatible portal environment. |
| Schedule workflow | Green | `npm run test:portal:schedule` passed with 38 files and 215 tests, covering Schedule V2 APIs, readiness, Board/Gantt/Site Visits client paths, command boundaries, and legacy fallback isolation. | Keep live readiness and manual Board/Gantt/Site Visit checks in release QA with staff credentials and a migrated database. |
| Design workbench | Green | Focused object-first helper coverage passed on 2026-05-21; the current state-lane anchors include `apps/portal/lib/drawings/state/objectFirstWorkbenchFixtures.test.ts`, `apps/portal/lib/drawings/state/objectWorkbenchStatusModelRoofValidation.test.ts`, and `apps/portal/lib/drawings/state/projectPergolaViewerScene.test.ts`. The broader last-known signal remains `npm run test:portal:workbench` on 2026-05-04 with 58 Vitest files and 589 tests, followed by the no-auth browser fixture pass. | Keep manual edit/save/reload, pricing-source rollout, and high-risk visual QA in release checks with authenticated staff data; rerun the full workbench and browser gates before treating this as release-complete. |
| Geometry/costing migration | Yellow | The workbench has a solved geometry artifact, a package-owned `GeometryQuantityTakeoff` derived from `Assembly3D`, and shadow `workbench_solved` commercial payload coverage that maps that takeoff. Baked fixture parity and representative saved estimate snapshot parity now compare `calculator_compat` and `workbench_solved`, with drift classified as authored intent, solved geometry, physical takeoff, or commercial mapping; live estimate and quote pricing still use the calculator costing path. | Keep the commercial path shadow-only, extend geometry takeoff buckets as solver support grows, and retire compatibility only after manual workbench QA and parity are stable. |

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
- [x] `npm run portal:bundle-budget` passes after the same fresh portal build with the preserved Schedule limits.
- [x] `npm run audit:security` has no unresolved high or critical production vulnerabilities.
- [x] `npm run test:portal:smoke` passes for authenticated portal routing.
- [x] `npm run test:portal:browser` passes for drawing/workbench browser smoke without silent full-suite skips.
- [x] `npm run test:portal:performance` passes route timing budgets with exactly five authenticated CI repetitions.

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
- [ ] Project page Activity tab tasks + notes: open project lands on Activity tab, tasks render and respond to manual completion, notes compose / edit-own / delete-own succeed, non-author staff sees no edit/delete affordance, admin can edit/delete any note, soft-deleted notes hide on reload.
- [ ] Project page Activity tab current-design snapshot bar: shows correct precedence (accepted > sent > draft > estimate), declined-only quotes fall through with `Quotes declined` pill, multi-module projects show `+ N more`, empty state when no design exists, View quote/View design link points at the right tab/version.

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
- [x] Project list navigation meets the new 100/500 ms five-run p75 contract; project detail remains green.
- [x] Contacts list meets the 100/500 ms five-run p75 route timing budget.
- [ ] Heavy views are lazy-split by actual workflow boundaries.
- [ ] Board, Gantt, Site Visits, design workbench, and spreadsheet surfaces remain responsive under realistic data volume.
- [ ] Loading, empty, error, pending, retry, stale, and locked states are visible and useful.
- [ ] Core workflows are manually checked at desktop and mobile/tablet widths where staff may use them.
- [ ] Browser tests or manual screenshots confirm high-risk canvas/SVG/3D views are nonblank and correctly framed.

### Maintainability

- [ ] Large files have an owner and a decomposition plan before major feature work continues in them.
- [ ] Warning or critical files touched by feature or bugfix work include one small extraction, or a handoff note that names why extraction was deferred and what the next safe extraction is.
- [ ] Parallel or dirty-tree work uses `npm run worktree:status` with `WORKTREE_OWNER_PATTERNS` before editing, `npm run architecture:changed` before handoff, and `npm run worktree:changed:strict` for explicit local lane enforcement.
- [ ] `npm run architecture:changed` is included in non-trivial portal handoffs, including worktree ownership, dead-code changed reporting, and changed-file architecture checks.
- [x] Portal Quality runs `npm run architecture:changed` as a PR-aware advisory report against base/head changes.
- [x] Portal Quality runs `npm run architecture:changed:strict` as a PR-aware advisory report without blocking legacy debt; local dirty-tree strict runs require declared ownership patterns.
- [ ] `npm run files:report` is reviewed before expanding warning or critical files.
- [ ] `npm run files:changed` is included in handoffs that touch warning or critical files.
- [ ] `npm run root:compat:changed` is included in handoffs that touch root compatibility paths before portal SaaS extraction work continues.
- [ ] `npm run dead-code:changed` is used directly for focused deletion, dependency, or cleanup work that needs the dedicated dead-code report.
- [ ] `npm run dead-code:changed:strict` is used for local cleanup/tooling verification when new unused files should be blocked without blocking legacy debt.
- [x] Portal Quality runs `npm run dead-code:changed` as a PR-aware advisory report against base/head changes.
- [ ] Source-of-truth boundaries are preserved for costing, geometry, schedule, local-first, quotes, invoices, and job packs.
- [ ] Geometry/costing migration preserves the target path: object-first design intent -> `@sp/geometry` solved physical model -> geometry-derived quantity takeoff -> `@sp/costing` commercial input and pricing -> estimates, quotes, invoices, and job packs.
- [ ] Compatibility and legacy fallback paths are isolated, named, and tested.
- [ ] Commercial parity coverage compares `calculator_compat` and `workbench_solved` before live estimate or quote pricing consumes the workbench-solved path.
- [ ] No new duplicate workflow rules are added in components when an owning domain helper or definition exists.
- [ ] New tests land at the owning layer first, then broaden only when blast radius requires it.
- [ ] Docs are updated when behavior, data flow, source-of-truth boundaries, test strategy, or known risks change.

## Workbench Solved Pricing Go/No-Go

Do not enable `PORTAL_ESTIMATE_PRICING_SOURCE=workbench_solved` until every item below has named evidence. Estimate persistence is the only live switch point; geometry remains owned by `@sp/geometry`, costing remains owned by `@sp/costing`, and quote/invoice/job-pack flows stay on saved estimate or quote-version boundaries.

### Readiness Gates

- [ ] The rollout readiness report has `eligibleToEnable: true` and an empty `blockingGateCodes` array.
- [ ] All gate codes pass: `workbench_solved_ready`, `quantity_takeoff_owned`, `commercial_parity_stable`, `estimate_persistence_source_explicit`, `estimate_lock_boundary_preserved`, `local_first_boundary_preserved`, `downstream_pricing_boundary_preserved`, and `rollback_to_calculator_live_confirmed`.
- [ ] Workbench commercial evidence shows source `workbench_solved`, trust `ready`, zero blocking diagnostics, quantity takeoff source `package_geometry` or `solved_geometry_spine`, and `fallbackPricingSource: null`.
- [ ] `calculator_compat` versus `workbench_solved` parity reports are `status: match`, include the parity-critical baked fixtures and representative saved estimate snapshots, and show `counts.blockingDifferences === 0`.
- [ ] Authenticated manual QA evidence exists for estimate save/update/duplicate, local-first pending/failure/retry/conflict states, estimate locks, quote refresh, public quote, deposit invoice, PDF, and job-pack paths.
- [ ] The final decision record includes exact command outputs, manual QA artifact links or IDs, rollout approver, selected flag value, selected time, and rollback owner.

### Rollback And Immutability Checks

- [ ] Rollback is documented as an explicit switch to `PORTAL_ESTIMATE_PRICING_SOURCE=calculator_live`, followed by redeploy/restart and a calculator-live estimate save smoke confirming new rows record `pricing_source: calculator_live`.
- [ ] Pre-enable, post-enable, and post-rollback snapshots compare row counts and stable IDs for `quote_versions`, `quote_line_items`, `quote_send_logs`, `deposit_invoices`, `deposit_invoice_send_logs`, `file_artifacts`, `job_pack_generations`, and `job_pack_sheet_overrides`.
- [ ] Historical quote totals, invoice totals, generated artifact IDs, public token hashes, send-log IDs, and job-pack generation IDs are unchanged across enablement and rollback.
- [ ] Raw `commercial_design_input` is absent from quote versions, public-token responses, PDFs, emails, invoice payloads, and job-pack outputs.
- [ ] Blocked `workbench_solved` attempts return `409 ESTIMATE_PRICING_SOURCE_BLOCKED`, emit an audit event with gate codes, and leave estimate rows unchanged.

### Post-Enable Signals

- [ ] Estimate save logs show expected `pricing_source` distribution for new saves: no invalid source values, no unset selected source, and no calculator fallback while reporting `workbench_solved`.
- [ ] Audit events reconcile with estimate mutations: each successful workbench save has `estimate.pricing_source_saved`, each blocked attempt has `estimate.pricing_source_blocked`, and blocked attempts have no paired estimate mutation.
- [ ] Error checks show no spike in `ESTIMATE_PRICING_SOURCE_BLOCKED`, `ESTIMATE_LOCKED`, quote refresh failures, public token failures, PDF generation failures, invoice send failures, or job-pack generation failures after enablement.
- [ ] Local-first conflict checks show blocked creates do not register durable aliases, queued quote/design-request actions remain queued or conflicted until a durable estimate save succeeds, and retry does not silently switch to `calculator_live`.
- [ ] Downstream artifact checks show new draft quote refreshes use saved estimate/quote-version boundaries and historical sent/accepted/declined quote versions remain unchanged.
- [ ] Failure modes with named owners are recorded for blocking diagnostics, parity drift, app-local takeoff source, missing source metadata, lock bypass, local-first alias drift, downstream mutation, audit write failure, and rollback smoke failure.

## Highest Leverage Tasks

Keep this ordered list current as work lands.

1. Restore failing quality gates before broad feature expansion; when the failure is in a hotspot, fix it at the owning layer rather than adding another caller workaround.
2. Keep manual quote/invoice/public-token/job-pack, Schedule V2, and Design Workbench edit/save/reload QA visible in release checks with staff credentials and compatible data.
3. Advance the geometry/costing migration without switching live pricing: extend package-owned physical takeoff in `packages/geometry`, compare `calculator_compat` and `workbench_solved`, and keep compatibility retirement explicit.
4. Make hotspot maintainability part of ordinary work: use `npm run files:report` to choose the next owner surface, and use `npm run files:changed` plus a decomposition note whenever warning or critical files are touched.

## Parallel Work Lanes

Parallel work is encouraged when ownership is clear and file overlap is low. Read `docs/parallel-work-guardrails.md` before running concurrent lanes across shared contracts, packages, apps, docs, or workbench migration areas.

| Lane | Scope | Safe In Parallel With | Avoid Touching |
| --- | --- | --- | --- |
| Quality gate repair | Current failing tests, lint guards, build blockers. | Security/deps, docs tracker updates, isolated feature fixes. | Broad refactors not needed for the failure. |
| Security/dependency audit | Production dependency upgrades, audit remediation, residual-risk notes. | Contacts/projects, schedule performance, workbench fixes. | Large feature behavior changes unless required by upgrade. |
| Contacts/projects env boundary | Contact APIs, contact/project server data helpers, project snapshot tests. | Schedule, workbench, style isolation, security/deps. | Quote/invoice side-effect helpers unless failure crosses that boundary. |
| Schedule performance | `/staff/schedule`, schedule queries, schedule CSS, route timing, bundle split. | Contacts/projects, workbench, security/deps. | Design workbench, quote/invoice, unrelated portal shell. |
| Design workbench | `apps/portal/components/drawings`, `apps/portal/lib/drawings`, workbench fixture/browser gates. | Contacts/projects, schedule, security/deps. | Calculator or costing files unless needed by explicit geometry contract. |
| Geometry/costing migration | `packages/geometry`, `packages/costing/src/commercial`, commercial parity adapters, and docs for the target boundary. | Design workbench, calculator decomposition, docs tracker updates. | Live estimate/quote pricing, public outputs, or job-pack pricing unless an explicit rollout task is in scope. |
| Quote/invoice/job packs | Quote/invoice/job-pack domain helpers, token routes, PDFs, email side effects. | Schedule performance, style isolation, docs updates. | Contacts/projects internals unless working on a documented handoff. |
| Style isolation and portal shell | Shared layout, surface styles, PageHeader, portal shell tests. | Security/deps, contacts/projects, schedule. | Feature behavior and workflow-specific CSS unless required by isolation test. |
| CI/typecheck/tooling | Scripts, workflows, typecheck, docs guard, command docs. | Most domain lanes. | Domain behavior changes unless a gate requires a small fix. |
| Large-file decomposition | `CalculatorGridClient`, `ModuleViewsCard`, `ScheduleClient`, `Geometry3DViewport`, `PlanViewport`, and files reported by `npm run files:report`. | Only lanes that do not touch the same files. | Active feature fixes in the same large file. |
| Hotspot bugfix with extraction | Current failing behavior inside a warning or critical file, plus the smallest owner extraction that makes the fix easier to test. | Docs tracker updates, unrelated security/deps, isolated feature work outside the same files. | Broad cleanup, formatting, or moving behavior that is not needed to stabilize the bug. |

## Canonical References

Use these docs as routing references. Do not copy their full rules into this tracker.

| Area | Read First |
| --- | --- |
| Agent protocol | `docs/agent-playbook.md` |
| Path ownership and doc update triggers | `docs/change-routing.md` |
| Repo and app boundaries | `docs/architecture.md` |
| Maintainability principles | `docs/maintainability-principles.md` |
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

### 2026-07-19

- Moved the Contacts index from a route-blocking server read to a staff-authenticated API/query owner with current-user cache bootstrap, truthful pending/cached/fresh/failure/access states, and instant intent-preloaded navigation through the reusable portal-index controller. Contact cache changes now remain coherent across detail, canonical list, Contacts index, and every Projects index; CSV import is a lazy intent-preloaded workflow. Internal Contacts navigation now uses canonical `/staff/contacts`. The fresh Contacts bundle is 559.8/159.6 KiB initial and 120.6/19.2 KiB lazy, with about 0.7 KiB shared-shell growth. Portal Quality run `29678858906` locked five-run p75 at 35 ms feedback and 52 ms useful content, with no overlay or long task; the 100/500 ms ceiling remains unchanged.
- Moved the Projects index from a route-blocking server read to one staff-authenticated combined query, current-user cache bootstrap, explicit pending/cached/fresh/failure/access states, intent-only prefetch, and instant URL feedback without the global loading overlay. The persistent portal content boundary now renders the actual Projects frame and truthful updating state synchronously while Next settles the incoming route, and filter ownership starts client-side without awaiting request search params. Shared route gzip remains within the Slice 2 5 KiB allowance. Portal Quality run `29675363201` locked five-run p75 at 44 ms feedback and 76 ms useful content, with no overlay or long task; the 100/500 ms ceiling remains unchanged.
- Made routine project opening immediate from the signed-in user's cached project/contact summary, refreshed the canonical snapshot quietly, split tabs into intent-preloaded workflow boundaries, restored instant browser Back, and changed internal Projects navigation to `/staff/projects`.
- Locked five-run production evidence at p75 44 ms URL feedback and 60 ms useful content, with no overlay or long task; the project-opening regression ceiling is now 100/500 ms. Independent project/contact list reads start concurrently, while the root Projects route can stream its non-blocking pending shell.
- Corrected Turbopack lazy accounting. The current per-boundary gate passes, but the honest Project Detail combined total exceeds the obsolete zero-lazy cap because the existing Estimates drawing/workbench dependency is outside this slice; the tracker remains Yellow for that separate reduction.

### 2026-07-18

- Added a customer-price-led calculator preview and calm visual pass. The shared quote-pricing helper applies `1.25x` to pergola true cost ex GST, rounds that result, then applies GST; the calculator displays the same value without persisting it. Internal costing and separately priced blinds remain visible, while Save, Preserve/Reprice, quote totals, costing inputs, schemas, APIs, and workbench boundaries are unchanged.
- Added the grouped calculator module navigator: canonical per-pergola module identities, fresh Add, deep Duplicate with regenerated child IDs, Move without reordering, confirmed browser-draft-only Remove, validation badges, a sticky desktop rail, and a narrow modal launcher. Costing, Save/Preserve/Reprice, drawing, quote, API, schema, and workbench boundaries are unchanged.

### 2026-07-16

- Added the calculator trust slice: explicit current/stale/invalid/error result states, a persistent command bar, searchable project selection through the existing query layer, container-responsive scrolling, valid V2 scenario inputs, and authenticated calculator browser coverage. Pricing totals, save/reprice policy, APIs, schemas, and the workbench boundary are unchanged.

### 2026-06-11

- Restored docs health after `npm run docs:guard` failed on decision-log index drift: synced the 2026-06-03 Workbench House Forms index count with entries and escaped the `Sheet \| Plan \| 3D` mode-switch text inside the index table. Added the missing `Read First` navigation cue to `docs/environment-auth-supabase.md`, then reran the docs-only checks successfully. Existing dirty worktree files outside this lane were intentionally left untouched.

### 2026-05-30

- Refreshed docs current-state references after a docs-only cleanup pass: shipped PR-T5/T7/T8/T9 plan docs now read as retrospective rather than awaiting execution, dense docs have lightweight routing cues, and workbench commercial adapter wording now names `WorkbenchSolvedProject`.
- Baseline quick-doctor status changed to Yellow: the focused `apps/portal/lib/estimates/drawingEdits.test.ts` rerun still fails because the object-first deck draft expectation includes the removed `label` field. A later broad `npm run portal:doctor:quick:log` attempt during this docs-only cleanup was stopped after the Vitest worker hung; its log had already reported multiple non-doc portal failures across Supabase boundary, workbench import guard, drawing edits, workbench fixture/page, and estimate client tests. The docs-only cleanup does not change code or tests.

### 2026-05-10

- Promoted maintainability from advisory reading to default agent routing: hotspot work now reads `docs/maintainability-principles.md`, warning/critical file changes should include one small extraction or a named deferral, and handoffs should name the owner plus next safe extraction.

### 2026-05-04

- Strengthened Browser And Manual QA Coverage for final rollout confidence: the no-auth fixture browser gate keeps 7 passing fixture tests and 1 documented `portal-fixture` skip by design, the hipped/U-shape ready workbench-solved case now checks rollout diagnostics plus plan/3D topology, invalid fixtures remain a negative guard, and `docs/testing-and-qa.md` now carries the pricing-source rollout manual QA script.
- Made the no-auth fixture browser gate coexist with a normal portal dev server: Playwright now defaults the fixture harness to port 3011 and isolated Next dev output, `npm run portal:fixture-env` passed while port 3001 was occupied by normal portal dev, and `npm run test:portal:browser` passed with 6 fixture tests and 1 auth-backed smoke skipped by design. The explicit auth-gated normal-server check still fails as intended when `PORTAL_BASE_URL=http://127.0.0.1:3001`.
- Attempted `npm run test:portal:workbench`; it failed before the browser segment in the then-current workbench commercial-payload test because `quantityTakeoff.flashings.totalLengthM` was 0 instead of 1.5. The focused commercial payload test failed the same way, so the blocker was tracked separately from the fixture browser gate.

### 2026-05-03

- Expanded commercial parity diagnostics while keeping the path shadow-only: `compareCommercialDesignInputsV1()` now classifies each difference by authored intent, solved geometry, physical takeoff, or commercial mapping, and the focused parity gate passed with 4 files and 33 tests.
- Stabilized the Fixture And QA Gates registry with fixture-only metadata for parity-critical baked workbench fixtures, geometry-ready solved-model assertions, metadata-backed commercial parity checks, representative saved estimate snapshot parity coverage, and supported-fixture takeoff smoke coverage. The then-current fixture/commercial payload/takeoff focused pass covered 3 files and 17 tests. `npm run test:portal:workbench` passed its Vitest segment with 57 files and 583 tests, then the no-auth browser segment was blocked by an existing normal portal Next dev server on port 3001; no pricing behavior changed.
- Added Fixture And QA Gates coverage for the geometry-first workbench path: baked fixture commercial parity dual-produced `calculator_compat` and `workbench_solved` payloads for mono, gable, box, mono-join, and screenshot-style hipped fixtures, and the no-auth browser spec gained a compact plan/3D smoke matrix for the parity-critical fixture shapes. The then-current fixture/commercial payload focused pass covered 9 tests. The full `npm run test:portal:workbench` attempt failed in drawing-surface guard/fallback tests from dirty outside-lane work before it reached the browser segment; direct local browser verification was also blocked by an existing normal portal dev server on port 3001 that auth-gated fixture routes.
- Started the file-decomposition lane with the largest calculator hotspot by extracting pure calculator input/default/normalization helpers from `CalculatorGridClient.tsx` into focused calculator helper modules. `npx vitest run apps/portal/app/staff/calculator` passed with 11 files and 114 tests; the later typecheck restoration pass cleared the unrelated marketing public-token route-test mock drift.
- Continued calculator decomposition by extracting pure save-readiness helpers, estimate-target resolution, redirect builders, and design-request tier labelling into `calculatorSaveWorkflow.ts`. `CalculatorGridClient.tsx` is down to 7065 lines from 7067 at HEAD; `npx vitest run apps/portal/app/staff/calculator` passed with 12 files and 120 tests, and `npm run test:portal:projects` passed with 40 files and 205 tests. A later Workbench drawing-surface pass restored the broad `typecheck` and `test:portal:log` gates.
- Restored the typecheck gate after public-token test contract drift: focused marketing and portal `tsc --noEmit --incremental false` checks passed, `npm run typecheck` passed, marketing public-token route tests passed with 4 files and 21 tests, and focused workbench solved-model/plan-view tests passed with 2 files and 5 tests.
- Restored the Workbench drawing-surface geometry gate after the refactor to the named sheet surface bundle: the import guard now enforces `buildWorkbenchDrawingSurfaceGeometry` and `WorkbenchDrawingSurfaceGeometry`, helper coverage verifies `solved_geometry`, `legacy_fallback`, and `unavailable` sources, `npm run test:portal:workbench` passed with 55 Vitest files and 568 tests plus browser fixture coverage at 3 passed / 1 skipped by design, `npm run typecheck` passed, and `npm run test:portal:log` passed.
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
- Hardened the local-first workflow readiness gate. The focused `npx vitest run apps/portal/lib/localFirst apps/portal/components/sync/LocalFirstPortalMutations.test.tsx apps/portal/lib/estimates apps/portal/app/api/estimates` pass covered 12 files and 67 tests, including new handler assertions for provisional-id retry, durable alias registration, locked estimate/quote conflicts, design-request terminal conflicts, and estimate-notes validation conflicts. The broader `npm run test:portal -- ...` form prepends all of `apps/portal`; it initially exposed an unrelated Design Workbench model-space fixture timing failure fixed in the next note.
- Restored the broad portal Vitest gate by waiting for the workbench snapped-deck selection diagnostic to settle after a failure-feedback canvas click under full-suite load. `npm run test:portal:log` passed with 193 files and 1203 tests; the typecheck-restoration rerun of `npm run test:portal:log` also passed, and `npm run test:portal:workbench` passed with 54 Vitest files, 564 tests, and the no-auth fixture browser smoke at 3 passed / 1 skipped by design.

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
- Cleared the quick-doctor typecheck blocker by typing the semantic placement cases in the then-current workbench model-space fixture suite; `npm run typecheck` passed.
- `npm run portal:doctor:quick` passed when captured to a log: docs guard, mojibake, typecheck, lint, and `npm run test:portal` all completed; portal tests reported 172 files and 1077 tests passed.
- `npm audit --omit=dev` reported 0 vulnerabilities. Full local authenticated smoke still needs `PORTAL_TEST_EMAIL` and `PORTAL_TEST_PASSWORD`; fixture browser smoke can run without auth.
- Created this tracker to coordinate portal production-readiness work.
- Initial review identified quality gates as the highest leverage priority before broad feature expansion.
- Known review findings to re-verify: portal tests failing, lint guard failing, schedule bundle budget failing, and production audit reporting vulnerabilities.
- Parallel lanes identified: quality gate repair, security/deps, contacts/projects env boundaries, schedule performance, design workbench behavior, quote/invoice/job-pack side effects, style isolation, CI/typecheck/tooling, and large-file decomposition after gates are green.
