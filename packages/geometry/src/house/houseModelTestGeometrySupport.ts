// Shared house-model test helpers split by responsibility.
import type { Line3, Point3, Polygon3, RenderMesh3D } from "../contracts";
import type { HouseModel } from "./houseModelTestConfigSupport";

export function pointOnSegment2D(
  candidate: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const cross = (candidate.x - start.x) * dy - (candidate.y - start.y) * dx;
  if (Math.abs(cross) > 1e-2) return false;
  const dot = (candidate.x - start.x) * dx + (candidate.y - start.y) * dy;
  if (dot < -1e-2) return false;
  return dot <= dx * dx + dy * dy + 1e-2;
}

function pointInPolygon2D(
  candidate: { x: number; y: number },
  polygon: Polygon3,
): boolean {
  let inside = false;
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index]!;
    const previous = polygon[previousIndex]!;
    const intersects =
      current.y > candidate.y !== previous.y > candidate.y &&
      candidate.x <
        ((previous.x - current.x) * (candidate.y - current.y)) /
          (previous.y - current.y || 1) +
          current.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInOrOnPolygon2D(
  candidate: { x: number; y: number },
  polygon: Polygon3,
): boolean {
  return (
    pointInPolygon2D(candidate, polygon) ||
    polygon.some((start, index) =>
      pointOnSegment2D(
        candidate,
        start,
        polygon[(index + 1) % polygon.length]!,
      ),
    )
  );
}

export function segmentInsidePolygon2D(
  start: { x: number; y: number },
  end: { x: number; y: number },
  polygon: Polygon3,
): boolean {
  return [0, 0.25, 0.5, 0.75, 1].every((sample) =>
    pointInOrOnPolygon2D(
      {
        x: start.x + (end.x - start.x) * sample,
        y: start.y + (end.y - start.y) * sample,
      },
      polygon,
    ),
  );
}

export function roofPointKey(candidate: { x: number; y: number; z: number }): string {
  return `${candidate.x.toFixed(3)},${candidate.y.toFixed(3)},${candidate.z.toFixed(3)}`;
}

export function roofSegmentKey(
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
): string {
  const startKey = roofPointKey(start);
  const endKey = roofPointKey(end);
  return startKey <= endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

function roofPointKeyXY(candidate: { x: number; y: number }): string {
  return `${candidate.x.toFixed(3)},${candidate.y.toFixed(3)}`;
}

function roofSegmentKeyXY(
  start: { x: number; y: number },
  end: { x: number; y: number },
): string {
  const startKey = roofPointKeyXY(start);
  const endKey = roofPointKeyXY(end);
  return startKey <= endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

function rebuildRoofPerimeterPolygon(model: HouseModel): Polygon3 | null {
  const directedSegments = model.roofPlanes.flatMap((roofPlane) =>
    roofPlane.boundary.map((start, index) => ({
      start,
      end: roofPlane.boundary[(index + 1) % roofPlane.boundary.length]!,
    })),
  );
  const segmentCounts = new Map<string, number>();
  for (const segment of directedSegments) {
    const key = roofSegmentKeyXY(segment.start, segment.end);
    segmentCounts.set(key, (segmentCounts.get(key) ?? 0) + 1);
  }

  const perimeterSegments = directedSegments
    .filter(
      (segment) =>
        (segmentCounts.get(roofSegmentKeyXY(segment.start, segment.end)) ??
          0) === 1,
    )
    .map((segment) => ({
      start: { x: segment.start.x, y: segment.start.y, z: 0 },
      end: { x: segment.end.x, y: segment.end.y, z: 0 },
    }));
  if (perimeterSegments.length < 3) return null;

  const startKey = roofPointKeyXY(perimeterSegments[0]!.start);
  const polygon: Polygon3 = [perimeterSegments[0]!.start];
  const used = new Set<number>([0]);
  let current = perimeterSegments[0]!.end;
  let guard = 0;

  while (
    roofPointKeyXY(current) !== startKey &&
    guard < perimeterSegments.length * 2
  ) {
    polygon.push(current);
    guard += 1;
    const nextIndex = perimeterSegments.findIndex((segment, index) => {
      if (used.has(index)) return false;
      return (
        roofPointKeyXY(segment.start) === roofPointKeyXY(current) ||
        roofPointKeyXY(segment.end) === roofPointKeyXY(current)
      );
    });
    if (nextIndex < 0) return null;
    used.add(nextIndex);
    const next = perimeterSegments[nextIndex]!;
    current =
      roofPointKeyXY(next.start) === roofPointKeyXY(current)
        ? next.end
        : next.start;
  }

  return polygon.length >= 3 ? polygon : null;
}

export function eavePolygonFromModel(model: HouseModel): Polygon3 {
  const rebuilt = rebuildRoofPerimeterPolygon(model);
  if (rebuilt) return rebuilt;
  return (model.eave.gutterLines ?? []).map((candidate) => ({
    x: candidate.start.x,
    y: candidate.start.y,
    z: 0,
  }));
}

export function polygonAreaXY(points: Array<{ x: number; y: number }>): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) / 2;
}

