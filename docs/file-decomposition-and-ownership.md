# File Decomposition And Ownership

Status: Active guardrail.

Purpose: keep files, modules, and ownership boundaries aligned with the target architecture while the repo moves toward a production-ready marketing site and a portal that can later be extracted into a SaaS product.

## Operating Rule

When touching a file, leave it closer to the target architecture when that can be done safely inside the task.

Large files are not automatically wrong, but they are risk markers. Do not keep adding inline behavior to a file that already mixes responsibilities. Prefer extracting a cohesive helper, controller, adapter, view model, domain function, or child component before the next feature hardens the wrong shape.

If a safe extraction would make the task too risky, keep the behavior change small and record the decomposition direction in the handoff or the owning doc.

## Split Triggers

Start looking for a split when a file:

- mixes rendering, browser events, domain policy, persistence, and validation.
- has repeated sections that could each be named as a module.
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

Default bands:

| Category | Warning | Critical |
| --- | ---: | ---: |
| Component or page | 800 lines | 1200 lines |
| Route, domain, package, or script | 700 lines | 1200 lines |
| Test | 1200 lines | 2500 lines |

Warning means agents should prefer extracting a cohesive owner before adding another responsibility.

Critical means major feature work should name the owner and decomposition direction before continuing in that file.

## Known Hotspots

Current large-file work should treat these areas as decomposition candidates, not normal expansion points:

- calculator and estimate UI surfaces.
- design workbench viewports, renderers, interaction controllers, adapters, and tests.
- geometry package solvers and house model logic.
- schedule client surfaces.
- project estimate and quote tabs.
- marketing start and public conversion pages.

## Enforcement Direction

This guardrail starts as documentation plus `npm run files:report`.

Later slices should tighten it in this order:

1. Keep the advisory report visible in handoffs and readiness work.
2. Add changed-file reporting so agents see when their own edits enlarge a warning or critical file.
3. Add an allowlist for known transitional files, each with an owner doc and decomposition direction.
4. Make CI fail only for newly critical files or changed critical files without an explicit decomposition note.
5. Retire allowlist entries as files are split by responsibility.

