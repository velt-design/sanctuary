import type {
  GeometryMetadata,
  HouseRoofFeature3D,
  HouseRoofFeatureKind,
  Line3,
  Point3,
  Polygon3,
  RoofPlane3D,
  Vector3,
} from '../contracts';
import { crossProduct, lineLength } from '../math3d';

export type RoofPoint2 = {
  x: number;
  y: number;
};

export type BentSpineTerminalGableClosure = {
  edgeIndex: number;
  sourceEdgeId: string;
  nodePoint: Point3;
  point: Point3;
  axis: 'x' | 'y';
};

export type HouseRoofBuildResult = {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  terminalClosures?: BentSpineTerminalGableClosure[];
  metadata: GeometryMetadata;
};

export type HouseRoofPerimeterEdgeKind =
  | 'drain_eave'
  | 'weather_flashed_edge'
  | 'house_apron_edge';

export type HouseRoofPerimeterFlashingRole =
  | 'high_side'
  | 'rake'
  | 'house_apron';

export type HouseRoofPerimeterEdge = {
  index: number;
  sourceEdgeId: string;
  edgeKind: HouseRoofPerimeterEdgeKind;
  perimeterId: string;
  perimeterPolygon: Polygon3;
  wallStart: Point3;
  wallEnd: Point3;
  eaveStart: Point3;
  eaveEnd: Point3;
  roofStart: Point3;
  roofEnd: Point3;
  sourceRoofPlaneId?: string | null;
  flashingRole?: HouseRoofPerimeterFlashingRole | null;
};

export type HouseRoofPerimeterPolygon = {
  boundary: Polygon3;
  sourceEdgeId: string;
  edgeKind: HouseRoofPerimeterEdgeKind;
  flashingRole?: HouseRoofPerimeterFlashingRole | null;
  sourceRoofPlaneId?: string | null;
  houseRoofSoffitMode?: 'horizontal' | 'sloped_underroof' | null;
};

export type HouseRoofPerimeterLine = {
  line: Line3;
  sourceEdgeId: string;
  edgeKind: HouseRoofPerimeterEdgeKind;
  sourceRoofPlaneId?: string | null;
  flashingRole?: HouseRoofPerimeterFlashingRole | null;
};

export type JoinedRoofEdge = {
  index: number;
  id: string;
  start: Point3;
  end: Point3;
  inwardNormal: { x: number; y: number };
  lengthMm: number;
  ridgeAxis: 'x' | 'y';
};

export type JoinedRoofRegion = {
  edge: JoinedRoofEdge;
  footprint: RoofPoint2[];
};

export type JoinedRoofWavefrontSegment = {
  edge: JoinedRoofEdge;
  start: RoofPoint2;
  end: RoofPoint2;
};

export type JoinedRoofWavefrontLoop = {
  segments: JoinedRoofWavefrontSegment[];
};

export type JoinedRoofWavefrontResult = {
  regions: JoinedRoofRegion[];
  metadata: GeometryMetadata;
  failureReason: string | null;
};

export type JoinedRoofFacet = {
  edge: JoinedRoofEdge;
  footprint: RoofPoint2[];
  boundary: Polygon3;
};

export type JoinedRoofFeatureDraft = {
  kind: HouseRoofFeatureKind;
  line: Line3;
  sourceEdgeIds: string[];
  roofFeatureSource: 'facet_adjacency' | 'reentrant_fallback';
};

export type JoinedRoofFacetBuildResult = {
  facets: JoinedRoofFacet[];
  metadata: GeometryMetadata;
};

export function point(x: number, y: number, z: number): Point3 {
  return { x, y, z };
}

export function line(start: Point3, end: Point3): Line3 {
  return { start, end };
}

export function swapPointAxes(candidate: Point3): Point3 {
  return { x: candidate.y, y: candidate.x, z: candidate.z };
}

export function swapVectorAxes(candidate: Vector3): Vector3 {
  return { x: candidate.y, y: candidate.x, z: candidate.z };
}

export function reflectPointAcrossX(input: { candidate: Point3; centerX: number }): Point3 {
  return {
    x: input.centerX * 2 - input.candidate.x,
    y: input.candidate.y,
    z: input.candidate.z,
  };
}

export function reflectVectorAcrossX(candidate: Vector3): Vector3 {
  return { x: -candidate.x, y: candidate.y, z: candidate.z };
}

