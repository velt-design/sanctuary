# House Composition Vision

**Drafted**: 2026-06-18. **Status**: committed direction for new house-form work.

The input model for house forms in the design workbench is being shifted from arbitrary free-form polygons to **rectangle primitives composed by explicit join operations**. This doc captures the decision, the model, and the phased plan for getting there.

The Phase 1 implementation plan lives separately at [`docs/pr-comp1-plan.md`](pr-comp1-plan.md).

## The decision

A house form is one or more **axis-aligned rectangle primitives**. Designers place rectangles, snap them adjacent, and explicitly **join** them to produce composite house forms. Free-form polygon drawing (today's `Draw outline` mode) is removed.

Legacy projects whose house forms were created via the old free-form path are not migrated — they continue to render via the existing geometry pipeline as-is. No retire effort for the legacy solver; it lives on as a read-only fallback for any leftover free-form data.

## Why

Every realistic orthogonal house footprint can be expressed as a union of axis-aligned rectangles. The current pipeline tries to recognize that composition *after the fact* — by analyzing a free-form polygon and inferring the underlying rectangles. That inference is fragile (see the Graham–Oratia bug class) because it has to handle infinitely many polygon shapes with a finite set of solver paths.

Constraining the input to rectangle compositions inverts the problem: the designer specifies the decomposition explicitly, the solver consumes that decomposition directly, and the bug class around "asymmetric L topology partition fails" dissolves entirely.

The tagline: **make the input space match what we can solve, not the other way around.**

## The model

### Two operations on rectangles

1. **Snap-attach** — when a designer drags a rectangle near an existing house form, snap aligns it edge-to-edge. Snap is **positioning only** — the two house forms remain independent first-class objects with separate ids, separate roofs, separate selection, separate edit state.

2. **Join** — when a designer multi-selects two snapped house forms and clicks **Join**, they become a single composite house form. The composite carries the constituent rectangles + the join metadata. Once joined, they share one roof intent and render as one coherent roof.

   **Detach** reverses Join — the composite splits back into N independent house forms in the same positions, each carrying the composite's roof intent as their initial intent.

Snap without join means "I want these aligned." Join means "I want these to be one house." Separating the two preserves designer intent — a garage and a house that happen to be adjacent can stay separate without auto-joining.

### One roof intent per composite

The composite owns the roof intent (form, pitch, material, ridge axis preference, open-gable ends). Designer picks "hipped" once for the joined house form; every constituent rectangle is hipped. No per-constituent roof override in v1 — that complexity isn't needed and adding it would invite the "mixed-intent across one house" failure modes we don't want.

### Roof resolution rule

When the solver renders a composite hipped roof:

- **If the union of the joined rectangles is itself a rectangle**, route to the existing `buildRectangularRoof` on the merged dimensions. One ridge, four facets, simple gutter loop. (Already rock-solid.)
- **Otherwise** (L, T, U, cross, etc.), solve each constituent rectangle independently and place an explicit **valley** at each inside corner where two rectangles meet at right angles.

Both branches end up calling `buildRectangularRoof` for the per-rectangle solves — the bulletproof path. The new code is the rectangle-union detector and the valley primitive. Neither is numerically fragile.

### Dutch hip preservation

Dutch hip (open-hip-as-gable on terminal ends) works in the composition model, and the model is genuinely cleaner than today.

Terminal ends are derived from the **composite perimeter**, not from each constituent:
- An edge shared between two constituent rectangles (a join edge) is consumed by the join and is NOT a terminal.
- An edge on the outer perimeter of the composite that's perpendicular to its rectangle's ridge axis IS a terminal — independently Dutch-hippable.

The rail's existing "Open End N" toggles operate on composite-level terminal ends. No new UI concept.

### Honest limits (v1)

- **Per-constituent roof override is not supported.** Designer can't say "hipped on the main block, skillion on the extension." If they want that, they keep the constituents as separate house forms (don't join). Could be added later if customers ask; not on the roadmap.
- **Only axis-aligned rectangles.** Rotated rectangles, octagons, curves are out of scope. The polymorphic primitive type (see Phase 1) leaves room to add these later without rework.

## The plan (4 phases)

Each phase ships independently. No phase changes designer-visible behavior except Phase 3 (where the rectangle tool replaces the draw tool) and Phase 4 (where Join/Detach are added).

### Phase 1 — Composition geometry primitives ([plan](pr-comp1-plan.md))

Build the rectangle + valley primitives in `@sp/geometry`. No workbench dependency, no UX change. Tests prove the math works on Graham–Oratia and other captured shapes.

**Designer-facing change**: none.

**Detail**: see [`docs/pr-comp1-plan.md`](pr-comp1-plan.md).

### Phase 2 — Composition data model in the workbench

Add an optional `composition: HouseComposition` field to `HouseFormModel`. When present, geometry solving uses Phase 1 primitives. When absent (legacy free-form forms), the existing path runs unchanged.

**Designer-facing change**: none.

### Phase 3 — Rectangle tool replaces Draw outline

The `Add structure` button is rebranded to `Add rectangle`. Every new house form is a single-rectangle composition. House-form-to-house-form snap is added to the snap infrastructure (the pergola-to-house snap is the existing model).

The legacy `Draw outline` tool is removed from the UI. Legacy free-form house forms continue to render via the existing solver but cannot be created or edited as free-form polygons — only created as rectangles.

**Designer-facing change**: shape palette tool replaces draw tool.

### Phase 4 — Join + Detach operations

Multi-select two snapped house forms → `Join` button appears in the rail. Detach reverses.

**Designer-facing change**: explicit composition workflow available.

## Architectural rules baked in from Phase 1

These are one-line disciplines that cost nothing to honor now but are painful to retrofit later:

1. **Composition geometry lives in `@sp/geometry`, not in `apps/portal`.** Reusable by any consumer (workbench, future tools, server-side reports).

2. **Primitive type is polymorphic from day one.** `type Primitive = Rectangle | { kind: 'unknown'; reserved: true }`. Rotated rectangles, octagons, etc. drop in without refactor.

3. **Join and Detach are pure functions.** `joinHouseForms(a, b): Composite | { error: JoinError }`. Testable independently of UI.

4. **Join validates structurally.** Reject joins where the rectangles don't share an edge (snap got close but didn't quite touch). Reject joins that would produce non-orthogonal composites. Errors are typed.

5. **Terminal end ids are deterministic from the composite perimeter.** Avoids "I joined two rectangles and the terminal-end ids changed under me" surprises. Roof intent serializes cleanly across join/detach round-trips.

6. **Legacy free-form solver is read-only.** No bug fixes, no new features. It's a museum exhibit kept alive for any leftover free-form data. Discourages investment in the dead path.

## Out of scope (intentional)

- **Migration of legacy free-form house forms.** Not used in any production project worth migrating. They keep working as-is via the legacy solver.
- **Designer validation rounds.** The product owner is the designer.
- **Per-constituent roof intent overrides.** Add later if a real customer need surfaces.
- **Curves, rotated rectangles, octagons.** Type leaves room; implementation does not.
- **Pricing implications of composition.** Costing path is downstream; the composition data model carries enough information for any future commercial adapter to consume.

## CTA

Phase 1 plan is at [`docs/pr-comp1-plan.md`](pr-comp1-plan.md). Say **"go comp1"** to start.
