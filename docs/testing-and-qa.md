# Testing And QA

Use the smallest test that covers the risk. Run broader suites when touching shared workflow, portal shell, scheduling, local-first, Supabase access, or public lead/quote flows.

## Read First

- Use `## Common Commands` for routine repo, portal, focused, and operational scripts.
- Use `## Docs-Only Checks` when changing docs, agent guidance, or docs tooling.
- Use `## Portal Browser Tests` and `## Drawing Fixture Route` for Playwright/auth/drawing smoke expectations.
- Use `## Schedule QA Gate` for Schedule V2 readiness and focused schedule checks.
- Use `## CI` to confirm which workflows enforce or report each gate.

## Canonical Command Source

Keep general repo command lists here. Other docs should link to this doc instead of duplicating broad command blocks. Feature docs may still list focused commands for their own verification gates.

The root `npm run dev`, `build`, and `start` scripts only print the app-specific command to use.

## Common Commands

```bash
npm run dev:marketing
npm run dev:portal
npm run test
npm run test:marketing
npm run test:portal
npm run build:marketing
npm run build:portal
npm run typecheck
npm run lint
```

Portal readiness sweeps:

```bash
npm run portal:doctor:quick
npm run portal:doctor:quick:log
npm run portal:doctor
npm run portal:doctor:log
npm run portal:build-env
npm run portal:side-effects
```

`portal:doctor:quick` runs docs guard, mojibake check, typecheck, lint, and portal Vitest. `portal:doctor` adds portal build, schedule bundle budget, drawing browser smoke, authenticated smoke, route performance, and production security audit.

`portal:build-env` is the fail-fast preflight for portal build-dependent gates. `npm run build:portal`, `npm run portal:side-effects`, and broad `npm run portal:doctor` run it before `next build` so an active portal dev server or Next build lock prints a clear manual-stop instruction instead of failing deep in the build.

`portal:side-effects` is the focused quote, invoice, public-token, PDF/email, and job-pack readiness gate. It runs `npm run test:portal:quotes` and then `npm run build:portal` because generated PDF and job-pack asset loading is build-sensitive.

Use the `:log` variants when running noisy gates through an AI agent or chat tool. They run the same root npm scripts, write full stdout/stderr to an OS temp log, and print only the command, log path, duration, exit code, and a compact pass/fail summary. On failure they also print the last 120 log lines.

Focused portal commands:

```bash
npm run test:portal:api
npm run test:portal:schedule
npm run test:portal:workbench
npm run test:portal:projects
npm run test:portal:quotes
npm run portal:side-effects
npm run test:portal:shell
npm run test:portal:log
```

Use focused commands while iterating in one domain, then run `npm run portal:doctor:quick` before handing work back. Use `npm run portal:doctor` for a broad local pre-merge readiness sweep when Playwright auth/env and audit expectations are ready.

Focused guards:

```bash
npm run docs:guard
npm run docs:impact
npm run docs:navigation
npm run docs:readiness
npm run worktree:status
npm run worktree:changed
npm run worktree:changed:strict
npm run architecture:changed
npm run architecture:changed:strict
npm run dead-code:report
npm run dead-code:changed
npm run dead-code:changed:strict
npm run files:report
npm run files:changed
npm run files:changed:strict
npm run root:compat
npm run root:compat:changed
npm run root:compat:changed:strict
npm run browser:supabase
npm run browser:supabase:changed
npm run browser:supabase:changed:strict
npm run service-role:report
npm run service-role:changed
npm run service-role:changed:strict
npm run text:mojibake
npm run packages:guard
npm run cache:forbid
npm run brand:forbid
npm run schedule:bundle-budget
```

`npm run packages:guard` checks that app imports of local `@sp/*` workspace packages are declared in the app manifest and listed in Next `transpilePackages`. `npm run lint` includes this guard after `docs:guard`.

