import type { Point2 } from './contracts';

export type GeneratedProfileAsset = {
  widthMm: number;
  depthMm: number;
  sectionOutline: Point2[];
  sectionVoids: Point2[][] | null;
};

type DxfPair = {
  code: string;
  value: string;
};

type DxfPolylineParseResult = {
  loop: Point2[];
  nextIndex: number;
};

type DxfOpenPathParseResult = {
  path: Point2[];
  nextIndex: number;
};

const POLYLINE_CLOSED_FLAG = 1;
const PATH_STITCH_TOLERANCE_MM = 0.1;
const SPLINE_SAMPLE_TOLERANCE_MM = 2;

function parseNumber(value: string, label: string, sourcePath: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${sourcePath}: invalid ${label} value "${value}".`);
  }
  return parsed;
}

function tokenizeDxf(source: string): DxfPair[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  if (lines[lines.length - 1] === '') {
    lines.pop();
  }
  if (lines.length % 2 !== 0) {
    throw new Error('DXF source must contain code/value pairs.');
  }

  const pairs: DxfPair[] = [];
  for (let index = 0; index < lines.length; index += 2) {
    pairs.push({
      code: lines[index]!.trim(),
      value: lines[index + 1]!.trim(),
    });
  }
  return pairs;
}

function stripRepeatedClosingPoint(points: Point2[]): Point2[] {
  if (points.length < 2) return points;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (first.x === last.x && first.y === last.y) {
    return points.slice(0, -1);
  }
  return points;
}

function pointDistance(a: Point2, b: Point2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointsEqualWithinTolerance(a: Point2, b: Point2, toleranceMm = PATH_STITCH_TOLERANCE_MM): boolean {
  return pointDistance(a, b) <= toleranceMm;
}

function averagePoint(a: Point2, b: Point2): Point2 {
  return {
    x: Number(((a.x + b.x) / 2).toFixed(6)),
    y: Number(((a.y + b.y) / 2).toFixed(6)),
  };
}

function dedupeSequentialPoints(points: Point2[]): Point2[] {
  if (points.length === 0) {
    return [];
  }

  const deduped: Point2[] = [points[0]!];
  for (let index = 1; index < points.length; index += 1) {
    const candidate = points[index]!;
    const previous = deduped[deduped.length - 1]!;
    if (pointsEqualWithinTolerance(previous, candidate)) {
      deduped[deduped.length - 1] = averagePoint(previous, candidate);
      continue;
    }
    deduped.push(candidate);
  }
  return deduped;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function evaluateBsplinePoint(controlPoints: Point2[], knots: number[], degree: number, parameter: number): Point2 {
  if (controlPoints.length === 0) {
    throw new Error('Cannot evaluate a B-spline without control points.');
  }
  if (controlPoints.length === 1) {
    return controlPoints[0]!;
  }

  const domainStart = knots[degree]!;
  const domainEnd = knots[knots.length - degree - 1]!;
  if (parameter >= domainEnd) {
    return controlPoints[controlPoints.length - 1]!;
  }

  let span = degree;
  while (span < knots.length - degree - 1 && parameter >= knots[span + 1]!) {
    span += 1;
  }

  const basis = Array.from({ length: degree + 1 }, (_, offset) => ({ ...controlPoints[span - degree + offset]! }));
  for (let level = 1; level <= degree; level += 1) {
    for (let index = degree; index >= level; index -= 1) {
      const knotIndex = span - degree + index;
      const denominator = knots[knotIndex + degree - level + 1]! - knots[knotIndex]!;
      const alpha = denominator === 0 ? 0 : (parameter - knots[knotIndex]!) / denominator;
      basis[index] = {
        x: (1 - alpha) * basis[index - 1]!.x + alpha * basis[index]!.x,
        y: (1 - alpha) * basis[index - 1]!.y + alpha * basis[index]!.y,
      };
    }
  }

  return basis[degree]!;
}

function sampleSplinePath(input: {
  controlPoints: Point2[];
  knots: number[];
  degree: number;
  sourcePath: string;
}): Point2[] {
  const { controlPoints, knots, degree, sourcePath } = input;

  if (controlPoints.length < 2) {
    throw new Error(`${sourcePath}: SPLINE entities must contain at least two control points.`);
  }
  if (knots.length < controlPoints.length + degree + 1) {
    throw new Error(`${sourcePath}: SPLINE entity is missing knot values required for evaluation.`);
  }

  if (degree <= 1) {
    return dedupeSequentialPoints(controlPoints);
  }

  const controlPolygonLength = controlPoints.slice(1).reduce((sum, point, index) => sum + pointDistance(point, controlPoints[index]!), 0);
  const sampleCount = Math.max(12, Math.ceil(controlPolygonLength / SPLINE_SAMPLE_TOLERANCE_MM));
  const startParameter = knots[degree]!;
  const endParameter = knots[knots.length - degree - 1]!;
  const sampled: Point2[] = [];

  for (let index = 0; index <= sampleCount; index += 1) {
    const ratio = sampleCount === 0 ? 0 : index / sampleCount;
    const parameter = startParameter + (endParameter - startParameter) * ratio;
    sampled.push(evaluateBsplinePoint(controlPoints, knots, degree, clampNumber(parameter, startParameter, endParameter)));
  }

  return dedupeSequentialPoints(sampled);
}

function parseLwPolylineEntity(pairs: DxfPair[], startIndex: number, sourcePath: string): DxfPolylineParseResult {
  let closed = false;
  const points: Point2[] = [];
  let pendingX: number | null = null;
  let index = startIndex;

  while (index < pairs.length) {
    const pair = pairs[index]!;
    if (pair.code === '0') break;

    if (pair.code === '70') {
      const flags = parseNumber(pair.value, 'LWPOLYLINE flag', sourcePath);
      closed = (flags & POLYLINE_CLOSED_FLAG) === POLYLINE_CLOSED_FLAG;
    } else if (pair.code === '10') {
      pendingX = parseNumber(pair.value, 'LWPOLYLINE x', sourcePath);
    } else if (pair.code === '20') {
      if (pendingX === null) {
        throw new Error(`${sourcePath}: encountered a LWPOLYLINE y coordinate before its x coordinate.`);
      }
      points.push({
        x: pendingX,
        y: parseNumber(pair.value, 'LWPOLYLINE y', sourcePath),
      });
      pendingX = null;
    } else if (pair.code === '42') {
      const bulge = parseNumber(pair.value, 'LWPOLYLINE bulge', sourcePath);
      if (Math.abs(bulge) > 0.000001) {
        throw new Error(`${sourcePath}: LWPOLYLINE bulge segments are not supported. Provide straight closed polylines only.`);
      }
    }

    index += 1;
  }

  if (!closed) {
    throw new Error(`${sourcePath}: LWPOLYLINE profiles must be closed.`);
  }

  const loop = stripRepeatedClosingPoint(points);
  if (loop.length < 3) {
    throw new Error(`${sourcePath}: LWPOLYLINE profiles must contain at least three unique points.`);
  }

  return {
    loop,
    nextIndex: index,
  };
}

function parsePolylineEntity(pairs: DxfPair[], startIndex: number, sourcePath: string): DxfPolylineParseResult {
  let closed = false;
  let index = startIndex;

  while (index < pairs.length) {
    const pair = pairs[index]!;
    if (pair.code === '0') break;
    if (pair.code === '70') {
      const flags = parseNumber(pair.value, 'POLYLINE flag', sourcePath);
      closed = (flags & POLYLINE_CLOSED_FLAG) === POLYLINE_CLOSED_FLAG;
    }
    index += 1;
  }

  const points: Point2[] = [];
  while (index < pairs.length) {
    const entityStart = pairs[index]!;
    if (entityStart.code !== '0') {
      index += 1;
      continue;
    }
    if (entityStart.value === 'SEQEND') {
      index += 1;
      break;
    }
    if (entityStart.value !== 'VERTEX') {
      throw new Error(`${sourcePath}: POLYLINE profiles may only contain VERTEX entries before SEQEND; found ${entityStart.value}.`);
    }

    let vertexX: number | null = null;
    let vertexY: number | null = null;
    index += 1;
    while (index < pairs.length) {
      const pair = pairs[index]!;
      if (pair.code === '0') break;
      if (pair.code === '10') {
        vertexX = parseNumber(pair.value, 'VERTEX x', sourcePath);
      } else if (pair.code === '20') {
        vertexY = parseNumber(pair.value, 'VERTEX y', sourcePath);
      } else if (pair.code === '42') {
        const bulge = parseNumber(pair.value, 'VERTEX bulge', sourcePath);
        if (Math.abs(bulge) > 0.000001) {
          throw new Error(`${sourcePath}: POLYLINE bulge segments are not supported. Provide straight closed polylines only.`);
        }
      }
      index += 1;
    }

    if (vertexX === null || vertexY === null) {
      throw new Error(`${sourcePath}: POLYLINE vertex is missing x/y coordinates.`);
    }
    points.push({ x: vertexX, y: vertexY });
  }

  if (!closed) {
    throw new Error(`${sourcePath}: POLYLINE profiles must be closed.`);
  }

  const loop = stripRepeatedClosingPoint(points);
  if (loop.length < 3) {
    throw new Error(`${sourcePath}: POLYLINE profiles must contain at least three unique points.`);
  }

  return {
    loop,
    nextIndex: index,
  };
}

function parseLineEntity(pairs: DxfPair[], startIndex: number, sourcePath: string): DxfOpenPathParseResult {
  let startX: number | null = null;
  let startY: number | null = null;
  let endX: number | null = null;
  let endY: number | null = null;
  let index = startIndex;

  while (index < pairs.length) {
    const pair = pairs[index]!;
    if (pair.code === '0') break;
    if (pair.code === '10') {
      startX = parseNumber(pair.value, 'LINE start x', sourcePath);
    } else if (pair.code === '20') {
      startY = parseNumber(pair.value, 'LINE start y', sourcePath);
    } else if (pair.code === '11') {
      endX = parseNumber(pair.value, 'LINE end x', sourcePath);
    } else if (pair.code === '21') {
      endY = parseNumber(pair.value, 'LINE end y', sourcePath);
    }
    index += 1;
  }

  if (startX === null || startY === null || endX === null || endY === null) {
    throw new Error(`${sourcePath}: LINE entities must contain both start and end coordinates.`);
  }

  return {
    path: dedupeSequentialPoints([
      { x: startX, y: startY },
      { x: endX, y: endY },
    ]),
    nextIndex: index,
  };
}

function parseSplineEntity(pairs: DxfPair[], startIndex: number, sourcePath: string): DxfOpenPathParseResult {
  let degree = 3;
  const knots: number[] = [];
  const controlPoints: Point2[] = [];
  let pendingX: number | null = null;
  const weights: number[] = [];
  let index = startIndex;

  while (index < pairs.length) {
    const pair = pairs[index]!;
    if (pair.code === '0') break;

    if (pair.code === '71') {
      degree = parseNumber(pair.value, 'SPLINE degree', sourcePath);
    } else if (pair.code === '40') {
      knots.push(parseNumber(pair.value, 'SPLINE knot', sourcePath));
    } else if (pair.code === '10') {
      pendingX = parseNumber(pair.value, 'SPLINE control point x', sourcePath);
    } else if (pair.code === '20') {
      if (pendingX === null) {
        throw new Error(`${sourcePath}: encountered a SPLINE control point y coordinate before its x coordinate.`);
      }
      controlPoints.push({
        x: pendingX,
        y: parseNumber(pair.value, 'SPLINE control point y', sourcePath),
      });
      pendingX = null;
    } else if (pair.code === '41') {
      weights.push(parseNumber(pair.value, 'SPLINE weight', sourcePath));
    }

    index += 1;
  }

  if (weights.some((weight) => Math.abs(weight - 1) > 0.000001)) {
    throw new Error(`${sourcePath}: rational SPLINE weights are not supported.`);
  }

  return {
    path: sampleSplinePath({
      controlPoints,
      knots,
      degree,
      sourcePath,
    }),
    nextIndex: index,
  };
}

function polygonArea(points: Point2[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function mergeChains(first: Point2[], second: Point2[]): Point2[] | null {
  const firstStart = first[0]!;
  const firstEnd = first[first.length - 1]!;
  const secondStart = second[0]!;
  const secondEnd = second[second.length - 1]!;

  if (pointsEqualWithinTolerance(firstEnd, secondStart)) {
    const joinPoint = averagePoint(firstEnd, secondStart);
    return dedupeSequentialPoints([...first.slice(0, -1), joinPoint, ...second.slice(1)]);
  }
  if (pointsEqualWithinTolerance(firstEnd, secondEnd)) {
    const reversed = [...second].reverse();
    const joinPoint = averagePoint(firstEnd, reversed[0]!);
    return dedupeSequentialPoints([...first.slice(0, -1), joinPoint, ...reversed.slice(1)]);
  }
  if (pointsEqualWithinTolerance(firstStart, secondEnd)) {
    const joinPoint = averagePoint(firstStart, secondEnd);
    return dedupeSequentialPoints([...second.slice(0, -1), joinPoint, ...first.slice(1)]);
  }
  if (pointsEqualWithinTolerance(firstStart, secondStart)) {
    const reversed = [...second].reverse();
    const joinPoint = averagePoint(firstStart, reversed[reversed.length - 1]!);
    return dedupeSequentialPoints([...reversed.slice(0, -1), joinPoint, ...first.slice(1)]);
  }
  return null;
}

function stitchOpenPathsIntoLoops(paths: Point2[][], sourcePath: string): Point2[][] {
  const working = paths
    .map((path) => dedupeSequentialPoints(path))
    .filter((path) => path.length >= 2);
  const loops: Point2[][] = [];

  while (working.length > 0) {
    let chain = working.shift()!;
    let merged = true;

    while (merged) {
      merged = false;
      for (let index = 0; index < working.length; index += 1) {
        const candidate = working[index]!;
        const combined = mergeChains(chain, candidate);
        if (!combined) {
          continue;
        }
        chain = combined;
        working.splice(index, 1);
        merged = true;
        break;
      }
    }

    if (chain.length < 3) {
      throw new Error(`${sourcePath}: stitched profile path must contain at least three points.`);
    }

    const first = chain[0]!;
    const last = chain[chain.length - 1]!;
    if (!pointsEqualWithinTolerance(first, last)) {
      throw new Error(`${sourcePath}: line/spline profile geometry could not be stitched into a closed loop.`);
    }

    const closedPoint = averagePoint(first, last);
    loops.push(dedupeSequentialPoints([closedPoint, ...chain.slice(1, -1)]));
  }

  return loops;
}

function normalizeLoops(loops: Point2[][]): GeneratedProfileAsset {
  const outerLoop = [...loops].sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)))[0];
  if (!outerLoop) {
    throw new Error('DXF profile must contain at least one closed polyline loop.');
  }

  const allPoints = loops.flat();
  const minX = Math.min(...allPoints.map((point) => point.x));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxY = Math.max(...allPoints.map((point) => point.y));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const normalizePoint = (point: Point2): Point2 => ({
    x: Number((point.x - centerX).toFixed(6)),
    y: Number((point.y - centerY).toFixed(6)),
  });

  const normalizedLoops = loops.map((loop) => loop.map(normalizePoint));
  const normalizedOuter = normalizedLoops[loops.indexOf(outerLoop)]!;
  const normalizedVoids = normalizedLoops.filter((_, index) => loops[index] !== outerLoop);

  return {
    widthMm: Number((maxX - minX).toFixed(6)),
    depthMm: Number((maxY - minY).toFixed(6)),
    sectionOutline: normalizedOuter,
    sectionVoids: normalizedVoids.length > 0 ? normalizedVoids : null,
  };
}

export function parseClosedProfileDxf(source: string, sourcePath = 'profile.dxf'): GeneratedProfileAsset {
  const pairs = tokenizeDxf(source);
  let currentSection: string | null = null;
  let sawEntitiesSection = false;
  const loops: Point2[][] = [];
  const openPaths: Point2[][] = [];
  const unsupportedEntityTypes = new Set<string>();

  for (let index = 0; index < pairs.length; ) {
    const pair = pairs[index]!;

    if (pair.code === '0' && pair.value === 'SECTION') {
      const sectionName = pairs[index + 1];
      currentSection = sectionName?.code === '2' ? sectionName.value : null;
      index += sectionName?.code === '2' ? 2 : 1;
      continue;
    }

    if (pair.code === '0' && pair.value === 'ENDSEC') {
      currentSection = null;
      index += 1;
      continue;
    }

    if (currentSection !== 'ENTITIES') {
      index += 1;
      continue;
    }

    sawEntitiesSection = true;
    if (pair.code !== '0') {
      index += 1;
      continue;
    }

    if (pair.value === 'LWPOLYLINE') {
      const result = parseLwPolylineEntity(pairs, index + 1, sourcePath);
      loops.push(result.loop);
      index = result.nextIndex;
      continue;
    }

    if (pair.value === 'POLYLINE') {
      const result = parsePolylineEntity(pairs, index + 1, sourcePath);
      loops.push(result.loop);
      index = result.nextIndex;
      continue;
    }

    if (pair.value === 'LINE') {
      const result = parseLineEntity(pairs, index + 1, sourcePath);
      openPaths.push(result.path);
      index = result.nextIndex;
      continue;
    }

    if (pair.value === 'SPLINE') {
      const result = parseSplineEntity(pairs, index + 1, sourcePath);
      openPaths.push(result.path);
      index = result.nextIndex;
      continue;
    }

    if (pair.value !== 'EOF') {
      unsupportedEntityTypes.add(pair.value);
    }
    index += 1;
  }

  if (!sawEntitiesSection) {
    throw new Error(`${sourcePath}: missing ENTITIES section.`);
  }

  if (unsupportedEntityTypes.size > 0) {
    throw new Error(
      `${sourcePath}: unsupported DXF entity types in ENTITIES section: ${Array.from(unsupportedEntityTypes).sort().join(', ')}.`,
    );
  }

  loops.push(...stitchOpenPathsIntoLoops(openPaths, sourcePath));

  return normalizeLoops(loops);
}

function formatPoint(point: Point2): string {
  return `{ x: ${point.x}, y: ${point.y} }`;
}

function formatPolygon(points: Point2[]): string {
  return `[${points.map((point) => formatPoint(point)).join(', ')}]`;
}

export function serializeGeneratedProfileAssetsModule(assets: Record<string, GeneratedProfileAsset>): string {
  const entries = Object.entries(assets).sort(([a], [b]) => a.localeCompare(b));
  const body = entries
    .map(([key, asset]) => {
      const sectionVoids = asset.sectionVoids
        ? `[${asset.sectionVoids.map((voidBoundary) => formatPolygon(voidBoundary)).join(', ')}]`
        : 'null';
      return `  ${key}: {
    widthMm: ${asset.widthMm},
    depthMm: ${asset.depthMm},
    sectionOutline: ${formatPolygon(asset.sectionOutline)},
    sectionVoids: ${sectionVoids},
  },`;
    })
    .join('\n');

  return `// Generated by scripts/generate-geometry-profile-assets.ts. Do not edit by hand.
export type GeneratedProfileAsset = {
  widthMm: number;
  depthMm: number;
  sectionOutline: Array<{ x: number; y: number }>;
  sectionVoids: Array<Array<{ x: number; y: number }>> | null;
};

export const GENERATED_PROFILE_ASSETS = {
${body}
} as const satisfies Record<string, GeneratedProfileAsset>;
`;
}
