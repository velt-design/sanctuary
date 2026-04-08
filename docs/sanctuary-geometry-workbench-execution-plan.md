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
- prevent shipping better SVG drafting while the real geometry kernel remains weak
- keep the next major delivery sequence focused on trustworthy structural 3D geometry

The product spec remains the product authority for V1 scope and rollout posture:

- `docs/sanctuary-geometry-workbench-spec.md`

The older drawing-workbench execution board remains lower-level historical sequencing context only. It is not the active mainline plan for Sanctuary geometry delivery.

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

### 2. Geometry truth before UI polish

The active mainline is now:

`estimate/calculator inputs -> normalized GeometryConfig -> Assembly3D -> geometry validation -> hidden 3D verification viewer -> 2D plan/section/elevation projections`

New rail, sheet, or editor polish is frozen unless it directly supports geometry validation against that pipeline.

### 3. Review gates are mandatory

Each milestone ends with a stop-and-review checkpoint.

Do not begin the next milestone until the current one is reviewed for:

- geometry correctness
- architectural fit
- user-value gained
- leftover work that will become expensive later

### 4. No fake lab drift

The hidden route can support fixture mode for development speed, but the main implementation must stay attached to real:

- `project`
- `estimate`
- optional `design_package_request` workflow metadata

### 5. V1 does not chase breadth

The goal is a trustworthy geometry base for standard pergolas, not maximum roof-form coverage or more editor chrome.

Supported V1 families remain:

- `mono`
- `gable`
- `box`

Deferred families remain:

- `hip`
- irregular footprints
- unusual multi-module cases
- bespoke connection exceptions

## Current Groundwork Status

### `M0` is complete

Planning, rollout posture, and product-level scope are locked in the Sanctuary spec and this plan.

### `M1` is complete

The hidden route, route gating, entity anchoring, and shell groundwork already exist.

### Historical note on the superseded path

The prior `M2-M4` path that emphasized geometry contracts, shell editing, and plan/sheet output on top of the existing SVG-driven workbench is now superseded by geometry-first delivery.

That prior work is retained in the repo as supporting infrastructure:

- hidden route
- local draft plumbing
- SVG workbench shell
- current `Model Space` and `Sheet View` surfaces

But it no longer counts as proof of geometry readiness. It is support work, not the active mainline.

## Milestone Overview

| Milestone | Outcome | Review focus |
| --- | --- | --- |
| M0 | Planning and rollout guardrails are locked | complete |
| M1 | Hidden route and real workflow entry groundwork exist | complete |
| G0 | Geometry-first reset is frozen in the docs | planning integrity |
| G1 | Geometry contracts, datums, and semantics are unambiguous | contract correctness |
| G2 | 3D primitives and normalization runtime exist in `packages/geometry` | kernel foundation |
| G3 | `mono` solver is trustworthy against real jobs | first-family correctness |
| G4 | `gable` solver is trustworthy | abstraction quality |
| G5 | `box` solver is trustworthy and does not force a fork | family completeness |
| G6 | Validation and fixture QA catch geometry drift reliably | regression safety |
| G7 | Hidden 3D verification viewer renders `Assembly3D` directly | visual QA usefulness |
| G8 | Geometry inspection tools make defects debuggable | inspection quality |
| G9 | 2D plan output is genuinely derived from 3D truth | projection integrity |
| G10 | Editing is reconnected to trusted geometry | editor reintegration |

## G0: Geometry-First Reset And Scope Freeze

### Goal

Reset the authoritative plan so geometry correctness is the mainline and the older SVG-first middle path cannot remain the easier alternative.

### Tasks

1. Rewrite the Sanctuary spec around `Assembly3D` as the only geometry truth.
2. Replace the active execution sequence with the geometry-first `G0-G10` path.
3. Freeze non-geometry-first work unless it directly supports validation.
4. Lock the future public kernel contracts in the docs:
   - `GeometryConfig`
   - `Assembly3D`
   - `AssemblyMember3D`
   - `RoofPlane3D`
   - `HouseReferenceGeometry`
   - `GeometryValidationReport`
   - `ViewerSceneModel`
