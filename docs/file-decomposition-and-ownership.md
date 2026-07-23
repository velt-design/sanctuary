# File Decomposition And Ownership

Status: Active guardrail.

Purpose: keep files, modules, and ownership boundaries aligned with the target architecture while the repo moves toward a production-ready marketing site and a portal that can later be extracted into a SaaS product.

## Read First

- Use `## Default Priority For Hotspots` when touching warning or critical files.
- Use `## Advisory Size Bands` to interpret `npm run files:report` and `npm run files:changed`.
- Update the machine-readable registry before treating this human summary as changed.

## Operating Rule

When touching a file, leave it closer to the target architecture when that can be done safely inside the task.

Large files are not automatically wrong, but they are risk markers. Do not keep adding inline behavior to a file that already mixes responsibilities. Prefer extracting a cohesive helper, controller, adapter, view model, domain function, or child component before the next feature hardens the wrong shape.

If a safe extraction would make the task too risky, keep the behavior change small and record the decomposition direction in the handoff or the owning doc.

When extracting a helper or module as part of a decomposition pass, copy the body byte-for-byte. Do not rename, retype, or "tidy" while moving -- behaviour-preserving improvements belong in a separate PR with their own tests. Behavioural drift in pure helpers is invisible to typecheck and often invisible to existing call-site tests. See `docs/decision-log.md` (2026-05-06) for the failure mode.

## Default Priority For Hotspots

When a task touches a warning or critical file, maintainability work is part of the task by default. Agents should look for a small, behavior-preserving extraction before adding new inline behavior.

If the change is an urgent bugfix or the extraction would increase risk, keep the code change minimal and leave a concrete decomposition note in the handoff. The note should name:

- touched warning or critical file.
- current owner area.
- whether extraction was done or deferred.
- the next safe extraction.
- focused tests or guards that cover the area.

This is not a request for broad cleanup. It is a bias against making already-risky files harder to change.

## Split Triggers

Start looking for a split when a file:

- mixes rendering, browser events, domain policy, persistence, and validation.
- has repeated sections that could each be named as a module.
- contains a coherent child UI unit (own state machine, side effects such as timers/listeners/refs, or co-locatable styles) sitting behind a clean prop interface -- extract it as a sibling component plus its own CSS module before the parent grows around it.
- requires scrolling through unrelated workflows to make a focused change.
- blocks parallel work because many agents must edit the same file.
- makes tests broad because useful logic is trapped inside a component or route.
- duplicates a package-owned or domain-owned rule in app code.
- grows while already listed as a production-readiness hotspot.

Do not split only to satisfy a line count. Split when the extracted piece has a name, owner, and test surface.

## Target Shapes

UI components compose behavior. They may own presentation, local interaction state, focus, refs, and callback wiring. They should not own durable domain rules, API policy, Supabase access rules, pricing logic, geometry semantics, quote/invoice side effects, or workflow write contracts.

Interaction-heavy surfaces should move math and state machines into focused controllers. Components keep DOM event registration and rendering; controllers own gesture classification, preview state, validation, commit intent, diagnostics, and pure calculations.

API routes should stay thin. Auth, payload parsing, domain action, persistence, side effects, and response shaping should be named and testable rather than inline inside long route handlers.

Packages own reusable truth. Move behavior into `packages/*` only when it is app-independent and has a stable public contract. Packages are not dumping grounds for portal-specific orchestration.

Tests may be longer than production files, but large tests should still split by behavior, fixture, or helper when they become hard to scan.

## SaaS-Ready Portal Rule

Write portal code as if the portal may later become its own SaaS product.

That means:

- staff/admin permissions stay explicit.
- customer, project, workflow, and side-effect ownership stay visible.
- browser UI goes through API, query, local-first, or approved spreadsheet adapters.
- portal product logic does not depend on marketing page structure.
- domain actions are named, testable, and ready for future tenant-aware boundaries.
- shared engines and formatting live behind package exports instead of app-local forks.

The future SaaS split will be much easier if today's files already have clear owners.

## Advisory Size Bands

Use `npm run files:report` for a visibility report. It is advisory and should not block handoff by itself.

Use `npm run files:changed` before handoff when a task touches warning or critical files. It reports only changed code files, shows current lines, HEAD lines, and delta, and prints the handoff cue the final response should cover.

Use `npm run files:changed:strict` only for local experiments and later enforcement. It is not part of lint or CI yet.

Default bands:

| Category | Warning | Critical |
| --- | ---: | ---: |
| Component or page | 800 lines | 1200 lines |
| Route, domain, package, or script | 700 lines | 1200 lines |
| Test | 1200 lines | 2500 lines |

Warning means agents should prefer extracting a cohesive owner before adding another responsibility.

Critical means major feature work should name the owner and decomposition direction before continuing in that file. If a critical file grows in a feature change, the default assumption is that the handoff is incomplete until it explains why extraction was deferred.

## Hotspot States

Use these states when choosing work or writing handoffs:

