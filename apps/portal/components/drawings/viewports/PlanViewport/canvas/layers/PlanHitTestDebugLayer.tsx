'use client';

import type { PlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import type { EdgeDragHover } from '../../tools/EdgeDragTool';
import type { Point2 } from '../polygonEdgeMath';

/**
 * Diagnostic overlay for the edge-drag hit-test pipeline. Active only when
 * the URL contains `?debug=hit-test` so the production path is unaffected.
 * Renders:
 *   - A small dot at every vertex of the active outline polygon.
 *   - A circle at the cursor's converted world position.
 *   - A line from cursor to the published `closestPoint` on the hovered edge.
 *   - Numeric `data-` attributes on the wrapping group so the user can copy
 *     coords out of the DOM (or screenshot the inspector) without us having
 *     to invent visual readouts.
 *
 * The goal is to make coord-space mismatches between the rendered edge and
 * the hit-test edge immediately visible. Delete the layer once the bug is
 * resolved — it has no production callers and lives in its own file.
 */
type PlanHitTestDebugLayerProps = {
  enabled: boolean;
  activeOutlinePolygon: ReadonlyArray<Point2> | null;
  cursorWorldMm: Point2 | null;
  hover: EdgeDragHover | null;
  coordinateAdapter: PlanCoordinateAdapter;
};

export function PlanHitTestDebugLayer({
  enabled,
  activeOutlinePolygon,
  cursorWorldMm,
  hover,
  coordinateAdapter,
}: PlanHitTestDebugLayerProps) {
  if (!enabled) return <g data-plan-layer="hitTestDebug" data-debug-enabled="false" />;

  const cursorSvg = cursorWorldMm ? coordinateAdapter.projectionToSvg(cursorWorldMm) : null;
  const closestSvg = hover ? coordinateAdapter.projectionToSvg(hover.closestPoint) : null;
  const cursorWorldAttr = cursorWorldMm
    ? `${cursorWorldMm.x.toFixed(0)},${cursorWorldMm.y.toFixed(0)}`
    : '';
  const closestWorldAttr = hover
    ? `${hover.closestPoint.x.toFixed(0)},${hover.closestPoint.y.toFixed(0)}`
    : '';
  const distanceMm =
    hover && cursorWorldMm
      ? Math.hypot(
          cursorWorldMm.x - hover.closestPoint.x,
          cursorWorldMm.y - hover.closestPoint.y,
        )
      : null;

  return (
    <g
      data-plan-layer="hitTestDebug"
      data-debug-enabled="true"
      data-cursor-world-mm={cursorWorldAttr}
      data-hover-outline-id={hover?.outlineId ?? ''}
      data-hover-edge-index={hover?.edgeIndex ?? ''}
      data-hover-closest-world-mm={closestWorldAttr}
      data-hover-distance-mm={distanceMm !== null ? distanceMm.toFixed(1) : ''}
      data-active-polygon-vertex-count={activeOutlinePolygon?.length ?? 0}
    >
      {activeOutlinePolygon?.map((vertex, idx) => {
        const svg = coordinateAdapter.projectionToSvg(vertex);
        return (
          <circle
            key={`vertex-${idx}`}
            cx={svg.x.toFixed(2)}
            cy={svg.y.toFixed(2)}
            r={3}
            fill="#00b3ff"
            stroke="#003a55"
            strokeWidth={0.5}
            vectorEffect="non-scaling-stroke"
            data-debug-vertex-index={idx}
            data-debug-vertex-world-mm={`${vertex.x.toFixed(0)},${vertex.y.toFixed(0)}`}
          />
        );
      })}
      {cursorSvg && (
        <circle
          cx={cursorSvg.x.toFixed(2)}
          cy={cursorSvg.y.toFixed(2)}
          r={6}
          fill="none"
          stroke="#ff00aa"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          data-debug-marker="cursor"
        />
      )}
      {cursorSvg && closestSvg && (
        <line
          x1={cursorSvg.x.toFixed(2)}
          y1={cursorSvg.y.toFixed(2)}
          x2={closestSvg.x.toFixed(2)}
          y2={closestSvg.y.toFixed(2)}
          stroke="#ff00aa"
          strokeWidth={0.75}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
          data-debug-marker="cursor-to-closest"
        />
      )}
    </g>
  );
}