export function finiteNumber(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function positiveNumber(value: number | null | undefined, fallback: number): number {
  return Math.max(0, finiteNumber(value, fallback));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function midpoint2(line3: Line3): { x: number; y: number } {
  return {
    x: (line3.start.x + line3.end.x) / 2,
    y: (line3.start.y + line3.end.y) / 2,
  };
}

export function distanceSquared2(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

export function boundingBox(footprint: Polygon3): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  return footprint.reduce(
    (box, item) => ({
      minX: Math.min(box.minX, item.x),
      maxX: Math.max(box.maxX, item.x),
      minY: Math.min(box.minY, item.y),
      maxY: Math.max(box.maxY, item.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
}

export function axisRange(
  polygon: Polygon3,
  axis: 'x' | 'y',
): { min: number; max: number; span: number } {
  const values = polygon.map((candidate) => (axis === 'x' ? candidate.x : candidate.y));
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, span: Math.max(0, max - min) };
}

export function rectangleCornersFromBox(box: {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}): { minXMinY: Point3; maxXMinY: Point3; maxXMaxY: Point3; minXMaxY: Point3 } {
  return {
    minXMinY: point(box.minX, box.minY, 0),
    maxXMinY: point(box.maxX, box.minY, 0),
    maxXMaxY: point(box.maxX, box.maxY, 0),
    minXMaxY: point(box.minX, box.maxY, 0),
  };
}

export function lineIntersectionT2D(
  start: Point3,
  end: Point3,
  otherStart: Point3,
  otherEnd: Point3,
): number | null {
  const rX = end.x - start.x;
  const rY = end.y - start.y;
  const sX = otherEnd.x - otherStart.x;
  const sY = otherEnd.y - otherStart.y;
  const denominator = rX * sY - rY * sX;
  if (Math.abs(denominator) <= 1e-6) return null;
  const qpx = otherStart.x - start.x;
  const qpy = otherStart.y - start.y;
  const t = (qpx * sY - qpy * sX) / denominator;
  const u = (qpx * rY - qpy * rX) / denominator;
  if (t <= 1e-6 || t >= 1 - 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null;
  return t;
}

export function signedAreaXY(polygon: Polygon3): number {
  return polygon.reduce((sum, current, index) => {
    const next = polygon[(index + 1) % polygon.length]!;
    return sum + current.x * next.y - next.x * current.y;
  }, 0) / 2;
}

export function lineIntersection2(
  a1: Point3,
  a2: Point3,
  b1: Point3,
  b2: Point3,
): { x: number; y: number } | null {
  const daX = a2.x - a1.x;
  const daY = a2.y - a1.y;
  const dbX = b2.x - b1.x;
  const dbY = b2.y - b1.y;
  const denominator = daX * dbY - daY * dbX;
  if (Math.abs(denominator) <= 1e-6) return null;
  const t = ((b1.x - a1.x) * dbY - (b1.y - a1.y) * dbX) / denominator;
  return {
    x: a1.x + daX * t,
    y: a1.y + daY * t,
  };
}

export function pointInPolygon2D(candidate: { x: number; y: number }, polygon: Polygon3): boolean {
  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index]!;
    const previous = polygon[previousIndex]!;
    const intersects =
      current.y > candidate.y !== previous.y > candidate.y &&
      candidate.x < ((previous.x - current.x) * (candidate.y - current.y)) / (previous.y - current.y || 1) + current.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function distanceToSegment2D(candidate: { x: number; y: number }, start: Point3, end: Point3): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-6) return Math.hypot(candidate.x - start.x, candidate.y - start.y);
  const ratio = clamp(((candidate.x - start.x) * dx + (candidate.y - start.y) * dy) / lengthSq, 0, 1);
  const x = start.x + dx * ratio;
  const y = start.y + dy * ratio;
  return Math.hypot(candidate.x - x, candidate.y - y);
}

export function polygonCentroid2D(polygon: Polygon3): { x: number; y: number } {
  const area = signedAreaXY(polygon);
  if (Math.abs(area) <= 1e-6) {
    const box = boundingBox(polygon);
    return { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  }
  let cx = 0;
  let cy = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    const cross = current.x * next.y - next.x * current.y;
    cx += (current.x + next.x) * cross;
    cy += (current.y + next.y) * cross;
  }
  const divisor = 6 * area;
  return { x: cx / divisor, y: cy / divisor };
}

export function uniqueSorted(values: number[]): number[] {
  return [...new Set(values.map((value) => Number(value.toFixed(6))))].sort((a, b) => a - b);
}

export function finiteVectorLength(source: Vector3): number {
  return Math.hypot(source.x, source.y, source.z);
}

export function translatePointByVector(source: Point3, delta: Vector3): Point3 {
  return point(source.x + delta.x, source.y + delta.y, source.z + delta.z);
}

export function negateVector(source: Vector3): Vector3 {
  return { x: -source.x, y: -source.y, z: -source.z };
}

export function pointOnRoofSegment2D(candidate: Point3, start: Point3, end: Point3): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const cross = (candidate.x - start.x) * dy - (candidate.y - start.y) * dx;
  if (Math.abs(cross) > 1e-2) return false;
  const dot = (candidate.x - start.x) * dx + (candidate.y - start.y) * dy;
  if (dot < -1e-2) return false;
  const lengthSq = dx * dx + dy * dy;
  return dot <= lengthSq + 1e-2;
}

export function edgeOutwardVector(polygon: Polygon3, index: number): Vector3 {
  const start = polygon[index]!;
  const end = polygon[(index + 1) % polygon.length]!;
  const length = lineLength(line(start, end));
  if (length <= 1e-6) return { x: 0, y: 0, z: 0 };
  const unitX = (end.x - start.x) / length;
  const unitY = (end.y - start.y) / length;
  return signedAreaXY(polygon) >= 0
    ? { x: unitY, y: -unitX, z: 0 }
    : { x: -unitY, y: unitX, z: 0 };
}

export function miterCornerPoint(
  previous: { start: Point3; end: Point3 },
  current: { start: Point3; end: Point3 },
): Point3 | null {
  const intersection = lineIntersection2(previous.start, previous.end, current.start, current.end);
  if (intersection) return point(intersection.x, intersection.y, 0);
  return distanceSquared2(previous.end, current.start) <= 1e-6 ? current.start : null;
}

export function finiteRoofQaPoint(candidate: Point3): boolean {
  return Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && Number.isFinite(candidate.z);
}

export function polygonArea3D(points: Polygon3): number {
  if (points.length < 3) return 0;
  const areaVector = points.reduce<Vector3>(
    (sum, current, index) => {
      const next = points[(index + 1) % points.length]!;
      const cross = crossProduct(current, next);
      return {
        x: sum.x + cross.x,
        y: sum.y + cross.y,
        z: sum.z + cross.z,
      };
    },
    { x: 0, y: 0, z: 0 },
  );
  return finiteVectorLength(areaVector) / 2;
}