| State | Meaning | Agent Default |
| --- | --- | --- |
| Red | Current quality gates fail, or the file is a critical hotspot on an active migration path. | Fix the gate or extract a focused owner before adding feature behavior. |
| Yellow | The file is warning/critical but gates are green and ownership is understood. | Feature work may proceed with a small extraction or a named deferral. |
| Green | The file has a clear owner, limited responsibility, and focused tests. | Normal scoped edits are acceptable. |

The state is a local judgment from current reports and owner docs. If unsure, treat the file as Yellow and document the decision.

## Known Hotspots

Current large-file work should treat these areas as decomposition candidates, not normal expansion points:

- calculator and estimate UI surfaces.
- design workbench viewports, renderers, interaction controllers, adapters, and tests.
- geometry package solvers and house model logic.
- schedule client surfaces.
- project estimate and quote tabs.
- marketing start and public conversion pages.

## Decomposition Registry

The machine-readable registry lives in `scripts/file-decomposition-registry.json`. `npm run files:report`, `npm run files:changed`, and `npm run files:changed:strict` use that JSON file for hotspot labels and strict-mode registry coverage.

The table below is a human summary, not the source the script reads. Update the JSON first when a touched critical file grows and the next safe split changes, then keep this summary aligned.

| Hotspot | Owner Area | Why It Is Large | Next Safe Extraction | Focused Tests |
| --- | --- | --- | --- | --- |
| Calculator | Portal calculator and estimate workflow | Estimate/project state, remaining module-input mutation policy, and result coordination are still concentrated in the main client, though the outer workspace shell lives in `CalculatorWorkspaceView.tsx`, house-footprint editor gesture/lifecycle state lives in `useCalculatorHouseFootprintController.ts`, deterministic module validation lives in `calculatorValidation.ts`, and blinds/flashings mutation state lives in focused controllers. Pure calculator input defaults, normalization, browser-draft persistence/session state, module navigation modelling/presentation, configuration-section definitions/presentation/field options, structure/site/workflow field-schema generation, issue model/focus navigation, infill lifecycle/actions/interactions/cost coordination/presentation, save orchestration/dialogs, blinds/flashings editor markup, materials-debug behavior, preview presentation, pricing presentation/splitting, and quote-status helpers also live outside `CalculatorGridClient.tsx`. | Extract the remaining module-input mutation policy, then separate result-derived presentation coordination from estimate/project orchestration. | `npx vitest run apps/portal/app/staff/calculator`, `npm run test:portal:projects`, `npm run typecheck` |
| Design workbench | Drawing workbench UI and drawing domain adapters | Viewports, render graph wiring, interaction state, compatibility fallbacks, and browser gestures are still being separated. | Move pure interaction math, render preparation, and compatibility adapters out of viewport presenters before adding new tools or overlays. | `npm run test:portal:workbench`, drawing unit tests, browser fixture smoke when UI changes |
| Geometry package | `packages/geometry` physical model truth | Solvers, house model contracts, projections, and fixtures are central package truth with broad consumers. | Split solver phases, normalized model contracts, and projection helpers by physical responsibility while preserving public package exports. | geometry package tests, affected portal drawing tests, `npm run typecheck` |
| Schedule | Portal schedule workflow | Board, Gantt, Site Visits, readiness, and legacy fallback remain heavy interactive surfaces. | Extract workflow-specific clients, query/view models, and command adapters before adding new schedule modes. | `npm run test:portal:schedule`, `npm run schedule:bundle-budget`, focused route tests |
| Quote and estimate tabs | Project detail quote and estimate workflows | Local-first state, locks, quote lifecycle, PDF/email side effects, and UI state sit close together. | Move lifecycle policy, side-effect orchestration, and tab view models into named helpers before adding more inline tab behavior. | `npm run test:portal:projects`, `npm run test:portal:quotes`, local-first tests |
| Marketing enquiry route | Public enquiry intake and conversion workflow | Request validation, indicative estimate preparation, project/contact/enquiry persistence, attachment staging, autoresponder delivery, outbox recording, attribution, and audit fallback still meet in one public route. | Move enquiry persistence and autoresponder/outbox audit orchestration behind named domain owners before JOB-07 migrates accepted delivery work; keep request validation and truthful response shaping in the route. | `npm run test:marketing -- apps/marketing/app/api/enquiry/route.test.ts apps/marketing/lib/email`, `npm run typecheck`, `npm run build:marketing` |
| Marketing start | Public conversion and guided-start experience | Page-level presentation, product selection, conversion copy, and interaction paths are concentrated in one public page. | Extract section components, content data, and conversion state helpers before adding new campaign branches. | `npm run test:marketing`, marketing build, Lighthouse checks when layout/performance changes |

## Enforcement Direction

This guardrail starts as documentation plus `npm run files:report`.

Later slices should tighten it in this order:

1. Keep the advisory report visible in handoffs and readiness work.
2. Use `npm run files:changed` in handoffs so agents see when their own edits enlarge a warning or critical file.
3. Use this registry as the initial allowlist for known transitional hotspots, each with owner area and decomposition direction.
4. Make CI fail only for newly critical files or changed critical files without an explicit decomposition note.
5. Retire allowlist entries as files are split by responsibility.
