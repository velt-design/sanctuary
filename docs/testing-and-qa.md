# Testing And QA

Use the smallest test that covers the risk. Run broader suites when touching shared workflow, portal shell, scheduling, local-first, Supabase access, or public lead/quote flows.

## Read First

- Use `## Common Commands` for routine repo, portal, focused, and operational scripts.
- Use `## Docs-Only Checks` when changing docs, agent guidance, or docs tooling.
- Use `## Background-Job And Worker Tests` for JOB-01/JOB-02/JOB-03 provider-package, worker, migration, security, webhook, fault-injection, and isolated PGMQ database checks.
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
npm run dev:worker
npm run test
npm run test:marketing
npm run test:email-provider
npm run test:jobs
npm run test:jobs:db-contract
npm run test:jobs:db
npm run test:worker
npm run test:portal
npm run build:marketing
npm run build:portal
npm run build:worker
npm run typecheck
npm run typecheck:worker
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

`portal:doctor:quick` runs docs guard, mojibake check, typecheck, lint, and portal Vitest. `portal:doctor` adds portal build, general route bundle budgets, drawing and fixture-performance browser smoke, authenticated smoke, route performance, and production security audit.

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
npm run portal:bundle-budget
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

## Background-Job And Worker Tests

JOB-01 through JOB-03 have six distinct verification layers:

- `npm run test:email-provider` runs the Node-only `@sp/email-provider` normalization, byte-stable durable identity, fixed 24-hour provider-retention/20-hour retry configuration, Resend outcome/timeout/abort, retry-after, integrity, and raw-body Svix verification tests. All network transport is injected or mocked; this command never sends a real email. On 2026-07-20 it passed 3 files and 47 tests.
- `npm run test:jobs` runs the `@sp/jobs` contract/state-machine/runtime-parser tests, the `@sp/email-provider` tests, static migration contract assertions, and repository security-boundary tests. On 2026-07-20 the JOB-03 local suite passed 8 files and 144 tests.
- `npm run test:jobs:db-contract` runs only `test/background-jobs-migration.test.ts`. Despite the name, it inspects SQL text and the checked-in SQL test shape; it does not connect to Postgres or execute a migration. On 2026-07-20 it passed 1 file and 26 tests.
- `npm run test:jobs:db` is the live database contract. `scripts/test-background-jobs-db.mjs` starts a disposable PGMQ-capable container, reports the resolved image, PostgreSQL major version, and PGMQ extension version, applies `supabase/tests/background_jobs_bootstrap.sql`, discovers and applies the seven JOB-01/JOB-02/JOB-03 migrations in order with each migration protected by a transaction, runs real two-session enqueue and provider-message unique-index races, executes the rollback-wrapped `supabase/tests/background_jobs.sql`, and removes the container. The default image is `ghcr.io/pgmq/pg18-pgmq:v1.10.0`; intentional overrides can set `BACKGROUND_JOBS_DB_IMAGE` and the expected version variables.
- `npm run test:worker` runs the Node-only worker configuration, safe logger, health server, RPC adapter, CLI, concurrency, execution, retry, heartbeat, shutdown, modes, and durable email coordinator tests. JOB-03 includes the required ten-point persistent-world hard-crash matrix from enqueue response loss through terminal queue archive/local return, plus an eleventh lost-return boundary after the business finaliser commits but before the `finalised` checkpoint. It asserts one frozen intent/key/body, one provider delivery, one business finalisation, monotonic checkpoints, and no redispatch after terminal state. On 2026-07-20 the JOB-03 local suite passed 12 files and 134 tests. `npm run typecheck:worker` and `npm run build:worker` prove the standalone TypeScript and bundled Node 22 entrypoint; `node apps/worker/dist/worker.mjs --help` is the built CLI smoke.
- `npm run test:email-integrations` runs the portal/marketing adapter, narrow repository, and webhook tests with mocked provider transport. They cover stable compatibility keys, safe failure summaries, incremental streaming body-size rejection and cancellation before signature verification, read failures, untouched raw-body verification, ignored signed event types, missing/invalid secrets, and strict RPC result parsing without real provider traffic. On 2026-07-20 it passed 8 files and 38 tests.

The database bootstrap creates only the test roles plus minimal `auth.users` and `public.projects` prerequisites. It is not a production migration and does not validate the repository's full historical migration chain, which is not independently bootstrappable from an empty database. Never run the SQL contract against a shared local, staging, or production database.

