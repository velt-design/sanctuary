# Maintainability Principles

These are the explicit rules of thumb the codebase optimises for. They are not aspirational -- if a change violates one, it should be reworked or accept a clearly-noted exception (with reason).

Long-term maintainability is the highest non-functional priority. The product will outlive any single feature; every line of code is read more than written. Bias decisions toward "the next person reading this in six months understands it without archaeology."

## Read First

- Use `## How Agents Should Use This` before bugfixes, migrations, interaction wiring, or hotspot work.
- Use the numbered principles as review criteria when choosing between a workaround and an extraction.
- Use the coordinate-system footguns before changing PlanViewport or workbench geometry commits.

## How Agents Should Use This

Use this doc before bugfixes, migration work, interaction wiring, or changes in files reported by `npm run files:report`.

For hotspot files, do not treat these principles as review-only advice. Before adding new behavior, ask:

- Can the behavior live in an existing owner helper, controller, adapter, view model, or package function?
- Is this the second caller for the same concept, and therefore a shared helper now?
- Would a focused integration test catch the wiring failure this change could introduce?
- If extraction is unsafe today, what exact next extraction should the handoff name?

If the answer is unclear, keep the behavior change smaller and prefer a named deferral over adding a new inline branch to a hotspot.

## 1. Shared logic for shared operations

When two paths perform the same conceptual operation, extract the shared logic into a helper. Both callers go through it.

**Example we got wrong**: pergola move and pergola edge-drag both translate a pergola. Both wrote the migration logic inline in `DesignWorkbenchEstimateClient.tsx`. The deck path migrated correctly; the move path did not. Result: shipped bug.

**The rule**: when a second caller needs the same operation, extract a helper. Don't copy. Don't "I'll get to it later." The bug pattern is "two paths drift apart" -- it always shows up.

## 2. Integration tests at boundaries

Unit tests don't catch wiring breakage. Whenever code crosses a layer (tool -> host -> store, geometry package -> portal, API -> client), at least one test must exercise the full path end-to-end.

**Example we got wrong**: `MoveTool` had 20 unit tests in isolation. Zero tests for "MoveTool wired into PlanViewport actually moves an object." Three wiring bugs slipped through despite green unit tests.

**The rule**: when you wire a tool/handler into a host, write at least one integration test before declaring it done. JSDOM-mockable counts; Playwright counts. "I unit-tested the parts" does not count.

## 3. Workarounds belong at the source

If a downstream caller needs to special-case a value that should "just work," the fix goes in the source -- not the caller. Workarounds compound: each new caller adds another, until the source becomes unfixable because too many callers depend on the workaround.

**Example we got wrong**: `topProjectionShapeClassifier` returns the wrong id for deck solid prisms (`house-solid-deck-1` instead of `deck-1`). Selection works around it via "any deck shape matches the active deck." Move was patched to read `metadata.sourceId` instead. Two workarounds, same root cause.

**The rule**: if the second caller needs a workaround, fix the source.

## 4. Single config option per concept

If two config options encode the same conceptual decision, they should be one option. Multiple options hide intent.

**Example we got wrong**: `MoveToolConfig.acceptedFamilies` AND `MoveToolConfig.getActiveTarget` both gate "can this click move this object?" The first filters by family, the second by id. The right shape is one `canMoveTarget?: (target: MoveTarget) => boolean` predicate that the host implements.

**The rule**: when you find yourself adding a second config option that overlaps an existing one, collapse them.

## 5. Decompose by responsibility, not by line count

A 1000-line cohesive module is fine. A 200-line module that owns three unrelated responsibilities is not. The [file-decomposition guide](file-decomposition-and-ownership.md) line bands are advisory; the question to ask is "can I name the responsibility this module owns in one phrase?" If you have to use "and," it's two modules.

**The rule**: split when the extracted piece has a name, owner, and test surface -- not to satisfy a line count.

## 6. Comments explain WHY, not WHAT

Code comments document non-obvious constraints, hidden invariants, or workarounds for specific bugs. They do not narrate the code -- well-named identifiers do that.

