import type { GeometryTopProjectionViewModel, Point2 } from '@sp/geometry';
import type { PlanPoint } from './objectWorkbenchPlanOverlay';

export type PlanSvgPoint = Point2;

export type PlanCoordinateAdapter = {
  coordinateSpace: 'top_projection_world_m' | 'object_outline_plan_m';
  projectionToSvg: (point: Point2) => PlanSvgPoint;
  projectionPolygonToSvg: (points: Point2[]) => PlanSvgPoint[];
  svgToProjectionPlanPoint: (point: PlanSvgPoint) => PlanPoint | null;
  directionToSvg: (direction: Point2) => Point2;
};

export function mmPointToPlanSvg(point: Point2, baseX: number, baseY: number, scale: number): PlanSvgPoint {
  return {
    x: baseX + (point.x / 1000) * scale,
    y: baseY + (point.y / 1000) * scale,
  };
}

export function mmPolygonToPlanSvg(points: Point2[], baseX: number, baseY: number, scale: number): PlanSvgPoint[] {
  return points.map((point) => mmPointToPlanSvg(point, baseX, baseY, scale));
}

export function topProjectionPointToPlanSvg(
  point: Point2,
  projection: GeometryTopProjectionViewModel,
  baseX: number,
  baseY: number,
  scale: number,
): PlanSvgPoint {
  const xMm =
    projection.screenAxis.x === 'world_x_left' && projection.extents
      ? projection.extents.minX + projection.extents.maxX - point.x
      : point.x;
  return mmPointToPlanSvg({ x: xMm, y: point.y }, baseX, baseY, scale);
}

export function topProjectionSvgPointToPlanPoint(
  point: PlanSvgPoint,
  projection: GeometryTopProjectionViewModel,
  baseX: number,
  baseY: number,
  scale: number,
): PlanPoint | null {
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const displayedXmm = ((point.x - baseX) / scale) * 1000;
  const displayedYmm = ((point.y - baseY) / scale) * 1000;
  const worldXmm =
    projection.screenAxis.x === 'world_x_left' && projection.extents
      ? projection.extents.minX + projection.extents.maxX - displayedXmm
      : displayedXmm;
  if (!Number.isFinite(worldXmm) || !Number.isFinite(displayedYmm)) return null;
  return {
    x: worldXmm / 1000,
    y: displayedYmm / 1000,
  };
}

export function topProjectionPolygonToPlanSvg(
  points: Point2[],
  projection: GeometryTopProjectionViewModel,
  baseX: number,
  baseY: number,
  scale: number,
): PlanSvgPoint[] {
  return points.map((point) => topProjectionPointToPlanSvg(point, projection, baseX, baseY, scale));
}

export function topProjectionDirectionToPlanSvg(
  direction: Point2,
  projection: GeometryTopProjectionViewModel | null | undefined,
): Point2 {
  return projection?.screenAxis.x === 'world_x_left'
    ? { x: -direction.x, y: direction.y }
    : direction;
}

export function buildTopProjectionPlanCoordinateAdapter(input: {
  projection: GeometryTopProjectionViewModel;
  baseX: number;
  baseY: number;
  scale: number;
}): PlanCoordinateAdapter {
  return {
    coordinateSpace: 'top_projection_world_m',
    projectionToSvg: (point) =>
      topProjectionPointToPlanSvg(point, input.projection, input.baseX, input.baseY, input.scale),
    projectionPolygonToSvg: (points) =>
      topProjectionPolygonToPlanSvg(points, input.projection, input.baseX, input.baseY, input.scale),
    svgToProjectionPlanPoint: (point) =>
      topProjectionSvgPointToPlanPoint(point, input.projection, input.baseX, input.baseY, input.scale),
    directionToSvg: (direction) => topProjectionDirectionToPlanSvg(direction, input.projection),
  };
}