function signedPolygonAreaXY(points: Array<{ x: number; y: number }>): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

export function reflexEaveVertices(model: HouseModel): Polygon3 {
  const eavePolygon = eavePolygonFromModel(model);
  const area = signedPolygonAreaXY(eavePolygon);
  return eavePolygon.filter((current, index) => {
    const previous =
      eavePolygon[(index - 1 + eavePolygon.length) % eavePolygon.length]!;
    const next = eavePolygon[(index + 1) % eavePolygon.length]!;
    const previousVector = {
      x: current.x - previous.x,
      y: current.y - previous.y,
    };
    const nextVector = { x: next.x - current.x, y: next.y - current.y };
    const cross =
      previousVector.x * nextVector.y - previousVector.y * nextVector.x;
    return Math.sign(cross || 1) !== Math.sign(area || 1);
  });
}

export function roofBoundarySegmentCounts(model: HouseModel): Map<string, number> {
  const counts = new Map<string, number>();
  for (const roofPlane of model.roofPlanes) {
    for (let index = 0; index < roofPlane.boundary.length; index += 1) {
      const start = roofPlane.boundary[index]!;
      const end = roofPlane.boundary[(index + 1) % roofPlane.boundary.length]!;
      const key = roofSegmentKey(start, end);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

export function roofBoundarySegments(
  model: HouseModel,
): Map<string, Array<{ roofPlaneIndex: number; edgeIndex: number }>> {
  const segments = new Map<
    string,
    Array<{ roofPlaneIndex: number; edgeIndex: number }>
  >();
  for (const [roofPlaneIndex, roofPlane] of model.roofPlanes.entries()) {
    for (
      let edgeIndex = 0;
      edgeIndex < roofPlane.boundary.length;
      edgeIndex += 1
    ) {
      const start = roofPlane.boundary[edgeIndex]!;
      const end =
        roofPlane.boundary[(edgeIndex + 1) % roofPlane.boundary.length]!;
      const key = roofSegmentKey(start, end);
      const references = segments.get(key) ?? [];
      references.push({ roofPlaneIndex, edgeIndex });
      segments.set(key, references);
    }
  }
  return segments;
}

export function pointDistanceSquared3(first: Point3, second: Point3): number {
  return (
    (first.x - second.x) ** 2 +
    (first.y - second.y) ** 2 +
    (first.z - second.z) ** 2
  );
}

function vectorLength3(vector: Point3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

export function normalizeVector3(vector: Point3): Point3 {
  const length = vectorLength3(vector);
  return length > 0
    ? { x: vector.x / length, y: vector.y / length, z: vector.z / length }
    : { x: 0, y: 0, z: 0 };
}

export function dotPoint3(first: Point3, second: Point3): number {
  return first.x * second.x + first.y * second.y + first.z * second.z;
}

export function countRenderMeshVerticalFaces(mesh: RenderMesh3D | undefined): number {
  if (!mesh) return 0;
  return mesh.faces.reduce((count, [a, b, c]) => {
    const first = mesh.vertices[a];
    const second = mesh.vertices[b];
    const third = mesh.vertices[c];
    if (!first || !second || !third) return count;
    const faceNormal = normalizeVector3({
      x:
        (second.y - first.y) * (third.z - first.z) -
        (second.z - first.z) * (third.y - first.y),
      y:
        (second.z - first.z) * (third.x - first.x) -
        (second.x - first.x) * (third.z - first.z),
      z:
        (second.x - first.x) * (third.y - first.y) -
        (second.y - first.y) * (third.x - first.x),
    });
    return Math.abs(faceNormal.z) <= 1e-3 ? count + 1 : count;
  }, 0);
}

export function pointDistanceToSegment2D(
  candidate: { x: number; y: number },
  start: Point3,
  end: Point3,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-6)
    return Math.hypot(candidate.x - start.x, candidate.y - start.y);
  const ratio = Math.min(
    Math.max(
      ((candidate.x - start.x) * dx + (candidate.y - start.y) * dy) / lengthSq,
      0,
    ),
    1,
  );
  const projectedX = start.x + dx * ratio;
  const projectedY = start.y + dy * ratio;
  return Math.hypot(candidate.x - projectedX, candidate.y - projectedY);
}

export function sourceEdgeLineFromModel(
  model: HouseModel,
  sourceEdgeId: string,
): Line3 | null {
  const match = /^footprint-edge-(\d+)$/.exec(sourceEdgeId);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= model.footprint.length)
    return null;
  return {
    start: model.footprint[index]!,
    end: model.footprint[(index + 1) % model.footprint.length]!,
  };
}

export function polygonIsHorizontal(boundary: Polygon3): boolean {
  const z = boundary[0]?.z;
  return (
    typeof z === "number" &&
    boundary.every((candidate) => Math.abs(candidate.z - z) <= 1e-6)
  );
}

export function countRenderMeshFacesAlignedToNormal(
  mesh: RenderMesh3D | undefined,
  normal: Point3,
): number {
  if (!mesh) return 0;
  const unitNormal = normalizeVector3(normal);
  return mesh.faces.reduce((count, [a, b, c]) => {
    const first = mesh.vertices[a];
    const second = mesh.vertices[b];
    const third = mesh.vertices[c];
    if (!first || !second || !third) return count;
    const faceNormal = normalizeVector3({
      x:
        (second.y - first.y) * (third.z - first.z) -
        (second.z - first.z) * (third.y - first.y),
      y:
        (second.z - first.z) * (third.x - first.x) -
        (second.x - first.x) * (third.z - first.z),
      z:
        (second.x - first.x) * (third.y - first.y) -
        (second.y - first.y) * (third.x - first.x),
    });
    return dotPoint3(faceNormal, unitNormal) >= 0.99 ? count + 1 : count;
  }, 0);
}

export function lineLength3(line3: Line3): number {
  return Math.hypot(
    line3.end.x - line3.start.x,
    line3.end.y - line3.start.y,
    line3.end.z - line3.start.z,
  );
}

function crossPoint3(first: Point3, second: Point3): Point3 {
  return {
    x: first.y * second.z - first.z * second.y,
    y: first.z * second.x - first.x * second.z,
    z: first.x * second.y - first.y * second.x,
  };
}

function subtractPoint3(first: Point3, second: Point3): Point3 {
  return {
    x: first.x - second.x,
    y: first.y - second.y,
    z: first.z - second.z,
  };
}

export function distanceToLine3D(candidate: Point3, source: Line3): number {
  const axis = subtractPoint3(source.end, source.start);
  const length = vectorLength3(axis);
  if (length <= 1e-6)
    return vectorLength3(subtractPoint3(candidate, source.start));
  return (
    vectorLength3(crossPoint3(subtractPoint3(candidate, source.start), axis)) /
    length
  );
}

