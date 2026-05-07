import type { PlanCoordinateAdapter, PlanSvgPoint } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import type { PlanPoint } from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';

/**
 * Pan + zoom of the inner `<g data-plan-transform>` group that wraps all
 * rendered geometry inside the SVG. Polygon `points` live in the group's
 * local coord system; the group transform maps them into the SVG viewBox
 * for display. Pointer events arrive in client coords; the SVG's screen CTM
 * only maps client → SVG viewBox, NOT through the group transform — so we
 * have to inverse-apply pan/zoom here to land in the same coord system as
 * the polygon.
 */
export type PlanViewportTransform = {
  panX: number;
  panY: number;
  zoom: number;
};

const IDENTITY: PlanViewportTransform = { panX: 0, panY: 0, zoom: 1 };

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

/**
 * Convert client (mouse) coordinates to plan-projection (world meters).
 *
 * Critical: the SVG renders all geometry inside an inner
 * `<g transform="translate(panX panY) scale(zoom)">` group for pan/zoom. The
 * polygon `points` written by `mmPolygonToPlanSvg` are in the group's local
 * coord system, while `svg.getScreenCTM()` returns the transform from SVG
 * viewBox space to client space — NOT through the group transform. Without
 * applying the inverse group transform, every pointer-derived world coord
 * would be offset by `(panX, panY) / zoom`, manifesting as the cursor
 * silently drifting away from the visible polygon as soon as the user pans
 * or zooms. Pass `viewportTransform` to undo it; pass nothing for the
 * identity case.
 */
export function clientPointToPlanProjection(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  adapter: PlanCoordinateAdapter,
  viewportTransform: PlanViewportTransform = IDENTITY,
): PlanPoint | null {
  const svgPoint = clientPointToSvg(svg, clientX, clientY);
  if (!svgPoint) return null;
  // Inverse-apply the inner-group transform so the cursor lands in the same
  // coord system as the polygon `points` (pre-`<g>`-transform).
  const localPoint: PlanSvgPoint = {
    x: (svgPoint.x - viewportTransform.panX) / viewportTransform.zoom,
    y: (svgPoint.y - viewportTransform.panY) / viewportTransform.zoom,
  };
  return adapter.svgToProjectionPlanPoint(localPoint);
}
