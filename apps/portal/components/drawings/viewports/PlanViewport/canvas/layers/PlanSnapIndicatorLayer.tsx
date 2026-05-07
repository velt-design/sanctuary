import type { PlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import type { EdgeDragPreview } from '../../tools/EdgeDragTool';
import lineweightStyles from '../planLineweights.module.css';

type PlanSnapIndicatorLayerProps = {
  preview: EdgeDragPreview | null;
  coordinateAdapter: PlanCoordinateAdapter;
};

const KIND_LABEL: Record<string, string> = {
  roof_eave: 'Roof eave',
  wall: 'Wall',
};

/**
 * Renders the snap visual when `preview.snap` is non-null. Highlights the
 * resolved snap target line and marks the snap point on the dragged edge so
 * the user can see what they're snapping to before releasing the pointer.
 *
 * Step 7b.3 of the first-class spatial-entities migration. Sits as a sibling
 * to `PlanEdgeDragPreviewLayer` so the preview polygon and the snap source
 * line render with separate visual roles.
 */
export function PlanSnapIndicatorLayer({ preview, coordinateAdapter }: PlanSnapIndicatorLayerProps) {
  if (!preview?.snap) return <g data-plan-layer="snapIndicator" />;
  const { snap } = preview;
  const targetStartSvg = coordinateAdapter.projectionToSvg(snap.target.start);
  const targetEndSvg = coordinateAdapter.projectionToSvg(snap.target.end);

  // Snap-point marker: midpoint of the (snapped) preview edge, which by
  // construction lies on the target line.
  const previewEdgeStart = preview.previewPolygon[preview.edgeIndex];
  const previewEdgeEnd =
    preview.previewPolygon[(preview.edgeIndex + 1) % preview.previewPolygon.length];
  const markerSvg =
    previewEdgeStart && previewEdgeEnd
      ? coordinateAdapter.projectionToSvg({
          x: (previewEdgeStart.x + previewEdgeEnd.x) / 2,
          y: (previewEdgeStart.y + previewEdgeEnd.y) / 2,
        })
      : null;

  const label = KIND_LABEL[snap.target.edgeKind] ?? snap.target.edgeKind;
  const labelAnchor = markerSvg ?? targetStartSvg;

  return (
    <g
      data-plan-layer="snapIndicator"
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
