import type { GeometryTopProjectionShape } from '@sp/geometry';
import type { PlanSvgPoint } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import type { ProjectionPlanLayer } from '@/lib/drawings/views/plan/planRenderGraph';

export type PlanRenderItem = {
  shape: GeometryTopProjectionShape;
  points: PlanSvgPoint[];
  layer: ProjectionPlanLayer;
};

export function svgPointsAttr(points: PlanSvgPoint[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}