5. Lock the canonical pipeline:
   - normalized config
   - 3D assembly
   - validation
   - hidden 3D verification
   - derived 2D projections

### Exit criteria

- the spec and execution plan describe one strategy, not two
- the hidden 3D viewer is listed as a required internal V1 gate
- old `M2-M4` language no longer stands as an active competing path
- geometry-first freeze rules are explicit

### Review gate

Review questions:

- Is the new mainline clearly centered on geometry truth rather than SVG polish?
- Is the hidden route reclassified correctly as support infrastructure until geometry is trusted?
- Can an implementer tell exactly what must be built before more plan/sheet polish resumes?

Proceed only if the answer to all three is yes.

## G1: Geometry Contract And Datum Definition

### Goal

Lock the runtime geometry contracts and the datum rules so the kernel can be implemented without ambiguity.

### Tasks

1. Finalize the normalized `GeometryConfig` contract.
2. Finalize the `Assembly3D` contract.
3. Define the runtime coordinate system:
   - `X` = length
   - `Y` = projection
   - `Z` = height
4. Define datum and attachment rules:
   - origin
   - attachment edge
   - house-side references
   - fall conventions
   - height semantics
5. Define member semantics:
   - role
   - profile
   - centerline
   - local frame
6. Define roof-plane semantics and house reference geometry.
7. Define quantity-hook expectations.

### Exit criteria

- datums and axes are unambiguous
- config normalization rules are explicit
- all supported V1 families fit the same contracts
- no view-specific or SVG-specific concerns leak into the contracts

### Review gate

Review questions:

- Are datums, axes, and member semantics unambiguous?
- Can two engineers derive the same member positioning rules from the written contract?
- Are we still defining a geometry model rather than a drawing model?

Proceed only if the contracts are precise enough to implement without reinterpretation.

## G2: 3D Primitives And Normalization

### Goal

Build the reusable runtime base inside `packages/geometry`.

### Tasks

1. Implement pure TS 3D primitives and helpers:
   - points
   - vectors
   - lines
   - planes
   - polygons
   - transforms
   - tolerances
2. Implement unit normalization and conversion helpers.
3. Implement config normalization from estimate/calculator inputs into `GeometryConfig`.
4. Keep the package UI-agnostic and portal-agnostic.
5. Add boundary tests that prove the package does not depend on current SVG/view code.

### Exit criteria

- primitives are sufficient for all supported V1 families
- normalization is deterministic
- no React or portal dependency exists in the kernel
- runtime contracts are executable rather than doc-only

### Review gate

Review questions:

- Is the runtime base sufficient for real member and roof-plane generation?
- Are we leaking renderer assumptions into the kernel already?
- Is normalization deterministic enough for fixture testing?

Proceed only if the runtime foundation is future-safe.

## G3: `mono` Solver

### Goal

Prove one family completely in 3D before broadening.

### Tasks

1. Implement the `mono` solver in `packages/geometry`.
2. Generate:
   - attachment edge
   - roof plane
   - posts
   - beams and ledger
   - rafters
   - gutters
   - fall vector
3. Encode supported connection variants:
   - soffit
   - fascia
   - wall
   - freestanding
4. Expose quantity hooks from the same assembly.
5. Add golden fixtures for representative standard `mono` jobs.

### Exit criteria

- `mono` geometry is deterministic
- core dimensions and heights are verifiable in 3D
- quantity hooks are stable for representative jobs
- unsupported `mono` edge cases fail explicitly

### Review gate

Review questions:

- Is `mono` geometry trustworthy against real jobs?
- Would we trust the 3D result enough to compare against Rhino?
- Are connection semantics encoded cleanly rather than hidden in drawing shortcuts?

Proceed only if the first family is trustworthy.

## G4: `gable` Solver

### Goal

Extend the kernel to the second family without breaking the abstractions.

### Tasks

1. Implement the `gable` solver.
2. Generate:
   - dual roof planes
   - ridge geometry
   - eave conditions
   - posts, beams, rafters, gutters, and support conditions
3. Encode gable-specific fall logic and framing rules.
4. Add representative golden fixtures.

### Exit criteria