As of 2026-07-20, `docker`, `psql`, and the Supabase CLI were unavailable on this workstation, so the local live command still stops at `spawnSync docker ENOENT` before starting a container. The dedicated `.github/workflows/background-jobs.yml` workflow is the executable database and artifact evidence: [run 29723041212](https://github.com/velt-design/sanctuary/actions/runs/29723041212) passed all seven JOB-01/JOB-02/JOB-03 migrations on upstream PostgreSQL 18/PGMQ 1.10.0 and Supabase PostgreSQL 17/PGMQ 1.5.1. The same run passed package typechecks, job/security contracts, application integrations, worker typecheck/tests/lint/production build, built CLI, the strict service-role guard, and the non-root container build. These checks prove the scoped background-job harness and artifact, not deployment to a shared environment or the repository's non-bootstrappable historical migration chain; no real provider send belongs in this gate.

The database contract checks the logged queue and unlogged-name fail-closed rule, minimal message, atomic intent-stable enqueue (including two database clients synchronised by an advisory-lock barrier), a concurrent cross-job provider-message collision blocked on the winning unique-index transaction and atomically quarantined after it commits, private payload and effect-identity read fencing, competing claims, random lease fencing, heartbeat extension, strict state/effect transitions, provider-window and same-key uncertainty recovery, verified acceptance races/deduplication/conflicts, append-only minimal receipts, cancellation fencing, bounded-argument NULL rejection, exact terminal archive, missing/stale-message audit and repair, safe inspection projections, and browser/service-role revokes. Static tests cannot prove those runtime behaviours by themselves.

Browser-role denial is verified from the live PostgreSQL privilege catalog for every `background_*` function, including an exact service-role allowlist. Do not replace that check with caught calls to revoked functions while the compatibility matrix pins Supabase Postgres `17.6.1.107`: [supabase/postgres#2112](https://github.com/supabase/postgres/issues/2112) records a `supautils` SIGSEGV on that denial path. A targeted fix appears in [supautils v3.2.2](https://github.com/supabase/supautils/releases/tag/v3.2.2), but version presence alone is not evidence; reconsider call-style probes only after an upgraded supported image passes the focused reproduction on both matrix legs. The workaround changes only the test mechanism, not grants or RLS.

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
npm run portal:calculator-ui
npm run portal:calculator-ui:provision
npm run portal:agent-scorecard
npm run portal:agent-scorecard:strict
npm run portal:fixture-env
npm run test:portal:browser:auth
npm run test:portal:browser
npm run test:portal:browser:headed
npm run test:portal:smoke
npm run test:portal:performance
npm run test:portal:performance:capture
npm run test:portal:performance:fixture
```

`npm run portal:auth-env` is the cheap fail-fast credential preflight for authenticated portal browser gates. It checks that `PORTAL_TEST_EMAIL` and `PORTAL_TEST_PASSWORD` are set before Playwright starts, so missing credentials fail loudly instead of producing a skipped or late setup failure.

`npm run portal:auth-runtime` is the authenticated runtime-readiness preflight for smoke and performance gates. It runs after `portal:auth-env`, signs in through the existing Playwright setup flow, verifies the session is not redirected to `/login` or `/access-status`, checks dashboard/projects/contacts/schedule shell access, confirms schedule readiness, and requires at least one project visible to the test account. `npm run test:portal:smoke`, `npm run test:portal:performance`, and broad `npm run portal:doctor` run it before their deeper authenticated assertions.

`npm run test:portal:browser` includes the gated, customer-data-free Project Command Centre fixture at `/qa/project-command-centre-fixture`. Its matrix preserves the nine commercial/source scenarios and adds primary, empty, conflict, critical, and undated action states at 1600, 1366, 1024, 768, and 390 px with horizontal-overflow assertions. The fixture renders the production design/commercial and primary-action cards and requires `ENABLE_PORTAL_QA_FIXTURES=1`; the standard fixture harness supplies that flag.

The UI foundation has a data-free visual mirror at `/qa/ui-foundation-fixture`, gated by the same `ENABLE_PORTAL_QA_FIXTURES=1` flag. Use it for desktop, tablet, and mobile screenshots when staff credentials are unavailable. `/staff/ui-foundation` remains the authoritative protected route and stays in authenticated agent-access smoke.

`playwright/portal.ui-foundation.spec.ts` is the production-hardening gate for `/staff/ui-foundation`, `/staff/projects`, and one discovered Project Detail route. It runs 1440x1000, 1280x800, 1024x900, 768x1024, and 390x844 plus 720x500 with a 200% zoom simulation. It combines semantic and interaction assertions with document-overflow, major-section-overlap, cropped-control, keyboard/focus-return, reduced-motion, and contrast checks; screenshots remain supplementary evidence rather than the only assertion.

`npm run test:portal:command-centre:auth` additionally requires `PORTAL_COMMAND_CENTRE_MUTATION_PROJECT_ID` and `PORTAL_COMMAND_CENTRE_CONFLICT_PROJECT_ID`. The mutation project must be a dedicated active `new`-through-`sent` test project with no other qualifying dated action or conflict. The conflict project must be dedicated, start with a real explicit-selection conflict, and be used with an admin test account. The suite fails rather than skipping when either project is missing, so a green result is Stage 2 completion evidence rather than a partial smoke.

`npm run test:portal:command-centre:auth` is the blocking authenticated Project Command Centre gate. It discovers an RLS-visible real project, opens its integrated Overview, requires the command-centre response to be `private, no-store`, verifies normalized nested quote/estimate/price fields plus the single-owner/action/audit contract, and requires the production owner/action UI. The mutation journey requires an admin test account because project-owner changes are admin-only. Missing staff credentials, project data, or the Stage 2 database migrations fails the gate rather than skipping it.

`npm run test:portal:performance` writes a schema-version-2 journey artifact. It measures cold Dashboard, Projects, Project Detail, Contacts, and Schedule; warm Dashboard to Projects, Dashboard to Contacts, Projects to project, browser back, and project tab navigation; and Schedule/Calculator interactions. The cold Project Detail journey discovers a real project in a separate authenticated context, then opens the canonical detail URL in a new context with no project-list or persisted-query cache so PROJECT-01 has a truthful cold-read signal. Each journey separates visible feedback, useful content, and background-settled time, and records same-origin requests/transfer, long tasks, and blocking overlays. Dashboard-to-Projects and Dashboard-to-Contacts feedback ends when the canonical index URL reaches the browser, useful content requires that index's heading, controls, truthful list region, and state marker, and background completion requires its fresh authenticated index response. Project-opening background completion still requires both the fresh snapshot and active tab workflow. Portal Performance CI builds once and runs all five authenticated repetitions against `next start`; development compilation time must never be recorded as product latency. CI rejects missing journeys and publishes p50/p75/p95. Product targets stay visible separately from regression ceilings so noisy baselines cannot redefine the product goal.

Wave 2 reversible-write coverage starts with `apps/portal/app/staff/projects/projectsIndexMutations.test.ts`, `ProjectsIndexClient.test.tsx`, and `apps/portal/lib/queries/projectCache.test.ts`. These tests use an intentionally unresolved request to prove cache/UI feedback occurs before network completion, then cover field-specific rollback, active/archived/all membership and count restoration, and separate QueryClients for user isolation. Server-confirmed success remains distinct from optimistic feedback; destructive delete and customer-facing side effects are outside the optimistic contract.

Ordinary authenticated route changes must keep the current surface usable, show the thin portal progress bar immediately, and apply `aria-busy` only to the clicked control. Full-page Blueprint loading remains for cold route/authentication boundaries. `npm run test:portal:shell` covers the shared transition owner and navigation controls; authenticated routing smoke verifies Schedule view changes never show the blocking overlay.

The initial authenticated baseline was locked on 2026-07-19 from exactly five CI runs. New regression ceilings use `max(product target, p75 x 1.2)`, rounded up to 50 ms, and are enforced against the five-run p75 aggregate. Existing cold-route and Schedule-toggle ceilings remain per-run and were not changed.

Wave 1 Slice 1 replaced the project-opening rows with exactly five production-mode authenticated runs from Portal Quality run `29671978619`. Project opening recorded 41/44/45 ms feedback p50/p75/p95, 58/60/60 ms useful-content p50/p75/p95, and 2286/2290/2956 ms background-settled p50/p75/p95. All five runs had no blocking overlay and no observed long task. The resulting locked regression ceiling is 100 ms feedback and 500 ms useful content, matching the product target.

Wave 1 Slice 2 replaced the Dashboard-to-Projects row with exactly five production-mode authenticated runs from Portal Quality run `29675363201`. The journey recorded 43/44/44 ms feedback p50/p75/p95, 75/76/99 ms useful-content p50/p75/p95, and 2243/2277/2311 ms background-settled p50/p75/p95. All five runs had no blocking overlay and no observed long task. Applying the ratchet formula keeps the locked ceiling at the 100/500 ms product target.

Wave 1 Slice 3 replaced Dashboard-to-Contacts with exactly five production-mode authenticated runs from Portal Quality run `29678858906`. The journey recorded 33/35/35 ms feedback p50/p75/p95, 50/52/53 ms useful-content p50/p75/p95, and 3053/3080/3096 ms background-settled p50/p75/p95. All five runs had no blocking overlay and no observed long task. Applying the ratchet formula keeps the locked ceiling at the 100/500 ms product target.

Wave 1 completion run `29687042640` recorded exactly five current-head production repetitions. The isolated pre-Slice-1 comparison run `29681955081` measured cold Project Detail useful-content p75 at 2,454 ms, making the unchanged 10% guard 2,699 ms. Current-head cold Project Detail measured 1,664/1,666/1,680 ms useful content p50/p75/p95: the small authenticated direct-link summary makes the real project header and tabs useful first, while complete-snapshot background settlement remains separately measured at 2,667/2,726/2,727 ms. All five project runs had no blocking overlay and no observed long task. The same current-head run measured calculator visible feedback at 40/47/58 ms and fresh-result completion at 924/939/942 ms. Fixture-safe workbench evidence measured object selection at 86/119 ms feedback/useful and Plan-to-3D at 117/122 ms, with no request, overlay, or long task in either interaction.

| Journey | Feedback p50/p75/p95 | Useful p50/p75/p95 | Product target | Locked feedback/useful ceiling |
| --------------------------- | -------------------: | -----------------: | :------------: | --------------------------------------------------------: |
| Dashboard cold | 806/807/871 ms | 816/817/881 ms | Miss | Existing cold ceiling unchanged |
| Projects cold | 749/766/779 ms | 758/777/788 ms | Miss | Existing cold ceiling unchanged |
| Project Detail cold | 781/785/797 ms | 1664/1666/1680 ms | 10% guard met | Existing cold ceiling unchanged; 2699 ms comparison guard |
| Contacts cold | 687/708/726 ms | 698/714/742 ms | Miss | Existing cold ceiling unchanged |
| Schedule cold | 737/758/760 ms | 1106/1125/1135 ms | Miss | Existing cold ceiling unchanged |
| Dashboard to Projects | 37/37/38 ms | 56/58/59 ms | Met | 100/500 ms |
| Dashboard to Contacts | 38/39/41 ms | 57/59/63 ms | Met | 100/500 ms |
| Projects to project | 35/38/39 ms | 48/49/51 ms | Met | 100/500 ms |
| Project back to Projects | 5/6/6 ms | 21/25/25 ms | Met | 100/500 ms |
| Project Details tab | 38/40/53 ms | 41/49/60 ms | Met | 250/500 ms |
| Schedule unscheduled toggle | 137/137/139 ms | 140/141/142 ms | Regression met | Existing 1200/1200 ms ceiling unchanged |
| Calculator current result | 40/47/58 ms | 924/939/942 ms | Feedback met | 700/2950 ms |

`npm run test:portal:performance:capture` is the CI repetition primitive after `portal:auth-runtime` has already passed. Use the normal `test:portal:performance` command for a standalone local run so auth/data prerequisites remain fail-fast.

`npm run test:portal:performance:fixture` runs credential-free interaction gates. The workbench journey measures object selection and Plan-to-3D feedback against `/qa/design-workbench-fixture`. The project-mutation route mounts the production Projects-index controller, Project/Contact Detail local-first controllers, and manual project-task toggle at `/qa/projects-index-mutation-fixture`. It intercepts sample requests and proves visible update/Done/checkbox feedback completes within 100 ms while deliberately 750 ms persistence responses continue in the background. Mutation feedback is timestamped inside Chromium by observing the real visible DOM state; Playwright command/IPC latency is not counted as product feedback. Paired rejection checks prove index rollback/error visibility, both detail editors' confirmed-value rollback with retained reviewable drafts, and task-specific rollback plus Retry. The route binds only a synthetic fixture owner, clears its local-first state, and uses no durable/customer record IDs. The gates produce separate schema-v2 artifacts at `artifacts/portal-workbench-performance.json` and `artifacts/portal-project-mutation-performance.json`.

After `npm run build:portal`, run `npm run portal:bundle-budget`. It enforces initial raw/gzip, total lazy raw/gzip, and largest-lazy raw/gzip limits for Schedule, Projects Index, Contacts Index, Project Detail, Calculator, and Design Workbench. The analyser reads both Next's loadable manifests and Turbopack's emitted lazy-loader groups so an empty route loadable manifest cannot silently report zero deferred code. Projects Index was measured at 687.3/197.8 KiB raw/gzip initial and 2,651.9/606.2 KiB lazy. Contacts Index was measured from the Slice 3 fresh build at 559.8/159.6 KiB initial and 120.6/19.2 KiB lazy; each limit is its fresh measurement plus 5%, rounded up to KiB. Shared shell gzip grew by about 0.7 KiB from Slice 2, within the 5 KiB allowance. `npm run schedule:bundle-budget` remains the focused compatibility wrapper and preserves the original Schedule limits. Missing or changed Next manifests fail with the fresh-build recovery command.

Project Detail measures about 658.1/189.5 KiB raw/gzip initial plus 1,762.9/370.9 KiB lazy (about 2,421.0/560.4 KiB combined). Its fresh-build-plus-5% limits remain below the preserved 3,014,656 raw / 757,760 gzip route cap. Activity remains the default workflow but now joins responsive Details and the other workflows as a truthful local lazy boundary; the project frame and tabs stay initial. The Estimate drawing surface no longer pulls Three/React Three Fiber into Project Detail: the 3D viewport loads only from exact `3D Review` intent and is accounted for by the Design Workbench route gate. That route measures about 1,583.2/385.9 KiB initial plus 942.8/247.1 KiB lazy; its split limits redistribute, but do not increase, the previous 2,681,856 raw / 671,744 gzip all-initial allowance.

`npm run portal:test-user:ensure` is an explicit service-role provisioning command for local or staging only. It requires `PORTAL_TEST_PROVISION_TARGET=local|staging`, `PORTAL_TEST_EMAIL`, `PORTAL_TEST_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`; it creates or updates the Supabase Auth user and upserts `portal_users.role`. It must not be embedded into routine browser gates.

`npm run portal:agent-access` captures authenticated browser state and opens the `agentAccessSmokeRoutes` subset from `playwright/support/portalRouteCatalog.ts` with shared browser evidence. The current smoke subset is `/dashboard`, `/staff/ui-foundation`, `/staff/projects`, `/staff/contacts`, and `/staff/schedule`; `/staff/projects` still expects at least one visible project. `npm run portal:agent-access:provision` is the opt-in combined command that provisions the test user first, then runs the same access smoke. Neither command seeds project or schedule data.

`npm run portal:scenarios:ensure` is the explicit service-role provisioning command for local/staging scenario data. It requires `PORTAL_TEST_SCENARIO_TARGET=local|staging`, `PORTAL_TEST_EMAIL`, `PORTAL_TEST_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`; it refuses missing targets and `production`, upserts deterministic `[Agent Scenario]` records, and writes non-secret route state to `playwright/.auth/portal-scenarios.json`. Optional env: `PORTAL_SCENARIOS=project-with-estimate,calculator-multi-module,quote-ready,workbench-multi-object` and `PORTAL_SCENARIO_PREFIX=agent`. The dedicated calculator scenario is reconciled to its current fixture revision on every provisioning run rather than sharing mutable route-smoke estimate state.

`npm run portal:agent-scenarios` captures authenticated browser state and opens dynamic routes from the catalog-backed scenario lane: project detail, estimate detail, quote detail, design workbench, and calculator. It reads `playwright/.auth/portal-scenarios.json` only and does not mutate data. `npm run portal:agent-scenarios:provision` is the opt-in combined command that provisions the test user, seeds scenarios, then runs scenario smoke; because user provisioning and scenario provisioning have separate safety gates, set both `PORTAL_TEST_PROVISION_TARGET=local|staging` and `PORTAL_TEST_SCENARIO_TARGET=local|staging`.

`npm run portal:calculator-ui` runs the authenticated calculator trust suite against the revisioned V2 `calculator-multi-module` scenario, which has three modules across two pergolas. It checks the fixture precondition before interaction and tells the operator to run `npm run portal:calculator-ui:provision` when the state file or stored estimate has drifted. The suite then checks canonical grouped module identity, fresh Add, deep Duplicate, Move without reordering, confirmed Remove, per-module validation badges and issue focus, current/stale result labelling, save blocking, calculator customer-price parity with the shared quote formula, nearest-dollar comma formatting in full and compact customer-price displays, compact aligned internal costs with non-shrinking single-line values and shrinkable unclipped labels at the 1366px browser width and its untouched 440px preview, preview hierarchy with Module views before True cost change, ranked cost-change categories, separate internal and blind cent precision, quiet configuration sheets with separate Blinds and Infills cards, helper-free routine configuration with retained validation messages, aligned input/toggle controls, restrained active-module actions, Orientation-diagram removal, stored-versus-Live save review, deliberate Preserve/Reprice actions, project selection, module-switch edit retention, local draft status and reload restoration, responsive configuration columns (three at 1600px and 1024px; two at 1366px and 768px), untouched 480px/440px desktop preview defaults, compact price visibility and full-price parity below 1120px, quiet empty add-ons and zero-count infill summaries, sticky-command-bar focus clearance, and initially visible narrow Save access at 1024px and 768px. The real project route additionally checks its compact project/Calculator chrome at 1600, 1366, 1024, 768, and 390px, including desktop height budgets, design-selection access, sticky navigation, and zero document overflow. The browser suite does not press a save action or create persistent quote data. `npm run portal:calculator-ui:provision` is the explicit local/staging provisioning variant and has the same two target safety requirements as the broader scenario provision command.

`playwright/portal.calculator-infills.spec.ts` is the authenticated infill accuracy and guided-usability lane. It creates scratch-draft infills only, proves panel material and joiner direction appear only on `Existing supports` with two explicit choices each, completes all three stages with pointer and keyboard controls, verifies the exact `2.4m x 2.1m` vertical-sheet pieces and purchases at desktop size, and verifies the kerf-safe `3m x 1m` horizontal-strip purchase plan at `1024px`. Desktop coverage keeps the first cut rows beside the compact diagram. At `768px` it keyboard-selects the Rectangle, Sloping top, and Triangle visual templates, verifies the explicit Selected marker, confirms the triangle needs only width and peak height, confirms that the point has no support question or cut, and checks triangle CSV parity. The compact progression scenario verifies primary-field order, exactly two Yes/No answers per physical edge, the neutral support summary, labelled diagram guidance, conservative No defaults, and no horizontal overflow. A `480px` scenario proves untouched required fields remain calm until blur, the Opening preview stays geometry-only, canonical Results rows stack without overflow, and the plain-English export actions remain available. Blocked stock/material coverage routes to `Existing supports`; invalid partial-edge roof-rafter matching also routes there, and export remains unavailable until the blocker is resolved. Valid clipboard and downloaded CSV contain the same canonical records shown in the two result tables. The suite does not save an estimate or create a quote.

`npm run portal:agent-scorecard` prints a read-only portal-agent quality snapshot from the route catalog, scenario registry, debug-export metadata, browser evidence adoption, and `npm run repo:health` headline. It does not run browser tests, provision users, seed scenarios, or mutate data. Use `npm run portal:agent-scorecard -- --json` for automation-friendly output. The human guide is `docs/portal-agent-scorecard.md`.

`npm run portal:agent-scorecard:strict` runs the same read-only scorecard plus the current portal-agent strictness ratchet. It fails only when route catalog, scenario, debug-export, seeded-scenario, or shared browser evidence coverage drops below the documented baseline; repo-health metrics remain advisory.

The portal route catalog is documented in `docs/portal-route-catalog.md`. Add new authenticated route coverage there first, then let browser specs consume the relevant catalog subset instead of adding local hardcoded route lists.

Shared page debug exports are enabled only outside production and only with `ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES=1`, `NEXT_PUBLIC_ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES=1`, `PORTAL_PAGE_DEBUG_EXPORTS=1`, or `NEXT_PUBLIC_PORTAL_PAGE_DEBUG_EXPORTS=1`. Project detail, redirected estimate detail, quote detail, and design workbench routes expose `data-portal-debug-export="true"` in the scenario lane. Browser specs should use `readPortalPageDebugExport(page)` / `expectPortalDebugExport(page, pageId)` from `playwright/support/portalAgent.ts`; bug reports for complex pages should include this payload when available.

Portal browser specs should install evidence through `playwright/support/portalBrowserEvidence.ts`, not local ad hoc listeners. The shared lane always attaches `portal-browser-evidence.json` with route/scenario context, current URL, console warnings/errors, page errors, failed requests, 4xx/5xx response summaries, and debug-export availability. On failure, or when `PORTAL_EVIDENCE_MODE=full`, it also attaches a full-page screenshot and truncated DOM snapshot. Workbench fixture specs add `workbench-viewport-evidence.json` with Plan body/fallback/hit-target ids, selection counts, 3D diagnostics, viewport bounds, and Plan/3D viewport screenshots when rich evidence is active. The lane never attaches storage state, cookies, auth headers, passwords, or service-role keys.

Workbench captured repro payloads are read through `readWorkbenchCapturedReproPayload(page)` from `playwright/support/workbenchFixture.ts`. The helper accepts the shared page debug export (`diagnostics.workbenchDebugFixture`) or the raw fixture script (`data-workbench-debug-export="true"`), validates `snapshot`, `objectFirst`, selected state, house geometry inputs, project house health, pergola health, and `projectPreviewSource`, and returns a normalized payload that can be pasted into `sanctuaryWorkbenchCapturedFixtures.ts`. Browser specs may attach this payload as evidence, but must not write captured payloads to tracked files. The full workflow is in `docs/workbench-captured-repro-workflow.md`.

`npm run workbench:capture:verify` is the explicit agent capture verifier for the current multi-house roof failure lane. It opens `WORKBENCH_CAPTURE_URL` or the default staff workbench route with page debug/workbench fixture flags enabled, reads `diagnostics.workbenchDebugFixture`, and fails unless the payload is object-first, has at least two house forms, has per-house diagnostics, and includes a non-healthy or inconsistent house roof/render stage. This command is expected to fail when the live page is healthy or only contains one house; that failure means no captured solver fixture should be baked yet.

`npm run portal:fixture-env` is the fail-fast server-readiness preflight for the no-auth drawing fixture gate. `npm run test:portal:browser`, `npm run test:portal:browser:headed`, and the browser segment of `npm run test:portal:workbench` run it before Playwright starts. It catches a normal portal dev server already occupying the Playwright port and catches `PORTAL_BASE_URL` targets that redirect the fixture route to auth.

The auth setup saves local state to `playwright/.auth/portal-staff.json`, which is ignored.

## Drawing Fixture Route

The drawing browser gate uses the hidden fixture workbench route:

```text
/staff/projects/fixture-roof/design-workbench?fixture=mono-standard
```

Fixture mode is read-only. It opens the standard Mono workbench fixture, enters the Plan Editor, verifies viewport diagnostics and gesture state, captures a nonblank plan screenshot, and confirms no page runtime errors. The no-auth fixture gate also checks gable, box, mono-join, and screenshot-style hipped fixtures for nonblank Plan Editor, 3D containment, finite diagnostics, top-projection parity, and the 3D Top screen-axis convention. Each parity-critical fixture now also exposes compact fixture-only browser diagnostics for the shadow `workbench_solved` commercial source, ready trust status, solved-geometry quantity takeoff source, no blocking readiness gates, and commercial parity counts. The authenticated browser suite can still open a project-backed drawing route when staff credentials and data are available.

The parity-critical baked fixture list is owned by `apps/portal/lib/drawings/sanctuaryWorkbenchFixtures.ts` through fixture-only QA metadata. Keep fixture names explicit, add representative saved estimate snapshots to the commercial parity harness or the fixture registry when a checked-in corpus exists, and treat commercial parity as shadow comparison signal only.

`npm run test:portal:browser` uses the no-auth `portal-fixture` Playwright project so fixture parity can run without project data or staff credentials. Run `npm run test:portal:browser:auth` first when you need the auth-backed `portal-chromium` setup state or project-list discovery smoke.

Skipped browser cases are intentional and should stay explained in the test output:

- In the `portal-fixture` project, the auth-backed project discovery smoke is skipped unless `PORTAL_DRAWING_URL` is set; that project-backed coverage belongs to `portal-chromium`.
- In authenticated project-backed runs, a selected project with no drawing geometry may skip the browser feel pass; this is data-dependent and should not hide fixture-route coverage.

When Playwright starts the portal dev server itself, it enables `ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES=1` and `ENABLE_PORTAL_QA_FIXTURES=1` for the no-auth fixture gates and uses isolated Next dev output so a normal `npm run dev:portal` server can keep running on port `3001`. The fixture harness defaults to `http://127.0.0.1:3011`; if that port is occupied, choose another fixture port:

```powershell
$env:PORTAL_PLAYWRIGHT_PORT='3021'; npm run test:portal:browser; Remove-Item Env:\PORTAL_PLAYWRIGHT_PORT
```

If `PORTAL_BASE_URL` points at an already-running portal server, that server must be started with the same fixture flags. The preflight does not terminate processes or weaken auth checks:

```powershell
# Terminal A: start the manual fixture server. Use PORTAL_PLAYWRIGHT_DIST_DIR only when another portal Next dev server is already running from apps/portal.
$env:ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES='1'; $env:ENABLE_PORTAL_QA_FIXTURES='1'; $env:PORTAL_PLAYWRIGHT_DIST_DIR='.next/playwright-fixture-manual'; npm --prefix apps/portal run dev:playwright -- -p 3021

# Terminal B: point the browser gate at that server.
$env:PORTAL_BASE_URL='http://127.0.0.1:3021'; npm run test:portal:browser; Remove-Item Env:\PORTAL_BASE_URL

# Terminal A after stopping the manual server.
Remove-Item Env:\ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES; Remove-Item Env:\ENABLE_PORTAL_QA_FIXTURES; Remove-Item Env:\PORTAL_PLAYWRIGHT_DIST_DIR
```

## Schedule QA Gate

Before shipping schedule changes:

1. Confirm migrations are applied through current Schedule V2 command/repair migrations.
2. Confirm `GET /api/staff/v1/schedule/readiness` returns `200`.
3. Run relevant schedule unit and route tests.
4. Manually check Board, Gantt, and Site Visits if UI behavior changed.

For UI-foundation presentation changes, run the authenticated non-mutating matrix after storage state exists:

```bash
npx playwright test playwright/portal.schedule-tasks-ui.spec.ts --project=portal-chromium --no-deps
```

It covers Board at 1440/1280/1024/768/390, Gantt, Site Visits, Schedule and Site Visit dialogs, project Tasks, 720x500 at 200% zoom, document overflow, mobile targets, focus return, reduced motion, and browser/runtime evidence. It opens forms and dialogs but does not save, drag, delete, unschedule, or toggle a task.

Minimum targeted schedule tests:

```bash
npx vitest run apps/portal/lib/scheduling/workingDays.test.ts apps/portal/lib/scheduling/recompute.test.ts
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
- Confirm Plan Editor, Sheet View, and 3D View are nonblank, finite, and do not show legacy fallback or unavailable text.
- Make one reversible object-first edit such as a small roof pitch, attachment side, deck position, opening position, or house form parameter change.
- Save the workbench, wait for the saved/clean state, reload the page, and confirm the edited value, Plan Editor, Sheet View, and 3D View persist.
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

- Background Jobs runs `npm run test:jobs` (including `@sp/email-provider`), provider-package typecheck, the worker typecheck/tests/build/CLI/container checks, the strict service-role boundary, and `npm run test:jobs:db` in a dedicated workflow when provider/job packages, provider adapters/webhook/repository, worker, migration, SQL harness, repository-security test, package manifest, container context, privileged-access report, or workflow configuration files change. A configured workflow without a successful run is not a green signal; this doc does not claim the check is required by branch protection.
- Portal Quality runs docs guard, architecture changed advisory reporting, architecture strict new-growth advisory reporting, dead-code changed advisory reporting, repository typecheck, lint, portal Vitest, portal build, general route bundle budgets, production security audit, fixture browser/performance smoke, and authenticated smoke. Authenticated smoke is blocking and writes the required credential, role, schedule-readiness, and project-data prerequisites to the GitHub step summary.
- Portal Performance Report runs five authenticated journey repetitions as a separate blocking job, rejects missing schema-v2 journeys, publishes p50/p75/p95, and uploads the `portal-performance-baseline` artifacts. It also writes the authenticated runtime prerequisites to the GitHub step summary before timing routes.
- Docs Health runs weekly and on demand, with blocking docs guard and mojibake checks plus advisory docs impact, navigation, and readiness reports.
- Lighthouse Guardrails run mobile and desktop Lighthouse profiles.
- Governance Monthly still runs the broader marketing/governance sweep with marketing tests, production dependency audit, and Lighthouse.