Good comments explain:
- **Hidden invariants**: "EdgeDragTool's onPointerDownFallthrough is the chain entry point for MoveTool; changing it breaks the dispatcher chain."
- **Non-obvious constraints**: "Unit-frame mode triggers when housePosition is set; legacy real-frame otherwise. See migration in normalize.ts:770."
- **Workarounds for specific bugs**: "Re-read store at apply time; the action is async and the closure captures stale state."

Bad comments narrate the code:
- `// Map over each item`
- `// Deck commit handler`
- `// Set position`

**The rule**: if removing the comment wouldn't confuse a future reader, don't write it.

## 7. Surface deprecation paths

When something is being migrated, both the docs and the code must describe the legacy path AND the target. Future code can then avoid accidentally coding against the legacy.

The [design-workbench-architecture](design-workbench-architecture.md) does this well for the spatial-entities migration: each audit row names the legacy site, the target shape, and the status. Continue this pattern in any other migration.

**The rule**: never document only the new state. Always include "what this replaces" so the reader can pattern-match against existing code they encounter.

## 8. Type the boundary, not the internals

When a function call crosses a module boundary, the types at that boundary are part of the contract. Internal helpers don't need elaborate types -- they're expressed by the call site.

**Example**: `MoveRequest` is a boundary type (consumers in `DesignWorkbenchEstimateClient` depend on its shape). `DragContext` inside MoveTool is internal -- its shape can change freely as long as `MoveRequest` doesn't.

**The rule**: invest in boundary types; don't over-type internals. Renaming an internal field shouldn't ripple across the codebase.

## 9. Atomic commits for atomic intent

When a user gesture conceptually means "move the deck and update its attachment," that's ONE patch, not three sequential writes. Sequential writes race; atomic writes don't.

**Example we got right**: `commitSharedPergolaEdgeDragResult` writes position + dimensions + attachment in a single patch. Earlier this was three fire-and-forget commits, and the last write often won, dropping position/dimensions writes (visible bug: "pergola jumps back to original size"). The atomic patch eliminated the race.

**The rule**: one user gesture, one patch. If you're writing multiple times, you're racing.

## 10. Prefer extraction over decoration

When fixing a bug, the temptation is to add an `if` branch or a workaround flag. Resist. Most bugs are signals that the abstraction is wrong, not that this case is special. Extracting a clearer abstraction usually fixes the bug AND simplifies the surrounding code.

**The rule**: if your fix is "add a special case for X," ask "is X special, or is the abstraction wrong?" Extract before decorating.

---

## Coordinate-system footguns (project-specific)

These are surfaces where coord conversions go wrong silently. Keep them in mind whenever a feature reads or writes mm coords.

### 1. Plan view's `world_x_left` flip

The plan-projection screen axis is `world_x_left, world_y_down` ([planCoordinateAdapter.ts](../apps/portal/lib/drawings/views/plan/planCoordinateAdapter.ts)). World X increases to the LEFT on screen. A pointer dragged right produces a NEGATIVE world X delta. Math works out for vanilla translate, but rotate/snap/normal-flip operations need to remember the flip explicitly.

When in doubt: `topProjectionDirectionToPlanSvg` flips a direction vector for SVG rendering; use it for any direction-derived rendering rather than recomputing.

### 2. Deck `position` is house-local; pergola `position` is world

The geometry decoder applies `decode(deck.outline) + deck.position + house.position = world`. Persisting `deck.position` requires subtracting `house.position` from any world-space anchor. This was the bug behind "deck drifts toward top-left on each move." [commitDeckTransform.ts](../apps/portal/lib/drawings/commits/commitDeckTransform.ts) is the single place that does this conversion -- both move and edge-drag go through it. Don't duplicate the math.

Pergolas live OUTSIDE the house model; their `position` is world coords directly (no double-translate risk). [commitPergolaTransform.ts](../apps/portal/lib/drawings/commits/commitPergolaTransform.ts) is the parallel helper.

