import type {
  AttachmentSide,
  DatumFrame3,
  GeometryConfig,
  GeometryMetadata,
  HouseDeck3D,
  HouseOpening3D,
  HouseAttachmentStrategy,
  HouseAttachmentTarget3D,
  HouseModel3D,
  HouseRoofAppendageForm,
  HouseReferenceGeometry,
  HouseRoofFeature3D,
  HouseRoofFeatureKind,
  HouseRoofForm,
  HouseRoofMaterial,
  HouseRoofMaterialProfileKind,
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
  HouseRoofMaterialVisual3D,
  HouseWallSegment3D,
  Line3,
  Plane3,
  Point3,
  Polygon3,
  RenderMesh3D,
  RoofFlashing3D,
  RoofPlane3D,
  Vector3,
} from './contracts';
import { validateHouseRoofSelection } from './houseRoofValidation';
import {
  crossProduct,
  dotProduct,
  lineLength,
  normalizeVector,
  planeFromOriginAxes,
  planeFromPoints,
  scaleVector,
  subtractPoints,
} from './math3d';
import { buildHouseSideAttachmentLine } from './footprints';

const WORLD_Z: Vector3 = { x: 0, y: 0, z: 1 };
const DEFAULT_EAVE_HEIGHT_MM = 2400;
const DEFAULT_ROOF_PITCH_DEG = 25;
const DEFAULT_SOFFIT_DEPTH_MM = 450;
const DEFAULT_FASCIA_HEIGHT_MM = 180;
const DEFAULT_GUTTER_WIDTH_MM = 125;
const DEFAULT_GUTTER_DEPTH_MM = 90;
const DEFAULT_GUTTER_PROJECTION_MM = 125;
const DEFAULT_EAVE_OVERHANG_MM = 450;
const DEFAULT_WALL_SOLID_THICKNESS_MM = 90;
const DEFAULT_ROOF_SOLID_THICKNESS_MM = 120;
const DEFAULT_SOFFIT_SOLID_THICKNESS_MM = 10;
const DEFAULT_FASCIA_SOLID_THICKNESS_MM = 18;
const DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_GIRTH_MM = 300;
const DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM = 150;
const DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_THICKNESS_MM = 1;
const DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_SURFACE_OFFSET_MM =
  DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_THICKNESS_MM / 2;
const DEFAULT_HOUSE_ROOF_MATERIAL: HouseRoofMaterial = 'corrugated_iron';
const DEFAULT_HOUSE_ROOF_MATERIAL_SURFACE_OFFSET_MM = 2;
const DEFAULT_DECK_SURFACE_THICKNESS_MM = 40;
const RIDGE_COLLAPSE_EPSILON_MM = 1;

type HouseGableTerminalEnd = {
  id: string;
  sourceEdgeId: string;
  label: string;
};

type HouseGableTerminalIntersection = {
  edgeIndex: number;
  nodePoint: Point3;
  point: Point3;
};

type BentSpineTerminalGableClosure = {
  edgeIndex: number;
  sourceEdgeId: string;
  nodePoint: Point3;
  point: Point3;
  axis: 'x' | 'y';
};

type HouseFootprintOpenSide = {
  bridgeEdgeIndex: number;
  direction: { x: number; y: number };
};

function point(x: number, y: number, z: number): Point3 {
  return { x, y, z };
}

function line(start: Point3, end: Point3): Line3 {
  return { start, end };
}

function swapPointAxes(candidate: Point3): Point3 {
  return { x: candidate.y, y: candidate.x, z: candidate.z };
}

function swapVectorAxes(candidate: Vector3): Vector3 {
  return { x: candidate.y, y: candidate.x, z: candidate.z };
}

function reflectPointAcrossX(input: { candidate: Point3; centerX: number }): Point3 {
  return {
    x: input.centerX * 2 - input.candidate.x,
    y: input.candidate.y,
    z: input.candidate.z,
  };
}

function reflectVectorAcrossX(candidate: Vector3): Vector3 {
  return { x: -candidate.x, y: candidate.y, z: candidate.z };
}

function finiteNumber(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function positiveNumber(value: number | null | undefined, fallback: number): number {
  return Math.max(0, finiteNumber(value, fallback));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function midpoint2(line3: Line3): { x: number; y: number } {
  return {
    x: (line3.start.x + line3.end.x) / 2,
    y: (line3.start.y + line3.end.y) / 2,
  };
}

function distanceSquared2(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function boundingBox(footprint: Polygon3): {
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

function axisRange(
  polygon: Polygon3,
  axis: 'x' | 'y',
): { min: number; max: number; span: number } {
  const values = polygon.map((candidate) => (axis === 'x' ? candidate.x : candidate.y));
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, span: Math.max(0, max - min) };
}

function rectangleCornersFromBox(box: {
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

function lineIntersectionT2D(
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

function roofPlaneHeightAtXY(roofPlane: RoofPlane3D, x: number, y: number): number | null {
  if (!pointInOrOnRoofPolygon({ x, y }, roofPlane.boundary)) return null;
  const planeEquation = roofSolidPlaneEquationFromPlane(roofPlane.plane);
  if (!planeEquation || Math.abs(planeEquation.normal.z) <= 1e-6) return null;
  return (
    planeEquation.constant -
    planeEquation.normal.x * x -
    planeEquation.normal.y * y
  ) / planeEquation.normal.z;
}

function roofPlaneEquationHeightAtXY(
  planeEquation: RoofSolidPlaneEquation,
  x: number,
  y: number,
): number | null {
  if (Math.abs(planeEquation.normal.z) <= 1e-6) return null;
  return (
    planeEquation.constant -
    planeEquation.normal.x * x -
    planeEquation.normal.y * y
  ) / planeEquation.normal.z;
}

function roofFeatureHeightAtXY(
  feature: Line3,
  x: number,
  y: number,
): number | null {
  const dx = feature.end.x - feature.start.x;
  const dy = feature.end.y - feature.start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-6) return null;
  if (!pointOnRoofSegment2D(point(x, y, 0), feature.start, feature.end)) return null;
  const useX = Math.abs(dx) >= Math.abs(dy);
  const denominator = useX ? dx : dy;
  if (Math.abs(denominator) <= 1e-6) return null;
  const t = useX ? (x - feature.start.x) / denominator : (y - feature.start.y) / denominator;
  if (t < -1e-3 || t > 1 + 1e-3) return null;
  return feature.start.z + (feature.end.z - feature.start.z) * clamp(t, 0, 1);
}

function roofHeightAtXY(input: {
  x: number;
  y: number;
  roofPlanes: RoofPlane3D[];
  fallbackZ: number;
}): number {
  let bestZ = Number.NEGATIVE_INFINITY;
  for (const roofPlane of input.roofPlanes) {
    const z = roofPlaneHeightAtXY(roofPlane, input.x, input.y);
    if (z == null) continue;
    bestZ = Math.max(bestZ, z);
  }
  return Number.isFinite(bestZ) ? bestZ : input.fallbackZ;
}

function buildWallTopProfile(input: {
  start: Point3;
  end: Point3;
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  fallbackTopZ: number;
  terminalClosurePoint?: Point3 | null;
}): Point3[] {
  const intersections = input.roofFeatures
    .map((feature) =>
      lineIntersectionT2D(
        input.start,
        input.end,
        feature.line.start,
        feature.line.end,
      ),
    )
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);
  const samples = [0, ...intersections, 1];
  if (input.terminalClosurePoint) {
    const dx = input.end.x - input.start.x;
    const dy = input.end.y - input.start.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq > ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) {
      const ratio =
        ((input.terminalClosurePoint.x - input.start.x) * dx +
          (input.terminalClosurePoint.y - input.start.y) * dy) /
        lengthSq;
      if (ratio > 1e-6 && ratio < 1 - 1e-6) {
        samples.push(ratio);
        samples.sort((left, right) => left - right);
      }
    }
  }

  return samples
    .filter((value, index, collection) => index === 0 || Math.abs(value - collection[index - 1]!) > 1e-6)
    .map((t) => {
    const x = input.start.x + (input.end.x - input.start.x) * t;
    const y = input.start.y + (input.end.y - input.start.y) * t;
    if (
      input.terminalClosurePoint &&
      Math.abs(input.terminalClosurePoint.x - x) <= 1e-6 &&
      Math.abs(input.terminalClosurePoint.y - y) <= 1e-6
    ) {
      return input.terminalClosurePoint;
    }
    const featureZ = input.roofFeatures.reduce((selected, feature) => {
      const z = roofFeatureHeightAtXY(feature.line, x, y);
      return z == null ? selected : Math.max(selected, z);
    }, Number.NEGATIVE_INFINITY);
    return point(
      x,
      y,
      Math.max(
        input.fallbackTopZ,
        Number.isFinite(featureZ) ? featureZ : Number.NEGATIVE_INFINITY,
        roofHeightAtXY({
          x,
          y,
          roofPlanes: input.roofPlanes,
          fallbackZ: input.fallbackTopZ,
        }),
      ),
    );
    });
}

function wallBoundaryHasFlatTop(boundary: Polygon3): boolean {
  if (boundary.length !== 4) return false;
  return Math.abs(boundary[2]!.z - boundary[3]!.z) <= 1e-6;
}

function buildWallSegments(
  footprint: Polygon3,
  wallHeightMm: number,
  roof?: HouseRoofBuildResult | null,
): HouseWallSegment3D[] {
  const segments: HouseWallSegment3D[] = [];
  const terminalClosureBySourceEdgeId = new Map(
    (roof?.terminalClosures ?? []).map((closure) => [closure.sourceEdgeId, closure]),
  );

  for (let index = 0; index < footprint.length; index += 1) {
    const sourceStart = footprint[index]!;
    const sourceEnd = footprint[(index + 1) % footprint.length]!;
    const groundStart = point(sourceStart.x, sourceStart.y, 0);
    const groundEnd = point(sourceEnd.x, sourceEnd.y, 0);
    const edgeLine = line(groundStart, groundEnd);
    if (lineLength(edgeLine) <= 0) continue;

    const edgeId = `footprint-edge-${index + 1}`;
    const xAxis = normalizeVector(subtractPoints(groundEnd, groundStart));
    const plane = planeFromOriginAxes(groundStart, xAxis, WORLD_Z);
    const roofForm = typeof roof?.metadata.roofForm === 'string' ? roof.metadata.roofForm : null;
    const usesRoofAlignedTop =
      (roofForm === 'mono' || roofForm === 'gable') && Boolean(roof?.roofPlanes.length);
    const terminalClosure = terminalClosureBySourceEdgeId.get(edgeId) ?? null;
    const topProfile =
      usesRoofAlignedTop
        ? buildWallTopProfile({
            start: groundStart,
            end: groundEnd,
            roofPlanes: roof?.roofPlanes ?? [],
            roofFeatures: roof?.roofFeatures ?? [],
            fallbackTopZ: wallHeightMm,
            terminalClosurePoint: terminalClosure?.point ?? null,
          })
        : [
            point(groundStart.x, groundStart.y, wallHeightMm),
            point(groundEnd.x, groundEnd.y, wallHeightMm),
          ];
    segments.push({
      id: `house-wall-${segments.length + 1}`,
      sourceEdgeId: edgeId,
      line: edgeLine,
      plane,
      boundary: [groundStart, groundEnd, ...topProfile.slice().reverse()],
      metadata:
        terminalClosure
          ? {
              houseWallClosureKind: 'terminal_gable',
              sourceRoofClosureEdgeId: terminalClosure.sourceEdgeId,
            }
          : undefined,
    });
  }

  return segments;
}

function buildRoofPlane(input: {
  id: string;
  boundary: Polygon3;
  highPoint: Point3;
  lowPoint: Point3;
  ridgeAxis: 'x' | 'y' | 'pyramid';
  pitchDeg: number;
  metadata?: Record<string, string | number | boolean | null>;
}): RoofPlane3D {
  return {
    id: input.id,
    boundary: input.boundary,
    plane: planeFromPoints(input.boundary[0]!, input.boundary[1]!, input.boundary[2]!),
    fallVector: normalizeVector(subtractPoints(input.lowPoint, input.highPoint)),
    metadata: {
      roofForm: 'hipped',
      ridgeAxis: input.ridgeAxis,
      pitchDeg: input.pitchDeg,
      ...(input.metadata ?? {}),
    },
  };
}

function signedAreaXY(polygon: Polygon3): number {
  return polygon.reduce((sum, current, index) => {
    const next = polygon[(index + 1) % polygon.length]!;
    return sum + current.x * next.y - next.x * current.y;
  }, 0) / 2;
}

function isOrthogonalFootprint(polygon: Polygon3): boolean {
  if (polygon.length < 4) return false;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    if (lineLength(line(current, next)) <= 1e-6) return false;
    if (Math.abs(current.x - next.x) > 1e-6 && Math.abs(current.y - next.y) > 1e-6) {
      return false;
    }
  }
  return Math.abs(signedAreaXY(polygon)) > 1e-6;
}

function lineIntersection2(
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

function offsetFootprintPolygon(footprint: Polygon3, offsetMm: number): Polygon3 | null {
  if (!isOrthogonalFootprint(footprint)) return null;
  const orientation = signedAreaXY(footprint) >= 0 ? 1 : -1;
  const shiftedEdges = footprint.map((current, index) => {
    const next = footprint[(index + 1) % footprint.length]!;
    const length = lineLength(line(current, next));
    const unitX = (next.x - current.x) / length;
    const unitY = (next.y - current.y) / length;
    const outward = orientation >= 0
      ? { x: unitY, y: -unitX }
      : { x: -unitY, y: unitX };
    return {
      start: point(current.x + outward.x * offsetMm, current.y + outward.y * offsetMm, 0),
      end: point(next.x + outward.x * offsetMm, next.y + outward.y * offsetMm, 0),
    };
  });

  const offset: Polygon3 = [];
  for (let index = 0; index < shiftedEdges.length; index += 1) {
    const previous = shiftedEdges[(index - 1 + shiftedEdges.length) % shiftedEdges.length]!;
    const current = shiftedEdges[index]!;
    const intersection = lineIntersection2(previous.start, previous.end, current.start, current.end);
    offset.push(intersection ? point(intersection.x, intersection.y, 0) : current.start);
  }
  return offset.every((candidate) => Number.isFinite(candidate.x) && Number.isFinite(candidate.y)) ? offset : null;
}

function pointInPolygon2D(candidate: { x: number; y: number }, polygon: Polygon3): boolean {
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

function distanceToSegment2D(candidate: { x: number; y: number }, start: Point3, end: Point3): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-6) return Math.hypot(candidate.x - start.x, candidate.y - start.y);
  const ratio = clamp(((candidate.x - start.x) * dx + (candidate.y - start.y) * dy) / lengthSq, 0, 1);
  const x = start.x + dx * ratio;
  const y = start.y + dy * ratio;
  return Math.hypot(candidate.x - x, candidate.y - y);
}

function clearanceToPolygon(candidate: { x: number; y: number }, polygon: Polygon3): number {
  let clearance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    clearance = Math.min(clearance, distanceToSegment2D(candidate, polygon[index]!, polygon[(index + 1) % polygon.length]!));
  }
  return clearance;
}

function polygonCentroid2D(polygon: Polygon3): { x: number; y: number } {
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

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values.map((value) => Number(value.toFixed(6))))].sort((a, b) => a - b);
}

function findInteriorRoofNode(polygon: Polygon3): { point: Point3; clearanceMm: number } {
  const box = boundingBox(polygon);
  const candidates: Array<{ x: number; y: number }> = [
    { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 },
    polygonCentroid2D(polygon),
  ];
  const xs = uniqueSorted([box.minX, box.maxX, ...polygon.map((candidate) => candidate.x)]);
  const ys = uniqueSorted([box.minY, box.maxY, ...polygon.map((candidate) => candidate.y)]);
  for (let xIndex = 0; xIndex < xs.length - 1; xIndex += 1) {
    for (let yIndex = 0; yIndex < ys.length - 1; yIndex += 1) {
      const x = (xs[xIndex]! + xs[xIndex + 1]!) / 2;
      const y = (ys[yIndex]! + ys[yIndex + 1]!) / 2;
      candidates.push({ x, y });
    }
  }

  let selected = candidates[0]!;
  let selectedClearance = -1;
  for (const candidate of candidates) {
    if (!pointInPolygon2D(candidate, polygon)) continue;
    const clearance = clearanceToPolygon(candidate, polygon);
    if (clearance > selectedClearance) {
      selected = candidate;
      selectedClearance = clearance;
    }
  }

  if (selectedClearance <= 0) {
    selectedClearance = Math.max(1, Math.min(box.maxX - box.minX, box.maxY - box.minY) / 4);
  }
  return { point: point(selected.x, selected.y, 0), clearanceMm: selectedClearance };
}

function polygonLineInterval(input: {
  polygon: Polygon3;
  axis: 'x' | 'y';
  coordinate: number;
  through: number;
}): { min: number; max: number } | null {
  const intersections: number[] = [];
  for (let index = 0; index < input.polygon.length; index += 1) {
    const start = input.polygon[index]!;
    const end = input.polygon[(index + 1) % input.polygon.length]!;
    if (input.axis === 'x') {
      if (Math.abs(start.y - end.y) <= 1e-6) continue;
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);
      if (input.coordinate <= minY || input.coordinate > maxY) continue;
      intersections.push(start.x);
    } else {
      if (Math.abs(start.x - end.x) <= 1e-6) continue;
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      if (input.coordinate <= minX || input.coordinate > maxX) continue;
      intersections.push(start.y);
    }
  }
  intersections.sort((a, b) => a - b);
  for (let index = 0; index < intersections.length - 1; index += 2) {
    const min = intersections[index]!;
    const max = intersections[index + 1]!;
    if (input.through >= min - 1e-6 && input.through <= max + 1e-6) {
      return { min, max };
    }
  }
  return null;
}

function closestPointOnLineSegment2D(candidate: Point3, source: Line3): Point3 {
  const dx = source.end.x - source.start.x;
  const dy = source.end.y - source.start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-6) return source.start;
  const ratio = clamp(((candidate.x - source.start.x) * dx + (candidate.y - source.start.y) * dy) / lengthSq, 0, 1);
  return point(source.start.x + dx * ratio, source.start.y + dy * ratio, source.start.z + (source.end.z - source.start.z) * ratio);
}

function isRectanglePolygon(polygon: Polygon3): boolean {
  if (polygon.length !== 4) return false;
  const box = boundingBox(polygon);
  return polygon.every((candidate) =>
    (Math.abs(candidate.x - box.minX) <= 1e-6 || Math.abs(candidate.x - box.maxX) <= 1e-6) &&
    (Math.abs(candidate.y - box.minY) <= 1e-6 || Math.abs(candidate.y - box.maxY) <= 1e-6),
  );
}

function buildRectangleRoofFeatures(input: {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  eaveHeightMm: number;
  roofPitchDeg: number;
}): HouseRoofFeature3D[] {
  const widthX = input.maxX - input.minX;
  const widthY = input.maxY - input.minY;
  const centerX = (input.minX + input.maxX) / 2;
  const centerY = (input.minY + input.maxY) / 2;
  const pitchRisePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);
  const features: HouseRoofFeature3D[] = [];
  const corners = [
    point(input.minX, input.minY, input.eaveHeightMm),
    point(input.maxX, input.minY, input.eaveHeightMm),
    point(input.maxX, input.maxY, input.eaveHeightMm),
    point(input.minX, input.maxY, input.eaveHeightMm),
  ];
  if (widthX >= widthY) {
    const halfShort = widthY / 2;
    const ridgeZ = input.eaveHeightMm + halfShort * pitchRisePerRun;
    const startX = input.minX + halfShort;
    const endX = input.maxX - halfShort;
    const start = point(startX, centerY, ridgeZ);
    const end = point(endX, centerY, ridgeZ);
    if (endX - startX > RIDGE_COLLAPSE_EPSILON_MM) {
      features.push({ id: 'house-roof-ridge-1', kind: 'ridge', line: line(start, end), metadata: { roofForm: 'hipped' } });
      for (const [index, corner] of corners.entries()) {
        const target = corner.x <= centerX ? start : end;
        features.push({ id: `house-roof-hip-${index + 1}`, kind: 'hip', line: line(corner, target), metadata: { roofForm: 'hipped' } });
      }
    } else {
      const peak = point(centerX, centerY, ridgeZ);
      for (const [index, corner] of corners.entries()) {
        features.push({ id: `house-roof-hip-${index + 1}`, kind: 'hip', line: line(corner, peak), metadata: { roofForm: 'hipped' } });
      }
    }
    return features;
  }

  const halfShort = widthX / 2;
  const ridgeZ = input.eaveHeightMm + halfShort * pitchRisePerRun;
  const startY = input.minY + halfShort;
  const endY = input.maxY - halfShort;
  const start = point(centerX, startY, ridgeZ);
  const end = point(centerX, endY, ridgeZ);
  if (endY - startY > RIDGE_COLLAPSE_EPSILON_MM) {
    features.push({ id: 'house-roof-ridge-1', kind: 'ridge', line: line(start, end), metadata: { roofForm: 'hipped' } });
    for (const [index, corner] of corners.entries()) {
      const target = corner.y <= centerY ? start : end;
      features.push({ id: `house-roof-hip-${index + 1}`, kind: 'hip', line: line(corner, target), metadata: { roofForm: 'hipped' } });
    }
  } else {
    const peak = point(centerX, centerY, ridgeZ);
    for (const [index, corner] of corners.entries()) {
      features.push({ id: `house-roof-hip-${index + 1}`, kind: 'hip', line: line(corner, peak), metadata: { roofForm: 'hipped' } });
    }
  }
  return features;
}

function buildRectangleHippedRoof(input: {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  eaveHeightMm: number;
  roofPitchDeg: number;
}): { roofPlanes: RoofPlane3D[]; roofFeatures: HouseRoofFeature3D[] } {
  const widthX = input.maxX - input.minX;
  const widthY = input.maxY - input.minY;
  const centerX = (input.minX + input.maxX) / 2;
  const centerY = (input.minY + input.maxY) / 2;
  const pitchRisePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);

  if (widthX >= widthY) {
    const halfShort = widthY / 2;
    const ridgeZ = input.eaveHeightMm + halfShort * pitchRisePerRun;
    const ridgeStartX = input.minX + halfShort;
    const ridgeEndX = input.maxX - halfShort;
    const ridgeAxis: 'x' | 'pyramid' =
      ridgeEndX - ridgeStartX <= RIDGE_COLLAPSE_EPSILON_MM ? 'pyramid' : 'x';
    const highMin = point(ridgeStartX, centerY, ridgeZ);
    const highMax = point(ridgeEndX, centerY, ridgeZ);
    const highMid = point(centerX, centerY, ridgeZ);
    const minYMid = point(centerX, input.minY, input.eaveHeightMm);
    const maxYMid = point(centerX, input.maxY, input.eaveHeightMm);
    const minXMid = point(input.minX, centerY, input.eaveHeightMm);
    const maxXMid = point(input.maxX, centerY, input.eaveHeightMm);

    return {
      roofPlanes: [
        buildRoofPlane({
          id: 'house-roof-min-y',
          boundary:
            ridgeAxis === 'pyramid'
              ? [
                  point(input.minX, input.minY, input.eaveHeightMm),
                  point(input.maxX, input.minY, input.eaveHeightMm),
                  highMid,
                ]
              : [
                  point(input.minX, input.minY, input.eaveHeightMm),
                  point(input.maxX, input.minY, input.eaveHeightMm),
                  highMax,
                  highMin,
                ],
          highPoint: highMid,
          lowPoint: minYMid,
          ridgeAxis,
          pitchDeg: input.roofPitchDeg,
        }),
        buildRoofPlane({
          id: 'house-roof-max-y',
          boundary:
            ridgeAxis === 'pyramid'
              ? [
                  point(input.maxX, input.maxY, input.eaveHeightMm),
                  point(input.minX, input.maxY, input.eaveHeightMm),
                  highMid,
                ]
              : [
                  point(input.maxX, input.maxY, input.eaveHeightMm),
                  point(input.minX, input.maxY, input.eaveHeightMm),
                  highMin,
                  highMax,
                ],
          highPoint: highMid,
          lowPoint: maxYMid,
          ridgeAxis,
          pitchDeg: input.roofPitchDeg,
        }),
        buildRoofPlane({
          id: 'house-roof-min-x',
          boundary: [
            point(input.minX, input.maxY, input.eaveHeightMm),
            point(input.minX, input.minY, input.eaveHeightMm),
            ridgeAxis === 'pyramid' ? highMid : highMin,
          ],
          highPoint: ridgeAxis === 'pyramid' ? highMid : highMin,
          lowPoint: minXMid,
          ridgeAxis,
          pitchDeg: input.roofPitchDeg,
        }),
        buildRoofPlane({
          id: 'house-roof-max-x',
          boundary: [
            point(input.maxX, input.minY, input.eaveHeightMm),
            point(input.maxX, input.maxY, input.eaveHeightMm),
            ridgeAxis === 'pyramid' ? highMid : highMax,
          ],
          highPoint: ridgeAxis === 'pyramid' ? highMid : highMax,
          lowPoint: maxXMid,
          ridgeAxis,
          pitchDeg: input.roofPitchDeg,
        }),
      ],
      roofFeatures: buildRectangleRoofFeatures(input),
    };
  }

  const halfShort = widthX / 2;
  const ridgeZ = input.eaveHeightMm + halfShort * pitchRisePerRun;
  const ridgeStartY = input.minY + halfShort;
  const ridgeEndY = input.maxY - halfShort;
  const ridgeAxis: 'y' | 'pyramid' =
    ridgeEndY - ridgeStartY <= RIDGE_COLLAPSE_EPSILON_MM ? 'pyramid' : 'y';
  const highMin = point(centerX, ridgeStartY, ridgeZ);
  const highMax = point(centerX, ridgeEndY, ridgeZ);
  const highMid = point(centerX, centerY, ridgeZ);
  const minYMid = point(centerX, input.minY, input.eaveHeightMm);
  const maxYMid = point(centerX, input.maxY, input.eaveHeightMm);
  const minXMid = point(input.minX, centerY, input.eaveHeightMm);
  const maxXMid = point(input.maxX, centerY, input.eaveHeightMm);

  return {
    roofPlanes: [
      buildRoofPlane({
        id: 'house-roof-min-y',
        boundary: [
          point(input.maxX, input.minY, input.eaveHeightMm),
          point(input.minX, input.minY, input.eaveHeightMm),
          ridgeAxis === 'pyramid' ? highMid : highMin,
        ],
        highPoint: ridgeAxis === 'pyramid' ? highMid : highMin,
        lowPoint: minYMid,
        ridgeAxis,
        pitchDeg: input.roofPitchDeg,
      }),
      buildRoofPlane({
        id: 'house-roof-max-y',
        boundary: [
          point(input.minX, input.maxY, input.eaveHeightMm),
          point(input.maxX, input.maxY, input.eaveHeightMm),
          ridgeAxis === 'pyramid' ? highMid : highMax,
        ],
        highPoint: ridgeAxis === 'pyramid' ? highMid : highMax,
        lowPoint: maxYMid,
        ridgeAxis,
        pitchDeg: input.roofPitchDeg,
      }),
      buildRoofPlane({
        id: 'house-roof-min-x',
        boundary:
          ridgeAxis === 'pyramid'
            ? [
                point(input.minX, input.maxY, input.eaveHeightMm),
                point(input.minX, input.minY, input.eaveHeightMm),
                highMid,
              ]
            : [
                point(input.minX, input.maxY, input.eaveHeightMm),
                point(input.minX, input.minY, input.eaveHeightMm),
                highMin,
                highMax,
              ],
        highPoint: highMid,
        lowPoint: minXMid,
        ridgeAxis,
        pitchDeg: input.roofPitchDeg,
      }),
      buildRoofPlane({
        id: 'house-roof-max-x',
        boundary:
          ridgeAxis === 'pyramid'
            ? [
                point(input.maxX, input.minY, input.eaveHeightMm),
                point(input.maxX, input.maxY, input.eaveHeightMm),
                highMid,
              ]
            : [
                point(input.maxX, input.minY, input.eaveHeightMm),
                point(input.maxX, input.maxY, input.eaveHeightMm),
                highMax,
                highMin,
              ],
        highPoint: highMid,
        lowPoint: maxXMid,
        ridgeAxis,
        pitchDeg: input.roofPitchDeg,
      }),
    ],
    roofFeatures: buildRectangleRoofFeatures(input),
  };
}

function monoPerimeterProjection(edge: HouseRoofPerimeterEdge, fallAxisXY: Vector3): number {
  const midpointX = (edge.roofStart.x + edge.roofEnd.x) / 2;
  const midpointY = (edge.roofStart.y + edge.roofEnd.y) / 2;
  return midpointX * fallAxisXY.x + midpointY * fallAxisXY.y;
}

function monoPerimeterAlignment(edge: HouseRoofPerimeterEdge, axisXY: Vector3): number {
  const edgeVector = normalizeVector({
    x: edge.roofEnd.x - edge.roofStart.x,
    y: edge.roofEnd.y - edge.roofStart.y,
    z: 0,
  });
  return Math.abs(dotProduct(edgeVector, axisXY));
}

function monoWeatherFlashingRole(
  edge: HouseRoofPerimeterEdge,
  fallAxisXY: Vector3,
): HouseRoofPerimeterFlashingRole {
  const acrossAxisXY = normalizeVector({ x: -fallAxisXY.y, y: fallAxisXY.x, z: 0 });
  return monoPerimeterAlignment(edge, acrossAxisXY) >= monoPerimeterAlignment(edge, fallAxisXY)
    ? 'high_side'
    : 'rake';
}

function samePoint3WithinTolerance(left: Point3, right: Point3, toleranceMm = 1e-3): boolean {
  return (
    Math.abs(left.x - right.x) <= toleranceMm &&
    Math.abs(left.y - right.y) <= toleranceMm &&
    Math.abs(left.z - right.z) <= toleranceMm
  );
}

function pointOnSegment2D(candidate: Point3, start: Point3, end: Point3, toleranceMm = 1e-3): boolean {
  const segment = { x: end.x - start.x, y: end.y - start.y };
  const offset = { x: candidate.x - start.x, y: candidate.y - start.y };
  const segmentLengthSq = segment.x * segment.x + segment.y * segment.y;
  if (segmentLengthSq <= toleranceMm * toleranceMm) return false;
  const cross = segment.x * offset.y - segment.y * offset.x;
  if (Math.abs(cross) > toleranceMm * Math.sqrt(segmentLengthSq)) return false;
  const projection = offset.x * segment.x + offset.y * segment.y;
  return projection >= -toleranceMm && projection <= segmentLengthSq + toleranceMm;
}

function roofPlanePerimeterOverlapSegment(
  roofPlane: RoofPlane3D,
  edge: HouseRoofPerimeterEdge,
): Line3 | null {
  const edgeDirection = normalizeVector(subtractPoints(edge.roofEnd, edge.roofStart));
  for (let index = 0; index < roofPlane.boundary.length; index += 1) {
    const start = roofPlane.boundary[index]!;
    const end = roofPlane.boundary[(index + 1) % roofPlane.boundary.length]!;
    if (!pointOnSegment2D(start, edge.roofStart, edge.roofEnd)) continue;
    if (!pointOnSegment2D(end, edge.roofStart, edge.roofEnd)) continue;
    if (lineLength(line(start, end)) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) continue;
    const segmentDirection = normalizeVector(subtractPoints(end, start));
    return dotProduct(segmentDirection, edgeDirection) >= 0
      ? line(start, end)
      : line(end, start);
  }
  return null;
}

function roofPlaneTouchesPerimeterEdge(roofPlane: RoofPlane3D, edge: HouseRoofPerimeterEdge): boolean {
  return roofPlanePerimeterOverlapSegment(roofPlane, edge) !== null;
}

const DRAIN_EDGE_MIN_PROJECTION = 0.25;
const DRAIN_EDGE_LOW_Z_TOLERANCE_MM = 1;

function edgeDrainProjection(edge: HouseRoofPerimeterEdge, roofPlane: RoofPlane3D): number {
  const outward = edgeOutwardVector(edge.perimeterPolygon, edge.index);
  const fallAxisXY = normalizeVector({
    x: roofPlane.fallVector.x,
    y: roofPlane.fallVector.y,
    z: 0,
  });
  if (finiteVectorLength(fallAxisXY) <= ROOF_JOIN_EPSILON_MM) return Number.NEGATIVE_INFINITY;
  return dotProduct(fallAxisXY, outward);
}

function roofPlaneBoundaryMinZ(roofPlane: RoofPlane3D): number {
  return roofPlane.boundary.reduce((selected, candidate) => Math.min(selected, candidate.z), Number.POSITIVE_INFINITY);
}

function roofPlaneOverlapIsLowDrainEdge(
  edge: HouseRoofPerimeterEdge,
  roofPlane: RoofPlane3D,
  overlapSegment: Line3,
): boolean {
  const drainProjection = edgeDrainProjection(edge, roofPlane);
  if (drainProjection < DRAIN_EDGE_MIN_PROJECTION) return false;
  const minBoundaryZ = roofPlaneBoundaryMinZ(roofPlane);
  return (
    Math.abs(overlapSegment.start.z - minBoundaryZ) <= DRAIN_EDGE_LOW_Z_TOLERANCE_MM &&
    Math.abs(overlapSegment.end.z - minBoundaryZ) <= DRAIN_EDGE_LOW_Z_TOLERANCE_MM
  );
}

function classifyHousePerimeterEdges(input: {
  edges: HouseRoofPerimeterEdge[];
  joinSourceEdgeId?: string | null;
  roofForm: HouseRoofForm;
  roofPlanes: RoofPlane3D[];
}): HouseRoofPerimeterEdge[] {
  return input.edges.map((edge) => {
    const adjacentRoofPlanes = input.roofPlanes.flatMap((roofPlane) => {
      const overlapSegment = roofPlanePerimeterOverlapSegment(roofPlane, edge);
      if (!overlapSegment) return [];
      const drainProjection = edgeDrainProjection(edge, roofPlane);
      return [{
        roofPlane,
        overlapSegment,
        drainProjection,
        lowDrainEdge: roofPlaneOverlapIsLowDrainEdge(edge, roofPlane, overlapSegment),
      }];
    });
    const drainingAdjacentRoofPlanes = adjacentRoofPlanes.filter((candidate) => candidate.lowDrainEdge);
    const primaryAdjacentRoofPlane =
      (drainingAdjacentRoofPlanes.length > 0 ? drainingAdjacentRoofPlanes : adjacentRoofPlanes).length === 0
        ? null
        : (drainingAdjacentRoofPlanes.length > 0 ? drainingAdjacentRoofPlanes : adjacentRoofPlanes).reduce<{
            roofPlane: RoofPlane3D;
            drainProjection: number;
          } | null>((selected, candidate) => {
            if (!selected) return candidate;
            if (drainingAdjacentRoofPlanes.length > 0) {
              return candidate.drainProjection > selected.drainProjection ? candidate : selected;
            }
            return Math.abs(candidate.drainProjection) > Math.abs(selected.drainProjection)
              ? candidate
              : selected;
          }, null);
    const maxDrainProjection = adjacentRoofPlanes.reduce(
      (selected, candidate) => Math.max(selected, candidate.drainProjection),
      Number.NEGATIVE_INFINITY,
    );
    const minDrainProjection = adjacentRoofPlanes.reduce(
      (selected, candidate) => Math.min(selected, candidate.drainProjection),
      Number.POSITIVE_INFINITY,
    );

    if (edge.sourceEdgeId === input.joinSourceEdgeId) {
      return {
        ...edge,
        edgeKind: 'house_apron_edge',
        sourceRoofPlaneId: primaryAdjacentRoofPlane?.roofPlane.id ?? edge.sourceRoofPlaneId ?? null,
        flashingRole: 'house_apron',
      };
    }
    if (drainingAdjacentRoofPlanes.length > 0) {
      return {
        ...edge,
        edgeKind: 'drain_eave',
        sourceRoofPlaneId: primaryAdjacentRoofPlane?.roofPlane.id ?? edge.sourceRoofPlaneId ?? null,
        flashingRole: null,
      };
    }
    return {
      ...edge,
      edgeKind: 'weather_flashed_edge',
      sourceRoofPlaneId: primaryAdjacentRoofPlane?.roofPlane.id ?? edge.sourceRoofPlaneId ?? null,
      flashingRole:
        input.roofForm === 'mono' && minDrainProjection <= -DRAIN_EDGE_MIN_PROJECTION
          ? 'high_side'
          : 'rake',
    };
  });
}

