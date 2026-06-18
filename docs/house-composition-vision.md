# House Composition Vision

**Drafted**: 2026-06-18. **Status**: vision doc, not yet committed work.

This is a north-star vision for how house footprints + roofs should work in the design workbench. It supersedes the current "free-form orthogonal polygon" input model. PR-HR2/HR1/HR3/HR4 (shipped) and PR-HR7 (planned) all advance toward this vision without being it.

## The shift

| Current model | Vision model |
|---|---|
| Designer **draws** an arbitrary orthogonal polygon | Designer **composes** the house from primitive rectangles |
| Solver tries to handle every topology designers can draw | Solver only needs to handle rectangles + how they connect |
| Bugs are infinite (every new shape is a new test case) | Bugs are bounded (finite primitive set; finite join operations) |
| "Make a new solver for shape X" | "Add a new join operation for combining rectangles like X" |
| Free-form, anything-goes — including shapes that can't render | Constrained-by-construction — every input is guaranteed renderable |

The deep insight: **every orthogonal house footprint a builder could realistically construct is the union of axis-aligned rectangles.** L's, T's, U's, crosses, recesses, staircases — all compositions of rectangles. We've been trying to teach the geometry pipeline to recognize these compositions AFTER the fact, when it would be vastly simpler to ask the designer to specify the composition UP FRONT.

## The primitive

**Rectangle.** That's it. One primitive. Width × depth, orthogonal, axis-aligned.

A rectangle has a known, tested, robust roof solver. We have multiple of these solvers and they all work. There is no bug class for "rectangle hipped roof breaks on aspect ratio X" — rectangles are the easy case.

## The operations

Two operations a designer can apply to a set of rectangles:

### 1. Snap-attach

Place rectangle B such that one of its edges is flush with an edge of rectangle A. The most common composition pattern — it produces L's, T's, U's, crosses, and every other shape Sanctuary customers actually build.

```
    A             A + B (snap-attach)
  ┌────┐         ┌────┐
  │    │         │    │
  │    │         │    │
  └────┘         └────┴──┐
                         │ B │
                         └───┘
```

A "join" gives the composite footprint AND records the decomposition:
```
House = {
  rectangles: [A, B],
  joins: [{ from: A.edge_south, to: B.edge_north, offset: 0 }],
}
```

### 2. Detach

Reverse of snap-attach. Designer selects one rectangle from a composite, clicks "Detach" → it becomes a separate house form (or gets removed).

That's it. **Two operations.** Every footprint a Sanctuary customer would draw is reachable from snap-attach alone.

## Why this kills the bug class we've been fighting

The Graham–Oratia bug (PR-HR6 / HR6b) is the geometry pipeline failing to figure out that a 12.5m × 8m main block + 5.8m × 2.4m extension are conceptually two rectangles, then failing to compose their roofs correctly. PR-HR7's decomposition retrofits exactly that recognition.

In the vision model, the designer **tells the system** "this house is a 12.5m × 8m rectangle with a 5.8m × 2.4m extension snapped to the south edge." There is no recognition step. The roof for the main block is just a rectangle-hipped roof (already works perfectly). The roof for the extension is a flat skillion (already works perfectly). The join logic uses the recorded `join` metadata directly — no topology inference.

**PR-HR7's value in this vision**: it's the stepping stone. The decomposition primitive HR7 builds (`buildDecomposedHippedRoof`) becomes the composition primitive in the vision model — same code, just driven by explicit `joins` metadata instead of inferred from polygon analysis. Work is preserved, the mental model changes.

## What gets simpler / what gets deleted

If the vision lands, here's what comes out of the geometry package:

**Deleted (~2000 LOC):**
- `roofEaveGraphHipped.ts` (source-edge coverage partition) — only needed for inferring rectangles from free-form polygons
- Most of `roofJoinedWavefront.ts` + `roofJoinedFacets.ts` — bent-spine wavefront for non-rectangular topologies
- `partialOpenJoinedTopology.test.ts` quarantine tracking — there are no quarantines because every primitive works
- `eaveOffsetRepair.ts` — composition tells us where eaves are; no repair needed
- The narrow-return L bug class entirely — they're just two rectangles