### 3. `assembly.house.position` is consumed by `applyAssemblyPosition3D` and then null

After the boundary transform runs, `assembly.house.position` is set to `null`. Don't read it from the post-transform artifact -- it's gone. The workbench house position lives on the selected/host `HouseFormModel.transform`; legacy module `houseFootprintPosition` exists only as compatibility fallback. See milestone 12 in `design-workbench-architecture.md`.

### 4. Read house position from the SAME source the geometry pipeline reads

The geometry pipeline reads the selected/host `HouseFormModel.transform` first and only falls back to `module.houseFootprintPosition` when no object-first house form is available. Consumers that need house world position should use the same transform path (`houseFormTransformToAssemblyPosition` / `houseFormTransformToWorldPositionMm`) before consulting the legacy module field.

### 5. Pointer dispatchers must NEVER invent coords, AND `pointerCancel` is not `pointerUp`

Two related footguns hit the same boundary -- `PlanCanvas.dispatchPlanPointer`.

**Inventing coords on null.** Plan pointer resolution returns `null` when the drawing surface can't be measured (pre-mount, SSR, edge cases). An earlier version fell back to `point: { x: 0, y: 0 }` for any pointer event without a shape. The MoveTool stored a real start coord on pointer-down, then received `(0, 0)` on pointer-up, producing `delta = -startCoord`. Rule: if the cursor can't be resolved, drop the event. Tools downstream rely on the contract that `ToolPointerEvent.point` is the true cursor world coord; a sentinel `(0, 0)` is worse than a missing event because the drag session stays alive with poisoned state.

**Treating `pointerCancel` as `pointerUp`.** This was the actual root cause of the deck-drift runaway. `pointerCancel` fires when the OS interrupts a gesture (palm rejection, focus loss, scroll/touch-action capture, browser killing the gesture). The React `PointerEvent` typically has `clientX === 0 && clientY === 0`. With pan/zoom applied, resolving `(0, 0)` as a plan point can produce a real but absurd world coord (e.g. ~900m off-canvas). Wiring `onPointerCancel={handlePointerUp}` then dispatches that as a "release," and MoveTool commits `delta = bogusEnd - realStart` -- a jump roughly proportional to the deck's on-screen distance from the page corner. Compounds because each commit moves the deck further away, making the next bogus delta larger.

Symptom matches `requestDeltaMm` magnitude tracking the deck's distance from origin; the user sees "deck slides toward the corner over a couple moves, getting worse each time." Fix: split `onPointerCancel` to a handler that calls `dispatcher.cancelActiveTool()` -- the active tool's session is discarded, the deck stays where it was, the user can retry.

The general rule: **`pointerUp` and `pointerCancel` are different events with different semantics.** `up` = "user released, commit the work." `cancel` = "the gesture is over without intent, throw the work away." Never alias them.

### 6. The plan-view layout is capped (`PLAN_LAYOUT_MAX_DIMENSION_M`)

The SVG `viewBox` is sized from `projection.extents`. Because SVG `preserveAspectRatio="xMidYMid meet"` shrinks the viewBox to fit the rendered element, a larger viewBox means each physical cursor pixel covers more world distance. If a shape is allowed to drift outside the project area, that growth becomes a feedback loop -- every commit grows the extents, every drag amplifies the next world delta, and the user-facing symptom is "the deck slides exponentially toward the corner." The layout caps `safeWidthM`/`safeHeightM` at `PLAN_LAYOUT_MAX_DIMENSION_M` (50m) to break the loop. Off-bounds shapes still render at correct world coords; they just fall outside the viewBox. Users can pan with `viewportTransform` to see them, or undo a bad move via Ctrl-Z.

When adding any new layout dimension that depends on shapes' world coords, apply the same cap pattern.

## How these get enforced

- Code review (human or agent): check the change against this list before approving.
- Architecture handoff (`npm run architecture:changed`, `npm run files:changed`): catches some violations mechanically.
- Doc-as-test: when a violation is shipped (and the bug surfaces), the docs MUST be updated with the example, so the next agent learns from it.
