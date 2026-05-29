# Design Workbench Multi-Object Goal

## Goal

Make the design workbench a robust multi-object editor: multiple house forms, multiple pergolas, decks, and openings can be created, moved, selected, snapped, rendered, and costed from one object-first project model.

This goal is the active campaign for work that sits between "the architecture is mostly right" and "the workbench is a dependable product surface."

## Why Now

The workbench has crossed the hardest conceptual boundary:

- `WorkbenchProjectModel` is the dominant runtime shape.
- House forms, pergolas, decks, and openings are explicit objects.
- Snap-derived attachment is the intended relationship-authoring path.
- Plan and 3D mostly derive from solved geometry rather than independent legacy presenters.
- The project house geometry registry now provides one canonical per-form reference path for plan identity, 3D host-excluded composition, and house snap targets.

The remaining risk is local work drifting back toward host-specific or primary-form shortcuts. Future PRs should use this goal as the check: are we moving toward a true multi-object editor, or making the old shape more comfortable?

## North-Star Constraints

Every PR under this goal must preserve these constraints:

- No primary house form. `house-main` can exist as imported legacy identity, but it is not privileged by new logic.
- No select-host-first workflows. New pergolas and decks are born freestanding; drag/snap creates relationships.
- Snap references are the relationship source of truth. Inspector controls may describe or tune relationships, but must not replace snap-derived host identity.
- Plan is the editor. 3D is a read surface and selection surface, not a direct manipulation surface.
- Geometry-ready plan, 3D, sheet, snap, dimensions, and selection identity derive from the solved geometry spine.
- Compatibility fields are allowed only as named fallback boundaries. Do not extend them without explicit approval.

## Current State

Strong:

- Multiple house forms have canonical `house_reference:<formId>` shapes.
- Primary and added house forms now move through the same object-first transform path.
- Plan selection identity for house references is per-form.
- Plan snap targets can include walls/eaves from every valid house form.
- Pergola-to-pergola snap exists.
- Connected pergola grouping exists as derived scene logic.
- Object-first pergolas without a persisted calculator module now get a runtime-only solve source, so the workbench can render/select orphan pergolas without writing fake `inputs.modules[]` rows.
- The rail's `Add pergola` affordance creates a freestanding object-first pergola, selects it immediately, and renders it through the runtime solve-source path.
- Non-active pergola context outlines are selectable in plan and route through the same pergola-id selection path as the rail, including transient object-first pergolas.
- Plan Editor now aggregates full solved plan bodies for every valid pergola id, including transient object-first pergolas, so multi-pergola projects are no longer visually active-module-only in plan.
- 3D Review now aggregates valid solved pergola scene bodies by `pergolaId` and keeps pergola selection identity on prefixed scene objects.
- Invalid or unsupported selected pergolas no longer blank the project view: Plan and 3D keep using a stable ready project viewport/preview basis while the invalid pergola remains visible as a reference/context outline.
- Transient object-first mono pergolas can build native inspector edit state from their solved in-memory module/config without being written into `inputs.modules[]`.
- Workbench solve orchestration now builds an explicit persisted + transient pergola source list and routes object-first host-house groups through the package-level `solveProject` boundary before rehydrating the existing solved-module contract.
- Costing direction is scene-derived through `SiteInputsV2` for pergola data.

Still incomplete:

- `buildRawGeometryModuleInput` still wraps a selected host house in each pergola module's `houseContext`, but the host form id now flows through geometry directly instead of a portal scene-retag bridge.
- The per-object solve loop is not complete; `solveProject` is now the workbench entry boundary for object-first host groups, but internally it still normalizes/solves each pergola and carries per-module `houseContext`.
- Invalid or unsupported pergolas still fall back to project reference/context outlines rather than full solved detail, but they must not remove valid project geometry from Plan or 3D when selected.
- 3D aggregation is read/select only; direct manipulation remains Plan-only, and invalid/unsupported pergolas are skipped from full 3D bodies while the project-wide ready scene remains visible.
- Connected-pergola cost semantics such as shared posts remain deferred.
- Some legacy snapshot/test carriers still rely on `HouseFirst*` paths.
- Inspector parity for house forms, decks, and openings is not at the same standard as the pergola inspector.

## Done Criteria

The goal is done when:

