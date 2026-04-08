# Sanctuary Geometry Workbench Execution Plan

Date: 2026-04-08
Status: Locked
Depends on:

- [`docs/sanctuary-geometry-workbench-spec.md`](./sanctuary-geometry-workbench-spec.md)
- [`docs/drawing-workbench-spec.md`](./drawing-workbench-spec.md)
- [`docs/drawing-workbench-execution-board.md`](./drawing-workbench-execution-board.md)
- [`docs/design-packages-spec.md`](./design-packages-spec.md)
- [`docs/portal-local-first-spec.md`](./portal-local-first-spec.md)

## Purpose

Break the Sanctuary Geometry Workbench into achievable execution milestones with explicit stop-and-review gates.

This document is the canonical milestone plan for Sanctuary-specific workbench delivery.

This plan is intended to:

- keep the workbench on a hidden internal route until it is production ready
- force review checkpoints before more layers are added
- prevent shipping UI shells that leave core platform work behind
- keep V1 narrowly focused on standard-job plan output

The product spec remains the product authority for V1 scope and rollout posture:

- `docs/sanctuary-geometry-workbench-spec.md`

The older drawing-workbench execution board remains lower-level sequencing context and is not reopened by Sanctuary M0 unless a concrete contradiction is found.

## Delivery Rules

### 1. Hidden route until production readiness

The workbench stays on a dedicated hidden route for the full build:

- `/staff/projects/[projectId]/design-workbench`

It remains:

- behind staff auth
- behind a feature flag
- unlinked from the normal project flow by default
- available by direct URL only for approved internal testers

Do not expose it as a normal project-page entry point until the final production-readiness gate is passed.

### 2. Review gates are mandatory

Each milestone ends with a stop-and-review checkpoint.

Do not begin the next milestone until the current one is reviewed for:

- architectural fit
- user-value gained
- quality and regression risk
- leftover work that will become expensive later

### 3. Small vertical slices over broad scaffolding

Prefer slices that prove the architecture with real value instead of creating empty abstractions early.

### 4. No fake lab drift

The hidden route can support fixture mode for development speed, but the main implementation must stay attached to real:

- `project`
- `estimate`
- `design_package_request`

### 5. V1 does not chase breadth

The goal is production-usable standard pergola plan output, not maximum geometry coverage.

## Milestone Overview

| Milestone | Outcome | Review focus |
| --- | --- | --- |
| M0 | Route, rollout guardrails, and planning contracts are locked | safe execution path |
| M1 | Real entity entry and hidden-route shell exist | workflow fit |
| M2 | Shared geometry kernel is stable for target pergola families | model correctness |
| M3 | `Model Space` editing foundation works on shared state | editing ergonomics |
| M4 | Plan output works across `Model Space` and `Sheet View` from one pipeline | drawing quality |
| M5 | Local-first draft persistence and recovery work cleanly | data integrity |
| M6 | Project-flow integration exists without exposing broad rollout | operational fit |
| M7 | Production-readiness hardening and pilot validation are complete | go/no-go |

## M0: Route Policy And Planning Freeze

### Goal

Lock the hidden-route strategy, execution order, and V1 boundaries before implementation expands.

### Tasks

1. Confirm `M0 T1` is satisfied by the locked product-level workbench spec.
2. Lock this execution plan as the canonical milestone plan for Sanctuary workbench delivery.
3. Confirm the hidden-route rollout policy:
   - auth-gated
   - feature-flag gated
   - direct-link only
   - no main navigation exposure
4. Confirm V1 geometry scope:
   - `mono`
   - `gable`
   - `box`
5. Confirm V1 output scope:
   - plan `Model Space`
   - plan `Sheet View`
   - local-first draft persistence
   - quantity hooks
6. Confirm explicit non-goals for V1:
   - no production section output
   - no production elevation output
   - no generated details
   - no sales or marketing skin

### M0 Freeze Decisions

The following decisions are now frozen for V1:

- hidden route only: `/staff/projects/[projectId]/design-workbench`
- rollout posture: staff auth + feature flag + direct-link-only hidden access until the production-readiness review passes
- no main-navigation exposure or default project-page launcher before production readiness
- V1 geometry scope: `mono`, `gable`, `box`
- V1 outputs: plan `Model Space`, plan `Sheet View`, local-first draft persistence, quantity hooks
- V1 non-goals: no production section output, no production elevation output, no generated details, no sales skin, no marketing skin
- project page role: orchestration and summary later, never the main editor

### M0 Completion

Sanctuary M0 is complete when:

- the product spec is locked
- this execution plan is locked
- the rollout, scope, and non-goal decisions above are frozen in-doc
- the existing drawings scaffold is treated as pre-existing and is not reopened by Sanctuary M0
- the older drawing-workbench board is used as lower-level sequencing context rather than product authority

### Exit criteria

- scope and rollout policy are documented
- the product spec is locked
- this execution plan is locked
- hidden-route rule is explicit
- V1 geometry and output scope are frozen
- teams can reference a single plan for sequencing

### Review gate

Review questions:

