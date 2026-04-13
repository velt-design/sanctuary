import type {
  DatumFrame3,
  GeometryConfig,
  GeometryMetadata,
  HouseAttachmentStrategy,
  HouseAttachmentTarget3D,
  HouseModel3D,
  HouseReferenceGeometry,
  HouseRoofFeature3D,
  HouseRoofFeatureKind,
  HouseWallSegment3D,
  Line3,
  Plane3,
  Point3,
  Polygon3,
  RenderMesh3D,
  RoofPlane3D,
  Vector3,
} from './contracts';
import {
  lineLength,
  normalizeVector,
  planeFromOriginAxes,
  planeFromPoints,
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
const RIDGE_COLLAPSE_EPSILON_MM = 1;

function point(x: number, y: number, z: number): Point3 {
  return { x, y, z };
}

function line(start: Point3, end: Point3): Line3 {
  return { start, end };
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

function buildWallSegments(footprint: Polygon3, wallHeightMm: number): HouseWallSegment3D[] {
  const segments: HouseWallSegment3D[] = [];

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
    segments.push({
      id: `house-wall-${segments.length + 1}`,
      sourceEdgeId: edgeId,
      line: edgeLine,
      plane,
      boundary: [
        groundStart,
        groundEnd,
        point(groundEnd.x, groundEnd.y, wallHeightMm),
        point(groundStart.x, groundStart.y, wallHeightMm),
      ],
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

function buildPolygonGutterLines(input: { eavePolygon: Polygon3; z: number }): Line3[] {
  const lines: Line3[] = [];
  for (let index = 0; index < input.eavePolygon.length; index += 1) {
    const start = input.eavePolygon[index]!;
    const end = input.eavePolygon[(index + 1) % input.eavePolygon.length]!;
    const gutterLine = line(point(start.x, start.y, input.z), point(end.x, end.y, input.z));
    if (lineLength(gutterLine) > 1e-6) lines.push(gutterLine);
  }
  return lines;
}

function buildPolygonFasciaPolygons(input: {
  eavePolygon: Polygon3;
  topZ: number;
  bottomZ: number;
}): Polygon3[] {
  const polygons: Polygon3[] = [];
  for (let index = 0; index < input.eavePolygon.length; index += 1) {
    const start = input.eavePolygon[index]!;
    const end = input.eavePolygon[(index + 1) % input.eavePolygon.length]!;
    const fascia = [
      point(start.x, start.y, input.topZ),
      point(end.x, end.y, input.topZ),
      point(end.x, end.y, input.bottomZ),
      point(start.x, start.y, input.bottomZ),
    ];
    if (lineLength(line(fascia[0]!, fascia[1]!)) > 1e-6) polygons.push(fascia);
  }
  return polygons;
}

function buildPolygonSoffitPolygons(input: {
  footprint: Polygon3;
  eavePolygon: Polygon3;
  z: number;
}): Polygon3[] {
  if (input.footprint.length !== input.eavePolygon.length) return [];
  const polygons: Polygon3[] = [];
  for (let index = 0; index < input.footprint.length; index += 1) {
    const wallStart = input.footprint[index]!;
    const wallEnd = input.footprint[(index + 1) % input.footprint.length]!;
    const eaveStart = input.eavePolygon[index]!;
    const eaveEnd = input.eavePolygon[(index + 1) % input.eavePolygon.length]!;
    const soffit = [
      point(eaveStart.x, eaveStart.y, input.z),
      point(eaveEnd.x, eaveEnd.y, input.z),
      point(wallEnd.x, wallEnd.y, input.z),
      point(wallStart.x, wallStart.y, input.z),
    ];
    if (lineLength(line(soffit[0]!, soffit[1]!)) > 1e-6 && lineLength(line(soffit[1]!, soffit[2]!)) > 1e-6) {
      polygons.push(soffit);
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
  metadata: GeometryMetadata;
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
  if (!pointInOrOnRoofPolygon(centroid, eavePolygon)) return `${roofPlane.id}:centroid_outside_eave`;
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
  if (boundary.some((candidate) => roofPointOnEaveBoundaryAtWrongHeight(candidate, input.eavePolygon, input.eaveHeightMm))) {
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

  const kindOrder: Record<HouseRoofFeatureKind, number> = { ridge: 0, hip: 1, valley: 2 };
  drafts.sort(
    (a, b) =>
      kindOrder[a.kind] - kindOrder[b.kind] ||
      compareRoofPoints(a.line.start, b.line.start) ||
      compareRoofPoints(a.line.end, b.line.end),
  );

  const counters: Record<HouseRoofFeatureKind, number> = { ridge: 0, hip: 0, valley: 0 };
  return drafts.map((draft) => {
    counters[draft.kind] += 1;
    return {
      id: `house-roof-${draft.kind}-${counters[draft.kind]}`,
      kind: draft.kind,
      line: draft.line,
      metadata: {
        roofForm: 'hipped',
        footprintFollowing: true,
        roofGeometry: 'rectilinear_joined_hipped',
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

  const roofFeatures = buildJoinedRoofFeatures({ facets: renderedFacets, edges, eavePolygon, eaveHeightMm: input.eaveHeightMm });
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

function buildFootprintFollowingHouseRoof(input: {
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
}): HouseRoofBuildResult {
  const box = boundingBox(input.eavePolygon);
  if (isRectanglePolygon(input.eavePolygon)) {
    return applyRoofQa({
      roof: {
        ...buildRectangleHippedRoof({ ...box, eaveHeightMm: input.eaveHeightMm, roofPitchDeg: input.roofPitchDeg }),
        metadata: { roofGeometry: 'rectangular_hipped', footprintFollowing: true },
      },
      eavePolygon: input.eavePolygon,
    });
  }

  if (!isOrthogonalFootprint(input.eavePolygon)) {
    return applyRoofQa({
      roof: {
        ...buildRectangleHippedRoof({ ...box, eaveHeightMm: input.eaveHeightMm, roofPitchDeg: input.roofPitchDeg }),
        metadata: { roofGeometry: 'bounding_box_fallback', footprintFollowing: false },
      },
      eavePolygon: input.eavePolygon,
    });
  }

  const roof = buildJoinedRectilinearHippedRoof(input);
  if (!roof.roofPlanes.length) {
    return applyRoofQa({
      roof: {
        ...buildRectangleHippedRoof({ ...box, eaveHeightMm: input.eaveHeightMm, roofPitchDeg: input.roofPitchDeg }),
        metadata: { roofGeometry: 'bounding_box_fallback', footprintFollowing: false },
      },
      eavePolygon: input.eavePolygon,
    });
  }

  return applyRoofQa({
    roof: {
      roofPlanes: roof.roofPlanes,
      roofFeatures: roof.roofFeatures,
      metadata: {
        roofGeometry: 'rectilinear_joined_hipped',
        footprintFollowing: true,
        ...(roof.metadata ?? {}),
      },
    },
    eavePolygon: input.eavePolygon,
    rejectedFacetCount: typeof roof.metadata?.roofRejectedFacetCount === 'number' ? roof.metadata.roofRejectedFacetCount : 0,
  });
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
  if (sourcePolygon.length < 3 || halfWidthMm <= 0 || Math.abs(signedAreaXY(sourcePolygon)) <= 1e-6) return null;
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
      start: point(start.x + outward.x * halfWidthMm, start.y + outward.y * halfWidthMm, 0),
      end: point(end.x + outward.x * halfWidthMm, end.y + outward.y * halfWidthMm, 0),
    };
  });
  const innerEdges = sourcePolygon.map((start, index) => {
    const end = sourcePolygon[(index + 1) % sourcePolygon.length]!;
    const outward = edgeOutwardVector(sourcePolygon, index);
    return {
      start: point(start.x - outward.x * halfWidthMm, start.y - outward.y * halfWidthMm, 0),
      end: point(end.x - outward.x * halfWidthMm, end.y - outward.y * halfWidthMm, 0),
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

function buildHouseEnvelopeSolids(input: {
  wallSegments: HouseWallSegment3D[];
  roofPlanes: RoofPlane3D[];
  soffitPolygons: Polygon3[];
  fasciaPolygons: Polygon3[];
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  gutterWidthMm: number;
  gutterDepthMm: number;
  gutterProjectionMm: number;
}): NonNullable<HouseModel3D['solids']> {
  const surfaceSolids: NonNullable<HouseModel3D['solids']>['surfaceSolids'] = [];
  const linearSolids: NonNullable<HouseModel3D['solids']>['linearSolids'] = [];
  const wallMiterFootprints = buildMiteredStripFootprints(
    input.wallSegments.map((segment) => segment.line.start),
    DEFAULT_WALL_SOLID_THICKNESS_MM / 2,
  );
  const fasciaMiterFootprints = buildMiteredStripFootprints(input.eavePolygon, DEFAULT_FASCIA_SOLID_THICKNESS_MM / 2);
  const gutterMiterFootprints = buildMiteredStripFootprints(input.eavePolygon, input.gutterWidthMm / 2);

  for (const [index, wall] of input.wallSegments.entries()) {
    const zRange = boundaryZRange(wall.boundary);
    const renderMesh =
      zRange && wallMiterFootprints?.length === input.wallSegments.length
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

  for (const roofPlane of input.roofPlanes) {
    surfaceSolids.push({
      id: `house-solid-${roofPlane.id}`,
      kind: 'roof',
      boundary: roofPlane.boundary,
      plane: roofPlane.plane,
      thicknessMm: DEFAULT_ROOF_SOLID_THICKNESS_MM,
      metadata: {
        ...roofPlane.metadata,
        sourceId: roofPlane.id,
      },
    });
  }

  for (const [index, boundary] of input.soffitPolygons.entries()) {
    const plane = planeFromBoundary(boundary);
    if (!plane) continue;
    const z = boundary[0]?.z;
    const renderMesh = typeof z === 'number' && Number.isFinite(z)
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
      },
    });
  }

  for (const [index, boundary] of input.fasciaPolygons.entries()) {
    const plane = planeFromBoundary(boundary);
    if (!plane) continue;
    const zRange = boundaryZRange(boundary);
    const renderMesh =
      zRange && fasciaMiterFootprints?.length === input.fasciaPolygons.length
        ? buildVerticalPrismRenderMesh(fasciaMiterFootprints[index]!, zRange.bottomZ, zRange.topZ)
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
      },
    });
  }

  for (let index = 0; index < input.eavePolygon.length; index += 1) {
    const start = input.eavePolygon[index]!;
    const end = input.eavePolygon[(index + 1) % input.eavePolygon.length]!;
    const gutterLine = line(
      point(start.x, start.y, input.eaveHeightMm - input.gutterDepthMm / 2),
      point(end.x, end.y, input.eaveHeightMm - input.gutterDepthMm / 2),
    );
    if (lineLength(gutterLine) <= 1e-6) continue;
    const xAxis = normalizeVector(subtractPoints(gutterLine.end, gutterLine.start));
    const yAxis = edgeOutwardVector(input.eavePolygon, index);
    const localFrame: DatumFrame3 = {
      origin: gutterLine.start,
      xAxis,
      yAxis,
      zAxis: WORLD_Z,
    };
    const renderMesh =
      gutterMiterFootprints?.length === input.eavePolygon.length
        ? buildVerticalPrismRenderMesh(
            gutterMiterFootprints[index]!,
            input.eaveHeightMm - input.gutterDepthMm,
            input.eaveHeightMm,
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
        gutterProjectionMm: input.gutterProjectionMm,
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
  const wallBox = boundingBox(footprint);
  const eavePolygon =
    offsetFootprintPolygon(footprint, eaveOverhangMm) ?? [
      point(wallBox.minX - eaveOverhangMm, wallBox.minY - eaveOverhangMm, 0),
      point(wallBox.maxX + eaveOverhangMm, wallBox.minY - eaveOverhangMm, 0),
      point(wallBox.maxX + eaveOverhangMm, wallBox.maxY + eaveOverhangMm, 0),
      point(wallBox.minX - eaveOverhangMm, wallBox.maxY + eaveOverhangMm, 0),
    ];
  const roof = buildFootprintFollowingHouseRoof({
    eavePolygon,
    eaveHeightMm,
    roofPitchDeg,
  });
  const wallSegments = buildWallSegments(footprint, wallHeightMm);
  const semanticAttachmentEdge = buildSemanticHouseAttachmentEdge(input.config, input.attachmentEdge);
  const attachmentTarget = buildAttachmentTarget({
    config: input.config,
    attachmentEdge: semanticAttachmentEdge,
    wallSegments,
    eaveHeightMm,
    fasciaHeightMm,
  });
  const gutterLines = buildPolygonGutterLines({ eavePolygon, z: eaveHeightMm });
  const fasciaPolygons = buildPolygonFasciaPolygons({
    eavePolygon,
    topZ: eaveHeightMm,
    bottomZ: eaveHeightMm - fasciaHeightMm,
  });
  const soffitPolygons = buildPolygonSoffitPolygons({
    footprint,
    eavePolygon,
    z: eaveHeightMm,
  });
  const roofPlanesForSolids = roof.metadata.roofQaStatus === 'valid' ? roof.roofPlanes : [];

  return {
    footprint,
    wallSegments,
    roofPlanes: roof.roofPlanes,
    roofFeatures: roof.roofFeatures,
    solids: buildHouseEnvelopeSolids({
      wallSegments,
      roofPlanes: roofPlanesForSolids,
      soffitPolygons,
      fasciaPolygons,
      eavePolygon,
      eaveHeightMm,
      gutterWidthMm,
      gutterDepthMm,
      gutterProjectionMm,
    }),
    eave: {
      soffitDepthMm,
      fasciaHeightMm,
      gutterWidthMm,
      gutterDepthMm,
      gutterProjectionMm,
      eaveOverhangMm,
      gutterLines,
      fasciaPolygons,
      soffitPolygons,
      metadata: roof.metadata,
    },
    attachmentTarget,
    metadata: {
      roofForm: model.roofForm ?? 'hipped',
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