function buildHouseRoofPerimeterEdges(input: {
  footprint: Polygon3;
  eavePolygon: Polygon3;
  roofForm: HouseRoofForm;
  roofPlanes: RoofPlane3D[];
  eaveHeightMm: number;
  attachmentTarget: HouseAttachmentTarget3D;
}): HouseRoofPerimeterEdge[] {
  if (input.footprint.length !== input.eavePolygon.length) return [];

  const monoRoofPlane = input.roofForm === 'mono' && input.roofPlanes.length > 0 ? input.roofPlanes[0]! : null;
  const monoRoofPlaneEquation = monoRoofPlane
    ? roofSolidPlaneEquationFromPlane(monoRoofPlane.plane)
    : null;
  const baseEdges = input.footprint.map((wallStart, index) => {
    const wallEnd = input.footprint[(index + 1) % input.footprint.length]!;
    const eaveStartXY = input.eavePolygon[index]!;
    const eaveEndXY = input.eavePolygon[(index + 1) % input.eavePolygon.length]!;
    const sourceEdgeId = `footprint-edge-${index + 1}`;
    const roofStartZ =
      monoRoofPlaneEquation
        ? roofPlaneEquationHeightAtXY(monoRoofPlaneEquation, eaveStartXY.x, eaveStartXY.y) ?? input.eaveHeightMm
        : input.eaveHeightMm;
    const roofEndZ =
      monoRoofPlaneEquation
        ? roofPlaneEquationHeightAtXY(monoRoofPlaneEquation, eaveEndXY.x, eaveEndXY.y) ?? input.eaveHeightMm
        : input.eaveHeightMm;
    const roofStart = point(eaveStartXY.x, eaveStartXY.y, roofStartZ);
    const roofEnd = point(eaveEndXY.x, eaveEndXY.y, roofEndZ);

    return {
      index,
      sourceEdgeId,
      edgeKind: 'drain_eave',
      perimeterId: 'house-main-roof',
      perimeterPolygon: input.eavePolygon,
      wallStart,
      wallEnd,
      eaveStart: roofStart,
      eaveEnd: roofEnd,
      roofStart,
      roofEnd,
      sourceRoofPlaneId: monoRoofPlane?.id ?? null,
      flashingRole: null,
    };
  });

  return classifyHousePerimeterEdges({
    edges: baseEdges,
    joinSourceEdgeId: input.attachmentTarget.sourceEdgeId,
    roofForm: input.roofForm,
    roofPlanes: input.roofPlanes,
  });
}

function buildMonoAppendagePerimeterEdges(input: {
  roofPlane: RoofPlane3D;
}): HouseRoofPerimeterEdge[] {
  const boundary = input.roofPlane.boundary;
  if (boundary.length < 4) return [];

  const baseEdges = boundary.map((roofStart, index) => {
    const roofEnd = boundary[(index + 1) % boundary.length]!;
    const oppositeStart = boundary[(index + 3) % boundary.length]!;
    const oppositeEnd = boundary[(index + 2) % boundary.length]!;
    return {
      index,
      sourceEdgeId: `${input.roofPlane.id}-edge-${index + 1}`,
      edgeKind: 'drain_eave' as HouseRoofPerimeterEdgeKind,
      perimeterId: input.roofPlane.id,
      perimeterPolygon: boundary,
      wallStart: oppositeStart,
      wallEnd: oppositeEnd,
      eaveStart: roofStart,
      eaveEnd: roofEnd,
      roofStart,
      roofEnd,
      sourceRoofPlaneId: input.roofPlane.id,
      flashingRole: null,
    };
  });

  return classifyHousePerimeterEdges({
    edges: baseEdges,
    joinSourceEdgeId: null,
    roofForm: 'mono',
    roofPlanes: [input.roofPlane],
  });
}

function buildAppendagePerimeterEdges(input: {
  roofForm: HouseRoofForm;
  roofPlanes: RoofPlane3D[];
}): HouseRoofPerimeterEdge[] {
  if (input.roofForm !== 'mono') return [];
  return input.roofPlanes.flatMap((roofPlane) =>
    roofPlane.metadata?.roofGeometry === 'appendage_band'
      ? buildMonoAppendagePerimeterEdges({ roofPlane })
      : [],
  );
}

function buildPerimeterOffsetStripFootprints(input: {
  edges: HouseRoofPerimeterEdge[];
  outerOffsetMm: number;
  innerOffsetMm: number;
}): HouseRoofPerimeterPolygon[] {
  if (
    input.edges.length === 0 ||
    !Number.isFinite(input.outerOffsetMm) ||
    !Number.isFinite(input.innerOffsetMm) ||
    Math.abs(input.outerOffsetMm - input.innerOffsetMm) <= 1e-6
  ) {
    return [];
  }

  const edgesByPerimeter = new Map<string, HouseRoofPerimeterEdge[]>();
  for (const edge of input.edges) {
    const collection = edgesByPerimeter.get(edge.perimeterId) ?? [];
    collection.push(edge);
    edgesByPerimeter.set(edge.perimeterId, collection);
  }

  return [...edgesByPerimeter.values()].flatMap((group) => {
    const orderedEdges = [...group].sort((a, b) => a.index - b.index);
    const sourcePolygon = orderedEdges[0]?.perimeterPolygon;
    if (!sourcePolygon || orderedEdges.length !== sourcePolygon.length) return [];

    const exposedEdges = orderedEdges.filter((edge) => isEavePackageEdge(edge.edgeKind));
    const exposedIndexes = new Set(exposedEdges.map((edge) => edge.index));
    const shifted = orderedEdges.map((edge) => {
      const outward = edgeOutwardVector(sourcePolygon, edge.index);
      return {
        edge,
        outer: {
          start: point(
            edge.eaveStart.x + outward.x * input.outerOffsetMm,
            edge.eaveStart.y + outward.y * input.outerOffsetMm,
            0,
          ),
          end: point(
            edge.eaveEnd.x + outward.x * input.outerOffsetMm,
            edge.eaveEnd.y + outward.y * input.outerOffsetMm,
            0,
          ),
        },
        inner: {
          start: point(
            edge.eaveStart.x + outward.x * input.innerOffsetMm,
            edge.eaveStart.y + outward.y * input.innerOffsetMm,
            0,
          ),
          end: point(
            edge.eaveEnd.x + outward.x * input.innerOffsetMm,
            edge.eaveEnd.y + outward.y * input.innerOffsetMm,
            0,
          ),
        },
      };
    });

    return exposedEdges.flatMap((edge) => {
      const current = shifted[edge.index]!;
      const previousIndex = (edge.index - 1 + orderedEdges.length) % orderedEdges.length;
      const nextIndex = (edge.index + 1) % orderedEdges.length;
      const previous = shifted[previousIndex]!;
      const next = shifted[nextIndex]!;
      const sharesPreviousCorner = exposedIndexes.has(previousIndex);
      const sharesNextCorner = exposedIndexes.has(nextIndex);

      const outerStart = sharesPreviousCorner
        ? miterCornerPoint(previous.outer, current.outer)
        : current.outer.start;
      const outerEnd = sharesNextCorner
        ? miterCornerPoint(current.outer, next.outer)
        : current.outer.end;
      const innerEnd = sharesNextCorner
        ? miterCornerPoint(current.inner, next.inner)
        : current.inner.end;
      const innerStart = sharesPreviousCorner
        ? miterCornerPoint(previous.inner, current.inner)
        : current.inner.start;

      if (!outerStart || !outerEnd || !innerEnd || !innerStart) return [];

      const boundary = [outerStart, outerEnd, innerEnd, innerStart];
      if (
        Math.abs(signedAreaXY(boundary)) <= 1e-6 ||
        boundary.some(
          (candidate, index) =>
            lineLength(line(candidate, boundary[(index + 1) % boundary.length]!)) <= 1e-6,
        )
      ) {
        return [];
      }

      return [{
        boundary,
        sourceEdgeId: edge.sourceEdgeId,
        edgeKind: edge.edgeKind,
        sourceRoofPlaneId: edge.sourceRoofPlaneId ?? null,
        flashingRole: edge.flashingRole ?? null,
      }];
    });
  });
}

function buildPolygonGutterLines(input: {
  perimeterEdges: HouseRoofPerimeterEdge[];
}): HouseRoofPerimeterLine[] {
  return input.perimeterEdges.flatMap((edge) => {
    if (!isEavePackageEdge(edge.edgeKind)) return [];
    const gutterLine = line(edge.eaveStart, edge.eaveEnd);
    if (lineLength(gutterLine) <= 1e-6) return [];
    return [{
      line: gutterLine,
      sourceEdgeId: edge.sourceEdgeId,
      edgeKind: edge.edgeKind,
      sourceRoofPlaneId: edge.sourceRoofPlaneId ?? null,
      flashingRole: edge.flashingRole ?? null,
    }];
  });
}

function buildPolygonGutterBoundaries(input: {
  perimeterEdges: HouseRoofPerimeterEdge[];
  gutterWidthMm: number;
  gutterProjectionMm: number;
}): HouseRoofPerimeterPolygon[] {
  const edgeById = new Map(input.perimeterEdges.map((edge) => [edge.sourceEdgeId, edge]));
  return buildPerimeterOffsetStripFootprints({
    edges: input.perimeterEdges,
    outerOffsetMm: input.gutterProjectionMm,
    innerOffsetMm: input.gutterProjectionMm - input.gutterWidthMm,
  }).flatMap((footprint) => {
    const edge = edgeById.get(footprint.sourceEdgeId);
    const topZ = edge?.eaveStart.z;
    if (typeof topZ !== 'number' || !Number.isFinite(topZ)) return [];
    return [{
      ...footprint,
      boundary: footprint.boundary.map((candidate) => point(candidate.x, candidate.y, topZ)),
    }];
  });
}

function buildPolygonFasciaPolygons(input: {
  perimeterEdges: HouseRoofPerimeterEdge[];
  fasciaHeightMm: number;
}): HouseRoofPerimeterPolygon[] {
  const polygons: HouseRoofPerimeterPolygon[] = [];
  for (const edge of input.perimeterEdges) {
    if (!isEavePackageEdge(edge.edgeKind)) continue;
    const fascia = [
      edge.eaveStart,
      edge.eaveEnd,
      point(edge.eaveEnd.x, edge.eaveEnd.y, edge.eaveEnd.z - input.fasciaHeightMm),
      point(edge.eaveStart.x, edge.eaveStart.y, edge.eaveStart.z - input.fasciaHeightMm),
    ];
    if (lineLength(line(fascia[0]!, fascia[1]!)) > 1e-6) {
      polygons.push({
        boundary: fascia,
        sourceEdgeId: edge.sourceEdgeId,
        edgeKind: edge.edgeKind,
        sourceRoofPlaneId: edge.sourceRoofPlaneId ?? null,
        flashingRole: edge.flashingRole ?? null,
      });
    }
  }
  return polygons;
}

function buildPolygonSoffitPolygons(input: {
  perimeterEdges: HouseRoofPerimeterEdge[];
  roofForm: HouseRoofForm;
  roofPlanes: RoofPlane3D[];
}): HouseRoofPerimeterPolygon[] {
  if (input.roofForm === 'mono') {
    const roofPlaneById = new Map(input.roofPlanes.map((roofPlane) => [roofPlane.id, roofPlane]));
    const polygons: HouseRoofPerimeterPolygon[] = [];

    for (const edge of input.perimeterEdges) {
      if (!isEavePackageEdge(edge.edgeKind)) continue;
      const roofPlane =
        (edge.sourceRoofPlaneId ? roofPlaneById.get(edge.sourceRoofPlaneId) : null) ??
        (input.roofPlanes.length === 1 ? input.roofPlanes[0]! : null);
      const bottomPlane = roofPlane
        ? roofSolidBottomPlaneEquation(roofPlane.plane, DEFAULT_ROOF_SOLID_THICKNESS_MM)
        : null;
      if (!roofPlane || !bottomPlane) continue;

      const soffit = [
        point(
          edge.eaveStart.x,
          edge.eaveStart.y,
          roofPlaneEquationHeightAtXY(bottomPlane, edge.eaveStart.x, edge.eaveStart.y) ?? Number.NaN,
        ),
        point(
          edge.eaveEnd.x,
          edge.eaveEnd.y,
          roofPlaneEquationHeightAtXY(bottomPlane, edge.eaveEnd.x, edge.eaveEnd.y) ?? Number.NaN,
        ),
        point(
          edge.wallEnd.x,
          edge.wallEnd.y,
          roofPlaneEquationHeightAtXY(bottomPlane, edge.wallEnd.x, edge.wallEnd.y) ?? Number.NaN,
        ),
        point(
          edge.wallStart.x,
          edge.wallStart.y,
          roofPlaneEquationHeightAtXY(bottomPlane, edge.wallStart.x, edge.wallStart.y) ?? Number.NaN,
        ),
      ];
      if (
        soffit.every(finiteRoofQaPoint) &&
        lineLength(line(soffit[0]!, soffit[1]!)) > 1e-6 &&
        lineLength(line(soffit[1]!, soffit[2]!)) > 1e-6 &&
        polygonArea3D(soffit) > ROOF_REGION_MIN_AREA_MM2
      ) {
        polygons.push({
          boundary: soffit,
          sourceEdgeId: edge.sourceEdgeId,
          edgeKind: edge.edgeKind,
          sourceRoofPlaneId: roofPlane.id,
          flashingRole: edge.flashingRole ?? null,
          houseRoofSoffitMode: 'sloped_underroof',
        });
      }
    }

    return polygons;
  }

  const polygons: HouseRoofPerimeterPolygon[] = [];
  for (const edge of input.perimeterEdges) {
    if (!isEavePackageEdge(edge.edgeKind)) continue;
    const soffit = [
      edge.eaveStart,
      edge.eaveEnd,
      point(edge.wallEnd.x, edge.wallEnd.y, edge.eaveEnd.z),
      point(edge.wallStart.x, edge.wallStart.y, edge.eaveStart.z),
    ];
    if (lineLength(line(soffit[0]!, soffit[1]!)) > 1e-6 && lineLength(line(soffit[1]!, soffit[2]!)) > 1e-6) {
      polygons.push({
        boundary: soffit,
        sourceEdgeId: edge.sourceEdgeId,
        edgeKind: edge.edgeKind,
        sourceRoofPlaneId: edge.sourceRoofPlaneId ?? null,
        flashingRole: edge.flashingRole ?? null,
        houseRoofSoffitMode: 'horizontal',
      });
    }
  }
  return polygons;
}

function vertexFeatureKind(polygon: Polygon3, index: number): HouseRoofFeatureKind {
  const area = signedAreaXY(polygon);
  const previous = polygon[(index - 1 + polygon.length) % polygon.length]!;
  const current = polygon[index]!;
  const next = polygon[(index + 1) % polygon.length]!;
  const prevVector = { x: current.x - previous.x, y: current.y - previous.y };
  const nextVector = { x: next.x - current.x, y: next.y - current.y };
  const cross = prevVector.x * nextVector.y - prevVector.y * nextVector.x;
  return Math.sign(cross || 1) === Math.sign(area || 1) ? 'hip' : 'valley';
}

type RoofPoint2 = {
  x: number;
  y: number;
};

type JoinedRoofEdge = {
  index: number;
  id: string;
  start: Point3;
  end: Point3;
  inwardNormal: { x: number; y: number };
  lengthMm: number;
  ridgeAxis: 'x' | 'y';
};

type JoinedRoofFacet = {
  edge: JoinedRoofEdge;
  footprint: RoofPoint2[];
  boundary: Polygon3;
};

type JoinedRoofRegion = {
  edge: JoinedRoofEdge;
  footprint: RoofPoint2[];
};

type JoinedRoofWavefrontSegment = {
  edge: JoinedRoofEdge;
  start: RoofPoint2;
  end: RoofPoint2;
};

type JoinedRoofWavefrontLoop = {
  segments: JoinedRoofWavefrontSegment[];
};

type JoinedRoofWavefrontResult = {
  regions: JoinedRoofRegion[];
  metadata: GeometryMetadata;
  failureReason: string | null;
};

type JoinedRoofFeatureDraft = {
  kind: HouseRoofFeatureKind;
  line: Line3;
  sourceEdgeIds: string[];
  roofFeatureSource: 'facet_adjacency' | 'reentrant_fallback';
};

type JoinedRoofFacetBuildResult = {
  facets: JoinedRoofFacet[];
  metadata: GeometryMetadata;
};

type HouseRoofBuildResult = {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  terminalClosures?: BentSpineTerminalGableClosure[];
  metadata: GeometryMetadata;
};

type HouseRoofPerimeterEdgeKind =
  | 'drain_eave'
  | 'weather_flashed_edge'
  | 'house_apron_edge';

type HouseRoofPerimeterFlashingRole =
  | 'high_side'
  | 'rake'
  | 'house_apron';