`npm run worktree:status` is an advisory ownership report for dirty worktrees and parallel lanes. Use `WORKTREE_OWNER_PATTERNS` with comma-separated path globs to declare the current task's owned paths. `npm run worktree:changed` is the focused handoff form. `npm run worktree:changed:strict` fails when dirty files exist without declared owner patterns, when files are outside the declared lane, or when deleted/missing paths need explicit owner confirmation. These commands are not part of `npm run lint`.

`npm run architecture:changed` is the recommended advisory handoff sweep for non-trivial work. It runs `worktree:changed` first, then `dead-code:changed`, `files:changed`, `root:compat:changed`, `browser:supabase:changed`, and `service-role:changed` with section headers, while leaving each focused report as the canonical source of its own handoff cues. It is not part of `npm run lint`.

`npm run architecture:changed:strict` is an architecture/tooling check and CI-visible advisory. It starts with `worktree:changed:strict`, then runs the strict changed-file variants that currently block only selected new risky growth. Declare `WORKTREE_OWNER_PATTERNS` before running it in a dirty local worktree. It is not part of `npm run lint`.

Changed-file architecture reports use the dirty worktree against `HEAD` by default. When `ARCHITECTURE_CHANGED_BASE` and `ARCHITECTURE_CHANGED_HEAD` are set, they compare those refs instead; Portal Quality uses that mode on pull requests so the advisory and strict advisory reports see PR base-to-head changes even though the CI checkout is clean. Strict mode remains non-blocking until new-growth enforcement is intentionally enabled.

`npm run dead-code:report` is an advisory unused-code and dependency report powered by Knip and explained by `docs/code-retirement-and-bloat-control.md`. It reports unused files, exports, types, dependencies, unlisted dependencies, and duplicate dependency declarations. `npm run dead-code:changed` narrows the same report to touched files for handoffs and uses the same dirty-worktree or PR base/head changed-file source as the architecture reports. `npm run dead-code:changed:strict` fails only for newly added unused files without valid registry coverage; existing modified files, unused exports/types, dependencies, and registered dynamic/deferred entrypoints remain advisory. These commands are not part of `npm run lint`; do not delete code from this report without search, owner-doc review, and focused tests.

`npm run files:report` is an advisory large-file ownership report. It highlights warning and critical files that should follow `docs/file-decomposition-and-ownership.md` before major feature expansion. `npm run files:changed` narrows that report to touched code files for agent handoffs, including line deltas from HEAD when available. `npm run files:changed:strict` exists for local experiments and later enforcement only. These are not part of `npm run lint` yet.

`npm run root:compat` is an advisory report for root-level compatibility paths such as `components`, `lib`, `data`, `src`, and `styles`. `npm run root:compat:changed` narrows the report to touched root compatibility files for handoffs. `npm run root:compat:changed:strict` fails only for new root compatibility files. These are not part of `npm run lint` yet.

`npm run browser:supabase` is a broad advisory inventory of browser-facing Supabase access. `npm run browser:supabase:changed` narrows the report to touched files for handoffs. `npm run browser:supabase:changed:strict` fails only for new browser Supabase access outside approved adapters. The narrower hard guard remains `npm run cache:forbid`, which is included in `npm run lint`.

`npm run service-role:report` is a broad advisory inventory of service-role Supabase access across portal, marketing, root compatibility, and operational scripts. `npm run service-role:changed` narrows the report to touched files for handoffs. `npm run service-role:changed:strict` fails only for new service-role access outside approved server flows or compatibility helpers. The narrower portal-only hard guard remains `apps/portal/lib/supabaseClient.boundaries.test.ts`.

Operational commands:

```bash
npm run portal:invite
npm run running-jobs:legacy-import
npm run costing:rebaseline-overrides
npm run geometry:generate-profile-assets
npm run emails:preview
```

## Docs-Only Checks

For docs-only changes, run these from the repo root:

```bash
npm run docs:guard
npm run docs:impact
npm run docs:navigation
npm run docs:readiness
npm run text:mojibake
```

