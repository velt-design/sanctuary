import { describe, expect, it, vi } from 'vitest';
import type {
  GeometryTopProjectionShape,
  GeometryTopProjectionViewModel,
} from '@sp/geometry';
import type { DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchSolvedGeometryArtifact } from '@/lib/drawings/state/workbenchSolvedModel';
import type { DrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { buildOutlineEditCommitHandler } from '@/app/staff/projects/[projectId]/design-workbench/commitOutlineEdit';
import type { ObjectWorkbenchActions } from '@/app/staff/projects/[projectId]/design-workbench/useObjectWorkbenchActions';
import { dispatchPointer, renderIntoDocument } from '../../../../../../test/reactHarness';
import PlanViewport from './PlanViewport';
import type { EdgeDragCommit } from './PlanViewport';

/**
 * Composed canvas integration test — exercises the full pointer-dispatch
 * chain through PlanViewport down to the commit handler:
 *
 *   DOM pointerdown/move/up → PlanCanvas.dispatchPlanPointer →
 *   ToolDispatcher → EdgeDragTool session lifecycle → onCommit →
 *   PlanViewport.onCommitOutlineEdit prop → buildOutlineEditCommitHandler →
 *   ObjectWorkbenchActions.commitSharedPergolaEdgeDragResult
 *
 * Each link is unit-tested in isolation (EdgeDragTool.test.ts,
 * commitOutlineEdit.test.ts, pointerToPlan.test.ts, etc.). What's
 * missing is a single end-to-end test that proves the COMPOSITION works
 * — that EdgeDragCommit's shape matches what the handler consumes, that
 * getActiveOutline wires up correctly, that the dispatcher routes
 * pointer events to the right tool. A change to any link's contract
 * would break this test loudly.
 *
 * COORDINATE SYSTEM. The plan layout uses `scale = 100` SVG units per
 * metre + 6-unit padding (see `canvas/planLayout.ts`). For a fixture
 * with extents starting at `(0, 0)`:
 *   `svgX = 6 + worldMm / 10`  ⇨  `worldMm = (svgX - 6) * 10`
 * JSDOM's default `getScreenCTM` is the identity matrix, so dispatched
 * `clientX/Y` flow through to `svgX/Y` unchanged. The
 * `clientForWorldMm` helper below inverts the transform so each
 * pointer's intended world coordinate is explicit at the call site.
 */

const IDENTITY_TRANSFORM: DrawingWorkbenchViewportTransform = { zoom: 1, panX: 0, panY: 0 };

const PLAN_SVG_PADDING = 6;
const PLAN_SVG_UNITS_PER_METRE = 100;

function clientForWorldMm(worldMm: number): number {
  return PLAN_SVG_PADDING + (worldMm / 1000) * PLAN_SVG_UNITS_PER_METRE;
}

function makeProjection(shapes: GeometryTopProjectionShape[]): GeometryTopProjectionViewModel {
  return {
    coordinateSpace: 'world_xy_mm',
    screenAxis: { x: 'world_x_right', y: 'world_y_down' },
    extents: {
      minX: 0,
      minY: 0,
      maxX: 5000,
      maxY: 3000,
      widthMm: 5000,
      heightMm: 3000,
    },
    shapes,
  };
}

function makeArtifact(shapes: GeometryTopProjectionShape[]): WorkbenchSolvedGeometryArtifact {
  return { topProjection: makeProjection(shapes) } as unknown as WorkbenchSolvedGeometryArtifact;
}

/**
 * Pergola outline shape at world (0,0) → (5000,3000) traversed clockwise.
 * `sourceType: 'pergola_reference'` + `kind: 'outline'` is the canonical
 * pergola-outline shape recognised by `topProjectionPlanLayer` →
 * `committedBodies`. `isCanonicalOutline: true` makes
 * `pickPrimaryEditCandidate` select it as the active edit target.
 * `pergolaId` matches the active object ref so `selectionHaloItems`
 * picks it up.
 *
 * Edge ordering for a clockwise polygon (matters for the outward-normal
 * sign in `EdgeDragTool.computeDeltaMm`):
 *   - edge 0: (0,0)     → (5000,0)     — top edge,   outward normal y=-1
 *   - edge 1: (5000,0)  → (5000,3000)  — right edge, outward normal x=+1
 *   - edge 2: (5000,3000)→(0,3000)     — bottom edge,outward normal y=+1
 *   - edge 3: (0,3000)  → (0,0)        — left edge,  outward normal x=-1
 */
function makePergolaShape(): GeometryTopProjectionShape {
  return {
    id: 'pergola-A-outline',
    sourceObjectId: 'pergola-A-outline',
    sourceId: null,
    sourceType: 'pergola_reference',
    family: 'pergola',
    kind: 'outline',
    polygon: [
      { x: 0, y: 0 },
      { x: 5000, y: 0 },
      { x: 5000, y: 3000 },
      { x: 0, y: 3000 },
    ],
    zOrder: 0,
    zMin: 0,
    zMax: 0,
    metadata: { isCanonicalOutline: true, pergolaId: 'pergola-A' },
  };
}

describe('PlanViewport edge-drag composed integration', () => {
  it('drives a pergola edge drag end-to-end: DOM pointer events → EdgeDragTool → onCommitOutlineEdit', () => {
    const onCommitOutlineEdit = vi.fn();
    const rendered = renderIntoDocument(
      <PlanViewport
        artifact={makeArtifact([makePergolaShape()])}
        activeObjectRef={{ family: 'pergolas', objectId: 'pergola-A' }}
        viewportTransform={IDENTITY_TRANSFORM}
        onViewportTransformChange={() => undefined}
        onCommitOutlineEdit={onCommitOutlineEdit}
      />,
    );
    const svg = rendered.container.querySelector('svg[data-plan-viewport="true"]');
    expect(svg).not.toBeNull();

    // Pointerdown at midpoint of edge 0 (top): world (2500, 0).
    // EdgeDragTool's default `edgeHitToleranceMm` is 250 mm; the cursor
    // is exactly on the edge so the session starts.
    dispatchPointer(svg!, 'pointerdown', {
      button: 0,
      pointerId: 1,
      clientX: clientForWorldMm(2500),
      clientY: clientForWorldMm(0),
    });
    // Move 500 mm in +y world space (inward for a clockwise polygon's
    // top edge — outward normal points y=-1, so positive +y client delta
    // produces a negative edge-perpendicular delta).
    dispatchPointer(svg!, 'pointermove', {
      pointerId: 1,
      clientX: clientForWorldMm(2500),
      clientY: clientForWorldMm(500),
    });
    dispatchPointer(svg!, 'pointerup', {
      pointerId: 1,
      clientX: clientForWorldMm(2500),
      clientY: clientForWorldMm(500),
    });

    expect(onCommitOutlineEdit).toHaveBeenCalledTimes(1);
    const commit = onCommitOutlineEdit.mock.calls[0]![0] as EdgeDragCommit;
    expect(commit.family).toBe('pergolas');
    expect(commit.outlineId).toBe('pergola-A-outline');
    expect(commit.edgeIndex).toBe(0);
    expect(commit.snap).toBeNull();
    // applyEdgePerpendicularTranslation shifts the dragged edge's two
    // vertices along the outward normal by `effectiveDelta`. For a -500
    // mm delta along (0, -1) normal: (0,0) → (0,500), (5000,0) → (5000,500).
    // Vertices 2 and 3 are unchanged.
    expect(commit.nextPolygon).toEqual([
      { x: 0, y: 500 },
      { x: 5000, y: 500 },
      { x: 5000, y: 3000 },
      { x: 0, y: 3000 },
    ]);
    rendered.unmount();
  });

  it('routes the same drag through buildOutlineEditCommitHandler to commitSharedPergolaEdgeDragResult with an atomic patch', () => {
    // Stitches the second half of the integration chain on top: the
    // commit emitted by EdgeDragTool flows into the production handler
    // (`buildOutlineEditCommitHandler`) and lands on the right action
    // (`commitSharedPergolaEdgeDragResult`) with the expected shape.
    // Catches breaks at the handler ↔ tool contract — the seam most
    // likely to drift silently when either side is refactored.
    const commitSharedPergolaEdgeDragResult = vi.fn().mockResolvedValue({ ok: true });
    const store = {
      persisted: { projectModel: { decks: [] } },
      ui: { activeObjectRef: { family: 'pergolas', objectId: 'pergola-A' } },
      derived: {
        activeHouseForm: null,
        activeObjectFirstPergola: {
          position: { originXMm: '0', originYMm: '0', rotationDeg: '0' },
          attachment: null,
        },
      },
    } as unknown as DrawingWorkbenchStore;
    const handler = buildOutlineEditCommitHandler({
      store,
      activeModuleInput: { lengthM: '5', projectionM: '3' } as never,
      objectWorkbenchActions: {
        commitSharedPergolaEdgeDragResult,
        commitSharedHouseDeckPatch: vi.fn(),
        commitSharedHouseFootprintEdit: vi.fn(),
      } as unknown as ObjectWorkbenchActions,
    });

    const rendered = renderIntoDocument(
      <PlanViewport
        artifact={makeArtifact([makePergolaShape()])}
        activeObjectRef={{ family: 'pergolas', objectId: 'pergola-A' }}
        viewportTransform={IDENTITY_TRANSFORM}
        onViewportTransformChange={() => undefined}
        onCommitOutlineEdit={handler}
      />,
    );
    const svg = rendered.container.querySelector('svg[data-plan-viewport="true"]');
    dispatchPointer(svg!, 'pointerdown', {
      button: 0,
      pointerId: 1,
      clientX: clientForWorldMm(2500),
      clientY: clientForWorldMm(0),
    });
    dispatchPointer(svg!, 'pointermove', {
      pointerId: 1,
      clientX: clientForWorldMm(2500),
      clientY: clientForWorldMm(500),
    });
    dispatchPointer(svg!, 'pointerup', {
      pointerId: 1,
      clientX: clientForWorldMm(2500),
      clientY: clientForWorldMm(500),
    });

    // The handler returns the ReversibleCommandInput; PlanViewport wraps
    // it into the local CommandBus and calls `.apply()` immediately so
    // the action runs synchronously here.
    expect(commitSharedPergolaEdgeDragResult).toHaveBeenCalledTimes(1);
    const [pergolaId, fields] = commitSharedPergolaEdgeDragResult.mock.calls[0]!;
    expect(pergolaId).toBe('pergola-A');
    // After the drag, edge 0 of the pergola moved from y=0 to y=500. The
    // bbox of nextPolygon is x ∈ [0, 5000], y ∈ [500, 3000]. The handler
    // converts that into:
    //   position.origin = (minX, minY) = (0, 500) -- changed from (0, 0)
    //   lengthMm = maxX - minX = 5000 -- UNCHANGED from 5m, so omitted
    //                                    from the patch (the handler's
    //                                    `lengthChanged` gate skips it)
    //   projectionMm = maxY - minY = 2500 -- changed from 3000
    // The atomic patch only includes fields that actually changed, so
    // the action call dropping lengthMm is the correct shape.
    expect(fields).toMatchObject({
      position: { originXMm: 0, originYMm: 500, rotationDeg: 0 },
      projectionMm: 2500,
    });
    expect(fields).not.toHaveProperty('lengthMm');
    rendered.unmount();
  });
});