type HouseRoofPerimeterEdge = {
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

type HouseRoofPerimeterPolygon = {
  boundary: Polygon3;
  sourceEdgeId: string;
  edgeKind: HouseRoofPerimeterEdgeKind;
  flashingRole?: HouseRoofPerimeterFlashingRole | null;
  sourceRoofPlaneId?: string | null;
  houseRoofSoffitMode?: 'horizontal' | 'sloped_underroof' | null;
};

type HouseRoofPerimeterLine = {
  line: Line3;
  sourceEdgeId: string;
  edgeKind: HouseRoofPerimeterEdgeKind;
  sourceRoofPlaneId?: string | null;
  flashingRole?: HouseRoofPerimeterFlashingRole | null;
};

type RoofQaStatus = 'valid' | 'invalid';

type HouseRoofQaResult = {
  status: RoofQaStatus;
  facetAreaMm2: number;
  eaveAreaMm2: number;
  areaDeltaMm2: number;
  rejectedFacetCount: number;
  failureReason: string | null;
};

const ROOF_JOIN_EPSILON_MM = 1e-3;
const ROOF_JOIN_FEATURE_MIN_LENGTH_MM = 5;
const ROOF_REGION_MIN_AREA_MM2 = 25;
const ROOF_QA_AREA_TOLERANCE_MIN_MM2 = 100;
const ROOF_QA_AREA_TOLERANCE_RATIO = 0.001;

function isEavePackageEdge(edgeKind: HouseRoofPerimeterEdgeKind): boolean {
  return edgeKind === 'drain_eave';
}

function isPerimeterFlashingEdge(edgeKind: HouseRoofPerimeterEdgeKind): boolean {
  return edgeKind === 'weather_flashed_edge' || edgeKind === 'house_apron_edge';
}

type RoofDissolveSegment = {
  start: RoofPoint2;
  end: RoofPoint2;
};

type RoofRegionDissolveResult =
  | {
      ok: true;
      footprints: RoofPoint2[][];
      sourceRegionCount: number;
      discardedLoopCount: number;
    }
  | {
      ok: false;
      reason: string;
      sourceRegionCount: number;
    };

function finiteRoofQaPoint(candidate: Point3): boolean {
  return Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && Number.isFinite(candidate.z);
}

function finiteRoofQaVector(candidate: Vector3): boolean {
  return Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && Number.isFinite(candidate.z);
}

function finiteRoofQaPlane(plane: Plane3): boolean {
  return (
    finiteRoofQaPoint(plane.origin) &&
    finiteRoofQaVector(plane.xAxis) &&
    finiteRoofQaVector(plane.yAxis) &&
    finiteRoofQaVector(plane.normal) &&
    Math.hypot(plane.xAxis.x, plane.xAxis.y, plane.xAxis.z) > ROOF_JOIN_EPSILON_MM &&
    Math.hypot(plane.yAxis.x, plane.yAxis.y, plane.yAxis.z) > ROOF_JOIN_EPSILON_MM &&
    Math.hypot(plane.normal.x, plane.normal.y, plane.normal.z) > ROOF_JOIN_EPSILON_MM
  );
}

function roofQaMetadata(result: HouseRoofQaResult): GeometryMetadata {
  return {
    roofQaStatus: result.status,
    roofQaFacetAreaMm2: Math.round(result.facetAreaMm2),
    roofQaEaveAreaMm2: Math.round(result.eaveAreaMm2),
    roofQaAreaDeltaMm2: Math.round(result.areaDeltaMm2),
    roofQaRejectedFacetCount: result.rejectedFacetCount,
    roofQaFailureReason: result.failureReason,
  };
}

function validateRoofPlaneForQa(roofPlane: RoofPlane3D, eavePolygon: Polygon3): string | null {
  if (roofPlane.boundary.length < 3) return `${roofPlane.id}:too_few_points`;
  if (!roofPlane.boundary.every(finiteRoofQaPoint)) return `${roofPlane.id}:non_finite_boundary`;
  if (!finiteRoofQaPlane(roofPlane.plane)) return `${roofPlane.id}:non_finite_plane`;

  const footprint = cleanRoofPolygon2D(roofPlane.boundary.map(point2FromPoint3));
  if (footprint.length < 3) return `${roofPlane.id}:degenerate_plan`;
  if (roofPolygonArea(footprint) <= ROOF_REGION_MIN_AREA_MM2) return `${roofPlane.id}:zero_plan_area`;
  if (!roofPolygonIsSimple(footprint)) return `${roofPlane.id}:self_intersecting_plan`;
  if (!roofRegionInsideEave(footprint, eavePolygon)) return `${roofPlane.id}:outside_eave_or_spans_void`;

  const centroid = roofPolygonCentroid(footprint);
  const roofGeometry =
    typeof roofPlane.metadata?.roofGeometry === 'string'
      ? roofPlane.metadata.roofGeometry
      : null;
  if (roofGeometry !== 'footprint_mono' && !pointInOrOnRoofPolygon(centroid, eavePolygon)) {
    return `${roofPlane.id}:centroid_outside_eave`;
  }
  return null;
}

function validateHouseRoofQa(input: {
  roofPlanes: RoofPlane3D[];
  eavePolygon: Polygon3;
  rejectedFacetCount?: number;
  failureReason?: string | null;
}): HouseRoofQaResult {
  const eaveAreaMm2 = Math.abs(signedAreaXY(input.eavePolygon));
  let facetAreaMm2 = 0;
  let failureReason: string | null = input.failureReason ?? null;

  if (
    input.eavePolygon.length < 3 ||
    input.eavePolygon.some((candidate) => !finiteRoofQaPoint(candidate)) ||
    eaveAreaMm2 <= ROOF_REGION_MIN_AREA_MM2
  ) {
    failureReason = 'invalid_eave_polygon';
  } else {
    const eaveFootprint = cleanRoofPolygon2D(input.eavePolygon.map(point2FromPoint3));
    if (!roofPolygonIsSimple(eaveFootprint)) failureReason = 'self_intersecting_eave_polygon';
  }

  if (input.roofPlanes.length === 0 && !failureReason) {
    failureReason = 'missing_roof_facets';
  }

  for (const roofPlane of input.roofPlanes) {
    const footprint = cleanRoofPolygon2D(roofPlane.boundary.map(point2FromPoint3));
    if (footprint.length >= 3) {
      facetAreaMm2 += roofPolygonArea(footprint);
    }
    failureReason ??= validateRoofPlaneForQa(roofPlane, input.eavePolygon);
  }

  const rejectedFacetCount = Math.max(0, input.rejectedFacetCount ?? 0);
  if (rejectedFacetCount > 0 && !failureReason) {
    failureReason = 'rejected_roof_facets';
  }

  const areaDeltaMm2 = facetAreaMm2 - eaveAreaMm2;
  const areaToleranceMm2 = Math.max(ROOF_QA_AREA_TOLERANCE_MIN_MM2, eaveAreaMm2 * ROOF_QA_AREA_TOLERANCE_RATIO);
  if (!failureReason && Math.abs(areaDeltaMm2) > areaToleranceMm2) {
    failureReason = 'roof_area_mismatch';
  }

  return {
    status: failureReason ? 'invalid' : 'valid',
    facetAreaMm2,
    eaveAreaMm2,
    areaDeltaMm2,
    rejectedFacetCount,
    failureReason,
  };
}

function applyRoofQa(input: {
  roof: HouseRoofBuildResult;
  eavePolygon: Polygon3;
  rejectedFacetCount?: number;
}): HouseRoofBuildResult {
  const topologyFailureReason =
    typeof input.roof.metadata.roofTopologyFailureReason === 'string'
      ? input.roof.metadata.roofTopologyFailureReason
      : null;
  const qaMetadata = roofQaMetadata(
    validateHouseRoofQa({
      roofPlanes: input.roof.roofPlanes,
      eavePolygon: input.eavePolygon,
      rejectedFacetCount: input.rejectedFacetCount,
      failureReason: topologyFailureReason,
    }),
  );
  const topologyMetadata = Object.fromEntries(
    Object.entries(input.roof.metadata).filter(
      ([key]) =>
        key === 'roofFacetMergeMode' ||
        key.startsWith('roofTopology') ||
        key.startsWith('roofWavefront'),
    ),
  );
  return {
    roofPlanes: input.roof.roofPlanes.map((roofPlane) => ({
      ...roofPlane,
      metadata: {
        ...roofPlane.metadata,
        ...topologyMetadata,
        ...qaMetadata,
      },
    })),
    roofFeatures: input.roof.roofFeatures.map((feature) => ({
      ...feature,
      metadata: {
        ...feature.metadata,
        ...topologyMetadata,
        ...qaMetadata,
      },
    })),
    terminalClosures: input.roof.terminalClosures,
    metadata: {
      ...input.roof.metadata,
      ...qaMetadata,
    },
  };
}

function point2FromPoint3(candidate: Point3): RoofPoint2 {
  return { x: candidate.x, y: candidate.y };
}

function roofPointDistance2(a: RoofPoint2, b: RoofPoint2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function signedArea2D(points: RoofPoint2[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function cleanRoofPolygon2D(points: RoofPoint2[]): RoofPoint2[] {
  const withoutDuplicates: RoofPoint2[] = [];
  for (const candidate of points) {
    const previous = withoutDuplicates[withoutDuplicates.length - 1];
    if (previous && roofPointDistance2(previous, candidate) <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) {
      continue;
    }
    withoutDuplicates.push(candidate);
  }
  if (
    withoutDuplicates.length > 1 &&
    roofPointDistance2(withoutDuplicates[0]!, withoutDuplicates[withoutDuplicates.length - 1]!) <=
      ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM
  ) {
    withoutDuplicates.pop();
  }

  if (withoutDuplicates.length < 3) return withoutDuplicates;

  const cleaned: RoofPoint2[] = [];
  for (let index = 0; index < withoutDuplicates.length; index += 1) {
    const previous = withoutDuplicates[(index - 1 + withoutDuplicates.length) % withoutDuplicates.length]!;
    const current = withoutDuplicates[index]!;
    const next = withoutDuplicates[(index + 1) % withoutDuplicates.length]!;
    const cross =
      (current.x - previous.x) * (next.y - current.y) -
      (current.y - previous.y) * (next.x - current.x);
    if (Math.abs(cross) <= ROOF_JOIN_EPSILON_MM) continue;
    cleaned.push(current);
  }
  return cleaned.length >= 3 ? cleaned : withoutDuplicates;
}

function roofPoint3Key(candidate: Point3): string {
  return `${candidate.x.toFixed(3)},${candidate.y.toFixed(3)},${candidate.z.toFixed(3)}`;
}

function roofPoint2Key(candidate: RoofPoint2): string {
  return `${candidate.x.toFixed(3)},${candidate.y.toFixed(3)}`;
}

function canonicalRoofSegmentKey(start: Point3, end: Point3): string {
  const startKey = roofPoint3Key(start);
  const endKey = roofPoint3Key(end);
  return startKey <= endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

function compareRoofPoints(a: Point3, b: Point3): number {
  return a.x - b.x || a.y - b.y || a.z - b.z;
}

function orientRoofFeatureLine(start: Point3, end: Point3, eaveHeightMm: number): Line3 {
  const startAtEave = Math.abs(start.z - eaveHeightMm) <= ROOF_JOIN_EPSILON_MM;
  const endAtEave = Math.abs(end.z - eaveHeightMm) <= ROOF_JOIN_EPSILON_MM;
  if (startAtEave && !endAtEave) return line(start, end);
  if (!startAtEave && endAtEave) return line(end, start);
  return compareRoofPoints(start, end) <= 0 ? line(start, end) : line(end, start);
}

function clipRoofPolygonByScalar(
  polygon: RoofPoint2[],
  scalar: (candidate: RoofPoint2) => number,
): RoofPoint2[] {
  if (polygon.length < 3) return [];
  const clipped: RoofPoint2[] = [];

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    const currentValue = scalar(current);
    const nextValue = scalar(next);
    const currentInside = currentValue <= ROOF_JOIN_EPSILON_MM;
    const nextInside = nextValue <= ROOF_JOIN_EPSILON_MM;
    const denominator = currentValue - nextValue;
    const intersection =
      Math.abs(denominator) <= ROOF_JOIN_EPSILON_MM
        ? null
        : {
            x: current.x + (next.x - current.x) * clamp(currentValue / denominator, 0, 1),
            y: current.y + (next.y - current.y) * clamp(currentValue / denominator, 0, 1),
          };

    if (currentInside && nextInside) {
      clipped.push(next);
    } else if (currentInside && !nextInside) {
      if (intersection) clipped.push(intersection);
    } else if (!currentInside && nextInside) {
      if (intersection) clipped.push(intersection);
      clipped.push(next);
    }
  }

  return cleanRoofPolygon2D(clipped);
}

function roofPolygonArea(polygon: RoofPoint2[]): number {
  return Math.abs(signedArea2D(polygon));
}

function roofPolygonCentroid(polygon: RoofPoint2[]): RoofPoint2 {
  const area = signedArea2D(polygon);
  if (Math.abs(area) <= ROOF_JOIN_EPSILON_MM) {
    const total = polygon.reduce((sum, candidate) => ({ x: sum.x + candidate.x, y: sum.y + candidate.y }), { x: 0, y: 0 });
    return {
      x: total.x / Math.max(1, polygon.length),
      y: total.y / Math.max(1, polygon.length),
    };
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
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

function pointOnRoofPolygonBoundary(candidate: RoofPoint2, polygon: Polygon3): boolean {
  const point3 = point(candidate.x, candidate.y, 0);
  for (let index = 0; index < polygon.length; index += 1) {
    if (pointOnRoofSegment2D(point3, polygon[index]!, polygon[(index + 1) % polygon.length]!)) return true;
  }
  return false;
}

function pointInOrOnRoofPolygon(candidate: RoofPoint2, polygon: Polygon3): boolean {
  return pointInPolygon2D(candidate, polygon) || pointOnRoofPolygonBoundary(candidate, polygon);
}

function segmentInsideRoofPolygon(start: RoofPoint2, end: RoofPoint2, polygon: Polygon3): boolean {
  const samples = [0.2, 0.4, 0.6, 0.8];
  return samples.every((sample) =>
    pointInOrOnRoofPolygon(
      {
        x: start.x + (end.x - start.x) * sample,
        y: start.y + (end.y - start.y) * sample,
      },
      polygon,
    ),
  );
}

function roofSegmentOverlapLength2D(
  aStart: RoofPoint2,
  aEnd: RoofPoint2,
  bStart: RoofPoint2,
  bEnd: RoofPoint2,
): number {
  const aDx = aEnd.x - aStart.x;
  const aDy = aEnd.y - aStart.y;
  const bDx = bEnd.x - bStart.x;
  const bDy = bEnd.y - bStart.y;
  const aLength = Math.hypot(aDx, aDy);
  const bLength = Math.hypot(bDx, bDy);
  if (aLength <= ROOF_JOIN_EPSILON_MM || bLength <= ROOF_JOIN_EPSILON_MM) return 0;
  const directionCross = Math.abs(aDx * bDy - aDy * bDx) / (aLength * bLength);
  if (directionCross > 1e-6) return 0;
  const bStartDistance = Math.abs((bStart.x - aStart.x) * aDy - (bStart.y - aStart.y) * aDx) / aLength;
  const bEndDistance = Math.abs((bEnd.x - aStart.x) * aDy - (bEnd.y - aStart.y) * aDx) / aLength;
  if (bStartDistance > ROOF_JOIN_EPSILON_MM || bEndDistance > ROOF_JOIN_EPSILON_MM) return 0;

  const unitX = aDx / aLength;
  const unitY = aDy / aLength;
  const aMin = 0;
  const aMax = aLength;
  const bProjectionStart = (bStart.x - aStart.x) * unitX + (bStart.y - aStart.y) * unitY;
  const bProjectionEnd = (bEnd.x - aStart.x) * unitX + (bEnd.y - aStart.y) * unitY;
  const bMin = Math.min(bProjectionStart, bProjectionEnd);
  const bMax = Math.max(bProjectionStart, bProjectionEnd);
  return Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
}

function roofSegmentsProperlyIntersect2D(
  aStart: RoofPoint2,
  aEnd: RoofPoint2,
  bStart: RoofPoint2,
  bEnd: RoofPoint2,
): boolean {
  const pointOnSegment = (candidate: RoofPoint2, start: RoofPoint2, end: RoofPoint2): boolean => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const cross = (candidate.x - start.x) * dy - (candidate.y - start.y) * dx;
    if (Math.abs(cross) > 1e-2) return false;
    const dot = (candidate.x - start.x) * dx + (candidate.y - start.y) * dy;
    if (dot < -1e-2) return false;
    const lengthSq = dx * dx + dy * dy;
    return dot <= lengthSq + 1e-2;
  };
  if (
    pointOnSegment(aStart, bStart, bEnd) ||
    pointOnSegment(aEnd, bStart, bEnd) ||
    pointOnSegment(bStart, aStart, aEnd) ||
    pointOnSegment(bEnd, aStart, aEnd)
  ) {
    return false;
  }
  const a1 = (aEnd.x - aStart.x) * (bStart.y - aStart.y) - (aEnd.y - aStart.y) * (bStart.x - aStart.x);
  const a2 = (aEnd.x - aStart.x) * (bEnd.y - aStart.y) - (aEnd.y - aStart.y) * (bEnd.x - aStart.x);
  const b1 = (bEnd.x - bStart.x) * (aStart.y - bStart.y) - (bEnd.y - bStart.y) * (aStart.x - bStart.x);
  const b2 = (bEnd.x - bStart.x) * (aEnd.y - bStart.y) - (bEnd.y - bStart.y) * (aEnd.x - bStart.x);
  return (
    a1 * a2 < -ROOF_JOIN_EPSILON_MM &&
    b1 * b2 < -ROOF_JOIN_EPSILON_MM
  );
}

function roofPolygonIsSimple(polygon: RoofPoint2[]): boolean {
  for (let firstIndex = 0; firstIndex < polygon.length; firstIndex += 1) {
    const firstNext = (firstIndex + 1) % polygon.length;
    for (let secondIndex = firstIndex + 1; secondIndex < polygon.length; secondIndex += 1) {
      const secondNext = (secondIndex + 1) % polygon.length;
      if (
        firstIndex === secondIndex ||
        firstNext === secondIndex ||
        secondNext === firstIndex
      ) {
        continue;
      }
      if (
        roofSegmentsProperlyIntersect2D(
          polygon[firstIndex]!,
          polygon[firstNext]!,
          polygon[secondIndex]!,
          polygon[secondNext]!,
        )
      ) {
        return false;
      }
    }
  }
  return true;
}

function roofSegmentInsidePolygonStrict(start: RoofPoint2, end: RoofPoint2, polygon: Polygon3): boolean {
  if (!pointInOrOnRoofPolygon(start, polygon) || !pointInOrOnRoofPolygon(end, polygon)) return false;
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  if (!pointInOrOnRoofPolygon(midpoint, polygon)) return false;
  for (let index = 0; index < polygon.length; index += 1) {
    const edgeStart = point2FromPoint3(polygon[index]!);
    const edgeEnd = point2FromPoint3(polygon[(index + 1) % polygon.length]!);
    if (roofSegmentsProperlyIntersect2D(start, end, edgeStart, edgeEnd)) return false;
  }
  return true;
}

function roofRegionInsideEave(region: RoofPoint2[], eavePolygon: Polygon3): boolean {
  return region.every((candidate, index) =>
    roofSegmentInsidePolygonStrict(candidate, region[(index + 1) % region.length]!, eavePolygon),
  );
}

function roofPointOnEaveBoundaryAtWrongHeight(candidate: Point3, eavePolygon: Polygon3, eaveHeightMm: number): boolean {
  return (
    pointOnRoofPolygonBoundary(point2FromPoint3(candidate), eavePolygon) &&
    Math.abs(candidate.z - eaveHeightMm) > 1
  );
}

function buildJoinedRoofEdges(eavePolygon: Polygon3): JoinedRoofEdge[] {
  const area = signedAreaXY(eavePolygon);
  const edges: JoinedRoofEdge[] = [];
  for (let index = 0; index < eavePolygon.length; index += 1) {
    const start = eavePolygon[index]!;
    const end = eavePolygon[(index + 1) % eavePolygon.length]!;
    const lengthMm = Math.hypot(end.x - start.x, end.y - start.y);
    if (lengthMm <= RIDGE_COLLAPSE_EPSILON_MM) continue;
    const unitX = (end.x - start.x) / lengthMm;
    const unitY = (end.y - start.y) / lengthMm;
    edges.push({
      index,
      id: `house-eave-edge-${index + 1}`,
      start,
      end,
      inwardNormal:
        area >= 0
          ? { x: -unitY, y: unitX }
          : { x: unitY, y: -unitX },
      lengthMm,
      ridgeAxis: Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? 'x' : 'y',
    });
  }
  return edges;
}

function roofRunFromEdge(edge: JoinedRoofEdge, candidate: RoofPoint2): number {
  return (candidate.x - edge.start.x) * edge.inwardNormal.x + (candidate.y - edge.start.y) * edge.inwardNormal.y;
}

function roofHeightFromEdge(input: {
  edge: JoinedRoofEdge;
  candidate: RoofPoint2;
  eaveHeightMm: number;
  pitchRisePerRun: number;
}): number {
  return input.eaveHeightMm + roofRunFromEdge(input.edge, input.candidate) * input.pitchRisePerRun;
}

function roofPlaneReachableFromEdge(input: {
  edge: JoinedRoofEdge;
  candidate: RoofPoint2;
  eavePolygon: Polygon3;
}): boolean {
  const run = roofRunFromEdge(input.edge, input.candidate);
  if (run < -ROOF_JOIN_EPSILON_MM) return false;
  const edgeDx = input.edge.end.x - input.edge.start.x;
  const edgeDy = input.edge.end.y - input.edge.start.y;
  const edgeLength = Math.hypot(edgeDx, edgeDy);
  if (edgeLength <= ROOF_JOIN_EPSILON_MM) return false;
  const unitX = edgeDx / edgeLength;
  const unitY = edgeDy / edgeLength;
  const projectionT = (input.candidate.x - input.edge.start.x) * unitX + (input.candidate.y - input.edge.start.y) * unitY;
  const source = {
    x: input.edge.start.x + unitX * projectionT,
    y: input.edge.start.y + unitY * projectionT,
  };
  if (projectionT >= -ROOF_JOIN_EPSILON_MM && projectionT <= input.edge.lengthMm + ROOF_JOIN_EPSILON_MM) {
    return segmentInsideRoofPolygon(source, input.candidate, input.eavePolygon);
  }

  if (projectionT < 0 && vertexFeatureKind(input.eavePolygon, input.edge.index) === 'valley') {
    return segmentInsideRoofPolygon(point2FromPoint3(input.edge.start), input.candidate, input.eavePolygon);
  }

  const endVertexIndex = (input.edge.index + 1) % input.eavePolygon.length;
  if (projectionT > input.edge.lengthMm && vertexFeatureKind(input.eavePolygon, endVertexIndex) === 'valley') {
    return segmentInsideRoofPolygon(point2FromPoint3(input.edge.end), input.candidate, input.eavePolygon);
  }

  return false;
}

function buildRectilinearRoofBaseRegions(eavePolygon: Polygon3): RoofPoint2[][] {
  const xs = uniqueSorted(eavePolygon.map((candidate) => candidate.x));
  const ys = uniqueSorted(eavePolygon.map((candidate) => candidate.y));
  const regions: RoofPoint2[][] = [];
  for (let xIndex = 0; xIndex < xs.length - 1; xIndex += 1) {
    for (let yIndex = 0; yIndex < ys.length - 1; yIndex += 1) {
      const minX = xs[xIndex]!;
      const maxX = xs[xIndex + 1]!;
      const minY = ys[yIndex]!;
      const maxY = ys[yIndex + 1]!;
      if (maxX - minX <= RIDGE_COLLAPSE_EPSILON_MM || maxY - minY <= RIDGE_COLLAPSE_EPSILON_MM) continue;
      const midpoint = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
      if (!pointInPolygon2D(midpoint, eavePolygon)) continue;
      regions.push([
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ]);
    }
  }
  return regions;
}

function splitRoofRegionsByPlaneIntersections(input: {
  regions: RoofPoint2[][];
  edges: JoinedRoofEdge[];
  eaveHeightMm: number;
  pitchRisePerRun: number;
}): RoofPoint2[][] {
  let regions = input.regions;
  for (let firstIndex = 0; firstIndex < input.edges.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < input.edges.length; secondIndex += 1) {
      const first = input.edges[firstIndex]!;
      const second = input.edges[secondIndex]!;
      const nextRegions: RoofPoint2[][] = [];
      for (const region of regions) {
        const regionArea = roofPolygonArea(region);
        const scalar = (candidate: RoofPoint2) =>
          roofHeightFromEdge({
            edge: first,
            candidate,
            eaveHeightMm: input.eaveHeightMm,
            pitchRisePerRun: input.pitchRisePerRun,
          }) -
          roofHeightFromEdge({
            edge: second,
            candidate,
            eaveHeightMm: input.eaveHeightMm,
            pitchRisePerRun: input.pitchRisePerRun,
          });
        const firstSide = clipRoofPolygonByScalar(region, scalar);
        const secondSide = clipRoofPolygonByScalar(region, (candidate) => -scalar(candidate));
        const firstArea = roofPolygonArea(firstSide);
        const secondArea = roofPolygonArea(secondSide);
        if (
          firstArea > ROOF_REGION_MIN_AREA_MM2 &&
          secondArea > ROOF_REGION_MIN_AREA_MM2 &&
          firstArea < regionArea - ROOF_REGION_MIN_AREA_MM2 &&
          secondArea < regionArea - ROOF_REGION_MIN_AREA_MM2
        ) {
          nextRegions.push(firstSide, secondSide);
          continue;
        }
        const kept = firstArea >= secondArea ? firstSide : secondSide;
        if (roofPolygonArea(kept) > ROOF_REGION_MIN_AREA_MM2) nextRegions.push(kept);
      }
      regions = nextRegions;
    }
  }
  return regions;
}

function assignRoofRegion(input: {
  footprint: RoofPoint2[];
  edges: JoinedRoofEdge[];
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  pitchRisePerRun: number;
}): JoinedRoofRegion | null {
  const centroid = roofPolygonCentroid(input.footprint);
  const candidates = input.edges
    .filter((edge) => roofPlaneReachableFromEdge({ edge, candidate: centroid, eavePolygon: input.eavePolygon }))
    .map((edge) => ({
      edge,
      height: roofHeightFromEdge({
        edge,
        candidate: centroid,
        eaveHeightMm: input.eaveHeightMm,
        pitchRisePerRun: input.pitchRisePerRun,
      }),
    }))
    .sort((a, b) => a.height - b.height || a.edge.index - b.edge.index);
  const selected = candidates[0];
  if (!selected) return null;
  return { edge: selected.edge, footprint: cleanRoofPolygon2D(input.footprint) };
}

function joinedRoofWavefrontVertexVelocity(
  previous: JoinedRoofWavefrontSegment,
  current: JoinedRoofWavefrontSegment,
): RoofPoint2 {
  return {
    x: previous.edge.inwardNormal.x + current.edge.inwardNormal.x,
    y: previous.edge.inwardNormal.y + current.edge.inwardNormal.y,
  };
}

function joinedRoofWavefrontLoopArea(loop: JoinedRoofWavefrontLoop): number {
  return signedArea2D(loop.segments.map((segment) => segment.start));
}

function joinedRoofWavefrontVertexKind(loop: JoinedRoofWavefrontLoop, index: number): HouseRoofFeatureKind {
  const area = joinedRoofWavefrontLoopArea(loop);
  const previous = loop.segments[(index - 1 + loop.segments.length) % loop.segments.length]!;
  const current = loop.segments[index]!;
  const previousVector = {
    x: previous.end.x - previous.start.x,
    y: previous.end.y - previous.start.y,
  };
  const nextVector = {
    x: current.end.x - current.start.x,
    y: current.end.y - current.start.y,
  };
  const cross = previousVector.x * nextVector.y - previousVector.y * nextVector.x;
  return Math.sign(cross || 1) === Math.sign(area || 1) ? 'hip' : 'valley';
}

function movedRoofPoint(candidate: RoofPoint2, velocity: RoofPoint2, distanceMm: number): RoofPoint2 {
  return {
    x: candidate.x + velocity.x * distanceMm,
    y: candidate.y + velocity.y * distanceMm,
  };
}

function joinedRoofWavefrontMovedSegments(
  loop: JoinedRoofWavefrontLoop,
  distanceMm: number,
): JoinedRoofWavefrontSegment[] {
  return loop.segments.map((segment, index) => {
    const previous = loop.segments[(index - 1 + loop.segments.length) % loop.segments.length]!;
    const next = loop.segments[(index + 1) % loop.segments.length]!;
    const startVelocity = joinedRoofWavefrontVertexVelocity(previous, segment);
    const endVelocity = joinedRoofWavefrontVertexVelocity(segment, next);
    return {
      edge: segment.edge,
      start: movedRoofPoint(segment.start, startVelocity, distanceMm),
      end: movedRoofPoint(segment.end, endVelocity, distanceMm),
    };
  });
}

function joinedRoofWavefrontEdgeCollapseDistance(loop: JoinedRoofWavefrontLoop, index: number): number | null {
  const segment = loop.segments[index]!;
  const previous = loop.segments[(index - 1 + loop.segments.length) % loop.segments.length]!;
  const next = loop.segments[(index + 1) % loop.segments.length]!;
  const length = Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
  if (length <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) return null;
  const unitX = (segment.end.x - segment.start.x) / length;
  const unitY = (segment.end.y - segment.start.y) / length;
  const startVelocity = joinedRoofWavefrontVertexVelocity(previous, segment);
  const endVelocity = joinedRoofWavefrontVertexVelocity(segment, next);
  const lengthChange = (endVelocity.x - startVelocity.x) * unitX + (endVelocity.y - startVelocity.y) * unitY;
  if (lengthChange >= -ROOF_JOIN_EPSILON_MM) return null;
  const distance = -length / lengthChange;
  return distance > ROOF_JOIN_EPSILON_MM ? distance : null;
}

function joinedRoofWavefrontSplitDistance(
  loop: JoinedRoofWavefrontLoop,
  vertexIndex: number,
  edgeIndex: number,
): number | null {
  const previousIndex = (vertexIndex - 1 + loop.segments.length) % loop.segments.length;
  if (edgeIndex === previousIndex || edgeIndex === vertexIndex) return null;
  if ((edgeIndex + 1) % loop.segments.length === vertexIndex) return null;

  const vertexSegment = loop.segments[vertexIndex]!;
  const previousSegment = loop.segments[previousIndex]!;
  const target = loop.segments[edgeIndex]!;
  const targetNext = loop.segments[(edgeIndex + 1) % loop.segments.length]!;
  const vertexVelocity = joinedRoofWavefrontVertexVelocity(previousSegment, vertexSegment);
  const targetStartVelocity = joinedRoofWavefrontVertexVelocity(
    loop.segments[(edgeIndex - 1 + loop.segments.length) % loop.segments.length]!,
    target,
  );
  const targetEndVelocity = joinedRoofWavefrontVertexVelocity(target, targetNext);
  const targetDx = target.end.x - target.start.x;
  const targetDy = target.end.y - target.start.y;
  const targetLength = Math.hypot(targetDx, targetDy);
  if (targetLength <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) return null;

  let distance: number | null = null;
  if (Math.abs(targetDy) <= ROOF_JOIN_EPSILON_MM) {
    const denominator = vertexVelocity.y - targetStartVelocity.y;
    if (Math.abs(denominator) <= ROOF_JOIN_EPSILON_MM) return null;
    distance = (target.start.y - vertexSegment.start.y) / denominator;
  } else if (Math.abs(targetDx) <= ROOF_JOIN_EPSILON_MM) {
    const denominator = vertexVelocity.x - targetStartVelocity.x;
    if (Math.abs(denominator) <= ROOF_JOIN_EPSILON_MM) return null;
    distance = (target.start.x - vertexSegment.start.x) / denominator;
  } else {
    return null;
  }

  if (distance <= ROOF_JOIN_EPSILON_MM) return null;
  const vertexAtEvent = movedRoofPoint(vertexSegment.start, vertexVelocity, distance);
  const targetStartAtEvent = movedRoofPoint(target.start, targetStartVelocity, distance);
  const targetEndAtEvent = movedRoofPoint(target.end, targetEndVelocity, distance);
  if (!pointOnRoofSegment2(vertexAtEvent, targetStartAtEvent, targetEndAtEvent)) return null;
  if (
    roofPointDistance2(vertexAtEvent, targetStartAtEvent) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM * ROOF_JOIN_FEATURE_MIN_LENGTH_MM ||
    roofPointDistance2(vertexAtEvent, targetEndAtEvent) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM * ROOF_JOIN_FEATURE_MIN_LENGTH_MM
  ) {
    return null;
  }
  return distance;
}

function findNextJoinedRoofWavefrontDistance(loops: JoinedRoofWavefrontLoop[]): number | null {
  let selected: number | null = null;
  const accept = (distance: number | null) => {
    if (distance === null || !Number.isFinite(distance) || distance <= ROOF_JOIN_EPSILON_MM) return;
    selected = selected === null ? distance : Math.min(selected, distance);
  };

  for (const loop of loops) {
    if (loop.segments.length < 3) continue;
    for (let index = 0; index < loop.segments.length; index += 1) {
      accept(joinedRoofWavefrontEdgeCollapseDistance(loop, index));
    }
    for (let vertexIndex = 0; vertexIndex < loop.segments.length; vertexIndex += 1) {
      if (joinedRoofWavefrontVertexKind(loop, vertexIndex) !== 'valley') continue;
      for (let edgeIndex = 0; edgeIndex < loop.segments.length; edgeIndex += 1) {
        accept(joinedRoofWavefrontSplitDistance(loop, vertexIndex, edgeIndex));
      }
    }
  }

  return selected;
}

function joinedRoofWavefrontSweptRegions(
  loop: JoinedRoofWavefrontLoop,
  distanceMm: number,
): JoinedRoofRegion[] {
  const movedSegments = joinedRoofWavefrontMovedSegments(loop, distanceMm);
  const regions: JoinedRoofRegion[] = [];
  for (const [index, segment] of loop.segments.entries()) {
    const moved = movedSegments[index]!;
    const footprint = cleanRoofPolygon2D([segment.start, segment.end, moved.end, moved.start]);
    if (footprint.length < 3 || roofPolygonArea(footprint) <= ROOF_REGION_MIN_AREA_MM2) continue;
    regions.push({ edge: segment.edge, footprint });
  }
  return regions;
}

function splitJoinedRoofWavefrontSegments(
  segments: JoinedRoofWavefrontSegment[],
): JoinedRoofWavefrontSegment[] {
  const splitPoints = segments.map((segment) => [segment.start, segment.end]);

  for (let firstIndex = 0; firstIndex < segments.length; firstIndex += 1) {
    const first = segments[firstIndex]!;
    for (let secondIndex = firstIndex + 1; secondIndex < segments.length; secondIndex += 1) {
      const second = segments[secondIndex]!;
      const firstLength = Math.hypot(first.end.x - first.start.x, first.end.y - first.start.y);
      const secondLength = Math.hypot(second.end.x - second.start.x, second.end.y - second.start.y);
      if (firstLength <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM || secondLength <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) continue;
      const directionCross =
        Math.abs((first.end.x - first.start.x) * (second.end.y - second.start.y) - (first.end.y - first.start.y) * (second.end.x - second.start.x)) /
        (firstLength * secondLength);
      if (directionCross <= 1e-6) {
        for (const candidate of [first.start, first.end]) {
          if (pointOnRoofSegment2(candidate, second.start, second.end)) {
            addRoofDissolveSplitPoint(splitPoints[secondIndex]!, candidate);
          }
        }
        for (const candidate of [second.start, second.end]) {
          if (pointOnRoofSegment2(candidate, first.start, first.end)) {
            addRoofDissolveSplitPoint(splitPoints[firstIndex]!, candidate);
          }
        }
        continue;
      }
      const intersection = roofSegmentIntersectionPoint(first.start, first.end, second.start, second.end);
      if (!intersection) continue;
      addRoofDissolveSplitPoint(splitPoints[firstIndex]!, intersection);
      addRoofDissolveSplitPoint(splitPoints[secondIndex]!, intersection);
    }
  }

  const fragments: JoinedRoofWavefrontSegment[] = [];
  for (const [index, segment] of segments.entries()) {
    const ordered = splitPoints[index]!
      .map((candidate) => ({
        point: roofPoint2FromKey(roofPoint2Key(candidate)),
        t: roofSegmentParam(segment.start, segment.end, candidate),
      }))
      .filter((candidate) => candidate.t >= -ROOF_JOIN_EPSILON_MM && candidate.t <= 1 + ROOF_JOIN_EPSILON_MM)
      .sort((a, b) => a.t - b.t);
    const unique: RoofPoint2[] = [];
    for (const candidate of ordered) {
      addRoofDissolveSplitPoint(unique, candidate.point);
    }
    for (let pointIndex = 0; pointIndex < unique.length - 1; pointIndex += 1) {
      const start = unique[pointIndex]!;
      const end = unique[pointIndex + 1]!;
      if (roofPointDistance2(start, end) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM * ROOF_JOIN_FEATURE_MIN_LENGTH_MM) continue;
      fragments.push({ edge: segment.edge, start, end });
    }
  }
  return fragments;
}

function removeCanceledJoinedRoofWavefrontSegments(
  fragments: JoinedRoofWavefrontSegment[],
): { segments: JoinedRoofWavefrontSegment[]; canceledCount: number; nonManifoldCount: number } {
  const remaining = new Map<string, JoinedRoofWavefrontSegment[]>();
  let canceledCount = 0;
  let nonManifoldCount = 0;

  for (const fragment of fragments) {
    const startKey = roofPoint2Key(fragment.start);
    const endKey = roofPoint2Key(fragment.end);
    if (startKey === endKey) continue;
    const key = `${startKey}|${endKey}`;
    const reverseKey = `${endKey}|${startKey}`;
    const reverse = remaining.get(reverseKey);
    if (reverse?.length) {
      reverse.pop();
      canceledCount += 1;
      if (reverse.length === 0) remaining.delete(reverseKey);
      continue;
    }
    const existing = remaining.get(key) ?? [];
    if (existing.length > 0) nonManifoldCount += 1;
    existing.push(fragment);
    remaining.set(key, existing);
  }

  return {
    segments: [...remaining.values()].flat(),
    canceledCount,
    nonManifoldCount,
  };
}

function polygonizeJoinedRoofWavefrontSegments(
  segments: JoinedRoofWavefrontSegment[],
): JoinedRoofWavefrontLoop[] | null {
  const unused = new Map<string, JoinedRoofWavefrontSegment>();
  const outgoing = new Map<string, string[]>();
  for (const [index, segment] of segments.entries()) {
    const key = `${roofPoint2Key(segment.start)}|${roofPoint2Key(segment.end)}|${index}`;
    unused.set(key, segment);
    const startKey = roofPoint2Key(segment.start);
    const existing = outgoing.get(startKey) ?? [];
    existing.push(key);
    outgoing.set(startKey, existing);
  }

  const loops: JoinedRoofWavefrontLoop[] = [];
  while (unused.size > 0) {
    const firstEntry = unused.entries().next().value as [string, JoinedRoofWavefrontSegment] | undefined;
    if (!firstEntry) break;
    const [firstKey, firstSegment] = firstEntry;
    unused.delete(firstKey);
    const startKey = roofPoint2Key(firstSegment.start);
    let currentKey = roofPoint2Key(firstSegment.end);
    const loopSegments: JoinedRoofWavefrontSegment[] = [firstSegment];
    let guard = 0;
    while (currentKey !== startKey && guard <= segments.length + 1) {
      guard += 1;
      const candidates = (outgoing.get(currentKey) ?? []).filter((key) => unused.has(key)).sort();
      const nextKey = candidates[0];
      if (!nextKey) return null;
      const nextSegment = unused.get(nextKey);
      if (!nextSegment) return null;
      unused.delete(nextKey);
      loopSegments.push(nextSegment);
      currentKey = roofPoint2Key(nextSegment.end);
    }
    if (currentKey !== startKey) return null;
    if (loopSegments.length >= 3 && Math.abs(joinedRoofWavefrontLoopArea({ segments: loopSegments })) > ROOF_REGION_MIN_AREA_MM2) {
      loops.push({ segments: loopSegments });
    }
  }
  return loops;
}

function advanceJoinedRoofWavefrontLoop(input: {
  loop: JoinedRoofWavefrontLoop;
  distanceMm: number;
}): {
  loops: JoinedRoofWavefrontLoop[];
  canceledSegmentCount: number;
  nonManifoldSegmentCount: number;
  failureReason: string | null;
} {
  const movedSegments = joinedRoofWavefrontMovedSegments(input.loop, input.distanceMm).filter(
    (segment) => roofPointDistance2(segment.start, segment.end) > ROOF_JOIN_FEATURE_MIN_LENGTH_MM * ROOF_JOIN_FEATURE_MIN_LENGTH_MM,
  );
  if (movedSegments.length < 3) {
    return { loops: [], canceledSegmentCount: 0, nonManifoldSegmentCount: 0, failureReason: null };
  }

  const splitSegments = splitJoinedRoofWavefrontSegments(movedSegments);
  const canceled = removeCanceledJoinedRoofWavefrontSegments(splitSegments);
  if (canceled.nonManifoldCount > 0) {
    return {
      loops: [],
      canceledSegmentCount: canceled.canceledCount,
      nonManifoldSegmentCount: canceled.nonManifoldCount,
      failureReason: 'roof_wavefront_non_manifold_boundary',
    };
  }
  if (canceled.segments.length === 0) {
    return {
      loops: [],
      canceledSegmentCount: canceled.canceledCount,
      nonManifoldSegmentCount: 0,
      failureReason: null,
    };
  }
  const loops = polygonizeJoinedRoofWavefrontSegments(canceled.segments);
  if (!loops) {
    return {
      loops: [],
      canceledSegmentCount: canceled.canceledCount,
      nonManifoldSegmentCount: canceled.nonManifoldCount,
      failureReason: 'roof_wavefront_unclosed_boundary',
    };
  }
  return {
    loops,
    canceledSegmentCount: canceled.canceledCount,
    nonManifoldSegmentCount: 0,
    failureReason: null,
  };
}

function buildJoinedRoofWavefrontRegions(input: {
  eavePolygon: Polygon3;
  edges: JoinedRoofEdge[];
}): JoinedRoofWavefrontResult {
  let loops: JoinedRoofWavefrontLoop[] = [
    {
      segments: input.edges.map((edge) => ({
        edge,
        start: point2FromPoint3(edge.start),
        end: point2FromPoint3(edge.end),
      })),
    },
  ];
  const regions: JoinedRoofRegion[] = [];
  let failureReason: string | null = null;
  let eventCount = 0;
  let maxLoopCount = loops.length;
  let canceledSegmentCount = 0;
  let nonManifoldSegmentCount = 0;
  const maxEvents = Math.max(16, input.edges.length * input.edges.length * 4);

  while (loops.length > 0 && eventCount < maxEvents) {
    const distanceMm = findNextJoinedRoofWavefrontDistance(loops);
    if (distanceMm === null) {
      failureReason = 'roof_wavefront_missing_next_event';
      break;
    }
    eventCount += 1;
    const nextLoops: JoinedRoofWavefrontLoop[] = [];
    for (const loop of loops) {
      regions.push(...joinedRoofWavefrontSweptRegions(loop, distanceMm));
      const advanced = advanceJoinedRoofWavefrontLoop({ loop, distanceMm });
      canceledSegmentCount += advanced.canceledSegmentCount;
      nonManifoldSegmentCount += advanced.nonManifoldSegmentCount;
      failureReason ??= advanced.failureReason;
      nextLoops.push(...advanced.loops);
    }
    if (failureReason) break;
    loops = nextLoops;
    maxLoopCount = Math.max(maxLoopCount, loops.length);
  }

  if (!failureReason && loops.length > 0) {
    failureReason = 'roof_wavefront_event_limit';
  }

  return {
    regions,
    failureReason,
    metadata: {
      roofWavefrontSolverMode: 'active_rectilinear_wavefront',
      roofWavefrontEventCount: eventCount,
      roofWavefrontMaxLoopCount: maxLoopCount,
      roofWavefrontAtomCount: regions.length,
      roofWavefrontCanceledSegmentCount: canceledSegmentCount,
      roofWavefrontNonManifoldSegmentCount: nonManifoldSegmentCount,
      roofWavefrontFailureReason: failureReason,
    },
  };
}

function roofPoint2FromKey(key: string): RoofPoint2 {
  const [x, y] = key.split(',').map(Number);
  return { x: x ?? 0, y: y ?? 0 };
}

function pointOnRoofSegment2(candidate: RoofPoint2, start: RoofPoint2, end: RoofPoint2): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const cross = (candidate.x - start.x) * dy - (candidate.y - start.y) * dx;
  if (Math.abs(cross) > 1e-2) return false;
  const dot = (candidate.x - start.x) * dx + (candidate.y - start.y) * dy;
  if (dot < -1e-2) return false;
  return dot <= dx * dx + dy * dy + 1e-2;
}

function roofSegmentParam(start: RoofPoint2, end: RoofPoint2, candidate: RoofPoint2): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) return 0;
  return ((candidate.x - start.x) * dx + (candidate.y - start.y) * dy) / lengthSq;
}

function addRoofDissolveSplitPoint(points: RoofPoint2[], candidate: RoofPoint2): void {
  if (!points.some((existing) => roofPointDistance2(existing, candidate) <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM)) {
    points.push(candidate);
  }
}

function roofSegmentIntersectionPoint(
  aStart: RoofPoint2,
  aEnd: RoofPoint2,
  bStart: RoofPoint2,
  bEnd: RoofPoint2,
): RoofPoint2 | null {
  const aDx = aEnd.x - aStart.x;
  const aDy = aEnd.y - aStart.y;
  const bDx = bEnd.x - bStart.x;
  const bDy = bEnd.y - bStart.y;
  const denominator = aDx * bDy - aDy * bDx;
  if (Math.abs(denominator) <= 1e-6) return null;
  const t = ((bStart.x - aStart.x) * bDy - (bStart.y - aStart.y) * bDx) / denominator;
  const u = ((bStart.x - aStart.x) * aDy - (bStart.y - aStart.y) * aDx) / denominator;
  if (t < -ROOF_JOIN_EPSILON_MM || t > 1 + ROOF_JOIN_EPSILON_MM) return null;
  if (u < -ROOF_JOIN_EPSILON_MM || u > 1 + ROOF_JOIN_EPSILON_MM) return null;
  return {
    x: aStart.x + aDx * clamp(t, 0, 1),
    y: aStart.y + aDy * clamp(t, 0, 1),
  };
}

function splitRoofDissolveSegments(segments: RoofDissolveSegment[]): RoofDissolveSegment[] {
  const splitPoints = segments.map((segment) => [segment.start, segment.end]);

  for (let firstIndex = 0; firstIndex < segments.length; firstIndex += 1) {
    const first = segments[firstIndex]!;
    for (let secondIndex = firstIndex + 1; secondIndex < segments.length; secondIndex += 1) {
      const second = segments[secondIndex]!;
      const firstDx = first.end.x - first.start.x;
      const firstDy = first.end.y - first.start.y;
      const secondDx = second.end.x - second.start.x;
      const secondDy = second.end.y - second.start.y;
      const firstLength = Math.hypot(firstDx, firstDy);
      const secondLength = Math.hypot(secondDx, secondDy);
      if (firstLength <= ROOF_JOIN_EPSILON_MM || secondLength <= ROOF_JOIN_EPSILON_MM) continue;

      const directionCross = Math.abs(firstDx * secondDy - firstDy * secondDx) / (firstLength * secondLength);
      if (directionCross <= 1e-6) {
        for (const candidate of [first.start, first.end]) {
          if (pointOnRoofSegment2(candidate, second.start, second.end)) {
            addRoofDissolveSplitPoint(splitPoints[secondIndex]!, candidate);
          }
        }
        for (const candidate of [second.start, second.end]) {
          if (pointOnRoofSegment2(candidate, first.start, first.end)) {
            addRoofDissolveSplitPoint(splitPoints[firstIndex]!, candidate);
          }
        }
        continue;
      }

      const intersection = roofSegmentIntersectionPoint(first.start, first.end, second.start, second.end);
      if (!intersection) continue;
      addRoofDissolveSplitPoint(splitPoints[firstIndex]!, intersection);
      addRoofDissolveSplitPoint(splitPoints[secondIndex]!, intersection);
    }
  }

  const fragments: RoofDissolveSegment[] = [];
  for (const [index, segment] of segments.entries()) {
    const ordered = splitPoints[index]!
      .map((candidate) => ({
        point: roofPoint2FromKey(roofPoint2Key(candidate)),
        t: roofSegmentParam(segment.start, segment.end, candidate),
      }))
      .filter((candidate) => candidate.t >= -ROOF_JOIN_EPSILON_MM && candidate.t <= 1 + ROOF_JOIN_EPSILON_MM)
      .sort((a, b) => a.t - b.t);
    const unique: RoofPoint2[] = [];
    for (const candidate of ordered) {
      addRoofDissolveSplitPoint(unique, candidate.point);
    }
    for (let pointIndex = 0; pointIndex < unique.length - 1; pointIndex += 1) {
      const start = unique[pointIndex]!;
      const end = unique[pointIndex + 1]!;
      if (roofPointDistance2(start, end) <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) continue;
      fragments.push({ start, end });
    }
  }
  return fragments;
}

function addDissolvedRoofBoundaryFragment(fragments: Map<string, number>, start: RoofPoint2, end: RoofPoint2): void {
  const startKey = roofPoint2Key(start);
  const endKey = roofPoint2Key(end);
  if (startKey === endKey) return;
  const key = `${startKey}|${endKey}`;
  const reverseKey = `${endKey}|${startKey}`;
  const reverseCount = fragments.get(reverseKey) ?? 0;
  if (reverseCount > 1) {
    fragments.set(reverseKey, reverseCount - 1);
    return;
  }
  if (reverseCount === 1) {
    fragments.delete(reverseKey);
    return;
  }
  fragments.set(key, (fragments.get(key) ?? 0) + 1);
}

function selectNextDissolvedRoofSegment(
  candidateKeys: string[],
  unused: Map<string, RoofDissolveSegment>,
  previous: RoofPoint2,
  current: RoofPoint2,
): string | null {
  if (candidateKeys.length === 0) return null;
  if (candidateKeys.length === 1) return candidateKeys[0] ?? null;
  const incomingX = current.x - previous.x;
  const incomingY = current.y - previous.y;
  const incomingLength = Math.hypot(incomingX, incomingY);
  if (incomingLength <= ROOF_JOIN_EPSILON_MM) return [...candidateKeys].sort()[0] ?? null;

  return [...candidateKeys]
    .map((key) => {
      const segment = unused.get(key)!;
      const outgoingX = segment.end.x - segment.start.x;
      const outgoingY = segment.end.y - segment.start.y;
      const cross = incomingX * outgoingY - incomingY * outgoingX;
      const dot = incomingX * outgoingX + incomingY * outgoingY;
      const angle = Math.atan2(cross, dot);
      return {
        key,
        leftTurnAngle: angle <= ROOF_JOIN_EPSILON_MM ? angle + Math.PI * 2 : angle,
      };
    })
    .sort((a, b) => a.leftTurnAngle - b.leftTurnAngle || a.key.localeCompare(b.key))[0]?.key ?? null;
}

function polygonizeDissolvedRoofSegments(segments: Map<string, RoofDissolveSegment>): RoofPoint2[][] | null {
  const unused = new Map(segments);
  const outgoing = new Map<string, string[]>();
  for (const [key, segment] of unused) {
    const startKey = roofPoint2Key(segment.start);
    const existing = outgoing.get(startKey) ?? [];
    existing.push(key);
    outgoing.set(startKey, existing);
  }

  const loops: RoofPoint2[][] = [];
  while (unused.size > 0) {
    const firstEntry = unused.entries().next().value as [string, RoofDissolveSegment] | undefined;
    if (!firstEntry) break;
    const [firstKey, firstSegment] = firstEntry;
    unused.delete(firstKey);

    const startKey = roofPoint2Key(firstSegment.start);
    let currentKey = roofPoint2Key(firstSegment.end);
    const loop: RoofPoint2[] = [firstSegment.start, firstSegment.end];
    let previousPoint = firstSegment.start;
    let currentPoint = firstSegment.end;
    let guard = 0;

    while (currentKey !== startKey && guard <= segments.size + 1) {
      guard += 1;
      const candidates = (outgoing.get(currentKey) ?? []).filter((key) => unused.has(key));
      const nextKey = selectNextDissolvedRoofSegment(candidates, unused, previousPoint, currentPoint);
      if (!nextKey) return null;
      const nextSegment = unused.get(nextKey);
      if (!nextSegment) return null;
      unused.delete(nextKey);
      loop.push(nextSegment.end);
      previousPoint = nextSegment.start;
      currentPoint = nextSegment.end;
      currentKey = roofPoint2Key(nextSegment.end);
    }

    if (currentKey !== startKey) return null;
    const cleaned = cleanRoofPolygon2D(loop);
    if (cleaned.length < 3 || roofPolygonArea(cleaned) <= ROOF_REGION_MIN_AREA_MM2) return null;
    loops.push(signedArea2D(cleaned) < 0 ? [...cleaned].reverse() : cleaned);
  }

  return loops;
}

function roofPolygonContactLengthWithEdge(polygon: RoofPoint2[], edge: JoinedRoofEdge): number {
  let contactLength = 0;
  const edgeStart = point2FromPoint3(edge.start);
  const edgeEnd = point2FromPoint3(edge.end);
  for (let index = 0; index < polygon.length; index += 1) {
    contactLength += roofSegmentOverlapLength2D(polygon[index]!, polygon[(index + 1) % polygon.length]!, edgeStart, edgeEnd);
  }
  return contactLength;
}

function dissolveJoinedRoofRegions(edge: JoinedRoofEdge, regions: JoinedRoofRegion[]): RoofRegionDissolveResult {
  if (!regions.length) {
    return { ok: false, reason: 'missing_source_regions', sourceRegionCount: 0 };
  }

  const segments: RoofDissolveSegment[] = [];
  for (const region of regions) {
    const cleanedFootprint = cleanRoofPolygon2D(region.footprint);
    const footprint = signedArea2D(cleanedFootprint) < 0 ? [...cleanedFootprint].reverse() : cleanedFootprint;
    for (let index = 0; index < footprint.length; index += 1) {
      const start = footprint[index]!;
      const end = footprint[(index + 1) % footprint.length]!;
      if (roofPointDistance2(start, end) <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) continue;
      segments.push({ start, end });
    }
  }

  const boundaryFragmentCounts = new Map<string, number>();
  for (const fragment of splitRoofDissolveSegments(segments)) {
    addDissolvedRoofBoundaryFragment(boundaryFragmentCounts, fragment.start, fragment.end);
  }

  const boundarySegments = new Map<string, RoofDissolveSegment>();
  for (const [key, count] of boundaryFragmentCounts) {
    if (count !== 1) {
      return { ok: false, reason: 'overlapping_boundary_fragments', sourceRegionCount: regions.length };
    }
    const [startKey, endKey] = key.split('|');
    if (!startKey || !endKey) {
      return { ok: false, reason: 'invalid_boundary_fragment_key', sourceRegionCount: regions.length };
    }
    boundarySegments.set(key, { start: roofPoint2FromKey(startKey), end: roofPoint2FromKey(endKey) });
  }

  const loops = polygonizeDissolvedRoofSegments(boundarySegments);
  if (!loops) {
    return { ok: false, reason: 'unclosed_boundary_graph', sourceRegionCount: regions.length };
  }
  const loopCandidates = loops
    .map((loop) => ({
      loop,
      contactLength: roofPolygonContactLengthWithEdge(loop, edge),
      area: roofPolygonArea(loop),
    }))
    .sort((a, b) => b.contactLength - a.contactLength || b.area - a.area);
  const sourceContactLoops = loopCandidates.filter((candidate) => candidate.contactLength > ROOF_JOIN_FEATURE_MIN_LENGTH_MM);
  const disconnectedLoops = loopCandidates.filter((candidate) => candidate.contactLength <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM);
  if (sourceContactLoops.length === 0) {
    return {
      ok: false,
      reason: 'merged_face_missing_source_edge_contact',
      sourceRegionCount: regions.length,
    };
  }

  const footprints = [...sourceContactLoops.map((candidate) => candidate.loop), ...disconnectedLoops.map((candidate) => candidate.loop)]
    .map((loop) => cleanRoofPolygon2D(loop))
    .filter((loop) => loop.length >= 3 && roofPolygonArea(loop) > ROOF_REGION_MIN_AREA_MM2);
  for (const footprint of footprints) {
    if (!roofPolygonIsSimple(footprint)) {
      return { ok: false, reason: 'self_intersecting_merged_face', sourceRegionCount: regions.length };
    }
  }

  return { ok: true, footprints, sourceRegionCount: regions.length, discardedLoopCount: 0 };
}

function mergeAssignedRoofRegions(regions: JoinedRoofRegion[]): {
  regions: JoinedRoofRegion[];
  topologyFailureReason: string | null;
  dissolvedRegionCount: number;
  atomicRegionCount: number;
  discardedLoopCount: number;
} {
  const byEdge = new Map<number, JoinedRoofRegion[]>();
  for (const region of regions) {
    const existing = byEdge.get(region.edge.index) ?? [];
    existing.push(region);
    byEdge.set(region.edge.index, existing);
  }

  const merged: JoinedRoofRegion[] = [];
  let topologyFailureReason: string | null = null;
  let dissolvedRegionCount = 0;
  let discardedLoopCount = 0;
  for (const edgeRegions of byEdge.values()) {
    const edge = edgeRegions[0]!.edge;
    const dissolved = dissolveJoinedRoofRegions(edge, edgeRegions);
    if (!dissolved.ok) {
      topologyFailureReason ??= `${edge.id}:${dissolved.reason}`;
      continue;
    }
    dissolvedRegionCount += Math.max(0, dissolved.sourceRegionCount - 1);
    discardedLoopCount += dissolved.discardedLoopCount;
    merged.push(...dissolved.footprints.map((footprint) => ({ edge, footprint })));
  }

  return {
    regions: merged.sort(
      (a, b) =>
        a.edge.index - b.edge.index ||
        roofPolygonCentroid(a.footprint).x - roofPolygonCentroid(b.footprint).x ||
        roofPolygonCentroid(a.footprint).y - roofPolygonCentroid(b.footprint).y,
    ),
    topologyFailureReason,
    dissolvedRegionCount,
    atomicRegionCount: regions.length,
    discardedLoopCount,
  };
}

function validateJoinedRoofRegionFootprint(region: RoofPoint2[], eavePolygon: Polygon3): RoofPoint2[] | null {
  const footprint = cleanRoofPolygon2D(region);
  if (footprint.length < 3) return null;
  if (footprint.some((candidate) => !Number.isFinite(candidate.x) || !Number.isFinite(candidate.y))) return null;
  if (roofPolygonArea(footprint) <= ROOF_REGION_MIN_AREA_MM2) return null;
  if (!roofPolygonIsSimple(footprint)) return null;
  if (!roofRegionInsideEave(footprint, eavePolygon)) return null;
  return footprint;
}

function sortJoinedRoofRegions(regions: JoinedRoofRegion[]): JoinedRoofRegion[] {
  return [...regions].sort(
    (a, b) =>
      a.edge.index - b.edge.index ||
      roofPolygonCentroid(a.footprint).x - roofPolygonCentroid(b.footprint).x ||
      roofPolygonCentroid(a.footprint).y - roofPolygonCentroid(b.footprint).y,
  );
}

function buildJoinedRoofFacetFromRegion(input: {
  region: JoinedRoofRegion;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  pitchRisePerRun: number;
  allowRaisedBoundaryPoints?: boolean;
}): JoinedRoofFacet | null {
  const footprint = validateJoinedRoofRegionFootprint(input.region.footprint, input.eavePolygon);
  if (!footprint) return null;

  const boundary = footprint.map((candidate) =>
    point(
      candidate.x,
      candidate.y,
      roofHeightFromEdge({
        edge: input.region.edge,
        candidate,
        eaveHeightMm: input.eaveHeightMm,
        pitchRisePerRun: input.pitchRisePerRun,
      }),
    ),
  );
  if (boundary.some((candidate) => !Number.isFinite(candidate.x) || !Number.isFinite(candidate.y) || !Number.isFinite(candidate.z))) {
    return null;
  }
  if (
    !input.allowRaisedBoundaryPoints &&
    boundary.some((candidate) => roofPointOnEaveBoundaryAtWrongHeight(candidate, input.eavePolygon, input.eaveHeightMm))
  ) {
    return null;
  }
  return { edge: input.region.edge, footprint, boundary };
}

function buildJoinedRoofFacets(input: {
  eavePolygon: Polygon3;
  edges: JoinedRoofEdge[];
  eaveHeightMm: number;
  pitchRisePerRun: number;
}): JoinedRoofFacetBuildResult {
  const baseRegions = buildRectilinearRoofBaseRegions(input.eavePolygon);
  const splitRegions = splitRoofRegionsByPlaneIntersections({
    regions: baseRegions,
    edges: input.edges,
    eaveHeightMm: input.eaveHeightMm,
    pitchRisePerRun: input.pitchRisePerRun,
  });
  const assignedRegions = splitRegions
    .map((footprint) =>
      assignRoofRegion({
        footprint,
        edges: input.edges,
        eavePolygon: input.eavePolygon,
        eaveHeightMm: input.eaveHeightMm,
        pitchRisePerRun: input.pitchRisePerRun,
      }),
    )
    .filter((region): region is JoinedRoofRegion => Boolean(region));
  const wavefrontRegions = buildJoinedRoofWavefrontRegions({
    eavePolygon: input.eavePolygon,
    edges: input.edges,
  });
  const mergedRegions = mergeAssignedRoofRegions(wavefrontRegions.regions);
  const facets: JoinedRoofFacet[] = [];
  let rejectedFacetCount = 0;

  for (const region of sortJoinedRoofRegions(mergedRegions.regions)) {
    const facet = buildJoinedRoofFacetFromRegion({
      region,
      eavePolygon: input.eavePolygon,
      eaveHeightMm: input.eaveHeightMm,
      pitchRisePerRun: input.pitchRisePerRun,
    });
    if (facet) {
      facets.push(facet);
    } else {
      rejectedFacetCount += 1;
    }
  }

  const internalEaveHeightSegmentCount = countJoinedRoofInternalEaveHeightSegments({
    facets,
    eavePolygon: input.eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
  });
  const sourceEdgeCount = new Set(facets.map((facet) => facet.edge.index)).size;
  const disconnectedSourceFaceCount = Math.max(0, facets.length - sourceEdgeCount);
  let topologyFailureReason = wavefrontRegions.failureReason ?? mergedRegions.topologyFailureReason;
  if (!topologyFailureReason && facets.length !== input.edges.length) {
    topologyFailureReason = `roof_topology_face_count_mismatch:${facets.length}:${input.edges.length}`;
  }
  if (!topologyFailureReason && disconnectedSourceFaceCount > 0) {
    topologyFailureReason = 'roof_topology_disconnected_source_faces';
  }
  if (!topologyFailureReason && internalEaveHeightSegmentCount > 0) {
    topologyFailureReason = 'roof_topology_internal_eave_height_seams';
  }

  return {
    facets,
    metadata: {
      roofFacetMergeMode: 'active_rectilinear_wavefront',
      ...wavefrontRegions.metadata,
      roofBaseRegionCount: baseRegions.length,
      roofSplitRegionCount: splitRegions.length,
      roofAssignedRegionCount: assignedRegions.length,
      roofAtomicRegionCount: mergedRegions.atomicRegionCount,
      roofDissolvedRegionCount: mergedRegions.dissolvedRegionCount,
      roofDiscardedDissolveLoopCount: mergedRegions.discardedLoopCount,
      roofFacetComponentCount: mergedRegions.regions.length,
      roofPreservedRegionFacetCount: facets.length,
      roofRejectedFacetCount: rejectedFacetCount,
      roofTopologyFailureReason: topologyFailureReason,
      roofTopologyFinalFaceCount: facets.length,
      roofTopologySourceEdgeCount: sourceEdgeCount,
      roofTopologyDisconnectedSourceFaceCount: disconnectedSourceFaceCount,
      roofTopologyInternalEaveHeightSegmentCount: internalEaveHeightSegmentCount,
      roofTopologyProjectionViolationCount: 0,
    },
  };
}

function pointOnRoofSegment2D(candidate: Point3, start: Point3, end: Point3): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const cross = (candidate.x - start.x) * dy - (candidate.y - start.y) * dx;
  if (Math.abs(cross) > 1e-2) return false;
  const dot = (candidate.x - start.x) * dx + (candidate.y - start.y) * dy;
  if (dot < -1e-2) return false;
  const lengthSq = dx * dx + dy * dy;
  return dot <= lengthSq + 1e-2;
}

