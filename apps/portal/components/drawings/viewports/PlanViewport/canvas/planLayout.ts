import type { GeometryTopProjectionViewModel, Point2 } from '@sp/geometry';
import type { PlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';

const PLAN_SVG_PADDING = 6;
const PLAN_SVG_UNITS_PER_METRE = 100;

const FALLBACK_EXTENTS = {
  minX: 0,
  minY: 0,
  maxX: 1000,
  maxY: 1000,
  widthMm: 1000,
  heightMm: 1000,
} as const;

export type PlanLayout = {
  baseX: number;
  baseY: number;
  scale: number;
  viewBox: string;
  width: number;
  height: number;
  worldBoxValue: string;
};

export function resolvePlanLayout(projection: GeometryTopProjectionViewModel): PlanLayout {
  const extents = projection.extents ?? FALLBACK_EXTENTS;
  const safeWidthM = Math.max(0.1, extents.widthMm / 1000);
  const safeHeightM = Math.max(0.1, extents.heightMm / 1000);
  const scale = PLAN_SVG_UNITS_PER_METRE;
  const width = safeWidthM * scale + PLAN_SVG_PADDING * 2;
  const height = safeHeightM * scale + PLAN_SVG_PADDING * 2;

  return {
    baseX: PLAN_SVG_PADDING - (extents.minX / 1000) * scale,
    baseY: PLAN_SVG_PADDING - (extents.minY / 1000) * scale,
    scale,
    viewBox: `0 0 ${width.toFixed(2)} ${height.toFixed(2)}`,
    width,
    height,
    worldBoxValue: `${extents.minX} ${extents.minY} ${extents.widthMm} ${extents.heightMm}`,
  };
}

export type PlanBoundsMm = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type PlanSvgRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function planBoundsToSvgRect(input: {
  bounds: PlanBoundsMm;
  adapter: PlanCoordinateAdapter;
}): PlanSvgRect {
  const { bounds, adapter } = input;
  const corners: Point2[] = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
  const projected = corners.map((corner) => adapter.projectionToSvg(corner));
  const xs = projected.map((point) => point.x);
  const ys = projected.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(0.1, maxX - minX),
    height: Math.max(0.1, maxY - minY),
  };
}

export function planBoundsFromPolygon(points: Point2[]): PlanBoundsMm | null {
  if (!points.length) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  return { minX, minY, maxX, maxY };
}
