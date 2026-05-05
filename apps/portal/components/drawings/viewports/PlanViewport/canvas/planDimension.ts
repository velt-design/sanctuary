import type { PlanCoordinateAdapter, PlanSvgPoint } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import { planBoundsFromPolygon } from './planLayout';

export type PlanDimensionPoint = {
  x: number;
  y: number;
};

export type PlanDimension = {
  id: string;
  start: PlanDimensionPoint;
  end: PlanDimensionPoint;
  offsetMm?: number;
  label?: string;
};

export type PlanDimensionGeometry = {
  extensionStart: { from: PlanSvgPoint; to: PlanSvgPoint };
  extensionEnd: { from: PlanSvgPoint; to: PlanSvgPoint };
  dimLine: { from: PlanSvgPoint; to: PlanSvgPoint };
  labelAnchor: PlanSvgPoint;
  labelRotationDeg: number;
  lengthMm: number;
  label: string;
};

export const DEFAULT_DIMENSION_OFFSET_MM = 200;

function unitNormal(dx: number, dy: number): { nx: number; ny: number } | null {
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  return { nx: -dy / length, ny: dx / length };
}

function angleDegBetweenSvgPoints(from: PlanSvgPoint, to: PlanSvgPoint): number {
  const angleRad = Math.atan2(to.y - from.y, to.x - from.x);
  let degrees = (angleRad * 180) / Math.PI;
  if (degrees > 90) degrees -= 180;
  if (degrees < -90) degrees += 180;
  return degrees;
}

export function formatDimensionLengthMm(lengthMm: number): string {
  return `${Math.round(lengthMm)}`;
}

export type PlanSelectionDimensionSource = {
  id: string;
  polygon: ReadonlyArray<PlanDimensionPoint>;
};

const SELECTION_DIM_OFFSET_MM = -350;

export function buildSelectionDimensions(
  items: ReadonlyArray<PlanSelectionDimensionSource>,
): PlanDimension[] {
  const dimensions: PlanDimension[] = [];
  for (const item of items) {
    const bounds = planBoundsFromPolygon(item.polygon as PlanDimensionPoint[]);
    if (!bounds) continue;
    if (bounds.maxX - bounds.minX <= 0 || bounds.maxY - bounds.minY <= 0) continue;
    dimensions.push({
      id: `${item.id}:width`,
      start: { x: bounds.minX, y: bounds.minY },
      end: { x: bounds.maxX, y: bounds.minY },
      offsetMm: SELECTION_DIM_OFFSET_MM,
    });
    dimensions.push({
      id: `${item.id}:height`,
      start: { x: bounds.minX, y: bounds.maxY },
      end: { x: bounds.minX, y: bounds.minY },
      offsetMm: SELECTION_DIM_OFFSET_MM,
    });
  }
  return dimensions;
}

export function resolvePlanDimensionGeometry(
  dimension: PlanDimension,
  adapter: PlanCoordinateAdapter,
): PlanDimensionGeometry | null {
  const { start, end } = dimension;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthMm = Math.hypot(dx, dy);
  if (lengthMm === 0) return null;
  const normal = unitNormal(dx, dy);
  if (!normal) return null;
  const offsetMm = dimension.offsetMm ?? DEFAULT_DIMENSION_OFFSET_MM;
  const dimStart = { x: start.x + normal.nx * offsetMm, y: start.y + normal.ny * offsetMm };
  const dimEnd = { x: end.x + normal.nx * offsetMm, y: end.y + normal.ny * offsetMm };

  const extensionStartFrom = adapter.projectionToSvg(start);
  const extensionStartTo = adapter.projectionToSvg(dimStart);
  const extensionEndFrom = adapter.projectionToSvg(end);
  const extensionEndTo = adapter.projectionToSvg(dimEnd);
  const dimLineFrom = extensionStartTo;
  const dimLineTo = extensionEndTo;
  const labelAnchor: PlanSvgPoint = {
    x: (dimLineFrom.x + dimLineTo.x) / 2,
    y: (dimLineFrom.y + dimLineTo.y) / 2,
  };
  const labelRotationDeg = angleDegBetweenSvgPoints(dimLineFrom, dimLineTo);
  const label = dimension.label ?? formatDimensionLengthMm(lengthMm);

  return {
    extensionStart: { from: extensionStartFrom, to: extensionStartTo },
    extensionEnd: { from: extensionEndFrom, to: extensionEndTo },
    dimLine: { from: dimLineFrom, to: dimLineTo },
    labelAnchor,
    labelRotationDeg,
    lengthMm,
    label,
  };
}
