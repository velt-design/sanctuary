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
  family?: string;
  kind?: string;
};

export type ActiveObjectFamily = 'house_forms' | 'decks' | 'openings' | 'pergolas';

const SELECTION_DIM_OFFSET_MM = -350;
const EDGE_DIM_OFFSET_MM = 350;

const PRIMARY_EDIT_KIND_BY_FAMILY: Record<ActiveObjectFamily, ReadonlyArray<string>> = {
  house_forms: ['footprint'],
  decks: ['deck', 'landing'],
  openings: ['opening_outline', 'opening_marker'],
  pergolas: ['roof_plane'],
};

function polygonAreaMm(points: ReadonlyArray<PlanDimensionPoint>): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function polygonCentroid(points: ReadonlyArray<PlanDimensionPoint>): PlanDimensionPoint | null {
  if (points.length === 0) return null;
  let sumX = 0;
  let sumY = 0;
  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
  }
  return { x: sumX / points.length, y: sumY / points.length };
}

function pickPrimaryEditPolygon(
  items: ReadonlyArray<PlanSelectionDimensionSource>,
  activeFamily: ActiveObjectFamily,
): PlanSelectionDimensionSource | null {
  const allowedKinds = PRIMARY_EDIT_KIND_BY_FAMILY[activeFamily];
  if (!allowedKinds) return null;
  const candidates = items.filter((item) => item.kind !== undefined && allowedKinds.includes(item.kind));
  if (candidates.length === 0) return null;
  let best: PlanSelectionDimensionSource | null = null;
  let bestArea = -Infinity;
  for (const candidate of candidates) {
    const area = polygonAreaMm(candidate.polygon);
    if (area > bestArea) {
      best = candidate;
      bestArea = area;
    }
  }
  return best;
}

function buildBoundingBoxDimensions(
  items: ReadonlyArray<PlanSelectionDimensionSource>,
): PlanDimension[] {
  let union: ReturnType<typeof planBoundsFromPolygon> = null;
  for (const item of items) {
    const bounds = planBoundsFromPolygon(item.polygon as PlanDimensionPoint[]);
    if (!bounds) continue;
    union = union
      ? {
          minX: Math.min(union.minX, bounds.minX),
          minY: Math.min(union.minY, bounds.minY),
          maxX: Math.max(union.maxX, bounds.maxX),
          maxY: Math.max(union.maxY, bounds.maxY),
        }
      : bounds;
  }
  if (!union) return [];
  if (union.maxX - union.minX <= 0 || union.maxY - union.minY <= 0) return [];
  return [
    {
      id: 'selection:width',
      start: { x: union.minX, y: union.minY },
      end: { x: union.maxX, y: union.minY },
      offsetMm: SELECTION_DIM_OFFSET_MM,
    },
    {
      id: 'selection:height',
      start: { x: union.minX, y: union.maxY },
      end: { x: union.minX, y: union.minY },
      offsetMm: SELECTION_DIM_OFFSET_MM,
    },
  ];
}

export function buildEdgeDimensions(
  source: { id: string; polygon: ReadonlyArray<PlanDimensionPoint> },
): PlanDimension[] {
  const polygon = source.polygon;
  if (polygon.length < 3) return [];
  const centroid = polygonCentroid(polygon);
  if (!centroid) return [];
  const dimensions: PlanDimension[] = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const start = polygon[i]!;
    const end = polygon[(i + 1) % polygon.length]!;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.hypot(dx, dy) === 0) continue;
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const naturalNormalX = -dy;
    const naturalNormalY = dx;
    const outwardX = midX - centroid.x;
    const outwardY = midY - centroid.y;
    const dot = naturalNormalX * outwardX + naturalNormalY * outwardY;
    const offsetMm = dot >= 0 ? EDGE_DIM_OFFSET_MM : -EDGE_DIM_OFFSET_MM;
    dimensions.push({
      id: `${source.id}:edge:${i}`,
      start: { x: start.x, y: start.y },
      end: { x: end.x, y: end.y },
      offsetMm,
    });
  }
  return dimensions;
}

export function buildSelectionDimensions(
  items: ReadonlyArray<PlanSelectionDimensionSource>,
  activeFamily?: ActiveObjectFamily | null,
): PlanDimension[] {
  if (activeFamily) {
    const editPolygon = pickPrimaryEditPolygon(items, activeFamily);
    if (editPolygon) {
      const edgeDims = buildEdgeDimensions({ id: editPolygon.id, polygon: editPolygon.polygon });
      if (edgeDims.length > 0) return edgeDims;
    }
  }
  return buildBoundingBoxDimensions(items);
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