`npm run docs:guard` checks required agent-doc links, startup-path docs, documented npm scripts, local Markdown link targets and anchors, decision-log structure, change-routing owner paths, portal readiness metadata, stale placeholders, ASCII docs, and superseded redirect shape.

`npm run docs:impact` is an advisory check that maps changed behavior files through `docs/change-routing.md` and suggests owner docs when matching docs were not changed. It exits nonzero only when `DOCS_IMPACT_STRICT=1`.

When `docs:impact` prints an advisory, update the suggested owner doc if the code change affects behavior, data flow, source-of-truth boundaries, test strategy, or known risks. Leaving docs unchanged is acceptable only when the change is mechanical, test-only, or behavior-neutral; note that decision in the handoff. Keep `docs:impact` advisory unless intentionally running `DOCS_IMPACT_STRICT=1` locally.

`npm run docs:navigation` is an advisory report for dense docs. It highlights long docs that may need a routing, index, or "read first" section.

`npm run docs:readiness` is an advisory report for `docs/portal-production-readiness.md`. It summarizes tracker age, status counts, at-risk rows, and unchecked checklist counts, but it does not verify readiness by itself.

## Portal Browser Tests

Required env:

- `PORTAL_TEST_EMAIL`
- `PORTAL_TEST_PASSWORD`

Optional env:

- `PORTAL_TEST_PROVISION_TARGET=local|staging`, required only for the opt-in provisioning command.
- `PORTAL_TEST_ROLE=staff|admin`, defaults to `staff` for provisioning.
- `PORTAL_EVIDENCE_MODE=default|full`, defaults to `default`; use `full` when you want screenshots and DOM snapshots attached for every portal browser route, not only failures.
- `PORTAL_PLAYWRIGHT_PORT`, defaults to `3011` when the portal harness starts locally.
- `PORTAL_BASE_URL`, disables local harness startup and points browser gates at an already-running portal.
- `PORTAL_DRAWING_URL`, points the drawing smoke at a known project/design page.

Commands:

```bash
npm run portal:auth-env
npm run portal:auth-runtime
npm run portal:test-user:ensure
npm run portal:agent-access
npm run portal:agent-access:provision
npm run portal:scenarios:ensure
npm run portal:agent-scenarios
npm run portal:agent-scenarios:provision
npm run portal:agent-scorecard
npm run portal:fixture-env
npm run test:portal:browser:auth
npm run test:portal:browser
npm run test:portal:browser:headed
npm run test:portal:smoke
npm run test:portal:performance
```

`npm run portal:auth-env` is the cheap fail-fast credential preflight for authenticated portal browser gates. It checks that `PORTAL_TEST_EMAIL` and `PORTAL_TEST_PASSWORD` are set before Playwright starts, so missing credentials fail loudly instead of producing a skipped or late setup failure.

`npm run portal:auth-runtime` is the authenticated runtime-readiness preflight for smoke and performance gates. It runs after `portal:auth-env`, signs in through the existing Playwright setup flow, verifies the session is not redirected to `/login` or `/access-status`, checks dashboard/projects/contacts/schedule shell access, confirms schedule readiness, and requires at least one project visible to the test account. `npm run test:portal:smoke`, `npm run test:portal:performance`, and broad `npm run portal:doctor` run it before their deeper authenticated assertions.

`npm run portal:test-user:ensure` is an explicit service-role provisioning command for local or staging only. It requires `PORTAL_TEST_PROVISION_TARGET=local|staging`, `PORTAL_TEST_EMAIL`, `PORTAL_TEST_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`; it creates or updates the Supabase Auth user and upserts `portal_users.role`. It must not be embedded into routine browser gates.

`npm run portal:agent-access` captures authenticated browser state and opens the `agentAccessSmokeRoutes` subset from `playwright/support/portalRouteCatalog.ts` with shared browser evidence. The current smoke subset is `/dashboard`, `/staff/projects`, `/staff/contacts`, and `/staff/schedule`; `/staff/projects` still expects at least one visible project. `npm run portal:agent-access:provision` is the opt-in combined command that provisions the test user first, then runs the same access smoke. Neither command seeds project or schedule data.