- Are we solving the real bottleneck, or drifting into a demo tool?
- Is the route strategy safe enough to keep unstable work isolated?
- Is V1 still narrow enough to complete?

Proceed only if the answer to all three is yes.

## M1: Hidden Route And Real Workflow Entry

### Goal

Create the real internal surface without exposing it broadly.

### Tasks

1. Add the hidden workbench route under the project path.
2. Gate the route behind:
   - server-side staff auth
   - feature flag
3. Load real workbench context:
   - `project`
   - active or selected `estimate`
   - active `design_package_request`
4. Support direct addressing through query params for estimate and request targeting.
5. Add fixture mode inside the hidden route for fast development and QA.
6. Define the route contract for missing-state cases:
   - no estimate
   - no design request
   - invalid request/estimate combination
   - unauthorized access

### Exit criteria

- hidden route resolves real entities
- only approved internal testers can reach it
- fixture mode does not replace real-entity usage
- entry contract is explicit for error and empty states

### Review gate

Review questions:

- Does the hidden route stand on real workflow entities from day one?
- Are auth and feature-flag controls strong enough?
- Are we avoiding accidental dependency on the main project page?

Proceed only if route isolation is solid.

## M2: Geometry Kernel And Domain Contract

### Goal

Build the shared geometry kernel that every later surface will consume.

### Tasks

1. Create `packages/geometry/` as a UI-agnostic kernel.
2. Define the V1 `GeometryConfig` contract.
3. Define the assembly-model contract.
4. Build deterministic assembly generation for:
   - `mono`
   - `gable`
   - `box`
5. Encode constrained rules for:
   - attachment type
   - roof type and fall
   - support placement
   - house context inputs
6. Add test fixtures for representative standard jobs.
7. Expose quantity hooks from the assembly output.
8. Document deferred cases explicitly so edge cases do not leak in by accident.

### Exit criteria

- same config always yields the same assembly output
- kernel has no React dependency
- plan builders can consume kernel output directly
- deferred geometry cases are clearly rejected or marked unsupported

### Review gate

Review questions:

- Is the assembly model semantic enough to support future section, elevation, and detail work?
- Are unsupported cases explicit instead of half-working?
- Are we already overfitting to the current plan renderer?

Proceed only if the kernel is stable and future-safe.

## M3: Shared State, Workbench Shell, And `Model Space` Foundation

### Goal

Create the editing foundation on top of the kernel.

### Tasks

1. Define the shared workbench state layers:
   - persisted draft config
   - ephemeral viewport UI state
   - selection and hover state
   - pan and zoom state
2. Build the workbench shell layout.
3. Add viewport mode switching.
4. Add `ModelSpaceViewport` as the primary editing surface.
5. Add navigation behaviors:
   - pan
   - zoom
   - fit
   - selection
6. Add the first constrained direct-manipulation handles:
   - width
   - projection
   - house attachment line
7. Define the rail field schema for the curated editing subset.
8. Add the rail shell bound to the same shared state.

### Exit criteria

- rail and viewport edit the same shared config state
- `Model Space` is the clear editing surface
- direct manipulation feels stable for the first target interactions
- the shell does not depend on sheet-specific composition logic

### Review gate

Review questions:

- Does editing genuinely feel like `Model Space`, or are we still carrying sheet-editor assumptions?
- Is the rail constrained enough, or is calculator sprawl returning?
- Is state separation clean between persisted draft data and UI-only state?

Proceed only if editing behavior is coherent.

## M4: Plan Pipeline, Annotation Engine, And `Sheet View`

### Goal

Get the first end-to-end drawing value from the shared pipeline.

### Tasks

1. Define `buildPlanViewModel` from the assembly model.
2. Separate geometry output from annotation intents.
3. Add the plan annotation engine with explicit handling for:
   - page-anchored annotations
   - geometry-anchored annotations
   - text orientation
   - fall semantics
   - framing spacing semantics
4. Build `PlanRenderer`.
5. Refactor `SheetViewport` and `SheetComposer` onto the shared plan pipeline.
6. Ensure `Model Space` and `Sheet View` consume the same source geometry.
7. Add rotation and layout regression coverage for:
   - width and projection dimensions
   - `FALL`
   - `c/c`
   - attachment labels

### Exit criteria

- one shared config drives both surfaces
- annotations remain readable under rotation and layout changes
- plan output is usable as a draft design-package surface
- sheet composition is document-first, not the editing engine

### Review gate

Review questions:

- Is the plan output already useful enough to replace some manual work?
- Are annotation rules structural now, or still brittle?
- Has `Sheet View` stayed document-first?

Proceed only if the answer to the first question is at least partially yes.

## M5: Local-First Draft Persistence, Sync, And Recovery

### Goal

Make the workbench operationally safe and fast for real repeated use.

### Tasks

1. Define the draft persistence entity shape for the workbench.
2. Key local working copies by `designRequestId` and associated estimate context.
3. Queue config and drawing mutations locally.
4. Persist durable draft state to the server.
5. Surface sync states:
   - saved
   - syncing
   - offline
   - conflict
   - error
