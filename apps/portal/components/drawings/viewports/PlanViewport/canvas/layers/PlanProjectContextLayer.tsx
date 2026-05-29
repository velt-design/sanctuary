import type { GeometryTopProjectionShape } from '@sp/geometry';
import type { PlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import lineweightStyles from '../planLineweights.module.css';

type PlanProjectContextLayerProps = {
  shapes: ReadonlyArray<GeometryTopProjectionShape>;
  coordinateAdapter: PlanCoordinateAdapter;
};

/**
 * Fallback context layer for pergolas that do not yet have full project-wide
 * plan detail. Valid solved pergolas render through committed bodies; this
 * faded outline layer keeps invalid/unsupported pergolas visible and
 * selectable without treating references as normal body geometry.
 *
 * Source: `WorkbenchSolvedModel.projectReferenceShapes` filtered via
 * `buildProjectContextOverlayShapes(...)` so the active pergola, full-detail
 * pergolas, and house references are removed.
 */
export function PlanProjectContextLayer({
  shapes,
  coordinateAdapter,
}: PlanProjectContextLayerProps) {
  if (shapes.length === 0) return <g data-plan-layer="projectContext" />;

  return (
    <g data-plan-layer="projectContext" data-plan-project-context-count={shapes.length}>
      {shapes.map((shape) => {
        const svgPoints = coordinateAdapter.projectionPolygonToSvg(shape.polygon);
        if (svgPoints.length < 3) return null;
        const pointsAttr = svgPoints
          .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
          .join(' ');
        const centroidX = svgPoints.reduce((sum, point) => sum + point.x, 0) / svgPoints.length;
        const centroidY = svgPoints.reduce((sum, point) => sum + point.y, 0) / svgPoints.length;
        const label =
          (typeof shape.metadata?.label === 'string' ? shape.metadata.label : null) ??
          shape.sourceObjectId;
        return (
          <g
            key={shape.id}
            data-plan-context-source-id={shape.sourceObjectId}
            data-plan-context-source-type={shape.sourceType}
          >
            <polygon points={pointsAttr} className={lineweightStyles.projectContextOutline} />
            <text
              x={centroidX.toFixed(2)}
              y={centroidY.toFixed(2)}
              className={lineweightStyles.projectContextLabel}
            >
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