function roofFeatureTouchesPoint(feature: Line3, candidate: Point3): boolean {
  return (
    Math.hypot(feature.start.x - candidate.x, feature.start.y - candidate.y, feature.start.z - candidate.z) <= 1 ||
    Math.hypot(feature.end.x - candidate.x, feature.end.y - candidate.y, feature.end.z - candidate.z) <= 1
  );
}

function countJoinedRoofInternalEaveHeightSegments(input: {
  facets: JoinedRoofFacet[];
  eavePolygon: Polygon3;
  eaveHeightMm: number;
}): number {
  const seen = new Set<string>();
  for (const facet of input.facets) {
    for (let index = 0; index < facet.boundary.length; index += 1) {
      const start = facet.boundary[index]!;
      const end = facet.boundary[(index + 1) % facet.boundary.length]!;
      if (
        Math.abs(start.z - input.eaveHeightMm) > 1 ||
        Math.abs(end.z - input.eaveHeightMm) > 1 ||
        lineLength(line(start, end)) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM
      ) {
        continue;
      }
      if (
        segmentOnEaveBoundary({
          start,
          end,
          eavePolygon: input.eavePolygon,
          eaveHeightMm: input.eaveHeightMm,
        })
      ) {
        continue;
      }
      seen.add(canonicalRoofSegmentKey(start, end));
    }
  }
  return seen.size;
}

function segmentOnEaveBoundary(input: { start: Point3; end: Point3; eavePolygon: Polygon3; eaveHeightMm: number }): boolean {
  if (
    Math.abs(input.start.z - input.eaveHeightMm) > ROOF_JOIN_EPSILON_MM ||
    Math.abs(input.end.z - input.eaveHeightMm) > ROOF_JOIN_EPSILON_MM
  ) {
    return false;
  }
  let overlapLength = 0;
  const segmentLength = lineLength(line(input.start, input.end));
  for (let index = 0; index < input.eavePolygon.length; index += 1) {
    const edgeStart = input.eavePolygon[index]!;
    const edgeEnd = input.eavePolygon[(index + 1) % input.eavePolygon.length]!;
    overlapLength += roofSegmentOverlapLength2D(
      point2FromPoint3(input.start),
      point2FromPoint3(input.end),
      point2FromPoint3(edgeStart),
      point2FromPoint3(edgeEnd),
    );
  }
  return overlapLength >= segmentLength - ROOF_JOIN_FEATURE_MIN_LENGTH_MM;
}

function findEaveVertexIndex(candidate: Point3, eavePolygon: Polygon3, eaveHeightMm: number): number | null {
  if (Math.abs(candidate.z - eaveHeightMm) > 1) return null;
  for (let index = 0; index < eavePolygon.length; index += 1) {
    const vertex = eavePolygon[index]!;
    if (Math.hypot(candidate.x - vertex.x, candidate.y - vertex.y) <= 1) return index;
  }
  return null;
}

function findEaveVertexIndexXY(candidate: Point3, eavePolygon: Polygon3): number | null {
  for (let index = 0; index < eavePolygon.length; index += 1) {
    const vertex = eavePolygon[index]!;
    if (Math.hypot(candidate.x - vertex.x, candidate.y - vertex.y) <= 1) return index;
  }
  return null;
}

function classifyJoinedRoofFeature(input: {
  start: Point3;
  end: Point3;
  sourceEdges: JoinedRoofEdge[];
  eavePolygon: Polygon3;
  eaveHeightMm: number;
}): HouseRoofFeatureKind {
  const startVertexIndex = findEaveVertexIndex(input.start, input.eavePolygon, input.eaveHeightMm);
  if (startVertexIndex !== null) return vertexFeatureKind(input.eavePolygon, startVertexIndex);
  const endVertexIndex = findEaveVertexIndex(input.end, input.eavePolygon, input.eaveHeightMm);
  if (endVertexIndex !== null) return vertexFeatureKind(input.eavePolygon, endVertexIndex);
  if (Math.min(input.start.z, input.end.z) > input.eaveHeightMm + 1) return 'ridge';
  if (input.sourceEdges.length >= 2) {
    const first = input.sourceEdges[0]!;
    const second = input.sourceEdges[1]!;
    const normalDot = first.inwardNormal.x * second.inwardNormal.x + first.inwardNormal.y * second.inwardNormal.y;
    if (normalDot < -0.5) return 'ridge';
  }
  return 'hip';
}

function buildJoinedRoofFeatures(input: {
  facets: JoinedRoofFacet[];
  edges: JoinedRoofEdge[];
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofForm: HouseRoofForm;
  roofGeometry: string;
}): HouseRoofFeature3D[] {
  const segments = new Map<
    string,
    {
      start: Point3;
      end: Point3;
      sourceEdgeIndexes: Set<number>;
      count: number;
    }
  >();

  for (const facet of input.facets) {
    for (let index = 0; index < facet.boundary.length; index += 1) {
      const start = facet.boundary[index]!;
      const end = facet.boundary[(index + 1) % facet.boundary.length]!;
      if (lineLength(line(start, end)) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) continue;
      const key = canonicalRoofSegmentKey(start, end);
      const existing = segments.get(key);
      if (existing) {
        existing.sourceEdgeIndexes.add(facet.edge.index);
        existing.count += 1;
      } else {
        segments.set(key, { start, end, sourceEdgeIndexes: new Set([facet.edge.index]), count: 1 });
      }
    }
  }

  const drafts: JoinedRoofFeatureDraft[] = [];
  const seen = new Set<string>();
  for (const segment of segments.values()) {
    if (segment.count < 2) continue;
    if (segment.sourceEdgeIndexes.size < 2) continue;
    if (
      segmentOnEaveBoundary({
        start: segment.start,
        end: segment.end,
        eavePolygon: input.eavePolygon,
        eaveHeightMm: input.eaveHeightMm,
      })
    ) {
      continue;
    }
    const sourceEdges = [...segment.sourceEdgeIndexes]
      .map((index) => input.edges.find((edge) => edge.index === index))
      .filter((edge): edge is JoinedRoofEdge => Boolean(edge));
    const featureLine = orientRoofFeatureLine(segment.start, segment.end, input.eaveHeightMm);
    const featureKey = canonicalRoofSegmentKey(featureLine.start, featureLine.end);
    if (seen.has(featureKey)) continue;
    seen.add(featureKey);
    drafts.push({
      kind: classifyJoinedRoofFeature({
        start: featureLine.start,
        end: featureLine.end,
        sourceEdges,
        eavePolygon: input.eavePolygon,
        eaveHeightMm: input.eaveHeightMm,
      }),
      line: featureLine,
      sourceEdgeIds: sourceEdges.map((edge) => edge.id).sort(),
      roofFeatureSource: 'facet_adjacency',
    });
  }

  const highCandidates = input.facets.flatMap((facet) =>
    facet.boundary.filter((candidate) => candidate.z > input.eaveHeightMm + 1),
  );
  for (let index = 0; index < input.eavePolygon.length; index += 1) {
    if (vertexFeatureKind(input.eavePolygon, index) !== 'valley') continue;
    const vertex = point(input.eavePolygon[index]!.x, input.eavePolygon[index]!.y, input.eaveHeightMm);
    if (drafts.some((draft) => draft.kind === 'valley' && roofFeatureTouchesPoint(draft.line, vertex))) continue;
    const target = [...highCandidates]
      .filter((candidate) => {
        if (Math.hypot(candidate.x - vertex.x, candidate.y - vertex.y) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) return false;
        return segmentInsideRoofPolygon(vertex, candidate, input.eavePolygon);
      })
      .sort(
        (a, b) =>
          Math.hypot(a.x - vertex.x, a.y - vertex.y) - Math.hypot(b.x - vertex.x, b.y - vertex.y) ||
          a.z - b.z,
      )[0];
    if (!target || lineLength(line(vertex, target)) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) continue;
    const featureLine = orientRoofFeatureLine(vertex, target, input.eaveHeightMm);
    const featureKey = canonicalRoofSegmentKey(featureLine.start, featureLine.end);
    if (seen.has(featureKey)) continue;
    seen.add(featureKey);
    const previousEdge = input.edges.find((edge) => edge.index === (index - 1 + input.eavePolygon.length) % input.eavePolygon.length);
    const nextEdge = input.edges.find((edge) => edge.index === index);
    drafts.push({
      kind: 'valley',
      line: featureLine,
      sourceEdgeIds: [previousEdge?.id, nextEdge?.id].filter((edgeId): edgeId is string => Boolean(edgeId)).sort(),
      roofFeatureSource: 'reentrant_fallback',
    });
  }

  const kindOrder: Record<HouseRoofFeatureKind, number> = {
    ridge: 0,
    hip: 1,
    valley: 2,
    gable_end_frame: 3,
  };
  drafts.sort(
    (a, b) =>
      kindOrder[a.kind] - kindOrder[b.kind] ||
      compareRoofPoints(a.line.start, b.line.start) ||
      compareRoofPoints(a.line.end, b.line.end),
  );

  const counters: Record<HouseRoofFeatureKind, number> = {
    ridge: 0,
    hip: 0,
    valley: 0,
    gable_end_frame: 0,
  };
  return drafts.map((draft) => {
    counters[draft.kind] += 1;
    return {
      id: `house-roof-${draft.kind}-${counters[draft.kind]}`,
      kind: draft.kind,
      line: draft.line,
      metadata: {
        roofForm: input.roofForm,
        footprintFollowing: true,
        roofGeometry: input.roofGeometry,
        sourceEdgeIds: draft.sourceEdgeIds.join(','),
        roofFeatureSource: draft.roofFeatureSource,
      },
    };
  });
}

function buildJoinedRectilinearHippedRoof(input: {
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
}): {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  metadata?: GeometryMetadata;
} {
  const pitchRisePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);
  if (!Number.isFinite(pitchRisePerRun) || pitchRisePerRun <= 0) {
    return { roofPlanes: [], roofFeatures: [] };
  }
  const eavePolygon = cleanRoofPolygon2D(input.eavePolygon.map(point2FromPoint3)).map((candidate) =>
    point(candidate.x, candidate.y, 0),
  );
  if (eavePolygon.length < 4 || Math.abs(signedAreaXY(eavePolygon)) <= ROOF_JOIN_EPSILON_MM) {
    return { roofPlanes: [], roofFeatures: [] };
  }
  const edges = buildJoinedRoofEdges(eavePolygon);
  const facetResult = buildJoinedRoofFacets({
    eavePolygon,
    edges,
    eaveHeightMm: input.eaveHeightMm,
    pitchRisePerRun,
  });
  const facets = facetResult.facets;

  const roofPlanes: RoofPlane3D[] = [];
  const renderedFacets: JoinedRoofFacet[] = [];
  let skippedDegenerateFacetCount = 0;
  for (const facet of facets) {
    const highPoint = facet.boundary.reduce((selected, candidate) => (candidate.z > selected.z ? candidate : selected), facet.boundary[0]!);
    const lowPoint = point((facet.edge.start.x + facet.edge.end.x) / 2, (facet.edge.start.y + facet.edge.end.y) / 2, input.eaveHeightMm);
    if (lineLength(line(lowPoint, highPoint)) <= RIDGE_COLLAPSE_EPSILON_MM) {
      skippedDegenerateFacetCount += 1;
      continue;
    }
    roofPlanes.push(
      buildRoofPlane({
        id: `house-roof-edge-${roofPlanes.length + 1}`,
        boundary: facet.boundary,
        highPoint,
        lowPoint,
        ridgeAxis: facet.edge.ridgeAxis,
        pitchDeg: input.roofPitchDeg,
        metadata: {
          sourceEdgeId: facet.edge.id,
          footprintFollowing: true,
          roofGeometry: 'rectilinear_joined_hipped',
        },
      }),
    );
    renderedFacets.push(facet);
  }

  const roofFeatures = buildJoinedRoofFeatures({
    facets: renderedFacets,
    edges,
    eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
    roofForm: 'hipped',
    roofGeometry: 'rectilinear_joined_hipped',
  });
  const fallbackFeatureCount = roofFeatures.filter((feature) => feature.metadata?.roofFeatureSource === 'reentrant_fallback').length;
  const valleyFeatureCount = roofFeatures.filter((feature) => feature.kind === 'valley').length;
  const topologyFailureReason =
    typeof facetResult.metadata.roofTopologyFailureReason === 'string'
      ? facetResult.metadata.roofTopologyFailureReason
      : fallbackFeatureCount > 0
        ? 'roof_topology_fallback_features'
        : null;
  return {
    roofPlanes,
    roofFeatures,
    metadata: {
      ...facetResult.metadata,
      roofTopologyFailureReason: topologyFailureReason,
      roofRejectedFacetCount:
        (typeof facetResult.metadata.roofRejectedFacetCount === 'number' ? facetResult.metadata.roofRejectedFacetCount : 0) +
        skippedDegenerateFacetCount,
      roofFacetCount: roofPlanes.length,
      roofFeatureCount: roofFeatures.length,
      roofFallbackFeatureCount: fallbackFeatureCount,
      roofTopologyValleyCount: valleyFeatureCount,
    },
  };
}

function ridgeGraphTerminalNodes(features: HouseRoofFeature3D[]): Array<{
  point: Point3;
  neighbor: Point3;
}> {
  const ridges = features.filter((feature) => feature.kind === 'ridge');
  const degreeByKey = new Map<string, number>();
  const pointByKey = new Map<string, Point3>();
  const neighborsByKey = new Map<string, Point3[]>();

  for (const ridge of ridges) {
    const startKey = roofPoint2Key(point2FromPoint3(ridge.line.start));
    const endKey = roofPoint2Key(point2FromPoint3(ridge.line.end));
    pointByKey.set(startKey, ridge.line.start);
    pointByKey.set(endKey, ridge.line.end);
    degreeByKey.set(startKey, (degreeByKey.get(startKey) ?? 0) + 1);
    degreeByKey.set(endKey, (degreeByKey.get(endKey) ?? 0) + 1);
    neighborsByKey.set(startKey, [...(neighborsByKey.get(startKey) ?? []), ridge.line.end]);
    neighborsByKey.set(endKey, [...(neighborsByKey.get(endKey) ?? []), ridge.line.start]);
  }

  return [...degreeByKey.entries()]
    .filter(([, degree]) => degree === 1)
    .map(([key]) => ({
      point: pointByKey.get(key)!,
      neighbor: neighborsByKey.get(key)?.[0]!,
    }))
    .filter((candidate) => Boolean(candidate.point) && Boolean(candidate.neighbor));
}

function roofFeaturesAreAxisAligned(features: HouseRoofFeature3D[]): boolean {
  return features.every((feature) => {
    const dx = Math.abs(feature.line.end.x - feature.line.start.x);
    const dy = Math.abs(feature.line.end.y - feature.line.start.y);
    return dx <= 1e-6 || dy <= 1e-6;
  });
}

function convexHullRoofPoints(points: RoofPoint2[]): RoofPoint2[] {
  const sorted = [...points]
    .map((point) => ({
      x: Math.round(point.x * 1_000_000) / 1_000_000,
      y: Math.round(point.y * 1_000_000) / 1_000_000,
    }))
    .sort((left, right) => (left.x === right.x ? left.y - right.y : left.x - right.x))
    .filter((point, index, all) =>
      index === 0 || point.x !== all[index - 1]?.x || point.y !== all[index - 1]?.y,
    );
  if (sorted.length <= 2) return sorted;

  const cross = (origin: RoofPoint2, first: RoofPoint2, second: RoofPoint2) =>
    (first.x - origin.x) * (second.y - origin.y) - (first.y - origin.y) * (second.x - origin.x);

  const lower: RoofPoint2[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 1e-6) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: RoofPoint2[] = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 1e-6) {
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function roofPointOnSegment2D(candidate: RoofPoint2, start: RoofPoint2, end: RoofPoint2): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const cross = (candidate.x - start.x) * dy - (candidate.y - start.y) * dx;
  if (Math.abs(cross) > 1e-3) return false;
  const dot = (candidate.x - start.x) * dx + (candidate.y - start.y) * dy;
  if (dot < -1e-3) return false;
  return dot <= dx * dx + dy * dy + 1e-3;
}

function edgeLiesOnConvexHull(input: {
  polygon: Polygon3;
  edgeIndex: number;
}): boolean {
  const hull = convexHullRoofPoints(input.polygon.map(point2FromPoint3));
  const start = point2FromPoint3(input.polygon[input.edgeIndex]!);
  const end = point2FromPoint3(input.polygon[(input.edgeIndex + 1) % input.polygon.length]!);
  return hull.some((hullStart, index) => {
    const hullEnd = hull[(index + 1) % hull.length]!;
    return roofPointOnSegment2D(start, hullStart, hullEnd) && roofPointOnSegment2D(end, hullStart, hullEnd);
  });
}

function outwardNormalForEdge(input: {
  polygon: Polygon3;
  edgeIndex: number;
}): { x: number; y: number } | null {
  const start = input.polygon[input.edgeIndex]!;
  const end = input.polygon[(input.edgeIndex + 1) % input.polygon.length]!;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-6) return null;
  const unitX = dx / length;
  const unitY = dy / length;
  return signedAreaXY(input.polygon) >= 0
    ? { x: unitY, y: -unitX }
    : { x: -unitY, y: unitX };
}

function deriveHouseFootprintOpenSide(polygon: Polygon3): HouseFootprintOpenSide | null {
  if (!isOrthogonalFootprint(polygon)) return null;
  const valleyIndexes = polygon
    .map((_, index) => (vertexFeatureKind(polygon, index) === 'valley' ? index : null))
    .filter((index): index is number => index !== null);
  if (valleyIndexes.length !== 2) return null;

  const bridgeEdgeIndex = valleyIndexes.find((index) =>
    valleyIndexes.includes((index + 1) % polygon.length),
  );
  if (bridgeEdgeIndex == null) return null;

  const direction = outwardNormalForEdge({
    polygon,
    edgeIndex: bridgeEdgeIndex,
  });
  if (!direction) return null;
  return {
    bridgeEdgeIndex,
    direction,
  };
}

function deriveLegacyHouseGableTerminalEndsX(input: {
  footprint: Polygon3;
}): HouseGableTerminalEnd[] {
  const segments = input.footprint
    .map((start, index) => {
      const end = input.footprint[(index + 1) % input.footprint.length]!;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      if (length <= 1e-6) return null;
      const axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      if (axis !== 'y') return null;
      return {
        index,
        sourceEdgeId: `footprint-edge-${index + 1}`,
        midpoint: {
          x: (start.x + end.x) / 2,
          y: (start.y + end.y) / 2,
        },
      };
    })
    .filter((segment): segment is NonNullable<typeof segment> => Boolean(segment))
    .sort((left, right) => left.midpoint.x - right.midpoint.x || left.midpoint.y - right.midpoint.y || left.index - right.index);

  return segments.map((segment, index) => ({
    id: `house-gable-end-x-${segment.index + 1}`,
    sourceEdgeId: segment.sourceEdgeId,
    label: `End ${index + 1}`,
  }));
}

function intersectTerminalRayWithFootprint(input: {
  origin: Point3;
  neighbor: Point3;
  polygon: Polygon3;
}): number | null {
  return intersectTerminalRayWithFootprintDetail(input)?.edgeIndex ?? null;
}

function intersectTerminalRayWithFootprintDetail(input: {
  origin: Point3;
  neighbor: Point3;
  polygon: Polygon3;
}): HouseGableTerminalIntersection | null {
  const dx = input.origin.x - input.neighbor.x;
  const dy = input.origin.y - input.neighbor.y;
  const axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
  const direction = axis === 'x' ? Math.sign(dx || 1) : Math.sign(dy || 1);
  let selectedIndex: number | null = null;
  let selectedDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < input.polygon.length; index += 1) {
    const start = input.polygon[index]!;
    const end = input.polygon[(index + 1) % input.polygon.length]!;
    if (axis === 'x') {
      if (Math.abs(start.x - end.x) > 1e-6) continue;
      const minY = Math.min(start.y, end.y) - 1e-6;
      const maxY = Math.max(start.y, end.y) + 1e-6;
      if (input.origin.y < minY || input.origin.y > maxY) continue;
      const distance = (start.x - input.origin.x) * direction;
      if (distance <= ROOF_JOIN_EPSILON_MM || distance >= selectedDistance) continue;
      selectedDistance = distance;
      selectedIndex = index;
      continue;
    }
    if (Math.abs(start.y - end.y) > 1e-6) continue;
    const minX = Math.min(start.x, end.x) - 1e-6;
    const maxX = Math.max(start.x, end.x) + 1e-6;
    if (input.origin.x < minX || input.origin.x > maxX) continue;
    const distance = (start.y - input.origin.y) * direction;
    if (distance <= ROOF_JOIN_EPSILON_MM || distance >= selectedDistance) continue;
    selectedDistance = distance;
    selectedIndex = index;
  }

  if (selectedIndex === null) return null;
  const start = input.polygon[selectedIndex]!;
  return axis === 'x'
    ? {
        edgeIndex: selectedIndex,
        nodePoint: input.origin,
        point: point(start.x, input.origin.y, input.origin.z),
      }
    : {
        edgeIndex: selectedIndex,
        nodePoint: input.origin,
        point: point(input.origin.x, start.y, input.origin.z),
      };
}

function deriveBentSpineTerminalIntersectionsX(input: {
  footprint: Polygon3;
  ridgeFeatures: HouseRoofFeature3D[];
}): HouseGableTerminalIntersection[] | null {
  if (!input.ridgeFeatures.length || !roofFeaturesAreAxisAligned(input.ridgeFeatures)) return null;
  const terminalIntersections = ridgeGraphTerminalNodes(input.ridgeFeatures)
    .map((node) =>
      intersectTerminalRayWithFootprintDetail({
        origin: node.point,
        neighbor: node.neighbor,
        polygon: input.footprint,
      }),
    )
    .filter((detail): detail is HouseGableTerminalIntersection => detail !== null);
  const byEdgeIndex = new Map<number, HouseGableTerminalIntersection>();
  for (const detail of terminalIntersections) {
    byEdgeIndex.set(detail.edgeIndex, detail);
  }
  const uniqueIndexes = [...byEdgeIndex.keys()];
  const outerIndexes =
    uniqueIndexes.length > 2
      ? uniqueIndexes.filter((edgeIndex) =>
          edgeLiesOnConvexHull({
            polygon: input.footprint,
            edgeIndex,
          }),
        )
      : uniqueIndexes;
  const selectedIndexes = outerIndexes.length > 0 ? outerIndexes : uniqueIndexes;
  if (!selectedIndexes.length) return null;
  return selectedIndexes
    .map((edgeIndex) => byEdgeIndex.get(edgeIndex)!)
    .sort((left, right) => left.point.x - right.point.x || left.point.y - right.point.y);
}

function buildBentSpineGableTerminalEndsX(input: {
  footprint: Polygon3;
}): HouseGableTerminalEnd[] {
  if (!isOrthogonalFootprint(input.footprint)) return [];
  const eavePolygon = cleanRoofPolygon2D(input.footprint.map(point2FromPoint3)).map((candidate) =>
    point(candidate.x, candidate.y, 0),
  );
  if (eavePolygon.length < 4 || Math.abs(signedAreaXY(eavePolygon)) <= ROOF_JOIN_EPSILON_MM) return [];

  const edges = buildJoinedRoofEdges(eavePolygon);
  const facetResult = buildJoinedRoofFacets({
    eavePolygon,
    edges,
    eaveHeightMm: 0,
    pitchRisePerRun: 1,
  });
  const ridgeFeatures = buildJoinedRoofFeatures({
    facets: facetResult.facets,
    edges,
    eavePolygon,
    eaveHeightMm: 0,
    roofForm: 'gable',
    roofGeometry: 'bent_spine_joined_gable',
  }).filter((feature) => feature.kind === 'ridge');
  const terminalIntersections = deriveBentSpineTerminalIntersectionsX({
    footprint: eavePolygon,
    ridgeFeatures,
  });
  if (!terminalIntersections) {
    return deriveLegacyHouseGableTerminalEndsX({ footprint: eavePolygon });
  }
  return terminalIntersections
    .map((detail) => ({
      id: `house-gable-end-x-${detail.edgeIndex + 1}`,
      sourceEdgeId: `footprint-edge-${detail.edgeIndex + 1}`,
      midpoint: {
        x: detail.point.x,
        y: detail.point.y,
      },
    }))
    .sort((left, right) => left.midpoint.x - right.midpoint.x || left.midpoint.y - right.midpoint.y)
    .map((candidate, index) => ({
      id: candidate.id,
      sourceEdgeId: candidate.sourceEdgeId,
      label: `End ${index + 1}`,
    }));
}