6. Add recovery behavior for refresh, reopen, and transient network failure.
7. Keep heavy artifact work out of the visible save path.
8. Define conflict isolation rules so workbench sync issues do not block unrelated portal work.

### Exit criteria

- local edits survive refresh and reopen
- users are not blocked on network round-trips while editing
- sync status is clear
- save path does not perform heavy artifact generation inline

### Review gate

Review questions:

- Is the workbench now fast because of real local-first behavior, or only because we deferred edge cases?
- Are conflict and recovery states understandable?
- Are we preserving server-authoritative truth cleanly?

Proceed only if persistence behavior is operationally trustworthy.

## M6: Workflow Integration Without Broad Exposure

### Goal

Tie the hidden route back into real project workflow while still keeping rollout narrow.

### Tasks

1. Add project-page launcher affordances for approved internal users only.
2. Show workbench-related project summary data:
   - active design request
   - linked estimate
   - last updated
   - draft or preview status
3. Add launch flows from:
   - estimate generation success path
   - project estimates tab
4. Define revision-entry behavior for later estimate-backed requests.
5. Confirm that the project page remains orchestration and summary, not the editor.
6. Define internal QA and pilot-user access rules.

### Exit criteria

- launch flow is natural from real estimate-backed design work
- rollout is still intentionally limited
- project page does not absorb editing responsibilities
- revision handling stays estimate-backed

### Review gate

Review questions:

- Does the workbench now fit real operations cleanly?
- Have we kept rollout narrow enough?
- Are revisions still explicit and traceable?

Proceed only if operational flow is clean without widening access prematurely.

## M7: Production Readiness, Pilot, And Go/No-Go

### Goal

Prove that the hidden route is ready to graduate from isolated internal use to broader production exposure.

### Tasks

1. Run a limited pilot with selected internal users.
2. Capture issue categories:
   - geometry correctness
   - drawing readability
   - save and sync reliability
   - workflow confusion
   - unsupported job types
3. Measure replacement success on standard jobs:
   - `mono`
   - `gable`
   - `box`
4. Confirm that quantities are stable enough to support quote preparation.
5. Confirm that the route is adequately hardened:
   - auth boundary
   - feature-flag control
   - data exposure controls
6. Triage and clear must-fix issues.
7. Decide whether to:
   - stay hidden
   - expand internal access
   - expose as a normal project-page action

### Exit criteria

- a meaningful share of standard jobs can be completed in the hidden route
- pilot users prefer it over Rhino/manual plan prep on standard jobs
- high-severity correctness and persistence issues are closed
- rollout recommendation is explicit

### Review gate

Go/no-go questions:

- Is plan output production-usable for standard jobs?
- Is persistence reliable enough for daily operations?
- Is the route safe enough to expose more broadly?
- Are unsupported cases clearly bounded so staff are not trapped?

Only after a yes to all four should the hidden-route restriction be relaxed.

## Suggested PR Slices

Keep PRs narrow and milestone-aligned.

### Suggested slice pattern

1. docs or contracts
2. hidden-route shell and gating
3. real entity loading
4. geometry contracts
5. geometry kernel
6. workbench state
7. `Model Space` base viewport
8. rail schema and rail UI
9. direct manipulation interactions
10. plan view-model and renderer
11. annotation engine
12. `Sheet View` refactor
13. local persistence and sync
14. workflow integration
15. pilot fixes and production hardening

## What Must Not Be Left Behind

At each milestone review, explicitly check whether the team is deferring foundational work that will later force rewrites.

Watch for this:

- building view-specific geometry instead of shared assembly
- reintroducing editing behavior into `Sheet View`
- growing the rail into a full calculator clone
- adding unsupported geometry cases without explicit domain rules
- relying on fixture data longer than planned
- making save feel fast only because data is not actually durable yet
- exposing the route before auth, persistence, and workflow edges are ready

## Recommendations

- Keep the route hidden until after pilot validation. That is the right call.
- Treat `packages/geometry/` as the long-term leverage point and protect its boundaries early.
- Keep the first user-value target blunt: standard pergola plan output that removes real manual work.
- Use milestone reviews to kill scope creep quickly rather than trying to absorb it.
- Require unsupported cases to fail clearly instead of degrading into ambiguous partial output.

## Concerns

- The main delivery risk is breadth creep: more roof forms, more editing controls, and more output types before the plan path is stable.
- The second major risk is fake progress: polished UI before reliable geometry and persistence.
- The third risk is premature exposure: once normal users rely on the route, unfinished persistence and auth edges become much more expensive to fix.
- The fourth risk is mixing business workflow state with drawing draft state in ways that make revisions and conflict handling messy later.
- The fifth risk is under-specifying unsupported jobs, which creates pressure to “just make this one weird case work” and breaks the kernel shape.

## Definition Of Success

This plan succeeds if the team reaches production readiness with:

- one hidden-route workbench built on real project and estimate workflow
- one shared geometry pipeline
- one production-usable plan workflow for standard jobs
- local-first editing with reliable recovery
- explicit milestone reviews that prevent hidden technical debt from piling up
