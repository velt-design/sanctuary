# PlanViewport

The 2D plan editor. All workbench interactions belong here. The 3D viewport is read-only; SheetView is read-only; the legacy `ModelSpaceViewport` is being retired in favour of this module.

## North star

A polygon-first editor where each selectable object is one canonical outline polygon. Click an object → see its dimensions broken into editable sections → drag an edge perpendicular to resize → geometry regenerates dependents (walls, roofs, fascia).

## Foundation contracts

### Canonical outline per object

Every selectable object emits **exactly one** projection shape that IS its editable outline. Halo, slice dims, snap, and the future drag tool all read from there — no per-family lookup tables, no fallbacks, no compositing in the viewport.

| Family | Outline source | Projection shape | Status |
|--------|---------------|------------------|--------|
| `house_forms` | `assembly.house.model.footprint` | `house_reference:house-footprint` | ✅ |
| `decks` | `deck.boundary` | `house_surface_solid` (kind:`'deck'`) | ✅ |
| `pergolas` | `assembly.outline` | `pergola_reference:pergola-outline` | ✅ |
| `openings` | derived from wall + opening props | `opening_reference:<id>:outline` | deferred — openings have no polygon in data today |

Every outline shape carries `metadata.isCanonicalOutline === true`. The picker ([`pickPrimaryEditCandidate`](canvas/planDimension.ts)) prefers the marker; the per-family kind list ([`PRIMARY_EDIT_KIND_BY_FAMILY`](canvas/planDimension.ts)) is the legacy fallback for shapes that pre-date the marker convention.

### Selection scope

**Per-object, per-family.** Selecting `house_forms` highlights only the house outline — decks and openings are independent objects with their own selections. Don't compose families into a single halo.

### Lineweight system

All visual styling flows from [`canvas/planLineweights.module.css`](canvas/planLineweights.module.css). It defines:

- 4 stroke weights: `heavy` / `medium` / `light` / `hairline`
- Per-surface fill tokens (house roof, pergola rafter, etc.)
- Selection / hover / dimension / snap colors

Layers consume semantic classes (`bodyHouseRoof`, `selectionHalo`, `dimensionLine`, etc). **Do not import calculator CSS modules into PlanViewport** — the migration off them is complete. Re-tuning the whole plan is a single CSS file edit.

### Dim model

- Slice dims are emitted **per side** (top / bottom / left / right) using only vertices that lie ON that side.
- Each dim represents a real, draggable section of the polygon between two vertices.
- Totals (full-width / full-height) only emit when a side has 2+ slices.
- `buildEdgeDimensions` is the fallback for non-rectilinear polygons (rotated outlines etc).
- `buildBoundingBoxDimensions` is the last-resort fallback for selections that have no primary edit polygon (typical for pre-canonical-outline geometry — emits two bbox dims).

## File map

```
PlanViewport.tsx              Entry; orchestrates render model + dims + tool dispatcher
PlanViewportPlaceholder.tsx   No-artifact view

canvas/
  PlanCanvas.tsx              SVG wrapper, pan/zoom, pointer dispatch
  planLineweights.module.css  Token system (single source of truth for visuals)
  planDimension.ts            Dim model + builders (slice / edge / bbox)
  planLayout.ts               Viewport sizing, bounds helpers
  planRenderItem.ts           Per-shape render item type
  selectionMatch.ts           active object → shape matcher
  shapeStyle.ts               shape kind → semantic class mapping
  usePlanRenderModel.ts       Hook: artifact → committed/context/detail/halo lists
  usePlanSelectionDimensions.ts  Hook: halo + active family → dim list
  layers/                     One file per render layer (committedBody, context, detail, halo, hit, dimension)

interactions/
  pointerToPlan.ts            Client coords → plan-projection coords
  usePanZoom.ts               Pan/zoom hook
  useHoveredShape.ts          Hover state hook
  selectShape.ts              Pure helpers used by SelectTool
  dragLifecycle.ts            Drag session helpers (used by MoveTool)
  snap/snapEngine.ts          Snap query helpers (built, awaiting first consumer)

tools/
  Tool.ts                     Tool interface
  ToolDispatcher.tsx          Active-tool dispatcher with cancel + re-init
  SelectTool.ts               Click-to-select, click-empty-to-clear
  MoveTool.ts                 Generic drag-translate tool (built, awaiting commit pipeline)
```