- A user can add more than one house form and more than one pergola in the workbench without hidden primary/host assumptions.
- Every house form can be selected, moved, rendered, and snapped to by id.
- Every pergola can be added freestanding, moved, resized, snapped to houses or other pergolas, selected from plan/rail/3D, and shown in the same project context.
- Pergola attachments are created by snap and round-trip through persistence, solve, render, and inspector state.
- Connected and unconnected pergolas have explicit, tested cost grouping semantics.
- `RawGeometryModuleInput.houseContext` is deleted or reduced to a clearly named compatibility alias, not the normal project solve path.
- Plan and 3D selection identity agree for houses, pergolas, decks, and openings.
- The marketing enquiry to estimate email path still works.

## Non-Goals

Do not expand this goal to include:

- A new marketing self-design shell.
- Rhino/Vray export.
- New pergola roof families or visual variants unless needed to prove the multi-object path.
- Full UI redesign beyond the controls needed to make multi-object editing coherent.
- Manual host-picking dropdowns as a substitute for snap.

## Suggested PR Sequence

1. **Per-object house solve boundary**
   - Add project-level raw house input/build path. (Started: house-form to raw-house conversion is now shared by project references and host raw geometry.)
   - Solve each house once into a stable `HouseModel3D`.
   - Let pergola raw inputs reference the resolved host model instead of wrapping the full house context. (Started: workbench sources are grouped by host house and routed through `solveProject`, but each raw pergola still carries compatibility `houseContext`.)
   - Delete the temporary host-scene retag bridge when the geometry package emits real house form ids. (Done: solver output now carries the host form id.)

2. **Enable freestanding Add Pergola**
   - Foundation shipped: object-first pergolas no longer need a persisted calculator module to solve/render; transient runtime solve sources are explicit and do not mutate `inputs.modules[]`.
   - Add a new pergola object with its own position, dimensions, and no host. (Shipped: rail add creates a freestanding object-first pergola.)
   - Select it immediately. (Shipped.)
   - Render it in plan as a real editable object. (Shipped via runtime solve source; full edit parity follows.)
   - Keep cost fallback explicit for freestanding pergolas. (Still deferred to connected-pergola costing semantics.)

3. **Full multi-pergola interaction**
   - Promote non-active pergolas from reference-only context to selectable/editable project objects where the surface supports it. (Shipped: plan context outlines now select by `pergolaId` and switch to the matching solved entry.)
   - Render all valid pergolas as full project plan bodies rather than active-only detail plus faded boxes. (Shipped for Plan Editor; invalid/unsupported pergolas keep reference fallback.)
   - Render all valid pergolas as full project 3D bodies rather than active-only 3D. (Shipped for 3D Review as read/select aggregation.)
   - Keep Plan/3D usable when an invalid or unsupported pergola is selected. (Shipped: the selected invalid object uses reference/context fallback while the shell routes through a stable ready project basis.)
   - Let transient supported pergolas show native inspector controls from solved in-memory state. (Shipped for supported mono through the temporary solve adapter.)
   - Ensure move, edge drag, snap, undo, and selection work for every pergola id. (Selection foundation shipped; broader edit parity remains under active verification as the solve bridge retires.)
   - Preserve pergola-to-pergola snap and attachment shape. (Preserved.)

4. **Connected-pergola costing semantics**
   - Make derived pergola groups cost as intended.
   - Decide and test shared-post/shared-edge rules.
   - Keep unconnected pergolas priced as separate pergolas.

5. **Inspector and polish pass**
   - Bring house-form, deck, opening, and pergola inspectors to a consistent read/write contract.
   - Remove stale fields that imply manual host selection.
   - Add visual checks for multi-house and multi-pergola projects.

## Verification Expectations

Each PR should run focused tests for the changed path plus the changed-file architecture guard:

- Geometry/state tests for solved model, raw input, registry, and object patches.
- PlanViewport tests for selection, movement, snap targets, and hit targets.
- Costing tests when pergola grouping or cost semantics change.
- `npx tsc -p apps/portal/tsconfig.json --noEmit --incremental false`.
- `npm run files:changed`.
- `npm run architecture:changed`.

Visual/manual checks should include at least:

- One project with two house forms.
- One project with two unconnected pergolas.
- One project with a pergola snapped to another pergola.
- One deck snapped to a non-default house form.

## Gate 0 Mapping

Expected legacy/audit rows:

- N2: primary-vs-additional house form assumptions.
- N5/N6/N7/N13: remaining `HouseFirst*` and legacy snapshot bridge carriers.
- N9/N10: host-only/per-module scene composition.
- N11: single-house snap-target assumptions.
- Architecture audit #9: `RawGeometryModuleInput.houseContext` wrapping non-pergola objects into each pergola solve.

PRs under this goal should state whether they remove legacy, build on legacy, or defer a Phase 2 dependency.
