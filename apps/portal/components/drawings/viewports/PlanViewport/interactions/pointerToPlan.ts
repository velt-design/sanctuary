import type { PlanCoordinateAdapter, PlanSvgPoint } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import type { PlanPoint } from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';

export function clientPointToSvg(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): PlanSvgPoint | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

export function clientPointToPlanProjection(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  adapter: PlanCoordinateAdapter,
): PlanPoint | null {
  const svgPoint = clientPointToSvg(svg, clientX, clientY);
  if (!svgPoint) return null;
  return adapter.svgToProjectionPlanPoint(svgPoint);
}