function deriveBentSpineTerminalGableClosures(input: {
  terminalIntersections: HouseGableTerminalIntersection[] | null;
}): BentSpineTerminalGableClosure[] {
  return (input.terminalIntersections ?? []).map((detail) => ({
    edgeIndex: detail.edgeIndex,
    sourceEdgeId: `footprint-edge-${detail.edgeIndex + 1}`,
    nodePoint: detail.nodePoint,
    point: detail.point,
    axis:
      Math.abs(detail.point.x - detail.nodePoint.x) >= Math.abs(detail.point.y - detail.nodePoint.y)
        ? 'x'
        : 'y',
  }));
}

function applyBentSpineTerminalGableClosures(input: {
  facets: JoinedRoofFacet[];
  terminalClosures: BentSpineTerminalGableClosure[];
  eaveHeightMm: number;
  pitchRisePerRun: number;
}): JoinedRoofFacet[] {
  if (!input.terminalClosures.length) return input.facets;

  const closureByEdgeIndex = new Map(
    input.terminalClosures.map((closure) => [closure.edgeIndex, closure]),
  );
  const closureByNodeKey = new Map(
    input.terminalClosures.map((closure) => [roofPoint3Key(closure.nodePoint), closure]),
  );

  return input.facets.flatMap((facet) => {
    if (closureByEdgeIndex.has(facet.edge.index)) return [];

    const nextBoundary = facet.boundary.map((candidate) => {
      const closure = closureByNodeKey.get(roofPoint3Key(candidate));
      return closure ? closure.point : candidate;
    });
    const nextFootprint = cleanRoofPolygon2D(nextBoundary.map(point2FromPoint3));
    if (nextFootprint.length < 3 || roofPolygonArea(nextFootprint) <= ROOF_REGION_MIN_AREA_MM2) {
      return [];
    }

    const changed = nextBoundary.some(
      (candidate, index) => !samePoint3WithinTolerance(candidate, facet.boundary[index]!),
    );
    if (!changed) return [facet];

    return [{
      ...facet,
      footprint: nextFootprint,
      boundary: nextFootprint.map((candidate) =>
        point(
          candidate.x,
          candidate.y,
          roofHeightFromEdge({
            edge: facet.edge,
            candidate,
            eaveHeightMm: input.eaveHeightMm,
            pitchRisePerRun: input.pitchRisePerRun,
          }),
        ),
      ),
    }];
  });
}

function buildLegacyJoinedRectilinearGableRoof(input: {
  sourceFootprint: Polygon3;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  ridgeAxis: HouseRoofRidgeAxis;
}): {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  metadata?: GeometryMetadata;
} {
  const pitchRisePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);
  if (!Number.isFinite(pitchRisePerRun) || pitchRisePerRun <= 0) {
    return { roofPlanes: [], roofFeatures: [] };
  }
  const eavePolygon = cleanRoofPolygon2D(input.eavePolygon.map(point2FromPoint3)).map((candidate) =>
    point(candidate.x, candidate.y, 0),
  );
  if (
    eavePolygon.length < 4 ||
    Math.abs(signedAreaXY(eavePolygon)) <= ROOF_JOIN_EPSILON_MM ||
    !isOrthogonalFootprint(input.sourceFootprint)
  ) {
    return { roofPlanes: [], roofFeatures: [] };
  }

  const allEdges = buildJoinedRoofEdges(eavePolygon);
  const edges = allEdges.filter((edge) => edge.ridgeAxis === input.ridgeAxis);
  if (edges.length < 2) {
    return { roofPlanes: [], roofFeatures: [] };
  }

  const baseRegions = buildRectilinearRoofBaseRegions(eavePolygon);
  const splitRegions = splitRoofRegionsByPlaneIntersections({
    regions: baseRegions,
    edges,
    eaveHeightMm: input.eaveHeightMm,
    pitchRisePerRun,
  });
  const assignedRegions = splitRegions
    .map((footprint) =>
      assignRoofRegion({
        footprint,
        edges,
        eavePolygon,
        eaveHeightMm: input.eaveHeightMm,
        pitchRisePerRun,
      }),
    )
    .filter((region): region is JoinedRoofRegion => Boolean(region));
  const mergedRegions = mergeAssignedRoofRegions(assignedRegions);
  const roofPlanes: RoofPlane3D[] = [];
  const renderedFacets: JoinedRoofFacet[] = [];
  let skippedDegenerateFacetCount = 0;

  for (const region of sortJoinedRoofRegions(mergedRegions.regions)) {
    const facet = buildJoinedRoofFacetFromRegion({
      region,
      eavePolygon,
      eaveHeightMm: input.eaveHeightMm,
      pitchRisePerRun,
      allowRaisedBoundaryPoints: true,
    });
    if (!facet) {
      skippedDegenerateFacetCount += 1;
      continue;
    }
    const highPoint = facet.boundary.reduce(
      (selected, candidate) => (candidate.z > selected.z ? candidate : selected),
      facet.boundary[0]!,
    );
    const lowPoint = point(
      (facet.edge.start.x + facet.edge.end.x) / 2,
      (facet.edge.start.y + facet.edge.end.y) / 2,
      input.eaveHeightMm,
    );
    if (lineLength(line(lowPoint, highPoint)) <= RIDGE_COLLAPSE_EPSILON_MM) {
      skippedDegenerateFacetCount += 1;
      continue;
    }
    roofPlanes.push(
      buildRoofPlane({
        id: `house-roof-edge-${roofPlanes.length + 1}`,
        boundary: facet.boundary,
        highPoint,
        lowPoint,
        ridgeAxis: input.ridgeAxis,
        pitchDeg: input.roofPitchDeg,
        metadata: {
          roofForm: 'gable',
          sourceEdgeId: facet.edge.id,
          footprintFollowing: true,
          roofGeometry: 'rectilinear_joined_gable',
        },
      }),
    );
    renderedFacets.push(facet);
  }

  const roofFeatures = buildJoinedRoofFeatures({
    facets: renderedFacets,
    edges,
    eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
    roofForm: 'gable',
    roofGeometry: 'rectilinear_joined_gable',
  }).filter((feature) => feature.kind === 'ridge' || feature.kind === 'valley');
  const fallbackFeatureCount = roofFeatures.filter(
    (feature) => feature.metadata?.roofFeatureSource === 'reentrant_fallback',
  ).length;
  const valleyFeatureCount = roofFeatures.filter((feature) => feature.kind === 'valley').length;
  const topologyFailureReason =
    typeof mergedRegions.topologyFailureReason === 'string'
      ? mergedRegions.topologyFailureReason
      : roofPlanes.length === 0
        ? 'roof_topology_missing_facets'
        : null;

  return {
    roofPlanes,
    roofFeatures,
    metadata: {
      ridgeAxis: input.ridgeAxis,
      roofFacetMergeMode: 'rectilinear_split_assignment',
      roofBaseRegionCount: baseRegions.length,
      roofSplitRegionCount: splitRegions.length,
      roofAssignedRegionCount: assignedRegions.length,
      roofAtomicRegionCount: mergedRegions.atomicRegionCount,
      roofDissolvedRegionCount: mergedRegions.dissolvedRegionCount,
      roofDiscardedDissolveLoopCount: mergedRegions.discardedLoopCount,
      roofFacetComponentCount: mergedRegions.regions.length,
      roofPreservedRegionFacetCount: roofPlanes.length,
      roofTopologyFailureReason: topologyFailureReason,
      roofRejectedFacetCount: skippedDegenerateFacetCount,
      roofTopologyFinalFaceCount: roofPlanes.length,
      roofTopologySourceEdgeCount: new Set(renderedFacets.map((facet) => facet.edge.index)).size,
      roofTopologyDisconnectedSourceFaceCount: Math.max(
        0,
        roofPlanes.length - new Set(renderedFacets.map((facet) => facet.edge.index)).size,
      ),
      roofTopologyInternalEaveHeightSegmentCount: countJoinedRoofInternalEaveHeightSegments({
        facets: renderedFacets,
        eavePolygon,
        eaveHeightMm: input.eaveHeightMm,
      }),
      roofTopologyProjectionViolationCount: 0,
      roofFacetCount: roofPlanes.length,
      roofFeatureCount: roofFeatures.length,
      roofFallbackFeatureCount: fallbackFeatureCount,
      roofTopologyValleyCount: valleyFeatureCount,
    },
  };
}

function buildBentSpineJoinedGableRoofX(input: {
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
}): {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  terminalEnds: HouseGableTerminalEnd[];
  terminalClosures: BentSpineTerminalGableClosure[];
  metadata?: GeometryMetadata;
} {
  const pitchRisePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);
  if (!Number.isFinite(pitchRisePerRun) || pitchRisePerRun <= 0) {
    return { roofPlanes: [], roofFeatures: [], terminalEnds: [], terminalClosures: [] };
  }
  const eavePolygon = cleanRoofPolygon2D(input.eavePolygon.map(point2FromPoint3)).map((candidate) =>
    point(candidate.x, candidate.y, 0),
  );
  if (eavePolygon.length < 4 || Math.abs(signedAreaXY(eavePolygon)) <= ROOF_JOIN_EPSILON_MM) {
    return { roofPlanes: [], roofFeatures: [], terminalEnds: [], terminalClosures: [] };
  }

  const terminalEnds = buildBentSpineGableTerminalEndsX({ footprint: eavePolygon });
  const edges = buildJoinedRoofEdges(eavePolygon);
  const facetResult = buildJoinedRoofFacets({
    eavePolygon,
    edges,
    eaveHeightMm: input.eaveHeightMm,
    pitchRisePerRun,
  });
  const rawRoofFeatures = buildJoinedRoofFeatures({
    facets: facetResult.facets,
    edges,
    eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
    roofForm: 'gable',
    roofGeometry: 'bent_spine_joined_gable',
  }).filter((feature) => feature.kind === 'ridge' || feature.kind === 'valley');
  const terminalIntersections = deriveBentSpineTerminalIntersectionsX({
    footprint: eavePolygon,
    ridgeFeatures: rawRoofFeatures.filter((feature) => feature.kind === 'ridge'),
  });
  const terminalClosures = deriveBentSpineTerminalGableClosures({
    terminalIntersections,
  });
  const closedFacets = applyBentSpineTerminalGableClosures({
    facets: facetResult.facets,
    terminalClosures,
    eaveHeightMm: input.eaveHeightMm,
    pitchRisePerRun,
  });
  const roofPlanes: RoofPlane3D[] = [];
  const renderedFacets: JoinedRoofFacet[] = [];
  let skippedDegenerateFacetCount = 0;
  for (const facet of closedFacets) {
    const highPoint = facet.boundary.reduce(
      (selected, candidate) => (candidate.z > selected.z ? candidate : selected),
      facet.boundary[0]!,
    );
    const lowPoint = point(
      (facet.edge.start.x + facet.edge.end.x) / 2,
      (facet.edge.start.y + facet.edge.end.y) / 2,
      input.eaveHeightMm,
    );
    if (lineLength(line(lowPoint, highPoint)) <= RIDGE_COLLAPSE_EPSILON_MM) {
      skippedDegenerateFacetCount += 1;
      continue;
    }
    roofPlanes.push(
      buildRoofPlane({
        id: `house-roof-edge-${roofPlanes.length + 1}`,
        boundary: facet.boundary,
        highPoint,
        lowPoint,
        ridgeAxis: facet.edge.ridgeAxis,
        pitchDeg: input.roofPitchDeg,
        metadata: {
          roofForm: 'gable',
          sourceEdgeId: facet.edge.id,
          footprintFollowing: true,
          roofGeometry: 'bent_spine_joined_gable',
          roofTerminalClosureFacet: terminalClosures.some((closure) =>
            facet.boundary.some((candidate) => samePoint3WithinTolerance(candidate, closure.point)),
          ),
          roofTerminalClosureSourceEdgeIds:
            terminalClosures
              .filter((closure) =>
                facet.boundary.some((candidate) => samePoint3WithinTolerance(candidate, closure.point)),
              )
              .map((closure) => closure.sourceEdgeId)
              .join(',') || null,
        },
      }),
    );
    renderedFacets.push(facet);
  }
  const roofFeatures = buildJoinedRoofFeatures({
    facets: renderedFacets,
    edges,
    eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
    roofForm: 'gable',
    roofGeometry: 'bent_spine_joined_gable',
  }).filter((feature) => feature.kind === 'ridge' || feature.kind === 'valley');
  const fallbackFeatureCount = roofFeatures.filter(
    (feature) => feature.metadata?.roofFeatureSource === 'reentrant_fallback',
  ).length;
  const valleyFeatureCount = roofFeatures.filter((feature) => feature.kind === 'valley').length;
  const sourceEdgeCount = new Set(renderedFacets.map((facet) => facet.edge.index)).size;
  const disconnectedSourceFaceCount = Math.max(0, renderedFacets.length - sourceEdgeCount);
  const internalEaveHeightSegmentCount = countJoinedRoofInternalEaveHeightSegments({
    facets: renderedFacets,
    eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
  });
  const topologyFailureReason =
    typeof facetResult.metadata.roofTopologyFailureReason === 'string'
      ? facetResult.metadata.roofTopologyFailureReason
      : disconnectedSourceFaceCount > 0
        ? 'roof_topology_disconnected_source_faces'
        : internalEaveHeightSegmentCount > 0
          ? 'roof_topology_internal_eave_height_seams'
          : null;

  return {
    roofPlanes,
    roofFeatures,
    terminalEnds,
    terminalClosures,
    metadata: {
      ...facetResult.metadata,
      roofGeometry: 'bent_spine_joined_gable',
      roofFacetMergeMode: 'active_rectilinear_wavefront_bent_spine',
      roofTerminalEndCount: terminalEnds.length,
      roofTerminalClosureCount: terminalClosures.length,
      roofTopologyFailureReason: topologyFailureReason,
      roofRejectedFacetCount:
        (typeof facetResult.metadata.roofRejectedFacetCount === 'number'
          ? facetResult.metadata.roofRejectedFacetCount
          : 0) + skippedDegenerateFacetCount,
      roofTopologyFinalFaceCount: roofPlanes.length,
      roofTopologySourceEdgeCount: sourceEdgeCount,
      roofTopologyDisconnectedSourceFaceCount: disconnectedSourceFaceCount,
      roofTopologyInternalEaveHeightSegmentCount: internalEaveHeightSegmentCount,
      roofFacetCount: roofPlanes.length,
      roofFeatureCount: roofFeatures.length,
      roofFallbackFeatureCount: fallbackFeatureCount,
      roofTopologyValleyCount: valleyFeatureCount,
    },
  };
}

function reflectRoofBuildResultAcrossX(input: {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  terminalEnds: HouseGableTerminalEnd[];
  terminalClosures?: BentSpineTerminalGableClosure[];
  metadata?: GeometryMetadata;
  centerX: number;
}): {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  terminalEnds: HouseGableTerminalEnd[];
  terminalClosures?: BentSpineTerminalGableClosure[];
  metadata?: GeometryMetadata;
} {
  return {
    roofPlanes: input.roofPlanes.map((roofPlane) => {
      const boundary = roofPlane.boundary.map((candidate) =>
        reflectPointAcrossX({ candidate, centerX: input.centerX }),
      );
      return {
        ...roofPlane,
        boundary,
        plane: planeFromBoundary(boundary) ?? roofPlane.plane,
        fallVector: reflectVectorAcrossX(roofPlane.fallVector),
      };
    }),
    roofFeatures: input.roofFeatures.map((feature) => ({
      ...feature,
      line: {
        start: reflectPointAcrossX({ candidate: feature.line.start, centerX: input.centerX }),
        end: reflectPointAcrossX({ candidate: feature.line.end, centerX: input.centerX }),
      },
    })),
    terminalEnds: input.terminalEnds,
    terminalClosures: input.terminalClosures?.map((closure) => ({
      ...closure,
      nodePoint: reflectPointAcrossX({ candidate: closure.nodePoint, centerX: input.centerX }),
      point: reflectPointAcrossX({ candidate: closure.point, centerX: input.centerX }),
    })),
    metadata: input.metadata,
  };
}

function swapRoofBuildResultAxes(input: {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  terminalEnds: HouseGableTerminalEnd[];
  terminalClosures?: BentSpineTerminalGableClosure[];
  metadata?: GeometryMetadata;
}): {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  terminalEnds: HouseGableTerminalEnd[];
  terminalClosures?: BentSpineTerminalGableClosure[];
  metadata?: GeometryMetadata;
} {
  return {
    roofPlanes: input.roofPlanes.map((roofPlane) => {
      const boundary = roofPlane.boundary.map(swapPointAxes);
      return {
        ...roofPlane,
        boundary,
        plane: planeFromBoundary(boundary) ?? roofPlane.plane,
        fallVector: swapVectorAxes(roofPlane.fallVector),
        metadata:
          roofPlane.metadata
            ? {
                ...roofPlane.metadata,
                ridgeAxis: 'y',
              }
            : roofPlane.metadata,
      };
    }),
    roofFeatures: input.roofFeatures.map((feature) => {
      const metadata =
        feature.metadata && typeof feature.metadata.ridgeAxis === 'string'
          ? {
              ...feature.metadata,
              ridgeAxis: 'y',
            }
          : feature.metadata;
      return {
        ...feature,
        line: {
          start: swapPointAxes(feature.line.start),
          end: swapPointAxes(feature.line.end),
        },
        ...(metadata ? { metadata } : {}),
      };
    }),
    terminalEnds: input.terminalEnds.map((terminalEnd) => ({
      ...terminalEnd,
      id: terminalEnd.id.replace('house-gable-end-x-', 'house-gable-end-y-'),
    })),
    terminalClosures: input.terminalClosures?.map((closure) => ({
      ...closure,
      nodePoint: swapPointAxes(closure.nodePoint),
      point: swapPointAxes(closure.point),
      axis: closure.axis === 'x' ? 'y' : 'x',
    })),
    metadata: input.metadata ? { ...input.metadata, ridgeAxis: 'y' } : undefined,
  };
}

function bridgeSideScore(input: {
  roofFeatures: HouseRoofFeature3D[];
  direction: { x: number; y: number };
}): number | null {
  const horizontalRidges = input.roofFeatures.filter(
    (feature) =>
      feature.kind === 'ridge' &&
      Math.abs(feature.line.start.y - feature.line.end.y) <= 1e-6 &&
      Math.abs(feature.line.start.x - feature.line.end.x) > 1e-6,
  );
  if (!horizontalRidges.length) return null;
  return Math.max(
    ...horizontalRidges.map((feature) => {
      const midpoint = midpoint2(feature.line);
      return midpoint.x * input.direction.x + midpoint.y * input.direction.y;
    }),
  );
}

export function deriveHouseGableTerminalEndsFromFootprint(input: {
  footprint: Polygon3;
  ridgeAxis: HouseRoofRidgeAxis;
}): HouseGableTerminalEnd[] {
  if (input.ridgeAxis === 'x') {
    return buildBentSpineGableTerminalEndsX({ footprint: input.footprint });
  }
  return buildBentSpineGableTerminalEndsX({
    footprint: input.footprint.map(swapPointAxes),
  }).map((terminalEnd) => ({
    ...terminalEnd,
    id: terminalEnd.id.replace('house-gable-end-x-', 'house-gable-end-y-'),
  }));
}

function buildJoinedRectilinearGableRoof(input: {
  sourceFootprint: Polygon3;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  ridgeAxis: HouseRoofRidgeAxis;
}): {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  terminalEnds?: HouseGableTerminalEnd[];
  terminalClosures?: BentSpineTerminalGableClosure[];
  metadata?: GeometryMetadata;
} {
  if (!isOrthogonalFootprint(input.sourceFootprint)) {
    return { roofPlanes: [], roofFeatures: [], terminalEnds: [], terminalClosures: [] };
  }
  if (input.ridgeAxis === 'x') {
    const bentSpine = buildBentSpineJoinedGableRoofX({
      eavePolygon: input.eavePolygon,
      eaveHeightMm: input.eaveHeightMm,
      roofPitchDeg: input.roofPitchDeg,
    });
    if (
      bentSpine.roofPlanes.length > 0 &&
      roofFeaturesAreAxisAligned(bentSpine.roofFeatures.filter((feature) => feature.kind === 'ridge'))
    ) {
      return bentSpine;
    }
    return buildLegacyJoinedRectilinearGableRoof(input);
  }
  const swappedEavePolygon = input.eavePolygon.map(swapPointAxes);
  const baseBentSpine = swapRoofBuildResultAxes(
    buildBentSpineJoinedGableRoofX({
      eavePolygon: swappedEavePolygon,
      eaveHeightMm: input.eaveHeightMm,
      roofPitchDeg: input.roofPitchDeg,
    }),
  );
  const openSide = deriveHouseFootprintOpenSide(input.sourceFootprint);
  let bentSpine = baseBentSpine;
  if (openSide && Math.abs(openSide.direction.y) > Math.abs(openSide.direction.x)) {
    const box = boundingBox(swappedEavePolygon);
    const reflectedBentSpine = swapRoofBuildResultAxes(
      reflectRoofBuildResultAcrossX({
        ...buildBentSpineJoinedGableRoofX({
          eavePolygon: swappedEavePolygon.map((candidate) =>
            reflectPointAcrossX({ candidate, centerX: (box.minX + box.maxX) / 2 }),
          ),
          eaveHeightMm: input.eaveHeightMm,
          roofPitchDeg: input.roofPitchDeg,
        }),
        centerX: (box.minX + box.maxX) / 2,
      }),
    );
    const baseScore = bridgeSideScore({
      roofFeatures: baseBentSpine.roofFeatures,
      direction: openSide.direction,
    });
    const reflectedScore = bridgeSideScore({
      roofFeatures: reflectedBentSpine.roofFeatures,
      direction: openSide.direction,
    });
    if (
      reflectedScore != null &&
      (baseScore == null || reflectedScore > baseScore + 1e-6)
    ) {
      bentSpine = reflectedBentSpine;
    }
  }
  if (
    bentSpine.roofPlanes.length > 0 &&
    roofFeaturesAreAxisAligned(bentSpine.roofFeatures.filter((feature) => feature.kind === 'ridge'))
  ) {
    return bentSpine;
  }
  return buildLegacyJoinedRectilinearGableRoof(input);
}

function buildComplexRidgeLine(input: {
  eavePolygon: Polygon3;
  node: Point3;
  axis: 'x' | 'y';
  z: number;
  insetMm: number;
}): Line3 | null {
  const interval = polygonLineInterval({
    polygon: input.eavePolygon,
    axis: input.axis,
    coordinate: input.axis === 'x' ? input.node.y : input.node.x,
    through: input.axis === 'x' ? input.node.x : input.node.y,
  });
  if (!interval) return null;
  const inset = Math.min(Math.max(50, input.insetMm / 2), Math.max(0, (interval.max - interval.min) / 3));
  const start = interval.min + inset;
  const end = interval.max - inset;
  if (end - start <= RIDGE_COLLAPSE_EPSILON_MM) return null;
  return input.axis === 'x'
    ? line(point(start, input.node.y, input.z), point(end, input.node.y, input.z))
    : line(point(input.node.x, start, input.z), point(input.node.x, end, input.z));
}

function buildComplexFootprintRoof(input: {
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
}): { roofPlanes: RoofPlane3D[]; roofFeatures: HouseRoofFeature3D[] } {
  const box = boundingBox(input.eavePolygon);
  const axis: 'x' | 'y' = box.maxX - box.minX >= box.maxY - box.minY ? 'x' : 'y';
  const roofNode = findInteriorRoofNode(input.eavePolygon);
  const pitchRisePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);
  const highZ = input.eaveHeightMm + Math.max(1, roofNode.clearanceMm) * pitchRisePerRun;
  const node = point(roofNode.point.x, roofNode.point.y, highZ);
  const ridgeLine = buildComplexRidgeLine({
    eavePolygon: input.eavePolygon,
    node,
    axis,
    z: highZ,
    insetMm: roofNode.clearanceMm,
  });
  const highTargetForEdge = (edgeMidpoint: Point3) =>
    ridgeLine ? closestPointOnLineSegment2D(edgeMidpoint, ridgeLine) : node;
  const roofPlanes: RoofPlane3D[] = [];

  for (let index = 0; index < input.eavePolygon.length; index += 1) {
    const start = input.eavePolygon[index]!;
    const end = input.eavePolygon[(index + 1) % input.eavePolygon.length]!;
    const eaveStart = point(start.x, start.y, input.eaveHeightMm);
    const eaveEnd = point(end.x, end.y, input.eaveHeightMm);
    const edgeMid = point((start.x + end.x) / 2, (start.y + end.y) / 2, input.eaveHeightMm);
    const highPoint = highTargetForEdge(edgeMid);
    if (lineLength(line(eaveStart, eaveEnd)) <= 1e-6 || lineLength(line(edgeMid, highPoint)) <= 1e-6) continue;
    roofPlanes.push(
      buildRoofPlane({
        id: `house-roof-edge-${index + 1}`,
        boundary: [eaveStart, eaveEnd, highPoint],
        highPoint,
        lowPoint: edgeMid,
        ridgeAxis: axis,
        pitchDeg: input.roofPitchDeg,
        metadata: {
          sourceEdgeId: `footprint-edge-${index + 1}`,
          footprintFollowing: true,
        },
      }),
    );
  }

  const roofFeatures: HouseRoofFeature3D[] = [];
  if (ridgeLine) {
    roofFeatures.push({
      id: 'house-roof-ridge-1',
      kind: 'ridge',
      line: ridgeLine,
      metadata: { roofForm: 'hipped', footprintFollowing: true },
    });
  }

  let hipCount = 0;
  let valleyCount = 0;
  for (let index = 0; index < input.eavePolygon.length; index += 1) {
    const source = input.eavePolygon[index]!;
    const start = point(source.x, source.y, input.eaveHeightMm);
    const target = ridgeLine ? closestPointOnLineSegment2D(start, ridgeLine) : node;
    if (lineLength(line(start, target)) <= 1e-6) continue;
    const kind = vertexFeatureKind(input.eavePolygon, index);
    if (kind === 'hip') hipCount += 1;
    if (kind === 'valley') valleyCount += 1;
    roofFeatures.push({
      id: kind === 'hip' ? `house-roof-hip-${hipCount}` : `house-roof-valley-${valleyCount}`,
      kind,
      line: line(start, target),
      metadata: { roofForm: 'hipped', footprintFollowing: true },
    });
  }

  return { roofPlanes, roofFeatures };
}

function invalidHouseRoof(input: {
  eavePolygon: Polygon3;
  roofForm: HouseRoofForm;
  roofGeometry: string;
  reason: string;
  metadata?: GeometryMetadata;
}): HouseRoofBuildResult {
  return applyRoofQa({
    roof: {
      roofPlanes: [],
      roofFeatures: [],
      metadata: {
        roofForm: input.roofForm,
        roofGeometry: input.roofGeometry,
        roofTopologyFailureReason: input.reason,
        ...(input.metadata ?? {}),
      },
    },
    eavePolygon: input.eavePolygon,
  });
}

function buildFlatHouseRoof(input: {
  eavePolygon: Polygon3;
  eaveHeightMm: number;
}): HouseRoofBuildResult {
  return applyRoofQa({
    roof: {
      roofPlanes: [
        {
          id: 'house-roof-flat-1',
          boundary: input.eavePolygon.map((candidate) =>
            point(candidate.x, candidate.y, input.eaveHeightMm),
          ),
          plane: planeFromPoints(
            point(input.eavePolygon[0]!.x, input.eavePolygon[0]!.y, input.eaveHeightMm),
            point(input.eavePolygon[1]!.x, input.eavePolygon[1]!.y, input.eaveHeightMm),
            point(input.eavePolygon[2]!.x, input.eavePolygon[2]!.y, input.eaveHeightMm),
          ),
          fallVector: { x: 0, y: 1, z: 0 },
          metadata: {
            roofForm: 'flat',
            roofGeometry: 'footprint_flat',
          },
        },
      ],
      roofFeatures: [],
      metadata: {
        roofForm: 'flat',
        roofGeometry: 'footprint_flat',
      },
    },
    eavePolygon: input.eavePolygon,
  });
}

function buildMonoHouseRoof(input: {
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  fallDirection: HouseRoofPrimaryFallDirection;
}): HouseRoofBuildResult {
  const axis =
    input.fallDirection === 'positive_x' || input.fallDirection === 'negative_x' ? 'x' : 'y';
  const range = axisRange(input.eavePolygon, axis);
  const risePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);
  const boundary = input.eavePolygon.map((candidate) => {
    const coordinate = axis === 'x' ? candidate.x : candidate.y;
    const run =
      input.fallDirection === 'positive_x' || input.fallDirection === 'positive_y'
        ? range.max - coordinate
        : coordinate - range.min;
    return point(candidate.x, candidate.y, input.eaveHeightMm + Math.max(0, run) * risePerRun);
  });
  const plane = planeFromPoints(boundary[0]!, boundary[1]!, boundary[2]!);

  return applyRoofQa({
    roof: {
      roofPlanes: [
        {
          id: 'house-roof-mono-1',
          boundary,
          plane,
          fallVector:
            input.fallDirection === 'positive_x'
              ? { x: 1, y: 0, z: -risePerRun }
              : input.fallDirection === 'negative_x'
                ? { x: -1, y: 0, z: -risePerRun }
                : input.fallDirection === 'negative_y'
                  ? { x: 0, y: -1, z: -risePerRun }
                  : { x: 0, y: 1, z: -risePerRun },
          metadata: {
            roofForm: 'mono',
            roofGeometry: 'footprint_mono',
            roofPrimaryFallDirection: input.fallDirection,
            pitchDeg: input.roofPitchDeg,
          },
        },
      ],
      roofFeatures: [],
      metadata: {
        roofForm: 'mono',
        roofGeometry: 'footprint_mono',
        roofPrimaryFallDirection: input.fallDirection,
      },
    },
    eavePolygon: input.eavePolygon,
  });
}

function buildRectangularGableRoof(input: {
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  ridgeAxis: HouseRoofRidgeAxis;
}): HouseRoofBuildResult {
  if (!isRectanglePolygon(input.eavePolygon)) {
    return invalidHouseRoof({
      eavePolygon: input.eavePolygon,
      roofForm: 'gable',
      roofGeometry: 'rectangular_gable',
      reason: 'unsupported_gable_topology',
    });
  }

  const box = boundingBox(input.eavePolygon);
  const risePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);
  const corners = rectangleCornersFromBox(box);
  const centerX = (box.minX + box.maxX) / 2;
  const centerY = (box.minY + box.maxY) / 2;
  const roofPlanes: RoofPlane3D[] = [];
  let ridge: Line3;

  if (input.ridgeAxis === 'x') {
    const run = (box.maxY - box.minY) / 2;
    const ridgeZ = input.eaveHeightMm + run * risePerRun;
    const ridgeStart = point(box.minX, centerY, ridgeZ);
    const ridgeEnd = point(box.maxX, centerY, ridgeZ);
    ridge = line(ridgeStart, ridgeEnd);
    roofPlanes.push(
      buildRoofPlane({
        id: 'house-roof-gable-min-y',
        boundary: [
          point(corners.minXMinY.x, corners.minXMinY.y, input.eaveHeightMm),
          point(corners.maxXMinY.x, corners.maxXMinY.y, input.eaveHeightMm),
          ridgeEnd,
          ridgeStart,
        ],
        highPoint: point(centerX, centerY, ridgeZ),
        lowPoint: point(centerX, box.minY, input.eaveHeightMm),
        ridgeAxis: 'x',
        pitchDeg: input.roofPitchDeg,
        metadata: { roofForm: 'gable', roofGeometry: 'rectangular_gable' },
      }),
      buildRoofPlane({
        id: 'house-roof-gable-max-y',
        boundary: [
          point(corners.maxXMaxY.x, corners.maxXMaxY.y, input.eaveHeightMm),
          point(corners.minXMaxY.x, corners.minXMaxY.y, input.eaveHeightMm),
          ridgeStart,
          ridgeEnd,
        ],
        highPoint: point(centerX, centerY, ridgeZ),
        lowPoint: point(centerX, box.maxY, input.eaveHeightMm),
        ridgeAxis: 'x',
        pitchDeg: input.roofPitchDeg,
        metadata: { roofForm: 'gable', roofGeometry: 'rectangular_gable' },
      }),
    );
  } else {
    const run = (box.maxX - box.minX) / 2;
    const ridgeZ = input.eaveHeightMm + run * risePerRun;
    const ridgeStart = point(centerX, box.minY, ridgeZ);
    const ridgeEnd = point(centerX, box.maxY, ridgeZ);
    ridge = line(ridgeStart, ridgeEnd);
    roofPlanes.push(
      buildRoofPlane({
        id: 'house-roof-gable-min-x',
        boundary: [
          point(corners.minXMaxY.x, corners.minXMaxY.y, input.eaveHeightMm),
          point(corners.minXMinY.x, corners.minXMinY.y, input.eaveHeightMm),
          ridgeStart,
          ridgeEnd,
        ],
        highPoint: point(centerX, centerY, ridgeZ),
        lowPoint: point(box.minX, centerY, input.eaveHeightMm),
        ridgeAxis: 'y',
        pitchDeg: input.roofPitchDeg,
        metadata: { roofForm: 'gable', roofGeometry: 'rectangular_gable' },
      }),
      buildRoofPlane({
        id: 'house-roof-gable-max-x',
        boundary: [
          point(corners.maxXMinY.x, corners.maxXMinY.y, input.eaveHeightMm),
          point(corners.maxXMaxY.x, corners.maxXMaxY.y, input.eaveHeightMm),
          ridgeEnd,
          ridgeStart,
        ],
        highPoint: point(centerX, centerY, ridgeZ),
        lowPoint: point(box.maxX, centerY, input.eaveHeightMm),
        ridgeAxis: 'y',
        pitchDeg: input.roofPitchDeg,
        metadata: { roofForm: 'gable', roofGeometry: 'rectangular_gable' },
      }),
    );
  }

  return applyRoofQa({
    roof: {
      roofPlanes,
      roofFeatures: [
        {
          id: 'house-roof-ridge-1',
          kind: 'ridge',
          line: ridge,
          metadata: {
            roofForm: 'gable',
            roofGeometry: 'rectangular_gable',
            ridgeAxis: input.ridgeAxis,
          },
        },
      ],
      metadata: {
        roofForm: 'gable',
        roofGeometry: 'rectangular_gable',
        ridgeAxis: input.ridgeAxis,
      },
    },
    eavePolygon: input.eavePolygon,
  });
}

