import type { DrawOutlineActiveToolState, DrawOutlineHoverPoint, DrawOutlinePoint, DrawOutlinePolygonPoint } from './drawOutlineToolState';

export const MIN_OUTLINE_SEGMENT_M = 0.001;
export const CLOSE_START_TOLERANCE_M = 0.2;

export function isFiniteOutlinePoint(point: DrawOutlinePoint): boolean {
  return Number.isFinite(point.alongM) && Number.isFinite(point.depthM);
}

export function distanceBetweenOutlinePoints(a: DrawOutlinePoint, b: DrawOutlinePoint): number {
  return Math.hypot(b.alongM - a.alongM, b.depthM - a.depthM);
}

export function absoluteAngleDeg(a: DrawOutlinePoint, b: DrawOutlinePoint): number {
  return (Math.atan2(b.depthM - a.depthM, b.alongM - a.alongM) * 180) / Math.PI;
}

export function normalizeAngleDeg(value: number): number {
  if (!Number.isFinite(value)) return 0;
  let next = ((value % 360) + 360) % 360;
  if (next > 180) next -= 360;
  return Math.round(next * 10) / 10;
}

export function formatOutlineNumber(value: number): string {
  return (Math.round(value * 1000) / 1000).toFixed(3).replace(/\.?0+$/, '') || '0';
}

export function snapOutlineMetres(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function formatOutlineMetres(value: number): string {
  return snapOutlineMetres(value).toFixed(3).replace(/\.?0+$/, '') || '0';
}

export function resolvePendingOutlinePoint(state: DrawOutlineActiveToolState): DrawOutlinePoint | null {
  const start = state.points[state.points.length - 1];
  if (!start) return null;
  const distance = Number.parseFloat(state.distanceDraft);
  const angle = Number.parseFloat(state.angleDraft);
  if (!Number.isFinite(distance) || distance < MIN_OUTLINE_SEGMENT_M || !Number.isFinite(angle)) return null;
  const previous = state.points[state.points.length - 2];
  const baseAngle = state.angleMode === 'relative' && previous ? absoluteAngleDeg(previous, start) : 0;
  const absoluteAngle = state.angleMode === 'relative' ? baseAngle + angle : angle;
  const radians = (absoluteAngle * Math.PI) / 180;
  return {
    alongM: snapOutlineMetres(start.alongM + Math.cos(radians) * distance),
    depthM: snapOutlineMetres(start.depthM + Math.sin(radians) * distance),
  };
}

export function hasDrawOutlineDraft(state: DrawOutlineActiveToolState): boolean {
  return Boolean(state.pendingPoint || state.distanceDraft || state.angleDraft || state.lockedDistanceDraft);
}

export function resolveDrawOutlineHoverPoint(points: DrawOutlinePoint[], point: DrawOutlinePoint): DrawOutlineHoverPoint {
  const firstPoint = points[0];
  const closeHovered = points.length >= 3 && firstPoint ? distanceBetweenOutlinePoints(firstPoint, point) <= CLOSE_START_TOLERANCE_M : false;
  return {
    point: closeHovered && firstPoint ? firstPoint : point,
    closeHovered,
  };
}

export function buildDrawOutlinePreviewPolygon(points: DrawOutlinePoint[], previewPoint: DrawOutlinePoint | null): DrawOutlinePolygonPoint[] {
  return outlinePointsToPolygon(previewPoint ? [...points, previewPoint] : points);
}

export function outlinePointsToPolygon(points: DrawOutlinePoint[]): DrawOutlinePolygonPoint[] {
  return points.map((point) => ({
    alongM: formatOutlineMetres(point.alongM),
    depthM: formatOutlineMetres(point.depthM),
  }));
}