- `gable` geometry uses the same contracts as `mono`
- ridge and eave semantics are explicit
- fixture comparison is stable

### Review gate

Review questions:

- Is `gable` geometry trustworthy?
- Did the solver keep the contracts clean, or did family-specific hacks creep in?
- Are ridge and eave semantics future-safe for section/elevation work?

Proceed only if the abstractions still hold.

## G5: `box` Solver

### Goal

Complete V1 family coverage without forcing a fork in the kernel shape.

### Tasks

1. Implement the `box` solver.
2. Encode perimeter beam and gutter semantics.
3. Encode constrained internal fall rules.
4. Generate representative standard and edge-of-scope `box` fixtures.
5. Confirm unsupported variants are rejected clearly.

### Exit criteria

- `mono`, `gable`, and `box` all generate through one kernel
- internal fall rules are deterministic
- unsupported cases fail clearly

### Review gate

Review questions:

- Are all V1 families solved without abstraction failure?
- Did `box` force a hidden geometry fork?
- Are unsupported variants clearly bounded?

Proceed only if the V1 family set remains coherent.

## G6: Validation And Fixture QA

### Goal

Make geometry correctness measurable and regression-safe.

### Tasks

1. Add invariant tests for each family:
   - overall dimensions
   - heights
   - member counts
   - fall direction
   - support conditions
   - roof-plane consistency
2. Add fixture comparison tooling.
3. Add explicit unsupported-case tests.
4. Add geometry-diff helpers that make solver drift debuggable.

### Exit criteria

- geometry regressions fail loudly
- unsupported cases are tested explicitly
- fixture drift is easy to spot

### Review gate

Review questions:

- Can geometry regressions be detected without opening the UI?
- Are unsupported cases first-class rather than implied?
- Does the QA layer give enough confidence to proceed to a viewer?

Proceed only if validation is meaningful.

## G7: Hidden 3D Verification Viewer

### Goal

Render `Assembly3D` directly in the hidden route so geometry can be visually verified.

### Tasks

1. Add a 3D viewer stack on the hidden route.
2. Derive a `ViewerSceneModel` directly from `Assembly3D`.
3. Support:
   - orbit
   - pan
   - zoom
   - fit
4. Support layer toggles for:
   - house context
   - posts
   - beams
   - rafters
   - gutters
   - roof planes
   - attachment edge
5. Keep the viewer internal only.

### Exit criteria

- the hidden route renders `Assembly3D` directly
- the viewer is useful for geometry QA
- the viewer is clearly internal validation tooling, not public product UI

### Review gate

Review questions:

- Can the hidden 3D viewer expose geometry mistakes clearly?
- Is it consuming the kernel directly rather than a 2D or SVG intermediate?
- Is the viewer good enough to become a real geometry gate?

Proceed only if the viewer adds real QA value.

## G8: Geometry Inspection Tools

### Goal

Make the viewer practical for debugging and sign-off, not just visual confirmation.

### Tasks

1. Add selection and member inspection.
2. Add layer/category visibility control.
3. Add section cut support.
4. Add measurement probes.
5. Add debug overlays for:
   - datum frames
   - member axes
   - roof planes
   - fall vectors

### Exit criteria

- designers and engineers can inspect wrong geometry without reading raw JSON
- viewer debugging is practical for real QA

### Review gate

Review questions:

- Does the inspection tooling make geometry defects debuggable?
- Can we explain and verify a bad solver result from the viewer alone?
- Are we still inspecting real kernel output rather than viewer-specific approximations?

Proceed only if inspection is strong enough for internal review.

## G9: Derive 2D Plan From 3D

### Goal

Rebuild plan output as a projection from `Assembly3D`.

### Tasks

1. Implement `buildPlanViewModel` from `Assembly3D`.
2. Project members, roof edges, and attachment geometry into plan output.
3. Derive annotation anchors from the projected geometry rather than hand-authored plan data.
4. Keep current plan output needs intact while changing the source of truth.
5. Confirm plan drift is now a projection problem or a solver problem, not a dual-geometry problem.

### Exit criteria

- plan output is genuinely derived from 3D truth
- plan and geometry stay in sync by construction
- old view-authored geometry is no longer the authority

