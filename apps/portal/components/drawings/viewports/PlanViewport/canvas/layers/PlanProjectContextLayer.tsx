import type { GeometryTopProjectionShape } from '@sp/geometry';
import type { PlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import lineweightStyles from '../planLineweights.module.css';

type PlanProjectContextLayerProps = {
  shapes: ReadonlyArray<GeometryTopProjectionShape>;
  coordinateAdapter: PlanCoordinateAdapter;
};

/**
 * Step 5d Option A of the first-class spatial-entities migration. Renders
 * faded outline shapes for OTHER pergolas in the project (not the active
 * module). Lets multi-pergola scenes show every pergola's outline in one
 * canvas without requiring a full per-pergola scene aggregation. The
 * active module still renders in full detail through the regular layers.
 *
 * Source: `WorkbenchSolvedModel.projectReferenceShapes` filtered via
 * `buildProjectContextOverlayShapes(activePergolaSourceId)` so the active
 * pergola's outline (already rendered) and the house reference (likewise)
 * are removed.
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
