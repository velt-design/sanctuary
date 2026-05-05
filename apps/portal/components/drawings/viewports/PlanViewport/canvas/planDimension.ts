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
const SLICE_X_OFFSET_MM = -350;
const SLICE_Y_OFFSET_MM = 350;
const TOTAL_OFFSET_DELTA_MM = 350;
const RECTILINEAR_TOLERANCE_DEG = 5;
const MERGED_HALO_DEDUPE_TOLERANCE_MM = 1;
const MERGED_HALO_MAX_SLICES_PER_AXIS = 8;

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

export function isRectilinearPolygon(
  polygon: ReadonlyArray<PlanDimensionPoint>,
  toleranceDeg = RECTILINEAR_TOLERANCE_DEG,
): boolean {
  if (polygon.length < 3) return false;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.hypot(dx, dy) === 0) continue;
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const mod90 = ((angleDeg % 90) + 90) % 90;
    const offset = Math.min(mod90, 90 - mod90);
    if (offset > toleranceDeg) return false;
  }
  return true;
}

function uniqueSortedCoords(values: ReadonlyArray<number>, toleranceMm = 0): number[] {
  if (toleranceMm <= 0) {
    const set = new Set<number>();
    for (const value of values) set.add(value);
    return Array.from(set).sort((lhs, rhs) => lhs - rhs);
  }
  const sorted = [...values].sort((lhs, rhs) => lhs - rhs);
  const out: number[] = [];
  for (const value of sorted) {
    const last = out.length > 0 ? out[out.length - 1]! : null;
    if (last === null || Math.abs(value - last) > toleranceMm) {
      out.push(value);
    }
  }
  return out;
}

function consecutivePairs(values: ReadonlyArray<number>): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < values.length - 1; i += 1) {
    pairs.push([values[i]!, values[i + 1]!]);
  }
  return pairs;
}

export function extractAxisSlices(
  polygon: ReadonlyArray<PlanDimensionPoint>,
  toleranceMm = 0,
): { xSlices: Array<[number, number]>; ySlices: Array<[number, number]> } {
  const xs = uniqueSortedCoords(polygon.map((point) => point.x), toleranceMm);
  const ys = uniqueSortedCoords(polygon.map((point) => point.y), toleranceMm);
  return { xSlices: consecutivePairs(xs), ySlices: consecutivePairs(ys) };
}

export type SidedAxisSlices = {
  top: Array<[number, number]>;
  bottom: Array<[number, number]>;
  left: Array<[number, number]>;
  right: Array<[number, number]>;
};

export function extractSidedAxisSlices(
  polygon: ReadonlyArray<PlanDimensionPoint>,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  toleranceMm = 0,
): SidedAxisSlices {
  const sideTolerance = toleranceMm > 0 ? toleranceMm : 1e-6;
  const onTop = polygon.filter((point) => Math.abs(point.y - bounds.minY) <= sideTolerance);
  const onBottom = polygon.filter((point) => Math.abs(point.y - bounds.maxY) <= sideTolerance);
  const onLeft = polygon.filter((point) => Math.abs(point.x - bounds.minX) <= sideTolerance);
  const onRight = polygon.filter((point) => Math.abs(point.x - bounds.maxX) <= sideTolerance);
  return {
    top: consecutivePairs(uniqueSortedCoords(onTop.map((point) => point.x), toleranceMm)),
    bottom: consecutivePairs(uniqueSortedCoords(onBottom.map((point) => point.x), toleranceMm)),
    left: consecutivePairs(uniqueSortedCoords(onLeft.map((point) => point.y), toleranceMm)),
    right: consecutivePairs(uniqueSortedCoords(onRight.map((point) => point.y), toleranceMm)),
  };
}

