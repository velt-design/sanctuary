import type { GeometryMetadata, Point3, Polygon3 } from '../contracts';
import { point, pointInPolygon2D, signedAreaXY } from './_internal';
import { isOrthogonalFootprint, offsetFootprintPolygon } from './footprintMath';
import { point2FromPoint3, roofPolygonIsSimple } from './roof2D';

export type OrthogonalEaveOffsetResult = {
  polygon: Polygon3 | null;
  metadata: GeometryMetadata;
};

const MIN_EAVE_AREA_MM2 = 1;
const EPSILON = 1e-6;

function stableCoord(value: number): number {
  const stable = Number(value.toFixed(6));
  return Object.is(stable, -0) ? 0 : stable;
}

function pointKey(candidate: Pick<Point3, 'x' | 'y'>): string {
  return `${stableCoord(candidate.x)},${stableCoord(candidate.y)}`;
}

function pointsEqual(a: Point3, b: Point3): boolean {
  return Math.abs(a.x - b.x) <= EPSILON && Math.abs(a.y - b.y) <= EPSILON;
}

function collinear(a: Point3, b: Point3, c: Point3): boolean {
  return (
    (Math.abs(a.x - b.x) <= EPSILON && Math.abs(b.x - c.x) <= EPSILON) ||
    (Math.abs(a.y - b.y) <= EPSILON && Math.abs(b.y - c.y) <= EPSILON)
  );
}

function cleanPolygon(polygon: Polygon3): Polygon3 {
  const deduped: Polygon3 = [];
  for (const candidate of polygon) {
    const stable = point(stableCoord(candidate.x), stableCoord(candidate.y), 0);
    const previous = deduped[deduped.length - 1];
    if (previous && pointsEqual(previous, stable)) continue;
    deduped.push(stable);
  }
  if (deduped.length > 1 && pointsEqual(deduped[0]!, deduped[deduped.length - 1]!)) {
    deduped.pop();
  }

  let changed = true;
  while (changed && deduped.length >= 3) {
    changed = false;
    for (let index = 0; index < deduped.length; index += 1) {
      const previous = deduped[(index - 1 + deduped.length) % deduped.length]!;
      const current = deduped[index]!;
      const next = deduped[(index + 1) % deduped.length]!;
      if (!collinear(previous, current, next)) continue;
      deduped.splice(index, 1);
      changed = true;
      break;
    }
  }
  return deduped;
}

function topologyFailureReason(polygon: Polygon3 | null): string | null {
  if (!polygon || polygon.length < 3) return 'missing_eave_polygon';
  if (
    polygon.some(
      (candidate) =>
        !Number.isFinite(candidate.x) || !Number.isFinite(candidate.y),
    )
  ) {
    return 'non_finite_eave_polygon';
  }
  if (Math.abs(signedAreaXY(polygon)) <= MIN_EAVE_AREA_MM2) {
    return 'collapsed_eave_polygon';
  }
  if (!roofPolygonIsSimple(polygon.map(point2FromPoint3))) {
    return 'self_intersecting_eave_polygon';
  }
  return null;
}

function linfDistanceToSegment(
  candidate: Pick<Point3, 'x' | 'y'>,
  start: Point3,
  end: Point3,
): number {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  if (Math.abs(start.x - end.x) <= EPSILON) {
    const dx = Math.abs(candidate.x - start.x);
    const dy = candidate.y < minY ? minY - candidate.y : candidate.y > maxY ? candidate.y - maxY : 0;
    return Math.max(dx, dy);
  }
  const dy = Math.abs(candidate.y - start.y);
  const dx = candidate.x < minX ? minX - candidate.x : candidate.x > maxX ? candidate.x - maxX : 0;
  return Math.max(dx, dy);
}

function insideOrthogonalBuffer(input: {
  candidate: Pick<Point3, 'x' | 'y'>;
  footprint: Polygon3;
  offsetMm: number;
}): boolean {
  if (pointInPolygon2D(input.candidate, input.footprint)) return true;
  for (let index = 0; index < input.footprint.length; index += 1) {
    const start = input.footprint[index]!;
    const end = input.footprint[(index + 1) % input.footprint.length]!;
    if (linfDistanceToSegment(input.candidate, start, end) <= input.offsetMm + EPSILON) {
      return true;
    }
  }
  return false;
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values.map(stableCoord))].sort((a, b) => a - b);
}

type BoundaryEdge = {
  start: Point3;
  end: Point3;
  startKey: string;
  endKey: string;
  used: boolean;
};

function traceBoundaryLoops(edges: BoundaryEdge[]): Polygon3[] | null {
  const byStart = new Map<string, BoundaryEdge[]>();
  for (const edge of edges) {
    const list = byStart.get(edge.startKey) ?? [];
    list.push(edge);
    byStart.set(edge.startKey, list);
  }

  const loops: Polygon3[] = [];
  for (const edge of edges) {
    if (edge.used) continue;
    const startKey = edge.startKey;
    let current: BoundaryEdge | undefined = edge;
    const loop: Polygon3 = [];
    let guard = 0;
    while (current && !current.used) {
      current.used = true;
      loop.push(current.start);
      const nextKey: string = current.endKey;
      if (nextKey === startKey) {
        loops.push(cleanPolygon(loop));
        current = undefined;
        break;
      }
      const next: BoundaryEdge | undefined = (byStart.get(nextKey) ?? []).find(
        (candidate) => !candidate.used,
      );
      current = next;
      guard += 1;
      if (guard > edges.length + 1) return null;
    }
    if (current === undefined) continue;
    return null;
  }
  return loops.filter((loop) => loop.length >= 3);
}

