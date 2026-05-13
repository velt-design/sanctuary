import type { Point2 } from '@sp/geometry';
import type { PlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import type { EdgeDragPreview } from '../../tools/EdgeDragTool';
import type { EdgeSnapResult } from '../../tools/resolveEdgeSnap';
import type { MoveToolPreview } from '../../tools/MoveTool';
import lineweightStyles from '../planLineweights.module.css';

const KIND_LABEL: Record<string, string> = {
  roof_eave: 'Roof eave',
  wall: 'Wall',
  pergola_outline: 'Pergola',
};

/**
 * Generalised snap-indicator render. Given a snap result and the world-coord
 * midpoint of the snapped edge, draws the target line, a dot marking the
 * snap point, and a label naming the snap target's edge kind. Used by both
 * the edge-drag flow (the resized edge's preview-midpoint) and the move flow
 * (the moving polygon's best-matching edge translated by the adjusted delta).
 */
function renderSnapVisual(input: {
  snap: EdgeSnapResult;
  midpointWorld: Point2 | null;
  coordinateAdapter: PlanCoordinateAdapter;
  layerName: string;
}) {
  const { snap, midpointWorld, coordinateAdapter, layerName } = input;
  const targetStartSvg = coordinateAdapter.projectionToSvg(snap.target.start);
  const targetEndSvg = coordinateAdapter.projectionToSvg(snap.target.end);
  const markerSvg = midpointWorld ? coordinateAdapter.projectionToSvg(midpointWorld) : null;
  const label = KIND_LABEL[snap.target.edgeKind] ?? snap.target.edgeKind;
  const labelAnchor = markerSvg ?? targetStartSvg;
  return (
    <g
      data-plan-layer={layerName}
      data-plan-snap-edge-kind={snap.target.edgeKind}
      data-plan-snap-target-id={snap.target.id}
    >
      <line
        x1={targetStartSvg.x.toFixed(2)}
        y1={targetStartSvg.y.toFixed(2)}
        x2={targetEndSvg.x.toFixed(2)}
        y2={targetEndSvg.y.toFixed(2)}
        className={lineweightStyles.snapIndicatorLine}
      />
      {markerSvg ? (
        <>
          <circle
            cx={markerSvg.x.toFixed(2)}
            cy={markerSvg.y.toFixed(2)}
            r="4"
            className={lineweightStyles.snapIndicatorMarker}
          />
          <text
            x={labelAnchor.x.toFixed(2)}
            y={(labelAnchor.y - 12).toFixed(2)}
            className={lineweightStyles.snapIndicatorLabel}
          >
            {label}
          </text>
        </>
      ) : null}
    </g>
  );
}

/**
 * Renders the snap visual for an EDGE-DRAG. Uses the snapped preview
 * polygon's edge midpoint -- which by construction lies on the target line
 * when a snap is active.
 *
 * Step 7b.3 of the first-class spatial-entities migration. Sits as a
 * sibling to `PlanEdgeDragPreviewLayer` so preview polygon and snap
 * source-line render with separate visual roles.
 */
export function PlanSnapIndicatorLayer({
  preview,
  coordinateAdapter,
}: {
  preview: EdgeDragPreview | null;
  coordinateAdapter: PlanCoordinateAdapter;
}) {
  if (!preview?.snap) return <g data-plan-layer="snapIndicator" />;
  const previewEdgeStart = preview.previewPolygon[preview.edgeIndex];
  const previewEdgeEnd =
    preview.previewPolygon[(preview.edgeIndex + 1) % preview.previewPolygon.length];
  const midpointWorld =
    previewEdgeStart && previewEdgeEnd
      ? {
          x: (previewEdgeStart.x + previewEdgeEnd.x) / 2,
          y: (previewEdgeStart.y + previewEdgeEnd.y) / 2,
        }
      : null;
  return renderSnapVisual({
    snap: preview.snap,
    midpointWorld,
    coordinateAdapter,
    layerName: 'snapIndicator',
  });
}

function translatedEdgeMidpoint(
  sourcePolygonMm: ReadonlyArray<Point2>,
  edgeIndex: number,
  delta: Point2,
): Point2 | null {
  const start = sourcePolygonMm[edgeIndex];
  const end = sourcePolygonMm[(edgeIndex + 1) % sourcePolygonMm.length];
  if (!start || !end) return null;
  return {
    x: (start.x + end.x) / 2 + delta.x,
    y: (start.y + end.y) / 2 + delta.y,
  };
}

/**
 * Renders the snap visual for a MOVE drag. The snapped edge's midpoint is
 * computed from the source polygon (captured at drag-start in MoveTool's
 * session) translated by the move preview's adjusted delta -- so the dot
 * tracks the moving object's edge as the user drags.
 *
 * When the move resolves a CORNER snap (two non-parallel targets within
 * tolerance on different polygon edges), this also renders the secondary
 * snap line + a corner-vertex marker at the intersection of the two
 * target lines. The secondary visual reuses `renderSnapVisual` for
 * consistency. See `resolveMoveSnap.ts` for the geometry.
 */
export function PlanMoveSnapIndicatorLayer({
  preview,
  sourcePolygonMm,
  coordinateAdapter,
}: {
  preview: MoveToolPreview | null;
  /** Polygon (world mm) of the object being moved -- pre-translation. */
  sourcePolygonMm: ReadonlyArray<Point2> | null;
  coordinateAdapter: PlanCoordinateAdapter;
}) {
  if (!preview?.snap || !sourcePolygonMm) {
    return <g data-plan-layer="moveSnapIndicator" />;
  }
  const { edgeIndex, edgeSnap, secondary, cornerVertex } = preview.snap;
  const primaryMidpointWorld = translatedEdgeMidpoint(sourcePolygonMm, edgeIndex, preview.delta);
  const secondaryMidpointWorld = secondary
    ? translatedEdgeMidpoint(sourcePolygonMm, secondary.edgeIndex, preview.delta)
    : null;
  const cornerVertexSvg = cornerVertex
    ? coordinateAdapter.projectionToSvg(cornerVertex)
    : null;
  return (
    <g data-plan-layer="moveSnapIndicator">
      {renderSnapVisual({
        snap: edgeSnap,
        midpointWorld: primaryMidpointWorld,
        coordinateAdapter,
        layerName: 'moveSnapIndicatorPrimary',
      })}
      {secondary
        ? renderSnapVisual({
            snap: secondary.edgeSnap,
            midpointWorld: secondaryMidpointWorld,
            coordinateAdapter,
            layerName: 'moveSnapIndicatorSecondary',
          })
        : null}
      {cornerVertexSvg ? (
        <circle
          cx={cornerVertexSvg.x.toFixed(2)}
          cy={cornerVertexSvg.y.toFixed(2)}
          r="6"
          className={lineweightStyles.snapIndicatorMarker}
          data-plan-snap-corner-vertex="true"
        />
      ) : null}
    </g>
  );
}