function buildGabledHouseRoof(input: {
  sourceFootprint: Polygon3;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  ridgeAxis: HouseRoofRidgeAxis;
}): HouseRoofBuildResult {
  if (!isOrthogonalFootprint(input.sourceFootprint)) {
    return invalidHouseRoof({
      eavePolygon: input.eavePolygon,
      roofForm: 'gable',
      roofGeometry: 'bent_spine_joined_gable',
      reason: 'unsupported_gable_topology',
      metadata: { footprintFollowing: false, ridgeAxis: input.ridgeAxis },
    });
  }

  if (isRectanglePolygon(input.eavePolygon)) {
    return buildRectangularGableRoof({
      eavePolygon: input.eavePolygon,
      eaveHeightMm: input.eaveHeightMm,
      roofPitchDeg: input.roofPitchDeg,
      ridgeAxis: input.ridgeAxis,
    });
  }

  const roof = buildJoinedRectilinearGableRoof(input);
  if (!roof.roofPlanes.length) {
    return invalidHouseRoof({
      eavePolygon: input.eavePolygon,
      roofForm: 'gable',
      roofGeometry: 'bent_spine_joined_gable',
      reason: 'unsupported_gable_topology',
      metadata: { ...(roof.metadata ?? {}), footprintFollowing: true, ridgeAxis: input.ridgeAxis },
    });
  }

  const bentSpineResult = applyRoofQa({
    roof: {
      roofPlanes: roof.roofPlanes,
      roofFeatures: roof.roofFeatures,
      terminalClosures: roof.terminalClosures,
      metadata: {
        roofForm: 'gable',
        roofGeometry: 'bent_spine_joined_gable',
        footprintFollowing: true,
        ridgeAxis: input.ridgeAxis,
        ...(roof.metadata ?? {}),
      },
    },
    eavePolygon: input.eavePolygon,
    rejectedFacetCount:
      typeof roof.metadata?.roofRejectedFacetCount === 'number'
        ? roof.metadata.roofRejectedFacetCount
        : 0,
  });
  if (bentSpineResult.metadata.roofQaStatus === 'valid') {
    return bentSpineResult;
  }

  const legacyRoof = buildLegacyJoinedRectilinearGableRoof(input);
  if (!legacyRoof.roofPlanes.length) {
    return bentSpineResult;
  }
  return applyRoofQa({
    roof: {
      roofPlanes: legacyRoof.roofPlanes,
      roofFeatures: legacyRoof.roofFeatures,
      metadata: {
        roofForm: 'gable',
        roofGeometry: 'rectilinear_joined_gable',
        footprintFollowing: true,
        ridgeAxis: input.ridgeAxis,
        ...(legacyRoof.metadata ?? {}),
      },
    },
    eavePolygon: input.eavePolygon,
    rejectedFacetCount:
      typeof legacyRoof.metadata?.roofRejectedFacetCount === 'number'
        ? legacyRoof.metadata.roofRejectedFacetCount
        : 0,
  });
}

function buildHippedHouseRoof(input: {
  sourceFootprint: Polygon3;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
}): HouseRoofBuildResult {
  const box = boundingBox(input.eavePolygon);
  if (!isOrthogonalFootprint(input.sourceFootprint)) {
    return invalidHouseRoof({
      eavePolygon: input.eavePolygon,
      roofForm: 'hipped',
      roofGeometry: 'rectilinear_joined_hipped',
      reason: 'unsupported_hipped_topology',
      metadata: { footprintFollowing: false },
    });
  }
  if (isRectanglePolygon(input.eavePolygon)) {
    return applyRoofQa({
      roof: {
        ...buildRectangleHippedRoof({ ...box, eaveHeightMm: input.eaveHeightMm, roofPitchDeg: input.roofPitchDeg }),
        metadata: { roofForm: 'hipped', roofGeometry: 'rectangular_hipped', footprintFollowing: true },
      },
      eavePolygon: input.eavePolygon,
    });
  }

  const roof = buildJoinedRectilinearHippedRoof(input);
  if (!roof.roofPlanes.length) {
    return invalidHouseRoof({
      eavePolygon: input.eavePolygon,
      roofForm: 'hipped',
      roofGeometry: 'rectilinear_joined_hipped',
      reason: 'unsupported_hipped_topology',
      metadata: { ...(roof.metadata ?? {}), footprintFollowing: true },
    });
  }

  return applyRoofQa({
    roof: {
      roofPlanes: roof.roofPlanes,
      roofFeatures: roof.roofFeatures,
      metadata: {
        roofForm: 'hipped',
        roofGeometry: 'rectilinear_joined_hipped',
        footprintFollowing: true,
        ...(roof.metadata ?? {}),
      },
    },
    eavePolygon: input.eavePolygon,
    rejectedFacetCount: typeof roof.metadata?.roofRejectedFacetCount === 'number' ? roof.metadata.roofRejectedFacetCount : 0,
  });
}

function buildHouseRoofAppendageBand(input: {
  box: { minX: number; maxX: number; minY: number; maxY: number };
  hostEdge: AttachmentSide;
  form: HouseRoofAppendageForm;
  pitchDeg: number;
  attachZ: number;
}): RoofPlane3D[] {
  const bandDepthMm = 1200;
  const risePerRun = Math.tan((input.pitchDeg * Math.PI) / 180);
  const outerZ = input.form === 'flat' ? input.attachZ : input.attachZ - bandDepthMm * risePerRun;

  switch (input.hostEdge) {
    case 'front':
      return [
        {
          id: 'house-roof-appendage-front',
          boundary: [
            point(input.box.minX, input.box.maxY, input.attachZ),
            point(input.box.maxX, input.box.maxY, input.attachZ),
            point(input.box.maxX, input.box.maxY + bandDepthMm, outerZ),
            point(input.box.minX, input.box.maxY + bandDepthMm, outerZ),
          ],
          plane: planeFromPoints(
            point(input.box.minX, input.box.maxY, input.attachZ),
            point(input.box.maxX, input.box.maxY, input.attachZ),
            point(input.box.maxX, input.box.maxY + bandDepthMm, outerZ),
          ),
          fallVector: { x: 0, y: 1, z: input.form === 'flat' ? 0 : -risePerRun },
          metadata: { roofGeometry: 'appendage_band', roofAppendageHostEdge: 'front' },
        },
      ];
    case 'left':
      return [
        {
          id: 'house-roof-appendage-left',
          boundary: [
            point(input.box.minX, input.box.maxY, input.attachZ),
            point(input.box.minX, input.box.minY, input.attachZ),
            point(input.box.minX - bandDepthMm, input.box.minY, outerZ),
            point(input.box.minX - bandDepthMm, input.box.maxY, outerZ),
          ],
          plane: planeFromPoints(
            point(input.box.minX, input.box.maxY, input.attachZ),
            point(input.box.minX, input.box.minY, input.attachZ),
            point(input.box.minX - bandDepthMm, input.box.minY, outerZ),
          ),
          fallVector: { x: -1, y: 0, z: input.form === 'flat' ? 0 : -risePerRun },
          metadata: { roofGeometry: 'appendage_band', roofAppendageHostEdge: 'left' },
        },
      ];
    case 'right':
      return [
        {
          id: 'house-roof-appendage-right',
          boundary: [
            point(input.box.maxX, input.box.minY, input.attachZ),
            point(input.box.maxX, input.box.maxY, input.attachZ),
            point(input.box.maxX + bandDepthMm, input.box.maxY, outerZ),
            point(input.box.maxX + bandDepthMm, input.box.minY, outerZ),
          ],
          plane: planeFromPoints(
            point(input.box.maxX, input.box.minY, input.attachZ),
            point(input.box.maxX, input.box.maxY, input.attachZ),
            point(input.box.maxX + bandDepthMm, input.box.maxY, outerZ),
          ),
          fallVector: { x: 1, y: 0, z: input.form === 'flat' ? 0 : -risePerRun },
          metadata: { roofGeometry: 'appendage_band', roofAppendageHostEdge: 'right' },
        },
      ];
    case 'rear':
    default:
      return [
        {
          id: 'house-roof-appendage-rear',
          boundary: [
            point(input.box.maxX, input.box.minY, input.attachZ),
            point(input.box.minX, input.box.minY, input.attachZ),
            point(input.box.minX, input.box.minY - bandDepthMm, outerZ),
            point(input.box.maxX, input.box.minY - bandDepthMm, outerZ),
          ],
          plane: planeFromPoints(
            point(input.box.maxX, input.box.minY, input.attachZ),
            point(input.box.minX, input.box.minY, input.attachZ),
            point(input.box.minX, input.box.minY - bandDepthMm, outerZ),
          ),
          fallVector: { x: 0, y: -1, z: input.form === 'flat' ? 0 : -risePerRun },
          metadata: { roofGeometry: 'appendage_band', roofAppendageHostEdge: 'rear' },
        },
      ];
  }
}

function buildSharedHouseRoof(input: {
  sourceFootprint: Polygon3;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  roofForm: HouseRoofForm;
  roofPrimaryFallDirection: HouseRoofPrimaryFallDirection;
  roofRidgeAxis: HouseRoofRidgeAxis;
  roofAppendage?: {
    enabled?: boolean | null;
    form?: HouseRoofAppendageForm | null;
    hostEdge?: AttachmentSide | null;
    pitchDeg?: number | null;
    dropMm?: number | null;
  } | null;
}): HouseRoofBuildResult {
  const roofSelectionValidation = validateHouseRoofSelection({
    roofForm: input.roofForm,
    footprint: input.sourceFootprint,
    appendageEnabled: Boolean(input.roofAppendage?.enabled),
  });
  if (
    roofSelectionValidation.code === 'unsupported_roof_topology' ||
    roofSelectionValidation.code === 'unsupported_gable_topology' ||
    roofSelectionValidation.code === 'unsupported_hipped_topology'
  ) {
    return invalidHouseRoof({
      eavePolygon: input.eavePolygon,
      roofForm: input.roofForm,
      roofGeometry: input.roofForm === 'gable' ? 'bent_spine_joined_gable' : 'rectilinear_joined_hipped',
      reason: roofSelectionValidation.code,
    });
  }

  const primary =
    input.roofForm === 'flat'
      ? buildFlatHouseRoof({
          eavePolygon: input.eavePolygon,
          eaveHeightMm: input.eaveHeightMm,
        })
      : input.roofForm === 'mono'
        ? buildMonoHouseRoof({
            eavePolygon: input.eavePolygon,
            eaveHeightMm: input.eaveHeightMm,
            roofPitchDeg: input.roofPitchDeg,
            fallDirection: input.roofPrimaryFallDirection,
          })
        : input.roofForm === 'gable'
          ? buildGabledHouseRoof({
              sourceFootprint: input.sourceFootprint,
              eavePolygon: input.eavePolygon,
              eaveHeightMm: input.eaveHeightMm,
              roofPitchDeg: input.roofPitchDeg,
              ridgeAxis: input.roofRidgeAxis,
            })
          : buildHippedHouseRoof({
              sourceFootprint: input.sourceFootprint,
              eavePolygon: input.eavePolygon,
              eaveHeightMm: input.eaveHeightMm,
              roofPitchDeg: input.roofPitchDeg,
            });

  if (!input.roofAppendage?.enabled || primary.metadata.roofQaStatus !== 'valid') {
    return primary;
  }
  if (roofSelectionValidation.code === 'invalid_appendage') {
    return {
      ...primary,
      metadata: {
        ...primary.metadata,
        roofQaStatus: 'invalid',
        roofQaFailureReason: 'invalid_appendage',
        roofTopologyFailureReason: 'invalid_appendage',
      },
    };
  }

  const box = boundingBox(input.eavePolygon);
  const roofAppendage = input.roofAppendage ?? null;
  const appendagePlanes = buildHouseRoofAppendageBand({
    box,
    hostEdge: roofAppendage?.hostEdge ?? 'rear',
    form: roofAppendage?.form ?? 'mono',
    pitchDeg: finiteNumber(roofAppendage?.pitchDeg, input.roofPitchDeg),
    attachZ: input.eaveHeightMm - positiveNumber(roofAppendage?.dropMm, 450),
  }).map((plane) => ({
    ...plane,
    metadata: {
      ...plane.metadata,
      roofForm: input.roofForm,
      roofAppendageEnabled: true,
      roofAppendageForm: roofAppendage?.form ?? 'mono',
    },
  }));

  return {
    roofPlanes: [...primary.roofPlanes, ...appendagePlanes],
    roofFeatures: primary.roofFeatures,
    metadata: {
      ...primary.metadata,
      roofAppendageEnabled: true,
      roofAppendageForm: roofAppendage?.form ?? 'mono',
      roofAppendageHostEdge: roofAppendage?.hostEdge ?? 'rear',
    },
  };
}

function planeFromBoundary(boundary: Polygon3): Plane3 | null {
  if (boundary.length < 3) return null;
  for (let secondIndex = 1; secondIndex < boundary.length - 1; secondIndex += 1) {
    const plane = planeFromPoints(boundary[0]!, boundary[secondIndex]!, boundary[secondIndex + 1]!);
    if (
      Number.isFinite(plane.normal.x) &&
      Number.isFinite(plane.normal.y) &&
      Number.isFinite(plane.normal.z) &&
      Math.hypot(plane.normal.x, plane.normal.y, plane.normal.z) > 1e-6
    ) {
      return plane;
    }
  }
  return null;
}