`npm run portal:scenarios:ensure` is the explicit service-role provisioning command for local/staging scenario data. It requires `PORTAL_TEST_SCENARIO_TARGET=local|staging`, `PORTAL_TEST_EMAIL`, `PORTAL_TEST_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`; it refuses missing targets and `production`, upserts deterministic `[Agent Scenario]` records, and writes non-secret route state to `playwright/.auth/portal-scenarios.json`. Optional env: `PORTAL_SCENARIOS=project-with-estimate,quote-ready,workbench-multi-object` and `PORTAL_SCENARIO_PREFIX=agent`.

`npm run portal:agent-scenarios` captures authenticated browser state and opens dynamic routes from the catalog-backed scenario lane: project detail, estimate detail, quote detail, and design workbench. It reads `playwright/.auth/portal-scenarios.json` only and does not mutate data. `npm run portal:agent-scenarios:provision` is the opt-in combined command that provisions the test user, seeds scenarios, then runs scenario smoke; because user provisioning and scenario provisioning have separate safety gates, set both `PORTAL_TEST_PROVISION_TARGET=local|staging` and `PORTAL_TEST_SCENARIO_TARGET=local|staging`.

`npm run portal:agent-scorecard` prints a read-only portal-agent quality snapshot from the route catalog, scenario registry, debug-export metadata, browser evidence adoption, and `npm run repo:health` headline. It does not run browser tests, provision users, seed scenarios, or mutate data. Use `npm run portal:agent-scorecard -- --json` for automation-friendly output. The human guide is `docs/portal-agent-scorecard.md`.

The portal route catalog is documented in `docs/portal-route-catalog.md`. Add new authenticated route coverage there first, then let browser specs consume the relevant catalog subset instead of adding local hardcoded route lists.

Shared page debug exports are enabled only outside production and only with `ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES=1`, `NEXT_PUBLIC_ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES=1`, `PORTAL_PAGE_DEBUG_EXPORTS=1`, or `NEXT_PUBLIC_PORTAL_PAGE_DEBUG_EXPORTS=1`. Project detail, redirected estimate detail, quote detail, and design workbench routes expose `data-portal-debug-export="true"` in the scenario lane. Browser specs should use `readPortalPageDebugExport(page)` / `expectPortalDebugExport(page, pageId)` from `playwright/support/portalAgent.ts`; bug reports for complex pages should include this payload when available.

Portal browser specs should install evidence through `playwright/support/portalBrowserEvidence.ts`, not local ad hoc listeners. The shared lane always attaches `portal-browser-evidence.json` with route/scenario context, current URL, console warnings/errors, page errors, failed requests, 4xx/5xx response summaries, and debug-export availability. On failure, or when `PORTAL_EVIDENCE_MODE=full`, it also attaches a full-page screenshot and truncated DOM snapshot. Workbench fixture specs add `workbench-viewport-evidence.json` with Plan body/fallback/hit-target ids, selection counts, 3D diagnostics, viewport bounds, and Plan/3D viewport screenshots when rich evidence is active. The lane never attaches storage state, cookies, auth headers, passwords, or service-role keys.

`npm run portal:fixture-env` is the fail-fast server-readiness preflight for the no-auth drawing fixture gate. `npm run test:portal:browser`, `npm run test:portal:browser:headed`, and the browser segment of `npm run test:portal:workbench` run it before Playwright starts. It catches a normal portal dev server already occupying the Playwright port and catches `PORTAL_BASE_URL` targets that redirect the fixture route to auth.

The auth setup saves local state to `playwright/.auth/portal-staff.json`, which is ignored.

## Drawing Fixture Route

The drawing browser gate uses the hidden fixture workbench route:

```text
/staff/projects/fixture-roof/design-workbench?fixture=mono-standard
```

