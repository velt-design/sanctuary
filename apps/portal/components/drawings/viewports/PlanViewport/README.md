# PlanViewport

The 2D plan editor. All workbench interactions belong here. The 3D viewport is read-only; SheetView is read-only; the legacy `ModelSpaceViewport` has been retired in favour of this module.

## North Star

A polygon-first editor where each selectable object is one canonical outline polygon. Click an object -> see its dimensions broken into editable sections -> drag an edge perpendicular to resize -> geometry regenerates dependents (walls, roofs, fascia).

The longer-arc direction is **first-class spatial entities with snap-derived relationships**: pergolas, decks, and house forms each store their own position/outline; connection state is derived from spatial alignment and object ids rather than used as the placement source of truth. Openings remain rigidly attached to walls. See [`docs/design-workbench-architecture.md`](../../../../../../docs/design-workbench-architecture.md), section "Object Model", for the current migration rule.

Until that migration completes, dragging a house footprint edge will move attached pergolas/decks per the current rigid attachment rules. That is expected behaviour, not a regression.

## Foundation Contracts

### Canonical Outline Per Object

Every selectable object emits **exactly one** projection shape that IS its editable outline. Halo, slice dims, snap, and the future drag tool all read from there - no per-family lookup tables, no fallbacks, no compositing in the viewport.

| Family | Outline source | Projection shape | Status |
| --- | --- | --- | --- |
| `house_forms` | project house registry / solved house model footprint | `house_reference:<houseFormId>` | shipped |
| `decks` | `deck.boundary` | `house_surface_solid` (kind: `'deck'`) | shipped |
| `pergolas` | project-wide pergola solved artifact | `pergola_reference:<pergolaId>` | shipped |
| `openings` | derived from wall + opening props | `opening_reference:<id>:outline` | deferred; openings have no polygon in data today |

Every outline shape carries `metadata.isCanonicalOutline === true`. The picker ([`pickPrimaryEditCandidate`](canvas/planDimension.ts)) prefers the marker; the per-family kind list ([`PRIMARY_EDIT_KIND_BY_FAMILY`](canvas/planDimension.ts)) is the compatibility fallback for shapes that pre-date the marker convention.

### Selection Scope

**Per-object, per-family.** Selecting `house_forms` highlights only the house outline - decks and openings are independent objects with their own selections. Don't compose families into a single halo.

### Canvas Style System

Plan styling is owned by [`canvas/canvasShapeStyle.ts`](canvas/canvasShapeStyle.ts) and the Canvas 2D renderer. It defines concrete stroke widths, fills, selection/hover styles, dimension styles, and snap styles in screen pixels so zooming preserves CAD-like line weights. **Do not import calculator CSS modules into PlanViewport**.

### Dim Model

- Slice dims are emitted **per side** (top / bottom / left / right) using only vertices that lie ON that side.
- Each dim represents a real, draggable section of the polygon between two vertices.
- Totals (full-width / full-height) only emit when a side has 2+ slices.
- `buildEdgeDimensions` is the fallback for non-rectilinear polygons (rotated outlines etc).
- `buildBoundingBoxDimensions` is the last-resort fallback for selections that have no primary edit polygon (typical for pre-canonical-outline geometry; emits two bbox dims).

## File Map

```text
PlanViewport.tsx              Entry; orchestrates render model + dims + tool dispatcher
PlanViewportPlaceholder.tsx   No-artifact view

canvas/
  PlanCanvas.tsx              Thin seam into the Canvas 2D renderer
  canvasShapeStyle.ts         Canvas body/detail/halo style constants
  planDimension.ts            Dim model + builders (slice / edge / bbox)
  planLayout.ts               Viewport sizing, bounds helpers
  planRenderItem.ts           Per-shape render item type
  selectionMatch.ts           active object -> shape matcher
  usePlanRenderModel.ts       Hook: artifact -> committed/context/detail/halo lists
  usePlanSelectionDimensions.ts  Hook: halo + active family -> dim list
  layers/                     One file per render layer (committedBody, context, detail, halo, hit, dimension)

interactions/
  usePanZoom.ts               Pan/zoom math helpers
  useHoveredShape.ts          Hover state hook
  selectShape.ts              Pure helpers used by SelectTool
  dragLifecycle.ts            Drag session helpers (used by MoveTool)
  snap/snapEngine.ts          Shared snap target contracts

tools/
  Tool.ts                     Tool interface
  ToolDispatcher.tsx          Active-tool dispatcher with cancel + re-init
  SelectTool.ts               Click-to-select, click-empty-to-clear
  MoveTool.ts                 Generic drag-translate tool
```