function edgeOutwardVector(polygon: Polygon3, index: number): Vector3 {
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

function renderMeshIsFinite(mesh: RenderMesh3D): boolean {
  return (
    mesh.vertices.length >= 6 &&
    mesh.faces.length > 0 &&
    mesh.vertices.every((candidate) =>
      Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && Number.isFinite(candidate.z),
    ) &&
    mesh.faces.every((face) =>
      face.every((index) => Number.isInteger(index) && index >= 0 && index < mesh.vertices.length),
    )
  );
}

function buildVerticalPrismRenderMesh(planFootprint: Polygon3, bottomZ: number, topZ: number): RenderMesh3D | undefined {
  if (planFootprint.length < 3 || !Number.isFinite(bottomZ) || !Number.isFinite(topZ)) return undefined;
  if (Math.abs(topZ - bottomZ) <= 1e-6 || Math.abs(signedAreaXY(planFootprint)) <= 1e-6) return undefined;

  const bottom = Math.min(bottomZ, topZ);
  const top = Math.max(bottomZ, topZ);
  const vertices = [
    ...planFootprint.map((candidate) => point(candidate.x, candidate.y, bottom)),
    ...planFootprint.map((candidate) => point(candidate.x, candidate.y, top)),
  ];
  const vertexCount = planFootprint.length;
  const faces: [number, number, number][] = [];

  for (let index = 1; index < vertexCount - 1; index += 1) {
    faces.push([0, index + 1, index]);
    faces.push([vertexCount, vertexCount + index, vertexCount + index + 1]);
  }

  for (let index = 0; index < vertexCount; index += 1) {
    const nextIndex = (index + 1) % vertexCount;
    faces.push([index, nextIndex, vertexCount + nextIndex]);
    faces.push([index, vertexCount + nextIndex, vertexCount + index]);
  }

  const mesh = { vertices, faces };
  return renderMeshIsFinite(mesh) ? mesh : undefined;
}

function boundaryZRange(boundary: Polygon3): { bottomZ: number; topZ: number } | null {
  if (!boundary.length) return null;
  const zValues = boundary.map((candidate) => candidate.z);
  const bottomZ = Math.min(...zValues);
  const topZ = Math.max(...zValues);
  return Number.isFinite(bottomZ) && Number.isFinite(topZ) && topZ - bottomZ > 1e-6
    ? { bottomZ, topZ }
    : null;
}

function miterCornerPoint(
  previous: { start: Point3; end: Point3 },
  current: { start: Point3; end: Point3 },
): Point3 | null {
  const intersection = lineIntersection2(previous.start, previous.end, current.start, current.end);
  if (intersection) return point(intersection.x, intersection.y, 0);
  return distanceSquared2(previous.end, current.start) <= 1e-6 ? current.start : null;
}

function buildMiteredStripFootprints(sourcePolygon: Polygon3, halfWidthMm: number): Polygon3[] | null {
  if (!Number.isFinite(halfWidthMm) || halfWidthMm <= 0) return null;
  return buildMiteredOffsetStripFootprints(sourcePolygon, halfWidthMm, -halfWidthMm);
}

function buildMiteredOffsetStripFootprints(
  sourcePolygon: Polygon3,
  outerOffsetMm: number,
  innerOffsetMm: number,
): Polygon3[] | null {
  if (
    sourcePolygon.length < 3 ||
    !Number.isFinite(outerOffsetMm) ||
    !Number.isFinite(innerOffsetMm) ||
    Math.abs(outerOffsetMm - innerOffsetMm) <= 1e-6 ||
    Math.abs(signedAreaXY(sourcePolygon)) <= 1e-6
  ) {
    return null;
  }
  if (
    sourcePolygon.some(
      (current, index) => lineLength(line(current, sourcePolygon[(index + 1) % sourcePolygon.length]!)) <= 1e-6,
    )
  ) {
    return null;
  }

  const outerEdges = sourcePolygon.map((start, index) => {
    const end = sourcePolygon[(index + 1) % sourcePolygon.length]!;
    const outward = edgeOutwardVector(sourcePolygon, index);
    return {
      start: point(start.x + outward.x * outerOffsetMm, start.y + outward.y * outerOffsetMm, 0),
      end: point(end.x + outward.x * outerOffsetMm, end.y + outward.y * outerOffsetMm, 0),
    };
  });
  const innerEdges = sourcePolygon.map((start, index) => {
    const end = sourcePolygon[(index + 1) % sourcePolygon.length]!;
    const outward = edgeOutwardVector(sourcePolygon, index);
    return {
      start: point(start.x + outward.x * innerOffsetMm, start.y + outward.y * innerOffsetMm, 0),
      end: point(end.x + outward.x * innerOffsetMm, end.y + outward.y * innerOffsetMm, 0),
    };
  });

  const footprints: Polygon3[] = [];
  for (let index = 0; index < sourcePolygon.length; index += 1) {
    const previousIndex = (index - 1 + sourcePolygon.length) % sourcePolygon.length;
    const nextIndex = (index + 1) % sourcePolygon.length;
    const previousOuter = outerEdges[previousIndex]!;
    const currentOuter = outerEdges[index]!;
    const nextOuter = outerEdges[nextIndex]!;
    const previousInner = innerEdges[previousIndex]!;
    const currentInner = innerEdges[index]!;
    const nextInner = innerEdges[nextIndex]!;

    const outerStart = miterCornerPoint(previousOuter, currentOuter);
    const outerEnd = miterCornerPoint(currentOuter, nextOuter);
    const innerEnd = miterCornerPoint(currentInner, nextInner);
    const innerStart = miterCornerPoint(previousInner, currentInner);

    if (!outerStart || !outerEnd || !innerEnd || !innerStart) return null;
    const footprint = [
      outerStart,
      outerEnd,
      innerEnd,
      innerStart,
    ];
    if (Math.abs(signedAreaXY(footprint)) <= 1e-6) return null;
    footprints.push(footprint);
  }

  return footprints;
}

type RoofSolidPlaneEquation = {
  normal: Vector3;
  constant: number;
};

type RoofSolidLine = {
  point: Point3;
  direction: Vector3;
};

type RoofSolidEdgeReference = {
  roofPlaneIndex: number;
  edgeIndex: number;
  start: Point3;
  end: Point3;
};

type RoofSolidAdjacency = {
  edgeMap: Map<string, RoofSolidEdgeReference[]>;
  invalidRoofPlaneIndexes: Set<number>;
};

type RoofSolidBottomEdge = {
  line: RoofSolidLine;
  perimeter: boolean;
  perimeterRole?: HouseRoofPerimeterEdgeKind | null;
};

type ProjectedRoofMeshPoint = {
  index: number;
  projected: { x: number; y: number };
};

function translatePointByVector(source: Point3, delta: Vector3): Point3 {
  return point(source.x + delta.x, source.y + delta.y, source.z + delta.z);
}

function negateVector(source: Vector3): Vector3 {
  return { x: -source.x, y: -source.y, z: -source.z };
}

function finiteVectorLength(source: Vector3): number {
  return Math.hypot(source.x, source.y, source.z);
}

function roofSolidPointKey(candidate: Point3): string {
  return [
    Math.round(candidate.x / ROOF_JOIN_EPSILON_MM),
    Math.round(candidate.y / ROOF_JOIN_EPSILON_MM),
    Math.round(candidate.z / ROOF_JOIN_EPSILON_MM),
  ].join(',');
}

function roofSolidEdgeKey(start: Point3, end: Point3): string {
  const startKey = roofSolidPointKey(start);
  const endKey = roofSolidPointKey(end);
  return startKey <= endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

function buildRoofSolidAdjacency(roofPlanes: RoofPlane3D[]): RoofSolidAdjacency {
  const edgeMap = new Map<string, RoofSolidEdgeReference[]>();
  const invalidRoofPlaneIndexes = new Set<number>();

  for (const [roofPlaneIndex, roofPlane] of roofPlanes.entries()) {
    if (roofPlane.boundary.length < 3) {
      invalidRoofPlaneIndexes.add(roofPlaneIndex);
      continue;
    }
    for (let edgeIndex = 0; edgeIndex < roofPlane.boundary.length; edgeIndex += 1) {
      const start = roofPlane.boundary[edgeIndex]!;
      const end = roofPlane.boundary[(edgeIndex + 1) % roofPlane.boundary.length]!;
      if (lineLength(line(start, end)) <= ROOF_JOIN_EPSILON_MM) {
        invalidRoofPlaneIndexes.add(roofPlaneIndex);
        continue;
      }
      const key = roofSolidEdgeKey(start, end);
      const references = edgeMap.get(key) ?? [];
      references.push({ roofPlaneIndex, edgeIndex, start, end });
      edgeMap.set(key, references);
    }
  }

  for (const references of edgeMap.values()) {
    const uniqueRoofPlaneIndexes = new Set(references.map((reference) => reference.roofPlaneIndex));
    if (references.length > 2 || uniqueRoofPlaneIndexes.size !== references.length) {
      for (const reference of references) {
        invalidRoofPlaneIndexes.add(reference.roofPlaneIndex);
      }
    }
  }

  return { edgeMap, invalidRoofPlaneIndexes };
}

function roofSolidPlaneEquationFromPlane(plane: Plane3): RoofSolidPlaneEquation | null {
  const normal = normalizeVector(plane.normal);
  if (finiteVectorLength(normal) <= ROOF_JOIN_EPSILON_MM) return null;
  return {
    normal,
    constant: dotProduct(normal, plane.origin),
  };
}

function roofSolidBottomPlaneEquation(plane: Plane3, thicknessMm: number): RoofSolidPlaneEquation | null {
  if (!Number.isFinite(thicknessMm) || thicknessMm <= 0) return null;
  const planeEquation = roofSolidPlaneEquationFromPlane(plane);
  if (!planeEquation) return null;
  const downwardOffset = scaleVector(
    planeEquation.normal,
    planeEquation.normal.z >= 0 ? -thicknessMm : thicknessMm,
  );
  const bottomOrigin = translatePointByVector(plane.origin, downwardOffset);
  return {
    normal: planeEquation.normal,
    constant: dotProduct(planeEquation.normal, bottomOrigin),
  };
}

function intersectRoofSolidPlanes(
  first: RoofSolidPlaneEquation,
  second: RoofSolidPlaneEquation,
): RoofSolidLine | null {
  const direction = crossProduct(first.normal, second.normal);
  const directionLengthSq = dotProduct(direction, direction);
  if (directionLengthSq <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) return null;

  const scaledSecondNormal = scaleVector(second.normal, first.constant);
  const scaledFirstNormal = scaleVector(first.normal, second.constant);
  const pointOnLine = scaleVector(
    crossProduct(
      {
        x: scaledSecondNormal.x - scaledFirstNormal.x,
        y: scaledSecondNormal.y - scaledFirstNormal.y,
        z: scaledSecondNormal.z - scaledFirstNormal.z,
      },
      direction,
    ),
    1 / directionLengthSq,
  );

  return {
    point: point(pointOnLine.x, pointOnLine.y, pointOnLine.z),
    direction: normalizeVector(direction),
  };
}

function roofSolidVerticalCutPlane(start: Point3, end: Point3): RoofSolidPlaneEquation | null {
  const edgeDirection = normalizeVector(subtractPoints(end, start));
  if (finiteVectorLength(edgeDirection) <= ROOF_JOIN_EPSILON_MM) return null;
  const normal = normalizeVector(crossProduct(edgeDirection, WORLD_Z));
  if (finiteVectorLength(normal) <= ROOF_JOIN_EPSILON_MM) return null;
  return {
    normal,
    constant: dotProduct(normal, start),
  };
}

function buildRoofSolidBottomEdge(input: {
  edgeReference: RoofSolidEdgeReference;
  edgeReferences: RoofSolidEdgeReference[];
  bottomPlanes: Array<RoofSolidPlaneEquation | null>;
  perimeterRole?: HouseRoofPerimeterEdgeKind | null;
}): RoofSolidBottomEdge | null {
  const currentBottomPlane = input.bottomPlanes[input.edgeReference.roofPlaneIndex];
  if (!currentBottomPlane) return null;

  if (input.edgeReferences.length === 2) {
    const adjacentReference = input.edgeReferences.find(
      (reference) => reference.roofPlaneIndex !== input.edgeReference.roofPlaneIndex,
    );
    const adjacentBottomPlane = typeof adjacentReference?.roofPlaneIndex === 'number'
      ? input.bottomPlanes[adjacentReference.roofPlaneIndex]
      : null;
    if (!adjacentBottomPlane) return null;
    const miterLine = intersectRoofSolidPlanes(currentBottomPlane, adjacentBottomPlane);
    if (miterLine) return { line: miterLine, perimeter: false };
  }

  if (input.edgeReferences.length > 2) return null;
  const cutPlane = roofSolidVerticalCutPlane(input.edgeReference.start, input.edgeReference.end);
  const cutLine = cutPlane ? intersectRoofSolidPlanes(currentBottomPlane, cutPlane) : null;
  const closePerimeter =
    input.edgeReferences.length === 1 &&
    input.perimeterRole !== 'weather_flashed_edge' &&
    input.perimeterRole !== 'house_apron_edge';
  return cutLine
    ? {
        line: cutLine,
        perimeter: closePerimeter,
        perimeterRole: input.perimeterRole ?? null,
      }
    : null;
}

function closestPointOnRoofSolidLine(candidate: Point3, source: RoofSolidLine): Point3 {
  const directionLengthSq = dotProduct(source.direction, source.direction);
  if (directionLengthSq <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) return source.point;
  const ratio = dotProduct(subtractPoints(candidate, source.point), source.direction) / directionLengthSq;
  return translatePointByVector(source.point, scaleVector(source.direction, ratio));
}

function intersectRoofSolidLines(
  first: RoofSolidLine,
  second: RoofSolidLine,
  fallbackNear: Point3,
): Point3 | null {
  const firstDirection = normalizeVector(first.direction);
  const secondDirection = normalizeVector(second.direction);
  const directionCross = crossProduct(firstDirection, secondDirection);
  const directionCrossLengthSq = dotProduct(directionCross, directionCross);
  const betweenOrigins = subtractPoints(first.point, second.point);

  if (directionCrossLengthSq <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) {
    const separation = finiteVectorLength(crossProduct(subtractPoints(second.point, first.point), firstDirection));
    return separation <= 1e-2 ? closestPointOnRoofSolidLine(fallbackNear, first) : null;
  }

  const firstLengthSq = dotProduct(firstDirection, firstDirection);
  const secondLengthSq = dotProduct(secondDirection, secondDirection);
  const directionDot = dotProduct(firstDirection, secondDirection);
  const firstOriginDot = dotProduct(firstDirection, betweenOrigins);
  const secondOriginDot = dotProduct(secondDirection, betweenOrigins);
  const denominator = firstLengthSq * secondLengthSq - directionDot * directionDot;
  if (Math.abs(denominator) <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) return null;

  const firstRatio = (directionDot * secondOriginDot - secondLengthSq * firstOriginDot) / denominator;
  const secondRatio = (firstLengthSq * secondOriginDot - directionDot * firstOriginDot) / denominator;
  const firstPoint = translatePointByVector(first.point, scaleVector(firstDirection, firstRatio));
  const secondPoint = translatePointByVector(second.point, scaleVector(secondDirection, secondRatio));
  if (lineLength(line(firstPoint, secondPoint)) > 1e-2) return null;
  return point(
    (firstPoint.x + secondPoint.x) / 2,
    (firstPoint.y + secondPoint.y) / 2,
    (firstPoint.z + secondPoint.z) / 2,
  );
}

function projectRoofMeshPoint(candidate: Point3, normal: Vector3): { x: number; y: number } {
  const absX = Math.abs(normal.x);
  const absY = Math.abs(normal.y);
  const absZ = Math.abs(normal.z);
  if (absX >= absY && absX >= absZ) return { x: candidate.y, y: candidate.z };
  if (absY >= absX && absY >= absZ) return { x: candidate.x, y: candidate.z };
  return { x: candidate.x, y: candidate.y };
}

function roofMeshProjectedPointDistanceSquared(
  first: { x: number; y: number },
  second: { x: number; y: number },
): number {
  return (first.x - second.x) ** 2 + (first.y - second.y) ** 2;
}

function signedRoofMeshProjectedArea(points: Array<{ x: number; y: number }>): number {
  return points.reduce((sum, current, index) => {
    const next = points[(index + 1) % points.length]!;
    return sum + current.x * next.y - next.x * current.y;
  }, 0) / 2;
}

function roofMeshProjectedCross(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function roofMeshPointOnProjectedSegment(
  candidate: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): boolean {
  if (Math.abs(roofMeshProjectedCross(start, end, candidate)) > ROOF_JOIN_EPSILON_MM) return false;
  const dot =
    (candidate.x - start.x) * (end.x - start.x) +
    (candidate.y - start.y) * (end.y - start.y);
  if (dot < -ROOF_JOIN_EPSILON_MM) return false;
  return dot <= roofMeshProjectedPointDistanceSquared(start, end) + ROOF_JOIN_EPSILON_MM;
}

function roofMeshProjectedSegmentsIntersect(
  firstStart: { x: number; y: number },
  firstEnd: { x: number; y: number },
  secondStart: { x: number; y: number },
  secondEnd: { x: number; y: number },
): boolean {
  const firstA = roofMeshProjectedCross(firstStart, firstEnd, secondStart);
  const firstB = roofMeshProjectedCross(firstStart, firstEnd, secondEnd);
  const secondA = roofMeshProjectedCross(secondStart, secondEnd, firstStart);
  const secondB = roofMeshProjectedCross(secondStart, secondEnd, firstEnd);

  if (Math.abs(firstA) <= ROOF_JOIN_EPSILON_MM && roofMeshPointOnProjectedSegment(secondStart, firstStart, firstEnd)) {
    return true;
  }
  if (Math.abs(firstB) <= ROOF_JOIN_EPSILON_MM && roofMeshPointOnProjectedSegment(secondEnd, firstStart, firstEnd)) {
    return true;
  }
  if (Math.abs(secondA) <= ROOF_JOIN_EPSILON_MM && roofMeshPointOnProjectedSegment(firstStart, secondStart, secondEnd)) {
    return true;
  }
  if (Math.abs(secondB) <= ROOF_JOIN_EPSILON_MM && roofMeshPointOnProjectedSegment(firstEnd, secondStart, secondEnd)) {
    return true;
  }

  return firstA * firstB < 0 && secondA * secondB < 0;
}

function roofMeshProjectedPolygonSelfIntersects(points: Array<{ x: number; y: number }>): boolean {
  for (let firstIndex = 0; firstIndex < points.length; firstIndex += 1) {
    const firstNext = (firstIndex + 1) % points.length;
    for (let secondIndex = firstIndex + 1; secondIndex < points.length; secondIndex += 1) {
      const secondNext = (secondIndex + 1) % points.length;
      if (firstIndex === secondIndex || firstNext === secondIndex || secondNext === firstIndex) continue;
      if (
        roofMeshProjectedSegmentsIntersect(
          points[firstIndex]!,
          points[firstNext]!,
          points[secondIndex]!,
          points[secondNext]!,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function roofMeshPointInProjectedTriangle(
  candidate: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): boolean {
  return (
    roofMeshProjectedCross(a, b, candidate) >= -ROOF_JOIN_EPSILON_MM &&
    roofMeshProjectedCross(b, c, candidate) >= -ROOF_JOIN_EPSILON_MM &&
    roofMeshProjectedCross(c, a, candidate) >= -ROOF_JOIN_EPSILON_MM
  );
}

function roofMeshProjectedTriangleArea(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  return Math.abs(roofMeshProjectedCross(a, b, c)) / 2;
}

function roofMeshProjectedTriangleCentroid(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): { x: number; y: number } {
  return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
}

function roofMeshPointInProjectedPolygon(
  candidate: { x: number; y: number },
  polygon: Array<{ x: number; y: number }>,
): boolean {
  if (
    polygon.some((start, index) =>
      roofMeshPointOnProjectedSegment(candidate, start, polygon[(index + 1) % polygon.length]!),
    )
  ) {
    return true;
  }

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

function prepareProjectedRoofMeshPolygon(points: Point3[], normal: Vector3): ProjectedRoofMeshPoint[] | null {
  const projected = points.map((candidate, index) => ({
    index,
    projected: projectRoofMeshPoint(candidate, normal),
  }));
  const cleaned: ProjectedRoofMeshPoint[] = [];

  for (const candidate of projected) {
    const previous = cleaned[cleaned.length - 1];
    if (
      !previous ||
      roofMeshProjectedPointDistanceSquared(previous.projected, candidate.projected) >
        ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM
    ) {
      cleaned.push(candidate);
    }
  }

  if (
    cleaned.length > 2 &&
    roofMeshProjectedPointDistanceSquared(cleaned[0]!.projected, cleaned[cleaned.length - 1]!.projected) <=
      ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM
  ) {
    cleaned.pop();
  }

  let removedCollinear = true;
  while (removedCollinear && cleaned.length > 3) {
    removedCollinear = false;
    for (let index = 0; index < cleaned.length; index += 1) {
      const previous = cleaned[(index - 1 + cleaned.length) % cleaned.length]!;
      const current = cleaned[index]!;
      const next = cleaned[(index + 1) % cleaned.length]!;
      const first = {
        x: current.projected.x - previous.projected.x,
        y: current.projected.y - previous.projected.y,
      };
      const second = {
        x: next.projected.x - current.projected.x,
        y: next.projected.y - current.projected.y,
      };
      const cross = first.x * second.y - first.y * second.x;
      const dot = first.x * second.x + first.y * second.y;
      if (Math.abs(cross) <= ROOF_JOIN_EPSILON_MM && dot >= -ROOF_JOIN_EPSILON_MM) {
        cleaned.splice(index, 1);
        removedCollinear = true;
        break;
      }
    }
  }

  const uniqueProjected = new Set(
    cleaned.map((candidate) => `${candidate.projected.x.toFixed(6)},${candidate.projected.y.toFixed(6)}`),
  );
  const area = signedRoofMeshProjectedArea(cleaned.map((candidate) => candidate.projected));
  if (cleaned.length < 3 || uniqueProjected.size < 3 || Math.abs(area) <= ROOF_REGION_MIN_AREA_MM2) return null;
  return area > 0 ? cleaned : [...cleaned].reverse();
}

function triangulateRoofMeshPolygon(points: Point3[], normal: Vector3): Array<[number, number, number]> | null {
  const prepared = prepareProjectedRoofMeshPolygon(points, normal);
  if (!prepared) return null;
  const projected = prepared.map((candidate) => candidate.projected);
  if (roofMeshProjectedPolygonSelfIntersects(projected)) return null;

  const remaining = prepared.map((_, index) => index);
  const triangles: Array<[number, number, number]> = [];
  let guard = 0;

  while (remaining.length > 3 && guard < projected.length * projected.length) {
    guard += 1;
    let clipped = false;

    for (let remainingIndex = 0; remainingIndex < remaining.length; remainingIndex += 1) {
      const previousIndex = remaining[(remainingIndex - 1 + remaining.length) % remaining.length]!;
      const currentIndex = remaining[remainingIndex]!;
      const nextIndex = remaining[(remainingIndex + 1) % remaining.length]!;
      const previous = projected[previousIndex]!;
      const current = projected[currentIndex]!;
      const next = projected[nextIndex]!;

      if (roofMeshProjectedCross(previous, current, next) <= ROOF_JOIN_EPSILON_MM) continue;
      if (
        remaining.some((candidateIndex) => {
          if (candidateIndex === previousIndex || candidateIndex === currentIndex || candidateIndex === nextIndex) {
            return false;
          }
          return roofMeshPointInProjectedTriangle(projected[candidateIndex]!, previous, current, next);
        })
      ) {
        continue;
      }

      const centroid = roofMeshProjectedTriangleCentroid(previous, current, next);
      if (!roofMeshPointInProjectedPolygon(centroid, projected)) continue;

      triangles.push([
        prepared[previousIndex]!.index,
        prepared[currentIndex]!.index,
        prepared[nextIndex]!.index,
      ]);
      remaining.splice(remainingIndex, 1);
      clipped = true;
      break;
    }

    if (!clipped) return null;
  }

  if (remaining.length === 3) {
    const [a, b, c] = remaining as [number, number, number];
    if (roofMeshProjectedTriangleArea(projected[a]!, projected[b]!, projected[c]!) <= ROOF_REGION_MIN_AREA_MM2) {
      return null;
    }
    const centroid = roofMeshProjectedTriangleCentroid(projected[a]!, projected[b]!, projected[c]!);
    if (!roofMeshPointInProjectedPolygon(centroid, projected)) return null;
    triangles.push([prepared[a]!.index, prepared[b]!.index, prepared[c]!.index]);
  }

  const triangulatedArea = triangles.reduce((sum, [a, b, c]) => {
    const projectedA = projectRoofMeshPoint(points[a]!, normal);
    const projectedB = projectRoofMeshPoint(points[b]!, normal);
    const projectedC = projectRoofMeshPoint(points[c]!, normal);
    return sum + roofMeshProjectedTriangleArea(projectedA, projectedB, projectedC);
  }, 0);
  const polygonArea = Math.abs(signedRoofMeshProjectedArea(projected));
  if (Math.abs(triangulatedArea - polygonArea) > Math.max(1, polygonArea * 0.001)) return null;

  return triangles;
}

function orientRoofMeshFace(
  vertices: Point3[],
  face: [number, number, number],
  normal: Vector3,
): [number, number, number] {
  const a = vertices[face[0]]!;
  const b = vertices[face[1]]!;
  const c = vertices[face[2]]!;
  const faceNormal = crossProduct(subtractPoints(b, a), subtractPoints(c, a));
  return dotProduct(faceNormal, normal) >= 0 ? face : [face[0], face[2], face[1]];
}

function buildRoofSolidRenderMesh(input: {
  roofPlanes: RoofPlane3D[];
  roofPlaneIndex: number;
  adjacency: RoofSolidAdjacency;
  bottomPlanes: Array<RoofSolidPlaneEquation | null>;
  includeBottomFaces?: boolean;
  perimeterEdgeRoles?: Map<string, HouseRoofPerimeterEdgeKind>;
}): RenderMesh3D | undefined {
  if (input.adjacency.invalidRoofPlaneIndexes.has(input.roofPlaneIndex)) return undefined;
  const roofPlane = input.roofPlanes[input.roofPlaneIndex];
  const bottomPlane = input.bottomPlanes[input.roofPlaneIndex];
  if (!roofPlane || !bottomPlane || roofPlane.boundary.length < 3) return undefined;

  const roofNormal = normalizeVector(roofPlane.plane.normal);
  if (finiteVectorLength(roofNormal) <= ROOF_JOIN_EPSILON_MM || Math.abs(roofNormal.z) <= ROOF_JOIN_EPSILON_MM) {
    return undefined;
  }
  const topNormal = roofNormal.z >= 0 ? roofNormal : negateVector(roofNormal);
  const triangles = triangulateRoofMeshPolygon(roofPlane.boundary, topNormal);
  if (!triangles) return undefined;

  const bottomEdges: RoofSolidBottomEdge[] = [];
  for (let edgeIndex = 0; edgeIndex < roofPlane.boundary.length; edgeIndex += 1) {
    const start = roofPlane.boundary[edgeIndex]!;
    const end = roofPlane.boundary[(edgeIndex + 1) % roofPlane.boundary.length]!;
    const edgeKey = roofSolidEdgeKey(start, end);
    const edgeReferences = input.adjacency.edgeMap.get(edgeKey) ?? [];
    const edgeReference = edgeReferences.find(
      (reference) => reference.roofPlaneIndex === input.roofPlaneIndex && reference.edgeIndex === edgeIndex,
    );
    if (!edgeReference || edgeReferences.length === 0 || edgeReferences.length > 2) return undefined;
    const bottomEdge = buildRoofSolidBottomEdge({
      edgeReference,
      edgeReferences,
      bottomPlanes: input.bottomPlanes,
      perimeterRole:
        input.perimeterEdgeRoles?.get(`${roofPlane.id}:${edgeIndex}`) ?? null,
    });
    if (!bottomEdge) return undefined;
    bottomEdges.push(bottomEdge);
  }

  const bottomVertices: Point3[] = [];
  for (let vertexIndex = 0; vertexIndex < roofPlane.boundary.length; vertexIndex += 1) {
    const previousBottomEdge = bottomEdges[(vertexIndex - 1 + bottomEdges.length) % bottomEdges.length]!;
    const currentBottomEdge = bottomEdges[vertexIndex]!;
    const bottomVertex = intersectRoofSolidLines(
      previousBottomEdge.line,
      currentBottomEdge.line,
      roofPlane.boundary[vertexIndex]!,
    );
    if (!bottomVertex) return undefined;
    if (Math.abs(dotProduct(bottomPlane.normal, bottomVertex) - bottomPlane.constant) > 1e-2) return undefined;
    bottomVertices.push(bottomVertex);
  }

  const vertices = [...roofPlane.boundary, ...bottomVertices];
  const vertexCount = roofPlane.boundary.length;
  const faces: [number, number, number][] = [];
  for (const face of triangles) {
    faces.push(orientRoofMeshFace(vertices, face, topNormal));
    if (input.includeBottomFaces ?? true) {
      faces.push(orientRoofMeshFace(
        vertices,
        [face[0] + vertexCount, face[2] + vertexCount, face[1] + vertexCount],
        negateVector(topNormal),
      ));
    }
  }

  for (let edgeIndex = 0; edgeIndex < bottomEdges.length; edgeIndex += 1) {
    if (!bottomEdges[edgeIndex]!.perimeter) continue;
    const nextIndex = (edgeIndex + 1) % vertexCount;
    faces.push([edgeIndex, nextIndex, vertexCount + nextIndex]);
    faces.push([edgeIndex, vertexCount + nextIndex, vertexCount + edgeIndex]);
  }

  const mesh = { vertices, faces };
  return renderMeshIsFinite(mesh) ? mesh : undefined;
}

function polygonArea3D(points: Polygon3): number {
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

function polygonAveragePoint3D(points: Polygon3): Point3 {
  const total = points.reduce(
    (sum, current) => ({
      x: sum.x + current.x,
      y: sum.y + current.y,
      z: sum.z + current.z,
    }),
    { x: 0, y: 0, z: 0 },
  );
  const divisor = Math.max(1, points.length);
  return point(total.x / divisor, total.y / divisor, total.z / divisor);
}

function cleanPolygon3D(points: Polygon3): Polygon3 {
  const withoutDuplicates: Polygon3 = [];
  for (const candidate of points) {
    const previous = withoutDuplicates[withoutDuplicates.length - 1];
    if (previous && finiteVectorLength(subtractPoints(candidate, previous)) <= ROOF_JOIN_EPSILON_MM) continue;
    withoutDuplicates.push(candidate);
  }

  if (
    withoutDuplicates.length > 1 &&
    finiteVectorLength(subtractPoints(withoutDuplicates[0]!, withoutDuplicates[withoutDuplicates.length - 1]!)) <=
      ROOF_JOIN_EPSILON_MM
  ) {
    withoutDuplicates.pop();
  }

  if (withoutDuplicates.length < 3) return withoutDuplicates;

  const cleaned: Polygon3 = [];
  for (let index = 0; index < withoutDuplicates.length; index += 1) {
    const previous = withoutDuplicates[(index - 1 + withoutDuplicates.length) % withoutDuplicates.length]!;
    const current = withoutDuplicates[index]!;
    const next = withoutDuplicates[(index + 1) % withoutDuplicates.length]!;
    const first = subtractPoints(current, previous);
    const second = subtractPoints(next, current);
    if (finiteVectorLength(crossProduct(first, second)) <= ROOF_JOIN_EPSILON_MM) continue;
    cleaned.push(current);
  }

  return cleaned.length >= 3 ? cleaned : withoutDuplicates;
}

function clipPolygon3DByScalar(
  polygon: Polygon3,
  scalar: (candidate: Point3) => number,
): Polygon3 {
  if (polygon.length < 3) return [];
  const clipped: Polygon3 = [];

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    const currentValue = scalar(current);
    const nextValue = scalar(next);
    const currentInside = currentValue <= ROOF_JOIN_EPSILON_MM;
    const nextInside = nextValue <= ROOF_JOIN_EPSILON_MM;
    const denominator = currentValue - nextValue;
    const intersection =
      Math.abs(denominator) <= ROOF_JOIN_EPSILON_MM
        ? null
        : translatePointByVector(
            current,
            scaleVector(subtractPoints(next, current), clamp(currentValue / denominator, 0, 1)),
          );

    if (currentInside && nextInside) {
      clipped.push(next);
    } else if (currentInside && !nextInside) {
      if (intersection) clipped.push(intersection);
    } else if (!currentInside && nextInside) {
      if (intersection) clipped.push(intersection);
      clipped.push(next);
    }
  }

  return cleanPolygon3D(clipped);
}

function roofPlaneTopNormal(roofPlane: RoofPlane3D): Vector3 | null {
  const normal = normalizeVector(roofPlane.plane.normal);
  if (finiteVectorLength(normal) <= ROOF_JOIN_EPSILON_MM) return null;
  return normal.z >= 0 ? normal : negateVector(normal);
}

function buildHouseRoofFeatureFlashingWing(input: {
  flashingId: string;
  featureLine: Line3;
  roofPlane: RoofPlane3D;
}): RoofFlashing3D['wings'][number] | null {
  if (lineLength(input.featureLine) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) return null;
  const topNormal = roofPlaneTopNormal(input.roofPlane);
  if (!topNormal || input.roofPlane.boundary.length < 3) return null;

  const featureDirection = normalizeVector(subtractPoints(input.featureLine.end, input.featureLine.start));
  if (finiteVectorLength(featureDirection) <= ROOF_JOIN_EPSILON_MM) return null;

  let interiorDirection = normalizeVector(crossProduct(topNormal, featureDirection));
  if (finiteVectorLength(interiorDirection) <= ROOF_JOIN_EPSILON_MM) return null;

  const centroidDistance = dotProduct(
    subtractPoints(polygonAveragePoint3D(input.roofPlane.boundary), input.featureLine.start),
    interiorDirection,
  );
  if (Math.abs(centroidDistance) <= ROOF_JOIN_EPSILON_MM) {
    const distances = input.roofPlane.boundary.map((candidate) =>
      dotProduct(subtractPoints(candidate, input.featureLine.start), interiorDirection),
    );
    const positiveMax = Math.max(...distances);
    const negativeMax = Math.max(...distances.map((distance) => -distance));
    if (negativeMax > positiveMax) interiorDirection = negateVector(interiorDirection);
  } else if (centroidDistance < 0) {
    interiorDirection = negateVector(interiorDirection);
  }

  const distanceFromFeature = (candidate: Point3) =>
    dotProduct(subtractPoints(candidate, input.featureLine.start), interiorDirection);
  const interiorSide = clipPolygon3DByScalar(
    input.roofPlane.boundary,
    (candidate) => -distanceFromFeature(candidate),
  );
  const strip = clipPolygon3DByScalar(
    interiorSide,
    (candidate) => distanceFromFeature(candidate) - DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM,
  );
  if (strip.length < 3 || polygonArea3D(strip) <= ROOF_REGION_MIN_AREA_MM2) return null;

  const surfaceOffset = scaleVector(topNormal, DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_SURFACE_OFFSET_MM);
  const boundary = strip.map((candidate) => translatePointByVector(candidate, surfaceOffset));
  const plane = {
    ...input.roofPlane.plane,
    origin: translatePointByVector(input.roofPlane.plane.origin, surfaceOffset),
  };

  return {
    id: `${input.flashingId}-${input.roofPlane.id}-wing`,
    boundary,
    plane,
  };
}

function buildHouseRoofFeatureFlashings(input: {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
}): RoofFlashing3D[] {
  const adjacency = buildRoofSolidAdjacency(input.roofPlanes);
  const flashings: RoofFlashing3D[] = [];

  for (const feature of input.roofFeatures) {
    if (feature.kind === 'gable_end_frame') continue;
    if (feature.metadata?.roofFeatureSource === 'reentrant_fallback') continue;
    const edgeReferences = adjacency.edgeMap.get(roofSolidEdgeKey(feature.line.start, feature.line.end)) ?? [];
    const uniqueRoofPlaneIndexes = new Set(edgeReferences.map((reference) => reference.roofPlaneIndex));
    if (edgeReferences.length !== 2 || uniqueRoofPlaneIndexes.size !== 2) continue;
    if (edgeReferences.some((reference) => adjacency.invalidRoofPlaneIndexes.has(reference.roofPlaneIndex))) continue;

    const flashingId = `house-roof-flashing-${feature.id}`;
    const wings = edgeReferences
      .map((reference) => {
        const roofPlane = input.roofPlanes[reference.roofPlaneIndex];
        return roofPlane
          ? buildHouseRoofFeatureFlashingWing({
              flashingId,
              featureLine: feature.line,
              roofPlane,
            })
          : null;
      })
      .filter((wing): wing is RoofFlashing3D['wings'][number] => wing !== null);

    if (wings.length !== 2) continue;
    flashings.push({
      id: flashingId,
      wings,
      thicknessMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_THICKNESS_MM,
      metadata: {
        position: feature.kind,
        source: 'house_model',
        sourceFeatureId: feature.id,
        featureKind: feature.kind,
        girthMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_GIRTH_MM,
        wingLengthMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM,
        thicknessMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_THICKNESS_MM,
        surfaceOffsetMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_SURFACE_OFFSET_MM,
        roofGeometry: typeof feature.metadata?.roofGeometry === 'string' ? feature.metadata.roofGeometry : null,
      },
    });
  }

  return flashings;
}

function attachmentTargetPlane(input: {
  attachmentTarget?: HouseAttachmentTarget3D | null;
}): Plane3 | null {
  const attachmentTarget = input.attachmentTarget;
  if (!attachmentTarget) return null;
  if (attachmentTarget.kind === 'zone') return attachmentTarget.zone?.plane ?? null;
  if (attachmentTarget.kind === 'plane') return attachmentTarget.plane ?? null;
  return null;
}

function buildPerimeterRoofFlashingWing(input: {
  flashingId: string;
  edge: HouseRoofPerimeterEdge;
  roofPlane: RoofPlane3D;
  featureLine: Line3;
}): RoofFlashing3D['wings'][number] | null {
  if (lineLength(input.featureLine) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) return null;
  const topNormal = roofPlaneTopNormal(input.roofPlane);
  if (!topNormal || input.roofPlane.boundary.length < 3) return null;

  const featureDirection = normalizeVector(subtractPoints(input.featureLine.end, input.featureLine.start));
  if (finiteVectorLength(featureDirection) <= ROOF_JOIN_EPSILON_MM) return null;

  let interiorDirection = normalizeVector(crossProduct(topNormal, featureDirection));
  if (finiteVectorLength(interiorDirection) <= ROOF_JOIN_EPSILON_MM) return null;

  const centroidDistance = dotProduct(
    subtractPoints(polygonAveragePoint3D(input.roofPlane.boundary), input.featureLine.start),
    interiorDirection,
  );
  if (Math.abs(centroidDistance) <= ROOF_JOIN_EPSILON_MM) {
    const distances = input.roofPlane.boundary.map((candidate) =>
      dotProduct(subtractPoints(candidate, input.featureLine.start), interiorDirection),
    );
    const positiveMax = Math.max(...distances);
    const negativeMax = Math.max(...distances.map((distance) => -distance));
    if (negativeMax > positiveMax) interiorDirection = negateVector(interiorDirection);
  } else if (centroidDistance < 0) {
    interiorDirection = negateVector(interiorDirection);
  }

  const surfaceOffset = scaleVector(topNormal, DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_SURFACE_OFFSET_MM);
  const inset = scaleVector(interiorDirection, DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM);
  const boundary = [
    translatePointByVector(input.featureLine.start, surfaceOffset),
    translatePointByVector(input.featureLine.end, surfaceOffset),
    translatePointByVector(translatePointByVector(input.featureLine.end, inset), surfaceOffset),
    translatePointByVector(translatePointByVector(input.featureLine.start, inset), surfaceOffset),
  ];
  if (polygonArea3D(boundary) <= ROOF_REGION_MIN_AREA_MM2) return null;
  const plane = {
    ...input.roofPlane.plane,
    origin: translatePointByVector(input.roofPlane.plane.origin, surfaceOffset),
  };

  return {
    id: `${input.flashingId}-${input.roofPlane.id}-roof-wing`,
    boundary,
    plane,
  };
}

function buildPerimeterReturnFlashingWing(input: {
  flashingId: string;
  edge: HouseRoofPerimeterEdge;
  roofPlane: RoofPlane3D;
  attachmentTarget?: HouseAttachmentTarget3D | null;
  featureLine: Line3;
}): RoofFlashing3D['wings'][number] | null {
  if (lineLength(input.featureLine) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) return null;

  const roofOffsetNormal = roofPlaneTopNormal(input.roofPlane);
  const roofOffset =
    roofOffsetNormal
      ? scaleVector(roofOffsetNormal, DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_SURFACE_OFFSET_MM)
      : { x: 0, y: 0, z: 0 };
  const topStart = translatePointByVector(input.featureLine.start, roofOffset);
  const topEnd = translatePointByVector(input.featureLine.end, roofOffset);

  if (input.edge.edgeKind === 'house_apron_edge') {
    const wallPlane = attachmentTargetPlane({ attachmentTarget: input.attachmentTarget });
    if (wallPlane) {
      const boundary = [
        input.featureLine.start,
        input.featureLine.end,
        point(
          input.featureLine.end.x,
          input.featureLine.end.y,
          input.featureLine.end.z + DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM,
        ),
        point(
          input.featureLine.start.x,
          input.featureLine.start.y,
          input.featureLine.start.z + DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM,
        ),
      ];
      if (polygonArea3D(boundary) <= ROOF_REGION_MIN_AREA_MM2) return null;
      return {
        id: `${input.flashingId}-${input.roofPlane.id}-apron-wing`,
        boundary,
        plane: wallPlane,
      };
    }
  }

  const featureDirection = normalizeVector(subtractPoints(input.featureLine.end, input.featureLine.start));
  if (finiteVectorLength(featureDirection) <= ROOF_JOIN_EPSILON_MM) return null;

  const boundary = [
    topStart,
    topEnd,
    point(topEnd.x, topEnd.y, topEnd.z - DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM),
    point(topStart.x, topStart.y, topStart.z - DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM),
  ];
  if (polygonArea3D(boundary) <= ROOF_REGION_MIN_AREA_MM2) return null;

  return {
    id: `${input.flashingId}-${input.roofPlane.id}-return-wing`,
    boundary,
    plane: planeFromOriginAxes(topStart, featureDirection, WORLD_Z),
  };
}

function buildPerimeterFlashings(input: {
  perimeterEdges: HouseRoofPerimeterEdge[];
  roofPlanes: RoofPlane3D[];
  attachmentTarget?: HouseAttachmentTarget3D | null;
}): RoofFlashing3D[] {
  const roofPlaneById = new Map(input.roofPlanes.map((roofPlane) => [roofPlane.id, roofPlane]));

  return input.perimeterEdges.flatMap((edge) => {
    if (!isPerimeterFlashingEdge(edge.edgeKind)) return [];
    return input.roofPlanes.flatMap((roofPlane) => {
      const featureLine = roofPlanePerimeterOverlapSegment(roofPlane, edge);
      if (!featureLine) return [];

      const flashingId = `house-roof-flashing-${edge.sourceEdgeId}-${roofPlane.id}`;
      const roofWing = buildPerimeterRoofFlashingWing({
        flashingId,
        edge,
        roofPlane,
        featureLine,
      });
      const returnWing = buildPerimeterReturnFlashingWing({
        flashingId,
        edge,
        roofPlane,
        attachmentTarget: input.attachmentTarget,
        featureLine,
      });
      const wings = [roofWing, returnWing].filter(
        (wing): wing is RoofFlashing3D['wings'][number] => wing !== null,
      );
      if (wings.length !== 2) return [];

      return [{
        id: flashingId,
        wings,
        thicknessMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_THICKNESS_MM,
        metadata: {
          position: edge.flashingRole ?? null,
          source: 'house_model',
          sourceEdgeId: edge.sourceEdgeId,
          sourceRoofPlaneId: roofPlane.id,
          featureKind: null,
          girthMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_GIRTH_MM,
          wingLengthMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM,
          thicknessMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_THICKNESS_MM,
          surfaceOffsetMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_SURFACE_OFFSET_MM,
          roofGeometry:
            typeof roofPlane.metadata?.roofGeometry === 'string' ? roofPlane.metadata.roofGeometry : null,
          houseRoofPerimeterRole: edge.edgeKind,
          flashingRole: edge.flashingRole ?? null,
          flashingTreatment: 'house_perimeter_folded',
        },
      }];
    });
  });
}

type HouseRoofMaterialSettings = {
  profileKind: HouseRoofMaterialProfileKind;
  spacingMm: number;
  lineDirection: 'fall' | 'across';
};

type HouseRoofMaterialProjection = {
  u: number;
  v: number;
};

function houseRoofMaterialSettings(material: HouseRoofMaterial): HouseRoofMaterialSettings {
  switch (material) {
    case 'trapezoidal_5_rib':
      return { profileKind: 'rib', spacingMm: 190, lineDirection: 'fall' };
    case 'eurotray_300':
      return { profileKind: 'seam', spacingMm: 300, lineDirection: 'fall' };
    case 'eurotray_500':
      return { profileKind: 'seam', spacingMm: 500, lineDirection: 'fall' };
    case 'shingles':
      return { profileKind: 'course', spacingMm: 250, lineDirection: 'across' };
    case 'corrugated_iron':
    default:
      return { profileKind: 'rib', spacingMm: 76.2, lineDirection: 'fall' };
  }
}

function pointOnHouseRoofMaterialProjectedSegment(
  candidate: HouseRoofMaterialProjection,
  start: HouseRoofMaterialProjection,
  end: HouseRoofMaterialProjection,
): boolean {
  const dx = end.u - start.u;
  const dy = end.v - start.v;
  const cross = (candidate.u - start.u) * dy - (candidate.v - start.v) * dx;
  if (Math.abs(cross) > ROOF_JOIN_EPSILON_MM) return false;
  const dot = (candidate.u - start.u) * dx + (candidate.v - start.v) * dy;
  if (dot < -ROOF_JOIN_EPSILON_MM) return false;
  return dot <= dx * dx + dy * dy + ROOF_JOIN_EPSILON_MM;
}

function pointInHouseRoofMaterialProjectedPolygon(
  candidate: HouseRoofMaterialProjection,
  polygon: HouseRoofMaterialProjection[],
): boolean {
  if (
    polygon.some((start, index) =>
      pointOnHouseRoofMaterialProjectedSegment(candidate, start, polygon[(index + 1) % polygon.length]!),
    )
  ) {
    return true;
  }

  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index]!;
    const previous = polygon[previousIndex]!;
    const intersects =
      current.v > candidate.v !== previous.v > candidate.v &&
      candidate.u < ((previous.u - current.u) * (candidate.v - current.v)) / (previous.v - current.v || 1) + current.u;
    if (intersects) inside = !inside;
  }
  return inside;
}

function projectedHouseRoofMaterialPolygonArea(polygon: HouseRoofMaterialProjection[]): number {
  if (polygon.length < 3) return 0;
  return Math.abs(
    polygon.reduce((sum, current, index) => {
      const next = polygon[(index + 1) % polygon.length]!;
      return sum + current.u * next.v - next.u * current.v;
    }, 0) / 2,
  );
}

function uniqueHouseRoofMaterialProjectedPointCount(polygon: HouseRoofMaterialProjection[]): number {
  return new Set(
    polygon.map((candidate) => `${Math.round(candidate.u / ROOF_JOIN_EPSILON_MM)},${Math.round(candidate.v / ROOF_JOIN_EPSILON_MM)}`),
  ).size;
}

function worldHouseRoofMaterialPoint(input: {
  origin: Point3;
  acrossAxis: Vector3;
  fallAxis: Vector3;
  offset: Vector3;
  u: number;
  v: number;
}): Point3 {
  return point(
    input.origin.x + input.acrossAxis.x * input.u + input.fallAxis.x * input.v + input.offset.x,
    input.origin.y + input.acrossAxis.y * input.u + input.fallAxis.y * input.v + input.offset.y,
    input.origin.z + input.acrossAxis.z * input.u + input.fallAxis.z * input.v + input.offset.z,
  );
}

function houseRoofMaterialCoordinateValues(min: number, max: number, spacingMm: number): number[] {
  const span = max - min;
  if (!Number.isFinite(span) || span <= ROOF_JOIN_EPSILON_MM || !Number.isFinite(spacingMm) || spacingMm <= ROOF_JOIN_EPSILON_MM) {
    return [];
  }
  const values: number[] = [];
  const start = Math.ceil(min / spacingMm) * spacingMm;
  for (let value = start; value <= max + ROOF_JOIN_EPSILON_MM; value += spacingMm) {
    if (value > min + ROOF_JOIN_EPSILON_MM && value < max - ROOF_JOIN_EPSILON_MM) {
      values.push(value);
    }
    if (values.length > 1000) break;
  }
  if (values.length === 0) values.push((min + max) / 2);
  return values;
}

function clipHouseRoofMaterialLine(input: {
  polygon: HouseRoofMaterialProjection[];
  fixedAxis: 'u' | 'v';
  fixedValue: number;
}): Array<{ start: HouseRoofMaterialProjection; end: HouseRoofMaterialProjection }> {
  const intersections: number[] = [];
  const variableAxis = input.fixedAxis === 'u' ? 'v' : 'u';

  for (let index = 0; index < input.polygon.length; index += 1) {
    const start = input.polygon[index]!;
    const end = input.polygon[(index + 1) % input.polygon.length]!;
    const startFixedDistance = start[input.fixedAxis] - input.fixedValue;
    const endFixedDistance = end[input.fixedAxis] - input.fixedValue;

    if (Math.abs(startFixedDistance) <= ROOF_JOIN_EPSILON_MM && Math.abs(endFixedDistance) <= ROOF_JOIN_EPSILON_MM) {
      intersections.push(start[variableAxis], end[variableAxis]);
      continue;
    }

    if (Math.abs(startFixedDistance) <= ROOF_JOIN_EPSILON_MM) {
      intersections.push(start[variableAxis]);
      continue;
    }

    if (Math.abs(endFixedDistance) <= ROOF_JOIN_EPSILON_MM) {
      intersections.push(end[variableAxis]);
      continue;
    }

    if (startFixedDistance * endFixedDistance < 0) {
      const ratio = startFixedDistance / (startFixedDistance - endFixedDistance);
      intersections.push(start[variableAxis] + (end[variableAxis] - start[variableAxis]) * ratio);
    }
  }

  const sorted = [...intersections]
    .filter((candidate) => Number.isFinite(candidate))
    .sort((a, b) => a - b)
    .reduce<number[]>((unique, candidate) => {
      const previous = unique[unique.length - 1];
      if (previous === undefined || Math.abs(candidate - previous) > ROOF_JOIN_EPSILON_MM) unique.push(candidate);
      return unique;
    }, []);

  const segments: Array<{ start: HouseRoofMaterialProjection; end: HouseRoofMaterialProjection }> = [];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const startValue = sorted[index]!;
    const endValue = sorted[index + 1]!;
    if (endValue - startValue <= 1) continue;
    const midpointValue = (startValue + endValue) / 2;
    const midpoint =
      input.fixedAxis === 'u'
        ? { u: input.fixedValue, v: midpointValue }
        : { u: midpointValue, v: input.fixedValue };
    if (!pointInHouseRoofMaterialProjectedPolygon(midpoint, input.polygon)) continue;

    segments.push(
      input.fixedAxis === 'u'
        ? {
            start: { u: input.fixedValue, v: startValue },
            end: { u: input.fixedValue, v: endValue },
          }
        : {
            start: { u: startValue, v: input.fixedValue },
            end: { u: endValue, v: input.fixedValue },
          },
    );
  }

  return segments;
}

function buildHouseRoofMaterialVisualForPlane(input: {
  roofPlane: RoofPlane3D;
  material: HouseRoofMaterial;
}): HouseRoofMaterialVisual3D | null {
  const settings = houseRoofMaterialSettings(input.material);
  const topNormal = roofPlaneTopNormal(input.roofPlane);
  if (!topNormal || input.roofPlane.boundary.length < 3) return null;
  if (!input.roofPlane.boundary.every(finiteRoofQaPoint) || polygonArea3D(input.roofPlane.boundary) <= ROOF_REGION_MIN_AREA_MM2) {
    return null;
  }

  const rawFall = normalizeVector(input.roofPlane.fallVector);
  if (finiteVectorLength(rawFall) <= ROOF_JOIN_EPSILON_MM) return null;
  const normalFallDot = dotProduct(rawFall, topNormal);
  const fallAxis = normalizeVector({
    x: rawFall.x - topNormal.x * normalFallDot,
    y: rawFall.y - topNormal.y * normalFallDot,
    z: rawFall.z - topNormal.z * normalFallDot,
  });
  if (finiteVectorLength(fallAxis) <= ROOF_JOIN_EPSILON_MM) return null;

  const acrossAxis = normalizeVector(crossProduct(topNormal, fallAxis));
  if (finiteVectorLength(acrossAxis) <= ROOF_JOIN_EPSILON_MM) return null;

  const origin = input.roofPlane.plane.origin;
  const projected = input.roofPlane.boundary.map((candidate) => {
    const relative = subtractPoints(candidate, origin);
    return {
      u: dotProduct(relative, acrossAxis),
      v: dotProduct(relative, fallAxis),
    };
  });
  if (
    projected.length < 3 ||
    uniqueHouseRoofMaterialProjectedPointCount(projected) < 3 ||
    projectedHouseRoofMaterialPolygonArea(projected) <= ROOF_REGION_MIN_AREA_MM2
  ) {
    return null;
  }

  const coordinates =
    settings.lineDirection === 'fall'
      ? houseRoofMaterialCoordinateValues(
          Math.min(...projected.map((candidate) => candidate.u)),
          Math.max(...projected.map((candidate) => candidate.u)),
          settings.spacingMm,
        )
      : houseRoofMaterialCoordinateValues(
          Math.min(...projected.map((candidate) => candidate.v)),
          Math.max(...projected.map((candidate) => candidate.v)),
          settings.spacingMm,
        );
  const offset = scaleVector(topNormal, DEFAULT_HOUSE_ROOF_MATERIAL_SURFACE_OFFSET_MM);
  const lines = coordinates.flatMap((fixedValue) =>
    clipHouseRoofMaterialLine({
      polygon: projected,
      fixedAxis: settings.lineDirection === 'fall' ? 'u' : 'v',
      fixedValue,
    }).map((segment) =>
      line(
        worldHouseRoofMaterialPoint({
          origin,
          acrossAxis,
          fallAxis,
          offset,
          u: segment.start.u,
          v: segment.start.v,
        }),
        worldHouseRoofMaterialPoint({
          origin,
          acrossAxis,
          fallAxis,
          offset,
          u: segment.end.u,
          v: segment.end.v,
        }),
      ),
    ),
  ).filter((candidate) => lineLength(candidate) > 1 && finiteRoofQaPoint(candidate.start) && finiteRoofQaPoint(candidate.end));

  if (lines.length === 0) return null;

  return {
    id: `house-roof-material-${input.roofPlane.id}`,
    roofPlaneId: input.roofPlane.id,
    material: input.material,
    profileKind: settings.profileKind,
    lines,
    plane: {
      ...input.roofPlane.plane,
      origin: translatePointByVector(input.roofPlane.plane.origin, offset),
    },
    spacingMm: settings.spacingMm,
    surfaceOffsetMm: DEFAULT_HOUSE_ROOF_MATERIAL_SURFACE_OFFSET_MM,
    metadata: {
      source: 'house_model',
      sourceRoofPlaneId: input.roofPlane.id,
      material: input.material,
      profileKind: settings.profileKind,
      lineDirection: settings.lineDirection,
      spacingMm: settings.spacingMm,
      surfaceOffsetMm: DEFAULT_HOUSE_ROOF_MATERIAL_SURFACE_OFFSET_MM,
      lineCount: lines.length,
    },
  };
}

function buildHouseRoofMaterialVisuals(input: {
  roofPlanes: RoofPlane3D[];
  material: HouseRoofMaterial;
}): HouseRoofMaterialVisual3D[] {
  return input.roofPlanes
    .map((roofPlane) => buildHouseRoofMaterialVisualForPlane({ roofPlane, material: input.material }))
    .filter((visual): visual is HouseRoofMaterialVisual3D => visual !== null);
}

function buildHouseDecks(input: {
  decks: NonNullable<HouseModel3D['decks']>;
}): HouseDeck3D[] {
  return input.decks
    .map((deck) => {
      if (!deck.boundary.length) return null;
      const topZ = Math.round(deck.topSurfaceElevationMm);
      const boundary = deck.boundary.map((point3) => point(point3.x, point3.y, topZ));
      const plane = planeFromBoundary(boundary);
      if (!plane) return null;
      return {
        ...deck,
        boundary,
        plane,
      };
    })
    .filter((deck): deck is HouseDeck3D => deck !== null);
}

function buildHouseOpenings(input: {
  openings: NonNullable<HouseModel3D['openings']>;
}): HouseOpening3D[] {
  return input.openings
    .map((opening) => {
      if (!opening?.id) return null;
      if (
        !Number.isFinite(opening.widthMm) ||
        !Number.isFinite(opening.heightMm) ||
        !Number.isFinite(opening.sillHeightMm) ||
        !Number.isFinite(opening.offsetAlongWallMm)
      ) {
        return null;
      }
      const kind =
        opening.kind === 'hinged_door' ||
        opening.kind === 'slider' ||
        opening.kind === 'stacker' ||
        opening.kind === 'window'
          ? opening.kind
          : 'window';
      return {
        ...opening,
        kind,
        panelCount:
          kind === 'slider'
            ? opening.panelCount === 3 || opening.panelCount === 4
              ? opening.panelCount
              : 2
            : null,
        wallId:
          opening.wallId === 'front' ||
          opening.wallId === 'left' ||
          opening.wallId === 'right'
            ? opening.wallId
            : 'rear',
        hostEdgeId: typeof opening.hostEdgeId === 'string' ? opening.hostEdgeId.trim() || null : null,
        widthMm: Math.max(0, Math.round(opening.widthMm)),
        heightMm: Math.max(0, Math.round(opening.heightMm)),
        sillHeightMm: Math.max(0, Math.round(opening.sillHeightMm)),
        offsetAlongWallMm: Math.max(0, Math.round(opening.offsetAlongWallMm)),
        validationStatus: opening.validationStatus === 'invalid' ? 'invalid' : 'valid',
        validationCodes: opening.validationCodes ?? [],
        validationMessage: opening.validationMessage ?? null,
      };
    })
    .filter((opening): opening is HouseOpening3D => opening !== null);
}

function houseWallIsOpenGableFrame(
  wall: Pick<HouseWallSegment3D, 'metadata'>,
): boolean {
  return wall.metadata?.houseWallMode === 'open_gable_frame';
}

function buildOpenGableFrameFeatures(input: {
  wallSegments: HouseWallSegment3D[];
  openTerminalEnds: HouseGableTerminalEnd[];
  roofGeometry: string | null;
}): HouseRoofFeature3D[] {
  const wallBySourceEdgeId = new Map(
    input.wallSegments.map((segment) => [segment.sourceEdgeId ?? '', segment]),
  );
  const features: HouseRoofFeature3D[] = [];

  for (const terminalEnd of input.openTerminalEnds) {
    const wall = wallBySourceEdgeId.get(terminalEnd.sourceEdgeId);
    if (!wall) continue;
    const topProfile = wall.boundary.slice(2).reverse();
    if (topProfile.length < 2) continue;

    const startVertical = line(wall.line.start, topProfile[0]!);
    if (lineLength(startVertical) > ROOF_JOIN_FEATURE_MIN_LENGTH_MM) {
      features.push({
        id: `${terminalEnd.id}-side-a`,
        kind: 'gable_end_frame',
        line: startVertical,
        metadata: {
          roofForm: 'gable',
          roofGeometry: input.roofGeometry,
          gableEndId: terminalEnd.id,
          sourceEdgeId: terminalEnd.sourceEdgeId,
          houseFrameRole: 'gable_end_post',
        },
      });
    }

    for (let index = 0; index < topProfile.length - 1; index += 1) {
      const topSegment = line(topProfile[index]!, topProfile[index + 1]!);
      if (lineLength(topSegment) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) continue;
      features.push({
        id: `${terminalEnd.id}-top-${index + 1}`,
        kind: 'gable_end_frame',
        line: topSegment,
        metadata: {
          roofForm: 'gable',
          roofGeometry: input.roofGeometry,
          gableEndId: terminalEnd.id,
          sourceEdgeId: terminalEnd.sourceEdgeId,
          houseFrameRole: 'gable_end_top_chord',
        },
      });
    }

    const endVertical = line(wall.line.end, topProfile[topProfile.length - 1]!);
    if (lineLength(endVertical) > ROOF_JOIN_FEATURE_MIN_LENGTH_MM) {
      features.push({
        id: `${terminalEnd.id}-side-b`,
        kind: 'gable_end_frame',
        line: endVertical,
        metadata: {
          roofForm: 'gable',
          roofGeometry: input.roofGeometry,
          gableEndId: terminalEnd.id,
          sourceEdgeId: terminalEnd.sourceEdgeId,
          houseFrameRole: 'gable_end_post',
        },
      });
    }
  }

  return features;
}

function buildHouseEnvelopeSolids(input: {
  wallSegments: HouseWallSegment3D[];
  roofPlanes: RoofPlane3D[];
  roofForm: HouseRoofForm;
  decks: HouseDeck3D[];
  perimeterEdges: HouseRoofPerimeterEdge[];
  soffitPolygons: HouseRoofPerimeterPolygon[];
  fasciaPolygons: HouseRoofPerimeterPolygon[];
  gutterLines: HouseRoofPerimeterLine[];
  gutterBoundaries: HouseRoofPerimeterPolygon[];
  gutterWidthMm: number;
  gutterDepthMm: number;
}): NonNullable<HouseModel3D['solids']> {
  const surfaceSolids: NonNullable<HouseModel3D['solids']>['surfaceSolids'] = [];
  const linearSolids: NonNullable<HouseModel3D['solids']>['linearSolids'] = [];
  const wallMiterFootprints = buildMiteredStripFootprints(
    input.wallSegments.map((segment) => segment.line.start),
    DEFAULT_WALL_SOLID_THICKNESS_MM / 2,
  );
  const fasciaMiterFootprints = buildPerimeterOffsetStripFootprints({
    edges: input.perimeterEdges,
    outerOffsetMm: DEFAULT_FASCIA_SOLID_THICKNESS_MM / 2,
    innerOffsetMm: -DEFAULT_FASCIA_SOLID_THICKNESS_MM / 2,
  });
  const roofSolidAdjacency = buildRoofSolidAdjacency(input.roofPlanes);
  const roofBottomPlanes = input.roofPlanes.map((roofPlane) =>
    roofSolidBottomPlaneEquation(roofPlane.plane, DEFAULT_ROOF_SOLID_THICKNESS_MM),
  );
  const perimeterEdgeRoles = new Map<string, HouseRoofPerimeterEdgeKind>();
  for (const edge of input.perimeterEdges) {
    if (!edge.sourceRoofPlaneId) continue;
    perimeterEdgeRoles.set(`${edge.sourceRoofPlaneId}:${edge.index}`, edge.edgeKind);
  }

  for (const [index, wall] of input.wallSegments.entries()) {
    if (houseWallIsOpenGableFrame(wall)) continue;
    const zRange = boundaryZRange(wall.boundary);
    const renderMesh =
      zRange &&
      wallBoundaryHasFlatTop(wall.boundary) &&
      wallMiterFootprints?.length === input.wallSegments.length
        ? buildVerticalPrismRenderMesh(wallMiterFootprints[index]!, zRange.bottomZ, zRange.topZ)
        : undefined;
    surfaceSolids.push({
      id: `house-solid-${wall.id}`,
      kind: 'wall',
      boundary: wall.boundary,
      plane: wall.plane,
      thicknessMm: DEFAULT_WALL_SOLID_THICKNESS_MM,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        sourceId: wall.id,
        sourceEdgeId: wall.sourceEdgeId ?? null,
      },
    });
  }

  for (const [roofPlaneIndex, roofPlane] of input.roofPlanes.entries()) {
    const renderMesh = buildRoofSolidRenderMesh({
      roofPlanes: input.roofPlanes,
      roofPlaneIndex,
      adjacency: roofSolidAdjacency,
      bottomPlanes: roofBottomPlanes,
      includeBottomFaces: input.roofForm !== 'mono',
      perimeterEdgeRoles,
    });
    surfaceSolids.push({
      id: `house-solid-${roofPlane.id}`,
      kind: 'roof',
      boundary: roofPlane.boundary,
      plane: roofPlane.plane,
      thicknessMm: DEFAULT_ROOF_SOLID_THICKNESS_MM,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        ...roofPlane.metadata,
        sourceId: roofPlane.id,
      },
    });
  }

  for (const deck of input.decks) {
    const renderMesh = buildVerticalPrismRenderMesh(
      deck.boundary,
      deck.topSurfaceElevationMm - DEFAULT_DECK_SURFACE_THICKNESS_MM,
      deck.topSurfaceElevationMm,
    );
    surfaceSolids.push({
      id: `house-solid-${deck.id}`,
      kind: 'deck',
      boundary: deck.boundary,
      plane: deck.plane,
      thicknessMm: DEFAULT_DECK_SURFACE_THICKNESS_MM,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        ...deck.metadata,
        sourceId: deck.id,
      },
    });
  }

  for (const [index, soffit] of input.soffitPolygons.entries()) {
    const boundary = soffit.boundary;
    const plane = planeFromBoundary(boundary);
    if (!plane) continue;
    const z = boundary[0]?.z;
    const renderMesh =
      typeof z === 'number' &&
      Number.isFinite(z) &&
      boundary.every((candidate) => Math.abs(candidate.z - z) <= 1e-6)
      ? buildVerticalPrismRenderMesh(
          boundary,
          z - DEFAULT_SOFFIT_SOLID_THICKNESS_MM / 2,
          z + DEFAULT_SOFFIT_SOLID_THICKNESS_MM / 2,
        )
      : undefined;
    surfaceSolids.push({
      id: `house-solid-soffit-${index + 1}`,
      kind: 'soffit',
      boundary,
      plane,
      thicknessMm: DEFAULT_SOFFIT_SOLID_THICKNESS_MM,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        sourceId: `house-soffit-${index + 1}`,
        sourceEdgeId: soffit.sourceEdgeId,
        houseRoofEdgeKind: soffit.edgeKind,
        houseRoofPerimeterRole: soffit.edgeKind,
        sourceRoofPlaneId: soffit.sourceRoofPlaneId ?? null,
        flashingRole: soffit.flashingRole ?? null,
        houseRoofSoffitMode: soffit.houseRoofSoffitMode ?? null,
      },
    });
  }

  for (const [index, fascia] of input.fasciaPolygons.entries()) {
    const boundary = fascia.boundary;
    const plane = planeFromBoundary(boundary);
    if (!plane) continue;
    const zRange = boundaryZRange(boundary);
    const renderMesh =
      zRange && fasciaMiterFootprints.length === input.fasciaPolygons.length
        ? buildVerticalPrismRenderMesh(fasciaMiterFootprints[index]!.boundary, zRange.bottomZ, zRange.topZ)
        : undefined;
    surfaceSolids.push({
      id: `house-solid-fascia-${index + 1}`,
      kind: 'fascia',
      boundary,
      plane,
      thicknessMm: DEFAULT_FASCIA_SOLID_THICKNESS_MM,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        sourceId: `house-fascia-${index + 1}`,
        sourceEdgeId: fascia.sourceEdgeId,
        houseRoofEdgeKind: fascia.edgeKind,
        houseRoofPerimeterRole: fascia.edgeKind,
        flashingRole: fascia.flashingRole ?? null,
        sourceRoofPlaneId: fascia.sourceRoofPlaneId ?? null,
      },
    });
  }

  for (const [index, gutter] of input.gutterLines.entries()) {
    const boundary = input.gutterBoundaries[index]?.boundary;
    const start = gutter.line.start;
    const end = gutter.line.end;
    const gutterLine = line(
      point(start.x, start.y, start.z - input.gutterDepthMm / 2),
      point(end.x, end.y, end.z - input.gutterDepthMm / 2),
    );
    if (lineLength(gutterLine) <= 1e-6) continue;
    const xAxis = normalizeVector(subtractPoints(gutterLine.end, gutterLine.start));
    const perimeterEdge = input.perimeterEdges.find((edge) => edge.sourceEdgeId === gutter.sourceEdgeId);
    const sourcePolygon = perimeterEdge?.perimeterPolygon ?? [];
    const sourceEdgeIndex = perimeterEdge?.index ?? sourceEdgeIndexFromId(gutter.sourceEdgeId, sourcePolygon.length);
    const yAxis =
      sourceEdgeIndex === null || sourcePolygon.length === 0
        ? { x: 0, y: 1, z: 0 }
        : edgeOutwardVector(sourcePolygon, sourceEdgeIndex);
    const localFrame: DatumFrame3 = {
      origin: gutterLine.start,
      xAxis,
      yAxis,
      zAxis: WORLD_Z,
    };
    const gutterBoundaryTopZ = boundary?.[0]?.z;
    const renderMesh =
      boundary && typeof gutterBoundaryTopZ === 'number' && Number.isFinite(gutterBoundaryTopZ)
        ? buildVerticalPrismRenderMesh(
          boundary,
          gutterBoundaryTopZ - input.gutterDepthMm,
          gutterBoundaryTopZ,
        )
        : undefined;
    linearSolids.push({
      id: `house-solid-gutter-${linearSolids.length + 1}`,
      kind: 'gutter',
      centerline: gutterLine,
      localFrame,
      profileWidthMm: input.gutterWidthMm,
      profileDepthMm: input.gutterDepthMm,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        sourceId: `house-gutter-line-${index + 1}`,
        sourceEdgeId: gutter.sourceEdgeId,
        houseRoofEdgeKind: gutter.edgeKind,
        houseRoofPerimeterRole: gutter.edgeKind,
        flashingRole: gutter.flashingRole ?? null,
        sourceRoofPlaneId: gutter.sourceRoofPlaneId ?? null,
      },
    });
  }

  return { surfaceSolids, linearSolids };
}