## Built but not yet wired

These are tested helpers waiting for their named consumer. Not dead code — staged work.

| Module | Wires up when |
|--------|---------------|
| `interactions/snap/snapEngine.ts` | First snap-dependent feature (relation dims, dimension tool, move-with-snap) |
| `tools/MoveTool.ts` | Commit-pipeline design lands (per-family `commitMove` callback) |
| `interactions/dragLifecycle.ts` | Currently only used by `MoveTool`; widely useful for any drag tool |

## EdgeDragTool and the outline-edit commit pipeline

When an outline polygon is selected, `EdgeDragTool` becomes the active tool. Pointerdown near an edge captures it; drag perpendicular previews a translated polygon; release fires `onCommit({ outlineId, family, nextPolygon })`.

### Commit contract

The callback chain is:

```
EdgeDragTool.onCommit
  → PlanViewport.onCommitOutlineEdit
    → WorkbenchViewportHost.onCommitOutlineEdit
      → DrawingWorkbench.onCommitOutlineEdit
        → caller (e.g. DesignWorkbenchEstimateClient)
```

`EdgeDragCommit = { outlineId: string; family: ActiveObjectFamily; nextPolygon: ReadonlyArray<Point2> }` — the polygon is in projection mm coordinates.

### Per-family handlers

Each family needs its own translation from `nextPolygon` into a workbench-state mutation:

| Family | Conversion | State mutation | Status |
|--------|-----------|----------------|--------|
| `house_forms` | mm `Point2[]` → `CalculatorHouseFootprintPolygonPoint[]` (`alongM = x / 1000`, `depthM = y / 1000`, both as strings) | `objectWorkbenchActions.commitSharedHouseFootprintEdit({ type: 'custom_polygon', polygon })` — sets `houseFootprintMode = 'custom_polygon'` and runs the full draft transaction (geometry re-solve cascades) | ✅ wired in `DesignWorkbenchEstimateClient` |
| `decks` | mm `Point2[]` → deck-boundary patch | new action; closest existing analogue is `commitDeckDimension` (parametric), would need a polygon-direct variant | ⏳ next |
| `pergolas` | mm `Point2[]` → pergola outline. Pergolas are currently parametric (lengthM/projectionM); a polygon-direct input may need to be added to the geometry config. | new action | ⏳ later |
| `openings` | n/a — openings have no polygon in data today | deferred | — |

For unsupported families today, the handler `console.warn`s the captured commit so drag interactions are observable end-to-end. Implementing decks and pergolas is the next slice.

## Rules

- **Don't add a workaround in the viewport for missing geometry data.** If an object lacks a canonical outline, fix the geometry pipeline (in `packages/geometry/src/topProjection.ts`), don't compose one in the viewport.
- **Don't import calculator CSS modules.** Use lineweight tokens.
- **Don't add features that bypass the outline contract.** Every edit operation should resolve to "mutate the polygon, regenerate dependents."
- **Test pure helpers next to their source.** React-rendering tests can stay smaller — most logic is in pure helpers.

## Related

- [`apps/portal/components/drawings/README.md`](../../README.md) — drawing component boundaries
- [`apps/portal/lib/drawings/README.md`](../../../../lib/drawings/README.md) — domain state and view-model building
- [`packages/geometry/src/topProjection.ts`](../../../../../../packages/geometry/src/topProjection.ts) — where canonical outline shapes are emitted