Fixture mode is read-only. It opens the standard Mono workbench fixture, enters Model Space Plan, verifies viewport diagnostics and gesture state, captures a nonblank plan screenshot, and confirms no page runtime errors. The no-auth fixture gate also checks gable, box, mono-join, and screenshot-style hipped fixtures for nonblank Model Space Plan, 3D containment, finite diagnostics, top-projection parity, and the 3D Top screen-axis convention. Each parity-critical fixture now also exposes compact fixture-only browser diagnostics for the shadow `workbench_solved` commercial source, ready trust status, solved-geometry quantity takeoff source, no blocking readiness gates, and commercial parity counts. The authenticated browser suite can still open a project-backed drawing route when staff credentials and data are available.

The parity-critical baked fixture list is owned by `apps/portal/lib/drawings/sanctuaryWorkbenchFixtures.ts` through fixture-only QA metadata. Keep fixture names explicit, add representative saved estimate snapshots to the commercial parity harness or the fixture registry when a checked-in corpus exists, and treat commercial parity as shadow comparison signal only.

`npm run test:portal:browser` uses the no-auth `portal-fixture` Playwright project so fixture parity can run without project data or staff credentials. Run `npm run test:portal:browser:auth` first when you need the auth-backed `portal-chromium` setup state or project-list discovery smoke.

Skipped browser cases are intentional and should stay explained in the test output:

- In the `portal-fixture` project, the auth-backed project discovery smoke is skipped unless `PORTAL_DRAWING_URL` is set; that project-backed coverage belongs to `portal-chromium`.
- In authenticated project-backed runs, a selected project with no drawing geometry may skip the browser feel pass; this is data-dependent and should not hide fixture-route coverage.

When Playwright starts the portal dev server itself, it enables the geometry workbench fixture flags for this no-auth fixture gate and uses isolated Next dev output so a normal `npm run dev:portal` server can keep running on port `3001`. The fixture harness defaults to `http://127.0.0.1:3011`; if that port is occupied, choose another fixture port:

```powershell
$env:PORTAL_PLAYWRIGHT_PORT='3021'; npm run test:portal:browser; Remove-Item Env:\PORTAL_PLAYWRIGHT_PORT
```

If `PORTAL_BASE_URL` points at an already-running portal server, that server must be started with the same fixture flags. The preflight does not terminate processes or weaken auth checks:

```powershell
# Terminal A: start the manual fixture server. Use PORTAL_PLAYWRIGHT_DIST_DIR only when another portal Next dev server is already running from apps/portal.
$env:ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES='1'; $env:PORTAL_PLAYWRIGHT_DIST_DIR='.next/playwright-fixture-manual'; npm --prefix apps/portal run dev:playwright -- -p 3021

# Terminal B: point the browser gate at that server.
$env:PORTAL_BASE_URL='http://127.0.0.1:3021'; npm run test:portal:browser; Remove-Item Env:\PORTAL_BASE_URL

# Terminal A after stopping the manual server.
Remove-Item Env:\ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES; Remove-Item Env:\PORTAL_PLAYWRIGHT_DIST_DIR
```

## Schedule QA Gate

Before shipping schedule changes:

1. Confirm migrations are applied through current Schedule V2 command/repair migrations.
2. Confirm `GET /api/staff/v1/schedule/readiness` returns `200`.
3. Run relevant schedule unit and route tests.
4. Manually check Board, Gantt, and Site Visits if UI behavior changed.

Minimum targeted schedule tests:

```bash
npx vitest run lib/scheduling/workingDays.test.ts lib/scheduling/recompute.test.ts apps/portal/lib/scheduling/workingDays.test.ts apps/portal/lib/scheduling/recompute.test.ts
```

## Manual QA Checklist Seeds

Portal shell:

- Navigate between staff pages and confirm header back/forward controls enable, disable, and move through history correctly.

Projects:

- Open `/staff/projects` across desktop and mobile widths.
- Confirm filters wrap without clipped text.
- Toggle follow-up due and confirm the list updates without layout jitter.