function findAttachmentWallSegment(
  wallSegments: HouseWallSegment3D[],
  attachmentEdge: Line3 | null,
): HouseWallSegment3D | null {
  if (!wallSegments.length) return null;
  if (!attachmentEdge) return wallSegments[0] ?? null;

  const attachmentMidpoint = midpoint2(attachmentEdge);
  return wallSegments.reduce<HouseWallSegment3D | null>((selected, candidate) => {
    if (!selected) return candidate;

    const candidateDistance = distanceSquared2(midpoint2(candidate.line), attachmentMidpoint);
    const selectedDistance = distanceSquared2(midpoint2(selected.line), attachmentMidpoint);
    if (candidateDistance < selectedDistance) return candidate;
    if (Math.abs(candidateDistance - selectedDistance) <= 1e-6 && lineLength(candidate.line) > lineLength(selected.line)) {
      return candidate;
    }
    return selected;
  }, null);
}

function clampLineZ(input: { source: Line3; bottomZ: number; topZ: number }): Line3 {
  return {
    start: {
      ...input.source.start,
      z: clamp(input.source.start.z, input.bottomZ, input.topZ),
    },
    end: {
      ...input.source.end,
      z: clamp(input.source.end.z, input.bottomZ, input.topZ),
    },
  };
}

type AttachmentWallProjection = {
  line: Line3 | null;
  wallOrientedLine: Line3 | null;
  metadata?: {
    attachmentSpanStatus: 'no_overlap';
  };
};

function interpolateAttachmentZ(attachmentEdge: Line3, rawStartT: number, rawEndT: number, targetT: number): number {
  const range = rawEndT - rawStartT;
  if (Math.abs(range) <= 1e-6) {
    return (attachmentEdge.start.z + attachmentEdge.end.z) / 2;
  }
  const ratio = (targetT - rawStartT) / range;
  return attachmentEdge.start.z + (attachmentEdge.end.z - attachmentEdge.start.z) * ratio;
}

function projectAttachmentEdgeToWallSegment(
  attachmentEdge: Line3 | null,
  sourceWall: HouseWallSegment3D | null,
): AttachmentWallProjection {
  if (!attachmentEdge || !sourceWall) {
    return {
      line: null,
      wallOrientedLine: null,
      metadata: { attachmentSpanStatus: 'no_overlap' },
    };
  }

  const wallLengthMm = lineLength(sourceWall.line);
  if (wallLengthMm <= 1e-6) {
    return {
      line: null,
      wallOrientedLine: null,
      metadata: { attachmentSpanStatus: 'no_overlap' },
    };
  }

  const wallUnit = {
    x: (sourceWall.line.end.x - sourceWall.line.start.x) / wallLengthMm,
    y: (sourceWall.line.end.y - sourceWall.line.start.y) / wallLengthMm,
  };
  const projectToWallT = (candidate: Point3): number =>
    (candidate.x - sourceWall.line.start.x) * wallUnit.x +
    (candidate.y - sourceWall.line.start.y) * wallUnit.y;
  const pointAtT = (t: number): Point3 => ({
    x: sourceWall.line.start.x + wallUnit.x * t,
    y: sourceWall.line.start.y + wallUnit.y * t,
    z: interpolateAttachmentZ(attachmentEdge, rawStartT, rawEndT, t),
  });

  const rawStartT = projectToWallT(attachmentEdge.start);
  const rawEndT = projectToWallT(attachmentEdge.end);
  const rawMinT = Math.min(rawStartT, rawEndT);
  const rawMaxT = Math.max(rawStartT, rawEndT);
  const overlapMinT = Math.max(0, rawMinT);
  const overlapMaxT = Math.min(wallLengthMm, rawMaxT);
  if (overlapMaxT - overlapMinT <= 1e-6) {
    return {
      line: null,
      wallOrientedLine: null,
      metadata: { attachmentSpanStatus: 'no_overlap' },
    };
  }

  const orderedStartT = rawStartT <= rawEndT ? overlapMinT : overlapMaxT;
  const orderedEndT = rawStartT <= rawEndT ? overlapMaxT : overlapMinT;
  return {
    line: line(pointAtT(orderedStartT), pointAtT(orderedEndT)),
    wallOrientedLine: line(pointAtT(overlapMinT), pointAtT(overlapMaxT)),
  };
}

function buildZoneBoundary(sourceLine: Line3 | null, bottomZ: number, topZ: number): Polygon3 | null {
  if (!sourceLine) return null;
  return [
    point(sourceLine.start.x, sourceLine.start.y, bottomZ),
    point(sourceLine.end.x, sourceLine.end.y, bottomZ),
    point(sourceLine.end.x, sourceLine.end.y, topZ),
    point(sourceLine.start.x, sourceLine.start.y, topZ),
  ];
}

function resolveStrategy(config: GeometryConfig): HouseAttachmentStrategy {
  return config.houseContext.attachmentStrategy ?? config.houseContext.model?.attachmentStrategy ?? 'none';
}

function averageAttachmentZ(attachmentEdge: Line3 | null, config: GeometryConfig): number {
  if (attachmentEdge) {
    return (attachmentEdge.start.z + attachmentEdge.end.z) / 2;
  }
  return (
    config.structural.heights.referenceUndersideMm ??
    config.structural.heights.houseUndersideMm ??
    DEFAULT_EAVE_HEIGHT_MM
  );
}

function buildSemanticHouseAttachmentEdge(config: GeometryConfig, attachmentEdge: Line3 | null): Line3 | null {
  if (!attachmentEdge || config.connection.type === 'freestanding') return null;

  const z = averageAttachmentZ(attachmentEdge, config);
  return buildHouseSideAttachmentLine({
    attachmentSide: config.connection.attachmentSide,
    pergolaWidthMm: config.dimensions.lengthMm,
    pergolaDepthMm: config.dimensions.projectionMm,
    zMm: z,
  });
}

function buildAttachmentTarget(input: {
  config: GeometryConfig;
  attachmentEdge: Line3 | null;
  wallSegments: HouseWallSegment3D[];
  eaveHeightMm: number;
  fasciaHeightMm: number;
}): HouseAttachmentTarget3D {
  const strategy = resolveStrategy(input.config);
  const sourceWall = findAttachmentWallSegment(input.wallSegments, input.attachmentEdge);
  const sourceEdgeId = sourceWall?.sourceEdgeId ?? sourceWall?.id ?? null;
  const targetProjection = projectAttachmentEdgeToWallSegment(input.attachmentEdge, sourceWall);
  const targetLine = targetProjection.line;
  const targetWallOrientedLine = targetProjection.wallOrientedLine;
  const targetMetadata = targetProjection.metadata;

  if (strategy === 'none') {
    return {
      kind: 'none',
      strategy,
      sourceEdgeId,
    };
  }

  if (strategy === 'soffit_brackets') {
    return {
      kind: 'line',
      strategy,
      line: targetLine,
      sourceEdgeId,
      metadata: targetMetadata,
    };
  }

  if (strategy === 'fascia_under_gutter') {
    const topZMm = input.eaveHeightMm;
    const bottomZMm = input.eaveHeightMm - input.fasciaHeightMm;
    const safeLine = targetLine ? clampLineZ({ source: targetLine, bottomZ: bottomZMm, topZ: topZMm }) : null;
    return {
      kind: 'zone',
      strategy,
      line: safeLine,
      zone: {
        plane: sourceWall?.plane ?? planeFromOriginAxes(input.config.datum.origin, input.config.datum.xAxis, input.config.datum.zAxis),
        topZMm,
        bottomZMm,
        boundary: buildZoneBoundary(targetWallOrientedLine, bottomZMm, topZMm),
        safeLine,
      },
      sourceEdgeId,
      metadata: targetMetadata,
    };
  }

  if (strategy === 'facade_ledger') {
    return {
      kind: 'plane',
      strategy,
      line: targetLine,
      plane: sourceWall?.plane ?? null,
      sourceEdgeId,
      metadata: targetMetadata,
    };
  }

  return {
    kind: 'metadata_only',
    strategy,
    sourceEdgeId,
    metadata: {
      tieback: true,
    },
  };
}

function sourceEdgeIndexFromId(sourceEdgeId: string | null | undefined, footprintLength: number): number | null {
  if (!sourceEdgeId) return null;
  const match = /^footprint-edge-(\d+)$/.exec(sourceEdgeId);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  return Number.isInteger(index) && index >= 0 && index < footprintLength ? index : null;
}

function buildAttachmentAwareMonoEavePolygon(input: {
  footprint: Polygon3;
  eavePolygon: Polygon3;
  roofForm: HouseRoofForm;
  attachmentTarget: HouseAttachmentTarget3D;
}): Polygon3 {
  if (input.roofForm !== 'mono') return input.eavePolygon;
  if (input.attachmentTarget.kind !== 'zone') return input.eavePolygon;
  if (input.eavePolygon.length !== input.footprint.length) return input.eavePolygon;
  if (!input.attachmentTarget.line) return input.eavePolygon;

  const sourceEdgeIndex = sourceEdgeIndexFromId(
    input.attachmentTarget.sourceEdgeId,
    input.footprint.length,
  );
  if (sourceEdgeIndex === null) return input.eavePolygon;

  const nextIndex = (sourceEdgeIndex + 1) % input.footprint.length;
  return input.eavePolygon.map((candidate, index) => {
    if (index === sourceEdgeIndex || index === nextIndex) {
      const footprintPoint = input.footprint[index]!;
      return point(footprintPoint.x, footprintPoint.y, candidate.z);
    }
    return candidate;
  });
}

export function buildHouseModel3D(input: {
  config: GeometryConfig;
  attachmentEdge: Line3 | null;
}): HouseModel3D | null {
  if (input.config.connection.type === 'freestanding') return null;

  const model = input.config.houseContext.model;
  const footprint = model?.footprint;
  if (!footprint || footprint.length < 3) return null;

  const eaveHeightMm = finiteNumber(
    model.eaveHeightMm,
    input.config.structural.heights.referenceUndersideMm ??
      input.config.structural.heights.houseUndersideMm ??
      DEFAULT_EAVE_HEIGHT_MM,
  );
  const wallHeightMm = finiteNumber(model.wallHeightMm, eaveHeightMm);
  const roofPitchDeg = finiteNumber(model.roofPitchDeg, DEFAULT_ROOF_PITCH_DEG);
  const soffitDepthMm = positiveNumber(model.eave?.soffitDepthMm, DEFAULT_SOFFIT_DEPTH_MM);
  const fasciaHeightMm = positiveNumber(model.eave?.fasciaHeightMm, DEFAULT_FASCIA_HEIGHT_MM);
  const gutterWidthMm = positiveNumber(model.eave?.gutterWidthMm, DEFAULT_GUTTER_WIDTH_MM);
  const gutterDepthMm = positiveNumber(model.eave?.gutterDepthMm, DEFAULT_GUTTER_DEPTH_MM);
  const gutterProjectionMm = positiveNumber(model.eave?.gutterProjectionMm, DEFAULT_GUTTER_PROJECTION_MM);
  const eaveOverhangMm = positiveNumber(model.eave?.eaveOverhangMm, DEFAULT_EAVE_OVERHANG_MM);
  const roofMaterial = model.roofMaterial ?? DEFAULT_HOUSE_ROOF_MATERIAL;
  const roofForm = model.roofForm ?? 'hipped';
  const roofPrimaryFallDirection = model.roofPrimaryFallDirection ?? 'positive_y';
  const roofRidgeAxis = model.roofRidgeAxis ?? 'x';
  const semanticAttachmentEdge = buildSemanticHouseAttachmentEdge(input.config, input.attachmentEdge);
  const preliminaryWallSegments = buildWallSegments(footprint, wallHeightMm, null);
  const preliminaryAttachmentTarget = buildAttachmentTarget({
    config: input.config,
    attachmentEdge: semanticAttachmentEdge,
    wallSegments: preliminaryWallSegments,
    eaveHeightMm,
    fasciaHeightMm,
  });
  const wallBox = boundingBox(footprint);
  const baseEavePolygon =
    offsetFootprintPolygon(footprint, eaveOverhangMm) ?? [
      point(wallBox.minX - eaveOverhangMm, wallBox.minY - eaveOverhangMm, 0),
      point(wallBox.maxX + eaveOverhangMm, wallBox.minY - eaveOverhangMm, 0),
      point(wallBox.maxX + eaveOverhangMm, wallBox.maxY + eaveOverhangMm, 0),
      point(wallBox.minX - eaveOverhangMm, wallBox.maxY + eaveOverhangMm, 0),
    ];
  const eavePolygon = buildAttachmentAwareMonoEavePolygon({
    footprint,
    eavePolygon: baseEavePolygon,
    roofForm,
    attachmentTarget: preliminaryAttachmentTarget,
  });
  const roof = buildSharedHouseRoof({
    sourceFootprint: footprint,
    eavePolygon,
    eaveHeightMm,
    roofPitchDeg,
    roofForm,
    roofPrimaryFallDirection,
    roofRidgeAxis,
    roofAppendage: model.roofAppendage ?? null,
  });
  const wallSegments = buildWallSegments(footprint, wallHeightMm, roof);
  const availableTerminalEnds = deriveHouseGableTerminalEndsFromFootprint({
    footprint,
    ridgeAxis: roofRidgeAxis,
  });
  const openTerminalEndIds = new Set(
    roofForm === 'gable' && roof.metadata.roofQaStatus === 'valid'
      ? (model.openGableEndIds ?? []).filter((id) =>
          availableTerminalEnds.some((terminalEnd) => terminalEnd.id === id),
        )
      : [],
  );
  const terminalEndBySourceEdgeId = new Map(
    availableTerminalEnds.map((terminalEnd) => [terminalEnd.sourceEdgeId, terminalEnd]),
  );
  const displayWallSegments = wallSegments.map((segment) => {
    const terminalEnd = segment.sourceEdgeId
      ? terminalEndBySourceEdgeId.get(segment.sourceEdgeId)
      : null;
    if (!terminalEnd || !openTerminalEndIds.has(terminalEnd.id)) return segment;
    return {
      ...segment,
      metadata: {
        ...segment.metadata,
        houseWallMode: 'open_gable_frame',
        gableEndId: terminalEnd.id,
      },
    };
  });
  const frameFeatures = buildOpenGableFrameFeatures({
    wallSegments: displayWallSegments,
    openTerminalEnds: availableTerminalEnds.filter((terminalEnd) =>
      openTerminalEndIds.has(terminalEnd.id),
    ),
    roofGeometry:
      typeof roof.metadata.roofGeometry === 'string' ? roof.metadata.roofGeometry : null,
  });
  const displayRoofFeatures = [...roof.roofFeatures, ...frameFeatures];
  const attachmentTarget = buildAttachmentTarget({
    config: input.config,
    attachmentEdge: semanticAttachmentEdge,
    wallSegments: displayWallSegments,
    eaveHeightMm,
    fasciaHeightMm,
  });
  const perimeterEdges = buildHouseRoofPerimeterEdges({
    footprint,
    eavePolygon,
    roofForm,
    roofPlanes: roof.roofPlanes,
    eaveHeightMm,
    attachmentTarget,
  });
  const appendagePerimeterEdges = buildAppendagePerimeterEdges({
    roofForm,
    roofPlanes: roof.roofPlanes,
  });
  const allPerimeterEdges = [...perimeterEdges, ...appendagePerimeterEdges];
  const gutterLines = buildPolygonGutterLines({ perimeterEdges: allPerimeterEdges });
  const gutterBoundaries = buildPolygonGutterBoundaries({
    perimeterEdges: allPerimeterEdges,
    gutterWidthMm,
    gutterProjectionMm,
  });
  const fasciaPolygons = buildPolygonFasciaPolygons({
    perimeterEdges: allPerimeterEdges,
    fasciaHeightMm,
  });
  const soffitPolygons = buildPolygonSoffitPolygons({
    perimeterEdges: allPerimeterEdges,
    roofForm,
    roofPlanes: roof.roofPlanes,
  });
  const roofPlanesForSolids = roof.metadata.roofQaStatus === 'valid' ? roof.roofPlanes : [];
  const roofFlashings =
    roof.metadata.roofQaStatus === 'valid'
      ? [
          ...buildHouseRoofFeatureFlashings({
            roofPlanes: roof.roofPlanes,
            roofFeatures: roof.roofFeatures,
          }),
          ...buildPerimeterFlashings({
            perimeterEdges: allPerimeterEdges,
            roofPlanes: roof.roofPlanes,
            attachmentTarget,
          }),
        ]
      : [];
  const roofMaterialVisuals =
    roof.metadata.roofQaStatus === 'valid'
      ? buildHouseRoofMaterialVisuals({
          roofPlanes: roof.roofPlanes,
          material: roofMaterial,
        })
      : [];
  const decks = buildHouseDecks({
    decks:
      (model.decks ?? [])
        .filter((deck): deck is NonNullable<NonNullable<typeof model.decks>[number]> => Boolean(deck?.outline?.length))
        .map((deck) => ({
          id: deck.id,
          name: deck.name ?? null,
          kind: deck.kind ?? 'deck',
          shape: deck.shape ?? 'preset',
          presetType: deck.presetType ?? null,
          presetRect: deck.presetRect ?? null,
          boundary: deck.outline ?? [],
          plane: planeFromOriginAxes(point(0, 0, 0), { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }),
          topSurfaceElevationMm:
            finiteNumber(deck.topSurfaceElevationMm, finiteNumber(deck.levelOffsetMm, 0)),
          elevationMode: deck.elevationMode ?? 'ground',
          hostEdgeId: deck.hostEdgeId ?? null,
          isAttached: Boolean(deck.isAttached),
          surfaceMaterial: deck.surfaceMaterial ?? 'timber_decking',
          supportClassification: deck.supportContext?.classification ?? 'mixed_or_unclear',
          metadata: {
            deckName: deck.name ?? deck.id,
            deckKind: deck.kind ?? 'deck',
            deckShape: deck.shape ?? 'preset',
            deckPresetType: deck.presetType ?? null,
            deckPresetRectWidthMm: deck.presetRect?.widthMm ?? null,
            deckPresetRectDepthMm: deck.presetRect?.depthMm ?? null,
            deckPresetRectCenterOffsetMm: deck.presetRect?.centerOffsetMm ?? null,
            deckPresetRectDetachedGapMm: deck.presetRect?.detachedGapMm ?? null,
            deckElevationMode: deck.elevationMode ?? 'ground',
            deckHostEdgeId: deck.hostEdgeId ?? null,
            deckIsAttached: Boolean(deck.isAttached),
            deckSurfaceMaterial: deck.surfaceMaterial ?? 'timber_decking',
            deckSupportClassification: deck.supportContext?.classification ?? 'mixed_or_unclear',
            deckNearestHouseEdgeId: deck.supportContext?.nearestHouseEdgeId ?? null,
            deckNearestHouseEdgeDistanceMm: deck.supportContext?.nearestHouseEdgeDistanceMm ?? null,
            deckAttachmentContactLengthMm: deck.supportContext?.attachmentContactLengthMm ?? null,
            deckSupportWarnings: deck.supportContext?.warningCodes?.join(',') ?? null,
            deckValidationStatus: deck.validation?.status ?? 'valid',
            deckValidationCodes: deck.validation?.codes?.join(',') ?? null,
          },
        })) ?? [],
  });
  const openings = buildHouseOpenings({
    openings:
      (model.openings ?? []).map((opening) => ({
        id: opening.id,
        label: opening.label ?? null,
        kind: opening.kind ?? 'window',
        wallId: opening.wallId ?? 'rear',
        hostEdgeId: opening.hostEdgeId ?? null,
        widthMm: finiteNumber(opening.widthMm, 0),
        heightMm: finiteNumber(opening.heightMm, 0),
        sillHeightMm: finiteNumber(opening.sillHeightMm, 0),
        offsetAlongWallMm: finiteNumber(opening.offsetAlongWallMm, 0),
        panelCount:
          opening.kind === 'slider'
            ? opening.panelCount === 3 || opening.panelCount === 4
              ? opening.panelCount
              : 2
            : null,
        validationStatus: opening.validation?.status === 'invalid' ? 'invalid' : 'valid',
        validationCodes: opening.validation?.codes ?? [],
        validationMessage: opening.validation?.message ?? null,
        metadata: {
          openingLabel: opening.label ?? opening.id,
          openingKind: opening.kind ?? 'window',
          openingPanelCount:
            opening.kind === 'slider'
              ? opening.panelCount === 3 || opening.panelCount === 4
                ? opening.panelCount
                : 2
              : null,
          openingWallId: opening.wallId ?? 'rear',
          openingHostEdgeId: opening.hostEdgeId ?? null,
          openingWidthMm: finiteNumber(opening.widthMm, 0),
          openingHeightMm: finiteNumber(opening.heightMm, 0),
          openingSillHeightMm: finiteNumber(opening.sillHeightMm, 0),
          openingOffsetAlongWallMm: finiteNumber(opening.offsetAlongWallMm, 0),
          openingValidationStatus: opening.validation?.status ?? 'valid',
          openingValidationCodes: opening.validation?.codes?.join(',') ?? null,
          openingValidationMessage: opening.validation?.message ?? null,
        },
      })) ?? [],
  });

  return {
    footprint,
    wallSegments: displayWallSegments,
    roofPlanes: roof.roofPlanes,
    roofFeatures: displayRoofFeatures,
    roofFlashings,
    roofMaterial,
    roofMaterialVisuals,
    decks,
    openings,
    solids: buildHouseEnvelopeSolids({
      wallSegments: displayWallSegments,
      roofPlanes: roofPlanesForSolids,
      roofForm,
      decks,
      perimeterEdges: allPerimeterEdges,
      soffitPolygons,
      fasciaPolygons,
      gutterLines,
      gutterBoundaries,
      gutterWidthMm,
      gutterDepthMm,
    }),
    eave: {
      soffitDepthMm,
      fasciaHeightMm,
      gutterWidthMm,
      gutterDepthMm,
      gutterProjectionMm,
      eaveOverhangMm,
      gutterLines: gutterLines.map((candidate) => candidate.line),
      gutterBoundaries: gutterBoundaries.map((candidate) => candidate.boundary),
      fasciaPolygons: fasciaPolygons.map((candidate) => candidate.boundary),
      soffitPolygons: soffitPolygons.map((candidate) => candidate.boundary),
      metadata: roof.metadata,
    },
    attachmentTarget,
    metadata: {
      roofForm,
      roofMaterial,
      openGableEndIds: [...openTerminalEndIds].join(','),
      storeyMode: model.storeyMode ?? 'single_storey',
      wallConstruction: model.wallConstruction ?? 'timber_frame',
      attachmentStrategy: attachmentTarget.strategy,
      ...roof.metadata,
    },
  };
}

export function buildHouseReferenceGeometry(input: {
  config: GeometryConfig;
  attachmentEdge: Line3 | null;
}): HouseReferenceGeometry {
  if (input.config.connection.type === 'freestanding') {
    return {
      wallPlane: null,
      fasciaLine: null,
      roofEdgeLine: null,
      soffitDepthMm: input.config.houseContext.soffitDepthMm ?? null,
      footprint: input.config.houseContext.footprint ?? null,
      model: null,
      attachmentTarget: null,
    };
  }

  const wallPlane: Plane3 = planeFromOriginAxes(
    input.config.datum.origin,
    input.config.datum.xAxis,
    input.config.datum.zAxis,
  );
  const model = buildHouseModel3D(input);

  return {
    wallPlane: {
      ...wallPlane,
      normal: { x: 0, y: -1, z: 0 },
    },
    fasciaLine: input.config.connection.type === 'fascia' ? input.attachmentEdge : null,
    roofEdgeLine: input.attachmentEdge,
    soffitDepthMm: input.config.houseContext.soffitDepthMm ?? null,
    footprint: input.config.houseContext.footprint ?? null,
    model,
    attachmentTarget: model?.attachmentTarget ?? null,
  };
}
