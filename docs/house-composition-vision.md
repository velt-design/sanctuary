# House Composition Vision

**Drafted**: 2026-06-18. **Status**: current composition contract and shipped migration record.

The input model for house forms in the design workbench is **rectangle primitives composed by explicit join operations**. This doc captures the current contract, the decision behind it, and the original phased migration rationale.

The original Phase 1 implementation plan lives separately at [`docs/pr-comp1-plan.md`](pr-comp1-plan.md) as a shipped retrospective record.

## Current implementation status

PR-COMP1, PR-COMP-PHASE2, PR-COMP-PHASE3, PR-COMP-PHASE4a/4b, and PR-WB-COMPOSITION-ONLY shipped on 2026-06-18 through 2026-06-19. `HouseFormModel.composition` is now required; Join and Detach are wired through the package geometry primitives and Plan interaction layer.

Legacy persisted `footprint.mode`, `preset`, `params`, and `polygon` values are not a parallel current model. The draft normaliser accepts them defensively, synthesises a composition, and subsequent writes use the composition-owned shape. A truly free-form legacy polygon is reduced to a bounding-box rectangle with `approximationReasons: ['legacy_polygon_bounding_box']`; this limitation must remain visible rather than being described as unchanged legacy rendering.

The phased material below is retained to explain sequencing and tradeoffs. Where it describes optional composition data, indefinite legacy free-form rendering, or future Join/Detach delivery, this current-status section and `docs/design-workbench-architecture.md` take precedence.

## The decision

A house form is one or more **axis-aligned rectangle primitives**. Designers place rectangles, snap them adjacent, and explicitly **join** them to produce composite house forms. Free-form polygon drawing (today's `Draw outline` mode) is removed.

Legacy projects created through the old free-form path are migrated defensively in memory when read: the normaliser emits a required composition and later saves omit the retired footprint fields. Rectangular/preset legacy data is represented directly; a truly free-form polygon becomes an explicitly marked bounding-box approximation.

## Why

Every realistic orthogonal house footprint can be expressed as a union of axis-aligned rectangles. The current pipeline tries to recognize that composition *after the fact* — by analyzing a free-form polygon and inferring the underlying rectangles. That inference is fragile (see the Graham–Oratia bug class) because it has to handle infinitely many polygon shapes with a finite set of solver paths.

Constraining the input to rectangle compositions inverts the problem: the designer specifies the decomposition explicitly, the solver consumes that decomposition directly, and the bug class around "asymmetric L topology partition fails" dissolves entirely.

The tagline: **make the input space match what we can solve, not the other way around.**

## The model

### Two operations on rectangles

1. **Snap-attach** — when a designer drags a rectangle near an existing house form, snap aligns it edge-to-edge. Snap is **positioning only** — the two house forms remain independent first-class objects with separate ids, separate roofs, separate selection, separate edit state.

2. **Join** — when a designer multi-selects two snapped house forms and clicks **Join**, they become a single composite house form. The composite carries the constituent rectangles, the join metadata, and each rectangle's roof intent. Once joined, they render as one coherent house form while preserving per-rectangle intent for solve and detach.

   **Detach** reverses Join — the composite splits back into N independent house forms in the same positions, each carrying its rectangle's roof intent as its initial intent.

Snap without join means "I want these aligned." Join means "I want these to be one house." Separating the two preserves designer intent — a garage and a house that happen to be adjacent can stay separate without auto-joining.

### Per-rectangle roof intent in a composite

Each rectangle primitive owns a `RectangleRoofIntent` (form, pitch, ridge axis preference, open-gable end caps). This is the shipped model: joined forms are one house form for selection/rendering, but the solver can still read the intent of each constituent rectangle. A simple one-rectangle house is just a one-primitive composition.

### Roof resolution rule

When the solver renders a composition:

- **If the union of the joined rectangles is itself a rectangle and the roof intent can be represented as one rectangle**, route to the existing rectangular roof path on the merged dimensions. One ridge, four facets, simple gutter loop.
- **Otherwise** (L, T, U, cross, mixed intent, etc.), compose the result from the constituent rectangle solves and explicit join/valley/stitched geometry, carrying diagnostics when the topology is approximate.

The important rule is that composition intent is explicit input, not inferred from a free-form polygon after the fact.

### Dutch hip preservation

Dutch hip (open-hip-as-gable on terminal ends) works in the composition model, and the model is genuinely cleaner than today.

Terminal ends are derived from the **composite perimeter**, not from each constituent:
- An edge shared between two constituent rectangles (a join edge) is consumed by the join and is NOT a terminal.
- An edge on the outer perimeter of the composite that's perpendicular to its rectangle's ridge axis IS a terminal — independently Dutch-hippable.

The rail's existing "Open End N" toggles operate on composite-level terminal ends. No new UI concept.

### Honest limits (v1)

- **Only axis-aligned rectangles.** Rotated rectangles, octagons, curves are out of scope. The polymorphic primitive type (see Phase 1) leaves room to add these later without rework.
- **The main authoring flow stays simple.** The data model can preserve per-rectangle intent, but the UI should not add complexity unless a real designer workflow needs it.

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

5. **Terminal end ids are deterministic from the composite perimeter.** Avoids "I joined two rectangles and the terminal-end ids changed under me" surprises. Per-rectangle roof intent serializes cleanly across join/detach round-trips.

6. **Legacy free-form solver is read-only.** No bug fixes, no new features. It's a museum exhibit kept alive for any leftover free-form data. Discourages investment in the dead path.

## Out of scope (intentional)

- **Migration of legacy free-form house forms.** Not used in any production project worth migrating. They keep working as-is via the legacy solver.
- **Designer validation rounds.** The product owner is the designer.
- **Curves, rotated rectangles, octagons.** Type leaves room; implementation does not.
- **Pricing implications of composition.** Costing path is downstream; the composition data model carries enough information for any future commercial adapter to consume.

## Next use

Use this doc as the Gate 0 direction check for new house-form work. Historical PR plans remain linked for context, but current implementation details live in the code and current-state architecture docs.