### Review gate

Review questions:

- Are 2D plan outputs now genuinely derived from 3D truth?
- If plan looks wrong, can we clearly locate the defect in geometry versus projection?
- Has the plan path stopped relying on legacy hand-authored geometry?

Proceed only if projection integrity is proven.

## G10: Reconnect Editing To Trusted Geometry

### Goal

Reconnect the hidden-route editing surfaces to the trusted geometry kernel after the geometry gates are passed.

### Tasks

1. Bind rail edits to normalized `GeometryConfig`.
2. Bind `Model Space` direct manipulation to normalized `GeometryConfig`.
3. Update the 3D viewer and derived 2D plan from the same config edits.
4. Keep the estimate-backed draft model as the persistence wrapper.
5. Reclassify existing hidden-route shell work as active product behavior only after it is running on trusted geometry.

### Exit criteria

- edit once, update 3D and 2D from the same source
- hidden-route editing is backed by trusted geometry
- no view-specific geometry edits remain

### Review gate

Review questions:

- Are edits now routed through the geometry kernel cleanly?
- Is the old SVG-first behavior gone from the mainline?
- Are we ready to reopen broader work on persistence polish, workflow exposure, and production rollout?

Proceed only if editing is truly geometry-backed.

## Mandatory Review Stops

No broad resume of plan, sheet, or editor polish happens until these gates are passed:

1. `G1` review: datums, axes, and member semantics are unambiguous
2. `G3` review: `mono` geometry is trustworthy against real jobs
3. `G5` review: all V1 families are solved without abstraction failure
4. `G7` review: the hidden 3D viewer exposes geometry mistakes clearly
5. `G9` review: 2D plan output is genuinely derived from 3D truth

## What Is Frozen While Geometry-First Delivery Runs

The following work is frozen unless it directly depends on the new geometry kernel and helps geometry validation:

- new milestone credit for SVG/editor interaction polish
- treating `apps/portal/lib/drawings/assembly/buildAssemblyModel()` as sufficient geometry completion
- broader rail expansion
- broader sheet annotation expansion
- more output types beyond what is needed to validate 3D truth and derive plan from it

The existing hidden-route shell work is retained, but it is supporting infrastructure only.

2D plan and sheet work resumes as a mainline only after `Assembly3D` and the hidden 3D verification viewer pass the gates above.

## Suggested PR Slices

Keep PRs narrow and geometry-first.

### Suggested slice pattern

1. docs reset and scope freeze
2. geometry contracts
3. 3D primitives and normalization
4. `mono` solver
5. `gable` solver
6. `box` solver
7. validation and fixtures
8. viewer scene model
9. hidden 3D viewer
10. inspection tools
11. derived plan builder
12. reconnect editing to trusted geometry

## Recommendations

- Treat `packages/geometry/` as the real product center now, not a support package.
- Use the hidden route as the geometry QA host, not as evidence that the geometry problem is solved.
- Keep unsupported cases explicit instead of letting the kernel half-handle them.
- Use the review gates to stop accidental drift back into easier SVG-first work.
- Hold the line on structural 3D accuracy rather than promising full CAD solids in V1.

## Concerns

- The main risk is fake progress: smoother UI while geometry truth stays uncertain.
- The second risk is abstraction drift: each family solved differently until the kernel quietly forks.
- The third risk is overpromising CAD depth when V1 only needs accurate structural 3D geometry.
- The fourth risk is resuming sheet and rail breadth too early because the hidden route already exists.
- The fifth risk is not building enough validation tooling, which makes geometry regressions expensive to diagnose.

## Definition Of Success

This plan succeeds if the team reaches the end of `G10` with:

- one trusted `Assembly3D` kernel for `mono`, `gable`, and `box`
- one meaningful geometry validation suite
- one hidden 3D verification viewer that can catch mistakes
- one plan builder that is genuinely derived from 3D truth
- one editing path that reconnects to the trusted geometry rather than bypassing it

Operational rollout, broader persistence polish, and project-page exposure are intentionally downstream of this geometry-first sequence and should be re-planned only after the geometry gates are passed.