export function buildSliceDimensions(
  source: { id: string; polygon: ReadonlyArray<PlanDimensionPoint> },
  options?: { toleranceMm?: number },
): PlanDimension[] {
  const bounds = planBoundsFromPolygon(source.polygon as PlanDimensionPoint[]);
  if (!bounds) return [];
  const sided = extractSidedAxisSlices(source.polygon, bounds, options?.toleranceMm ?? 0);
  const dims: PlanDimension[] = [];
  for (const [x0, x1] of sided.top) {
    dims.push({
      id: `${source.id}:slice:x:top:${Math.round(x0)}-${Math.round(x1)}`,
      start: { x: x0, y: bounds.minY },
      end: { x: x1, y: bounds.minY },
      offsetMm: SLICE_X_OFFSET_MM,
    });
  }
  if (sided.top.length > 1) {
    dims.push({
      id: `${source.id}:total:x:top`,
      start: { x: bounds.minX, y: bounds.minY },
      end: { x: bounds.maxX, y: bounds.minY },
      offsetMm: SLICE_X_OFFSET_MM - TOTAL_OFFSET_DELTA_MM,
    });
  }
  for (const [x0, x1] of sided.bottom) {
    dims.push({
      id: `${source.id}:slice:x:bottom:${Math.round(x0)}-${Math.round(x1)}`,
      start: { x: x0, y: bounds.maxY },
      end: { x: x1, y: bounds.maxY },
      offsetMm: -SLICE_X_OFFSET_MM,
    });
  }
  if (sided.bottom.length > 1) {
    dims.push({
      id: `${source.id}:total:x:bottom`,
      start: { x: bounds.minX, y: bounds.maxY },
      end: { x: bounds.maxX, y: bounds.maxY },
      offsetMm: -SLICE_X_OFFSET_MM + TOTAL_OFFSET_DELTA_MM,
    });
  }
  for (const [y0, y1] of sided.left) {
    dims.push({
      id: `${source.id}:slice:y:left:${Math.round(y0)}-${Math.round(y1)}`,
      start: { x: bounds.minX, y: y0 },
      end: { x: bounds.minX, y: y1 },
      offsetMm: SLICE_Y_OFFSET_MM,
    });
  }
  if (sided.left.length > 1) {
    dims.push({
      id: `${source.id}:total:y:left`,
      start: { x: bounds.minX, y: bounds.minY },
      end: { x: bounds.minX, y: bounds.maxY },
      offsetMm: SLICE_Y_OFFSET_MM + TOTAL_OFFSET_DELTA_MM,
    });
  }
  for (const [y0, y1] of sided.right) {
    dims.push({
      id: `${source.id}:slice:y:right:${Math.round(y0)}-${Math.round(y1)}`,
      start: { x: bounds.maxX, y: y0 },
      end: { x: bounds.maxX, y: y1 },
      offsetMm: -SLICE_Y_OFFSET_MM,
    });
  }
  if (sided.right.length > 1) {
    dims.push({
      id: `${source.id}:total:y:right`,
      start: { x: bounds.maxX, y: bounds.minY },
      end: { x: bounds.maxX, y: bounds.maxY },
      offsetMm: -SLICE_Y_OFFSET_MM - TOTAL_OFFSET_DELTA_MM,
    });
  }
  return dims;
}

function mergedHaloVertices(
  items: ReadonlyArray<PlanSelectionDimensionSource>,
): PlanDimensionPoint[] {
  const points: PlanDimensionPoint[] = [];
  for (const item of items) {
    for (const point of item.polygon) {
      points.push({ x: point.x, y: point.y });
    }
  }
  return points;
}

