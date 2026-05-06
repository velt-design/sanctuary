export type Point2 = { x: number; y: number };

export type ClosestEdgeResult = {
  edgeIndex: number;
  distanceMm: number;
  closestPoint: Point2;
  outwardNormal: Point2;
};

function polygonCentroid(polygon: ReadonlyArray<Point2>): Point2 | null {
  if (polygon.length === 0) return null;
  let sumX = 0;
  let sumY = 0;
  for (const point of polygon) {
    sumX += point.x;
    sumY += point.y;
  }
  return { x: sumX / polygon.length, y: sumY / polygon.length };
}

function closestPointOnSegment(point: Point2, a: Point2, b: Point2): { point: Point2; distance: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    const dist = Math.hypot(point.x - a.x, point.y - a.y);
    return { point: { x: a.x, y: a.y }, distance: dist };
  }
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
  const projected = { x: a.x + t * dx, y: a.y + t * dy };
  const distance = Math.hypot(point.x - projected.x, point.y - projected.y);
  return { point: projected, distance };
}

export function polygonEdgeOutwardNormal(
  polygon: ReadonlyArray<Point2>,
  edgeIndex: number,
): Point2 | null {
  if (polygon.length < 3) return null;
  const a = polygon[edgeIndex];
  const b = polygon[(edgeIndex + 1) % polygon.length];
  if (!a || !b) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  const candidate = { x: -dy / length, y: dx / length };
  const centroid = polygonCentroid(polygon);
  if (!centroid) return candidate;
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const outwardX = midX - centroid.x;
  const outwardY = midY - centroid.y;
  const dot = candidate.x * outwardX + candidate.y * outwardY;
  return dot >= 0 ? candidate : { x: -candidate.x, y: -candidate.y };
}

export function findClosestPolygonEdge(
  polygon: ReadonlyArray<Point2>,
  point: Point2,
): ClosestEdgeResult | null {
  if (polygon.length < 3) return null;
  let bestIndex = -1;
  let bestDistance = Infinity;
  let bestPoint: Point2 = { x: 0, y: 0 };
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const result = closestPointOnSegment(point, a, b);
    if (result.distance < bestDistance) {
      bestDistance = result.distance;
      bestIndex = i;
      bestPoint = result.point;
    }
  }
  if (bestIndex < 0) return null;
  const outwardNormal = polygonEdgeOutwardNormal(polygon, bestIndex);
  if (!outwardNormal) return null;
  return {
    edgeIndex: bestIndex,
    distanceMm: bestDistance,
    closestPoint: bestPoint,
    outwardNormal,
  };
}

export function applyEdgePerpendicularTranslation(
  polygon: ReadonlyArray<Point2>,
  edgeIndex: number,
  deltaMm: number,
): Point2[] {
  if (polygon.length < 3) return polygon.map((point) => ({ x: point.x, y: point.y }));
  const normal = polygonEdgeOutwardNormal(polygon, edgeIndex);
  if (!normal) return polygon.map((point) => ({ x: point.x, y: point.y }));
  const startIndex = edgeIndex;
  const endIndex = (edgeIndex + 1) % polygon.length;
  return polygon.map((point, index) => {
    if (index === startIndex || index === endIndex) {
      return {
        x: point.x + normal.x * deltaMm,
        y: point.y + normal.y * deltaMm,
      };
    }
    return { x: point.x, y: point.y };
  });
}