Design Workbench authenticated edit/save/reload:

- Use a staff test account and a reversible draft estimate/design with safe fixture-like data.
- Open `/staff/projects`, select the project, open the Designs tab, and open the drawing workbench.
- Confirm Model Space Plan, Sheet View, and 3D View are nonblank, finite, and do not show legacy fallback or unavailable text.
- Make one reversible object-first edit such as a small roof pitch, attachment side, deck position, opening position, or house form parameter change.
- Save the workbench, wait for the saved/clean state, reload the page, and confirm the edited value, Model Space Plan, Sheet View, and 3D View persist.
- Restore the original value, save again, reload again, and confirm the project returns to its starting state.

Pricing Source Rollout:

- `calculator_live` save: leave `PORTAL_ESTIMATE_PRICING_SOURCE` unset or set it to `calculator_live`, save a reversible estimate, and confirm `estimates.pricing_source` plus compact metadata record calculator live while `commercial_design_input` stays null and no downstream public output exposes a commercial payload.
- Blocked `workbench_solved` save: set `PORTAL_ESTIMATE_PRICING_SOURCE=workbench_solved` against a not-ready or blocked workbench case, attempt an estimate save, and confirm `409 ESTIMATE_PRICING_SOURCE_BLOCKED`, visible conflict/failure state, no estimate row mutation, and no hidden calculator fallback.
- Ready `workbench_solved` save once enabled: use a safe ready fixture-like project, save, reload, and confirm `pricing_source=workbench_solved`, compact metadata is present, `commercial_design_input` is stored only on the estimate row, and normal edit/reload behavior still works.
- Quote refresh preserving metadata: refresh a draft quote from the estimate and confirm line items and totals come from the saved estimate boundary while compact source metadata copies to the quote version.
- Rollback to `calculator_live`: switch the env back to `calculator_live`, save a new estimate or refresh a future draft quote only through domain helpers, and confirm historical workbench-backed estimates, quote versions, PDFs, public tokens, invoices, and job packs are not repriced.
- Public quote/PDF/invoice/job-pack preservation: verify public quote pages, generated quote PDFs, invoice creation/PDF, and job-pack generation preserve historical quote-version totals and never expose raw `commercial_design_input`.

Schedule Board:

- Assign an unscheduled job to a crew.
- Reorder jobs within a crew.
- Move a job between crews.
- Unschedule a job and refresh.
- Confirm crew lanes stay fixed-width and horizontally scroll.

Schedule Gantt:

- Confirm week headers are Monday-aligned.
- Confirm weekend shading is Saturday/Sunday.
- Drag or resize bars only through supported interactions.
- Toggle crew collapse and range options.

## Portal Production Readiness

Use `docs/portal-production-readiness.md` as the active readiness tracker for current status, blockers, highest-leverage tasks, and parallel lanes.

This doc remains the canonical command catalog. When readiness work changes command expectations, update this doc; when readiness status changes, update `docs/portal-production-readiness.md`.

## CI

- Portal Quality runs docs guard, architecture changed advisory reporting, architecture strict new-growth advisory reporting, dead-code changed advisory reporting, repository typecheck, lint, portal Vitest, portal build, schedule bundle budget, production security audit, fixture browser smoke, and authenticated smoke. Authenticated smoke is blocking and writes the required credential, role, schedule-readiness, and project-data prerequisites to the GitHub step summary.
- Portal Performance Report runs authenticated route timing as a separate blocking job and uploads `portal-route-timings` when generated. It also writes the authenticated runtime prerequisites to the GitHub step summary before timing routes.
- Docs Health runs weekly and on demand, with blocking docs guard and mojibake checks plus advisory docs impact, navigation, and readiness reports.
- Lighthouse Guardrails run mobile and desktop Lighthouse profiles.
- Governance Monthly still runs the broader marketing/governance sweep with marketing tests, production dependency audit, and Lighthouse.