function buildBboxSliceDimensions(
  source: { id: string; polygon: ReadonlyArray<PlanDimensionPoint> },
  toleranceMm: number,
): PlanDimension[] {
  const bounds = planBoundsFromPolygon(source.polygon as PlanDimensionPoint[]);
  if (!bounds) return [];
  const { xSlices, ySlices } = extractAxisSlices(source.polygon, toleranceMm);
  if (xSlices.length === 0 && ySlices.length === 0) return [];
  const dims: PlanDimension[] = [];
  for (const [x0, x1] of xSlices) {
    dims.push({
      id: `${source.id}:slice:x:top:${Math.round(x0)}-${Math.round(x1)}`,
      start: { x: x0, y: bounds.minY },
      end: { x: x1, y: bounds.minY },
      offsetMm: SLICE_X_OFFSET_MM,
    });
    dims.push({
      id: `${source.id}:slice:x:bottom:${Math.round(x0)}-${Math.round(x1)}`,
      start: { x: x0, y: bounds.maxY },
      end: { x: x1, y: bounds.maxY },
      offsetMm: -SLICE_X_OFFSET_MM,
    });
  }
  if (xSlices.length > 1) {
    dims.push({
      id: `${source.id}:total:x:top`,
      start: { x: bounds.minX, y: bounds.minY },
      end: { x: bounds.maxX, y: bounds.minY },
      offsetMm: SLICE_X_OFFSET_MM - TOTAL_OFFSET_DELTA_MM,
    });
    dims.push({
      id: `${source.id}:total:x:bottom`,
      start: { x: bounds.minX, y: bounds.maxY },
      end: { x: bounds.maxX, y: bounds.maxY },
      offsetMm: -SLICE_X_OFFSET_MM + TOTAL_OFFSET_DELTA_MM,
    });
  }
  for (const [y0, y1] of ySlices) {
    dims.push({
      id: `${source.id}:slice:y:left:${Math.round(y0)}-${Math.round(y1)}`,
      start: { x: bounds.minX, y: y0 },
      end: { x: bounds.minX, y: y1 },
      offsetMm: SLICE_Y_OFFSET_MM,
    });
    dims.push({
      id: `${source.id}:slice:y:right:${Math.round(y0)}-${Math.round(y1)}`,
      start: { x: bounds.maxX, y: y0 },
      end: { x: bounds.maxX, y: y1 },
      offsetMm: -SLICE_Y_OFFSET_MM,
    });
  }
  if (ySlices.length > 1) {
    dims.push({
      id: `${source.id}:total:y:left`,
      start: { x: bounds.minX, y: bounds.minY },
      end: { x: bounds.minX, y: bounds.maxY },
      offsetMm: SLICE_Y_OFFSET_MM + TOTAL_OFFSET_DELTA_MM,
    });
    dims.push({
      id: `${source.id}:total:y:right`,
      start: { x: bounds.maxX, y: bounds.minY },
      end: { x: bounds.maxX, y: bounds.maxY },
      offsetMm: -SLICE_Y_OFFSET_MM - TOTAL_OFFSET_DELTA_MM,
    });
  }
  return dims;
}

function tryMergedHaloSliceDimensions(
  items: ReadonlyArray<PlanSelectionDimensionSource>,
): PlanDimension[] | null {
  const polygon = mergedHaloVertices(items);
  if (polygon.length === 0) return null;
  const { xSlices, ySlices } = extractAxisSlices(polygon, MERGED_HALO_DEDUPE_TOLERANCE_MM);
  if (xSlices.length === 0 && ySlices.length === 0) return null;
  if (
    xSlices.length > MERGED_HALO_MAX_SLICES_PER_AXIS ||
    ySlices.length > MERGED_HALO_MAX_SLICES_PER_AXIS
  ) {
    return null;
  }
  const dims = buildBboxSliceDimensions({ id: 'selection-merged', polygon }, MERGED_HALO_DEDUPE_TOLERANCE_MM);
  return dims.length > 0 ? dims : null;
}

export function buildSelectionDimensions(
  items: ReadonlyArray<PlanSelectionDimensionSource>,
  activeFamily?: ActiveObjectFamily | null,
): PlanDimension[] {
  if (activeFamily) {
    const editPolygon = pickPrimaryEditPolygon(items, activeFamily);
    if (editPolygon) {
      if (isRectilinearPolygon(editPolygon.polygon)) {
        const sliceDims = buildSliceDimensions({ id: editPolygon.id, polygon: editPolygon.polygon });
        if (sliceDims.length > 0) return sliceDims;
      }
      const edgeDims = buildEdgeDimensions({ id: editPolygon.id, polygon: editPolygon.polygon });
      if (edgeDims.length > 0) return edgeDims;
    }
    const mergedDims = tryMergedHaloSliceDimensions(items);
    if (mergedDims) return mergedDims;
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