## EdgeDragTool And The Outline-Edit Commit Pipeline

When an outline polygon is selected, `EdgeDragTool` becomes the active tool. Pointerdown near an edge captures it; drag perpendicular previews a translated polygon; release fires `onCommit({ outlineId, family, nextPolygon })`.

### Commit Contract

The callback chain is:

```text
EdgeDragTool.onCommit
  -> PlanViewport.onCommitOutlineEdit
    -> WorkbenchViewportHost.onCommitOutlineEdit
      -> DrawingWorkbench.onCommitOutlineEdit
        -> caller (e.g. DesignWorkbenchEstimateClient)
```

`EdgeDragCommit = { outlineId: string; family: ActiveObjectFamily; nextPolygon: ReadonlyArray<Point2> }` - the polygon is in projection mm coordinates.

### Per-Family Handlers

Each family needs its own translation from `nextPolygon` into a workbench-state mutation:

| Family | Conversion | State mutation | Status |
| --- | --- | --- | --- |
| `house_forms` | mm `Point2[]` -> selected-form local bounding box after subtracting the selected house form transform | `objectWorkbenchActions.commitHouseFormFootprintEdit({ houseFormId, edit: { type: 'composition_resize', ... } })` - resizes only single-primitive composition forms; multi-primitive composites must be detached first | wired in `commitOutlineEdit.ts` |
| `decks` | mm `Point2[]` -> side-local `(alongM, depthM)` via `buildSideLocalPolygonFromWorld` against a hardcoded **1m x 1m unit frame with `params: null`** (matches the deck decoder in `normalize.ts:470-530`). Independent of pergola dimensions. | `objectWorkbenchActions.commitSharedHouseDeckPatch(deckId, { shape: 'custom', outline: <encoded> })` | wired |
| `pergolas` | mm `Point2[]` -> bounding box -> `(position.origin, lengthM, projectionM)`. The bbox `min` becomes the pergola's world origin; `max - min` becomes its dimensions. Any wall drag works: -along/-depth walls shift `position`, +along/+depth walls grow dims, mixed drags do both. | `commitSharedPergolaEdgeDragResult(...)` writes position, dimensions, and snap-derived attachment in one atomic transaction. | wired - pergola is a first-class spatial entity. Rotation drag deferred until a rotate gizmo lands. |
| `openings` | n/a; openings have no polygon in data today | deferred | not wired |

For unsupported families today, the handler `console.warn`s the captured commit so drag interactions are observable end-to-end.

## Rules

- **Don't add a workaround in the viewport for missing geometry data.** If an object lacks a canonical outline, fix the geometry pipeline (in `packages/geometry/src/topProjection.ts`), don't compose one in the viewport.
- **Don't import calculator CSS modules.** Keep Plan styling in the Canvas 2D style constants.
- **Don't add features that bypass the outline contract.** Every edit operation should resolve to "mutate the polygon, regenerate dependents."
- **Test pure helpers next to their source.** React-rendering tests can stay smaller - most logic is in pure helpers.

## Related

- [`apps/portal/components/drawings/README.md`](../../README.md) - drawing component boundaries
- [`apps/portal/lib/drawings/README.md`](../../../../lib/drawings/README.md) - domain state and view-model building
- [`packages/geometry/src/topProjection.ts`](../../../../../../packages/geometry/src/topProjection.ts) - where canonical outline shapes are emitted