**Retained (~1500 LOC, all well-tested):**
- `buildRectangularRoof` — already rock-solid
- The QA gate — composite must still produce valid geometry (cheaper to verify on rectangles)
- The HR2/HR1/HR4/HR3 infrastructure — works regardless of input model
- All mono / flat / single-rectangle hipped / Dutch-hip code paths
- `houseModel.ts` composition logic
- The 75-case multi-open matrix — still applies (each primitive in a composite can have open-hip variants)

**Added (~600 LOC):**
- `HouseComposition` type carrying `rectangles[]` + `joins[]`
- `composeHouseFootprint()` — produces the unified polygon from a composition
- `composeHouseRoof()` — assembles roof from per-rectangle sub-roofs using `joins`
- Workbench UX: shape palette + snap interaction + Join/Detach buttons
- Migration shim: converts existing free-form polygons → `HouseComposition` (best-effort; falls back to legacy free-form for shapes that don't decompose cleanly)

**Net result**: ~1100 LOC removed, ~600 LOC added. Less code, fewer bugs, more reliable.

## What the designer gives up

Honest trade-offs:

1. **Truly arbitrary polygons.** A designer can no longer draw a 9-vertex zigzag and expect a roof. If a real customer house has a shape that isn't decomposable into rectangles (rare for residential pergolas in NZ), the designer hits a wall.
   - **Mitigation**: "Advanced mode" preserves the legacy draw-outline tool for the 1% of cases that need it. Those cases inherit the existing geometry pipeline (with all its known bug classes), but at least the 99% common path is rock-solid.

2. **Single-fluid drawing.** Composition is more clicks than "draw freeform." Workflow becomes "add rectangle, drag to position, snap, add another, drag, snap" vs "click around the perimeter." Some designers may find this slower for simple shapes.
   - **Mitigation**: presets for the most common compositions (straight rectangle, L, T, U, recess) drop a pre-built composition. Designer just resizes the rectangles, no drawing needed for 90% of houses.

3. **Curves / non-orthogonal angles.** Out of scope in v1. If customers need bay windows, octagonal turrets, or 45°-angle extensions, those become a v2 conversation (probably "rotated rectangle" as a new primitive).
   - **Honest assessment**: Sanctuary's customer base doesn't seem to need these today. If that changes, the vision model is compatible (add primitives, keep composition).

## What gets BETTER for the designer

1. **Predictability**: every drag-and-snap produces a guaranteed-valid roof. No more "did I draw this in a way the solver can handle?"
2. **Speed**: a 5-click composition replaces a 15-click polygon trace.
3. **Editability**: changing the main block dimensions doesn't risk breaking the extension's roof. Each primitive is independent.
4. **Visual feedback**: snap targets show during drag (the existing snap infrastructure already exists for pergolas).
5. **No more bug reports for shapes-that-should-work** — the bug-report button (PR-HR1) starts being used for the rare cases instead of the common ones.

## Migration path

This isn't a forklift rewrite. The path is incremental:

### Phase 0 (NOW): the HR2/HR1/HR4/HR3 infrastructure
- Status: **shipped**.
- Provides the diagnostic + capture + matrix surface the rest of the migration relies on.

### Phase 1: PR-HR7 (planned, see [pr-hr7-plan.md](pr-hr7-plan.md))
- Detect + decompose narrow-return L's at the geometry layer.
- Ships the composition primitives the vision model needs.
- Designer-facing: nothing changes; they still draw free-form. But the bug class dissolves.
- **Value to the vision**: validates the composition geometry works before we touch the UX.

### Phase 2: Composition data model
- Introduce `HouseComposition` type (rectangles + joins) alongside the existing free-form polygon.
- `composeHouseFootprint()` produces the unified polygon from a composition (designer sees the same plan view).
- Existing house forms continue to use free-form polygons; new forms can opt in to composition.
- **Value**: data model exists; nothing breaks; can be hidden behind a feature flag.

### Phase 3: Shape palette UI
- New "Add shape" tool replaces (or coexists with) "Draw outline."
- Click a rectangle, drag to size, drop in the plan.
- Existing snap-during-drag infrastructure (from pergola) repurposed for house-form snapping.
- **Value**: designers can opt into the new flow on new projects.

### Phase 4: Join / Detach operations
- Multi-select rectangles, click "Join" → composite house form.
- Select a rectangle in a composite, click "Detach" → standalone form (or remove).
- **Value**: full composition workflow.

### Phase 5: Migration of legacy free-form house forms
- Run "decompose to rectangles" on every existing project's house forms.
- Cases that decompose cleanly: auto-migrate to composition model.
- Cases that don't: stay on legacy free-form (advanced mode).
- **Value**: every project that can be expressed in the new model gets the reliability upgrade.

### Phase 6: Retire legacy polygon solver
- Once the legacy free-form usage is in single digits across all projects, retire `roofEaveGraphHipped.ts` + friends.
- Free-form draw stays as advanced-mode but routed through a single "best-effort" solver.
- **Value**: ~2000 LOC removed from the geometry package; bug surface shrinks dramatically.

## Are we doing the right things to make this happen?

**Yes — every piece of work shipped this week is load-bearing for the vision.**

| Work | How it serves the vision |
|---|---|
| **HR2** (validation panel) | Stays exactly as-is; designer still sees failing-stage + code regardless of input model |
| **HR1** (Save bug report) | Captures the exact composition state when something fails — even more useful in the composition model |
| **HR4** (regression matrix) | Tests are per-primitive in the composition model; same matrix shape, narrower per-test scope |
| **HR3** (amber-tint render) | Still fires for cases that fail (now mostly edge-case advanced-mode shapes) |
| **HR7** (narrow-return decomposition) | **This IS the composition geometry** — just driven by polygon analysis today, by explicit `joins` later |

The work isn't a different direction from the vision. It's the foundation.

## What we'd push back on

- **The temptation to ship Phase 3 (shape palette UI) before Phase 1 (HR7).** The geometry has to be solid first. If a designer composes a snap-attached rectangle and the roof still breaks, the new UX is worse than the old one. HR7 ships the composition geometry that everything else builds on.

- **The temptation to make composition the ONLY mode immediately.** Existing projects with free-form house forms need a migration path; some won't decompose. "Advanced mode" stays for the long tail.

- **The temptation to add more primitives early.** v1 is rectangles only. Rotated rectangles, octagons, curves — all valid v2 conversations, all premature now.

- **The framing that this is a "rewrite."** It's not. It's an additive new input model + UX, with the existing free-form pipeline kept alive in advanced mode. The retire step (Phase 6) happens years later if at all.

## Acceptance for this vision doc

This isn't an implementation plan, so the bar is different:

- Captures the user's vision in their words ("preset shapes you can select and join")
- Explains WHY the vision is architecturally better (less code, fewer bugs, bounded surface)
- Honest about trade-offs (designer gives up arbitrary polygon drawing)
- Shows the connection to current/planned work (HR7 is the geometry foundation)
- Gives a phased migration path (no forklift; each phase is shippable on its own)

## CTA

Two ways to use this:

1. **Reference for future PRs.** Every house-related PR cites this doc and answers "does this advance the vision?" Same way `design-workbench-architecture.md` is Gate 0.

2. **Roadmap input.** If this resonates as the right direction, the phased migration becomes the multi-quarter roadmap for house forms. PR-HR7 ships as Phase 1; Phase 2-6 get scheduled when there's bandwidth.

This doc is intentionally not committing the team to phases 2-6. It's articulating the vision so future tactical work (like HR7) can be evaluated against it. The phased migration is a "we could do this" plan, not a "we will do this" commitment.