function buildCellUnionBoundary(input: {
  footprint: Polygon3;
  offsetMm: number;
}): { polygon: Polygon3 | null; failureReason: string | null } {
  const xs = uniqueSorted(
    input.footprint.flatMap((candidate) => [
      candidate.x - input.offsetMm,
      candidate.x,
      candidate.x + input.offsetMm,
    ]),
  );
  const ys = uniqueSorted(
    input.footprint.flatMap((candidate) => [
      candidate.y - input.offsetMm,
      candidate.y,
      candidate.y + input.offsetMm,
    ]),
  );
  if (xs.length < 2 || ys.length < 2) {
    return { polygon: null, failureReason: 'insufficient_eave_grid' };
  }

  const included = new Set<string>();
  const cellKey = (xIndex: number, yIndex: number): string => `${xIndex}:${yIndex}`;
  for (let xIndex = 0; xIndex < xs.length - 1; xIndex += 1) {
    for (let yIndex = 0; yIndex < ys.length - 1; yIndex += 1) {
      const x0 = xs[xIndex]!;
      const x1 = xs[xIndex + 1]!;
      const y0 = ys[yIndex]!;
      const y1 = ys[yIndex + 1]!;
      if (x1 - x0 <= EPSILON || y1 - y0 <= EPSILON) continue;
      const center = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
      if (
        insideOrthogonalBuffer({
          candidate: center,
          footprint: input.footprint,
          offsetMm: input.offsetMm,
        })
      ) {
        included.add(cellKey(xIndex, yIndex));
      }
    }
  }
  if (included.size === 0) {
    return { polygon: null, failureReason: 'empty_eave_grid' };
  }

  const edges: BoundaryEdge[] = [];
  const addEdge = (start: Point3, end: Point3): void => {
    edges.push({
      start,
      end,
      startKey: pointKey(start),
      endKey: pointKey(end),
      used: false,
    });
  };

  for (const key of included) {
    const [xIndexText, yIndexText] = key.split(':');
    const xIndex = Number(xIndexText);
    const yIndex = Number(yIndexText);
    const x0 = xs[xIndex]!;
    const x1 = xs[xIndex + 1]!;
    const y0 = ys[yIndex]!;
    const y1 = ys[yIndex + 1]!;
    const hasCell = (candidateX: number, candidateY: number): boolean =>
      included.has(cellKey(candidateX, candidateY));

    if (!hasCell(xIndex, yIndex - 1)) {
      addEdge(point(x0, y0, 0), point(x1, y0, 0));
    }
    if (!hasCell(xIndex + 1, yIndex)) {
      addEdge(point(x1, y0, 0), point(x1, y1, 0));
    }
    if (!hasCell(xIndex, yIndex + 1)) {
      addEdge(point(x1, y1, 0), point(x0, y1, 0));
    }
    if (!hasCell(xIndex - 1, yIndex)) {
      addEdge(point(x0, y1, 0), point(x0, y0, 0));
    }
  }

  const loops = traceBoundaryLoops(edges);
  if (!loops) return { polygon: null, failureReason: 'unclosed_eave_boundary' };
  if (loops.length !== 1) {
    return { polygon: null, failureReason: 'disconnected_or_holed_eave_boundary' };
  }
  const polygon = loops[0]!;
  const failureReason = topologyFailureReason(polygon);
  if (failureReason) return { polygon: null, failureReason };
  return { polygon, failureReason: null };
}

export function buildOrthogonalCellUnionEaveOffset(input: {
  footprint: Polygon3;
  offsetMm: number;
}): OrthogonalEaveOffsetResult {
  if (
    input.offsetMm < 0 ||
    !Number.isFinite(input.offsetMm) ||
    !isOrthogonalFootprint(input.footprint)
  ) {
    return {
      polygon: null,
      metadata: {
        eaveOffsetConstructionMethod: 'orthogonal_cell_union',
        eaveOffsetTopologyStatus: 'invalid',
        eaveOffsetTopologyFailureReason: 'unsupported_orthogonal_eave_offset',
        eaveOffsetRequestedOverhangMm: input.offsetMm,
        eaveOffsetResolvedVertexCount: 0,
      },
    };
  }

  const legacyOffset = offsetFootprintPolygon(input.footprint, input.offsetMm);
  const legacyFailureReason = topologyFailureReason(legacyOffset);
  const result =
    input.offsetMm <= EPSILON
      ? { polygon: cleanPolygon(input.footprint), failureReason: null }
      : buildCellUnionBoundary(input);
  const failureReason = result.failureReason ?? topologyFailureReason(result.polygon);
  const polygon = failureReason ? null : result.polygon;

  return {
    polygon,
    metadata: {
      eaveOffsetConstructionMethod: 'orthogonal_cell_union',
      eaveOffsetTopologyStatus: failureReason
        ? 'invalid'
        : legacyFailureReason
          ? 'resolved'
          : 'valid',
      eaveOffsetTopologyFailureReason: failureReason,
      eaveOffsetRequestedOverhangMm: input.offsetMm,
      eaveOffsetResolvedVertexCount: polygon?.length ?? 0,
    },
  };
}
