import type { Point3, RenderMesh3D } from "@sp/geometry";
import type { SceneBounds } from "./sceneBoundsTypes";

/**
 * Small renderable-predicate helpers shared by the scene-bounds
 * computation, the per-object renderers, and the measurement-anchor
 * resolution. Pure functions over `Point3`/`RenderMesh3D`; no THREE
 * imports so they're safe to use from any layer of the viewport.
 *
 * `MIN_RENDERABLE_POLYGON_AREA_MM2` is the area threshold below which a
 * polygon is treated as degenerate (collapses to a line or point) and
 * skipped by the renderable predicates. The same constant is enforced
 * inside the buffer-geometry builders (`prepareSlabBoundary`,
 * `triangulateProjectedPolygon`) so a polygon that passes the predicate
 * always produces a buildable mesh.
 */
export const MIN_RENDERABLE_POLYGON_AREA_MM2 = 1;

export function linePoints(line: { start: Point3; end: Point3 }): Point3[] {
  return [line.start, line.end];
}

export function isFinitePoint(point: Point3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  );
}

export function isRenderableRenderMesh(mesh: RenderMesh3D | undefined): mesh is RenderMesh3D {
  return Boolean(
    mesh &&
      mesh.vertices.length >= 3 &&
      mesh.faces.length > 0 &&
      mesh.vertices.every(isFinitePoint) &&
      mesh.faces.every((face) =>
        face.every((index) => Number.isInteger(index) && index >= 0 && index < mesh.vertices.length),
      ),
  );
}

export function renderMeshPoints(mesh: RenderMesh3D | undefined): Point3[] {
  return isRenderableRenderMesh(mesh) ? mesh.vertices : [];
}

export function isRenderableLine(line: { start: Point3; end: Point3 }): boolean {
  if (!isFinitePoint(line.start) || !isFinitePoint(line.end)) return false;
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const dz = line.end.z - line.start.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) > 0.001;
}

function polygonArea3D(points: Point3[]): number {
  if (points.length < 3) return 0;
  const origin = points[0]!;
  let area = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const a = {
      x: points[index]!.x - origin.x,
      y: points[index]!.y - origin.y,
      z: points[index]!.z - origin.z,
    };
    const b = {
      x: points[index + 1]!.x - origin.x,
      y: points[index + 1]!.y - origin.y,
      z: points[index + 1]!.z - origin.z,
    };
    const cross = {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
    area += Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z) / 2;
  }
  return area;
}

function uniquePointCount(points: Point3[]): number {
  return new Set(
    points.map((point) => `${point.x.toFixed(6)},${point.y.toFixed(6)},${point.z.toFixed(6)}`),
  ).size;
}

export function isRenderablePolygon(points: Point3[]): boolean {
  return (
    points.length >= 3 &&
    points.every(isFinitePoint) &&
    uniquePointCount(points) >= 3 &&
    polygonArea3D(points) > MIN_RENDERABLE_POLYGON_AREA_MM2
  );
}

export function allSceneBoundsFinite(bounds: SceneBounds | null): boolean {
  if (!bounds) return false;
  return [
    bounds.min.x,
    bounds.min.y,
    bounds.min.z,
    bounds.max.x,
    bounds.max.y,
    bounds.max.z,
    bounds.center.x,
    bounds.center.y,
    bounds.center.z,
    bounds.size,
  ].every(Number.isFinite);
}

export function boundingSize(points: Point3[]): number {
  if (points.length === 0) return 1000;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const zs = points.map((point) => point.z);
  return Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
    Math.max(...zs) - Math.min(...zs),
    1000,
  );
}

export function centroid(points: Point3[]): Point3 {
  if (points.length === 0) return { x: 0, y: 0, z: 0 };
  const total = points.reduce(
    (current, point) => ({
      x: current.x + point.x,
      y: current.y + point.y,
      z: current.z + point.z,
    }),
    { x: 0, y: 0, z: 0 },
  );
  return {
    x: total.x / points.length,
    y: total.y / points.length,
    z: total.z / points.length,
  };
}

export function midpoint(start: Point3, end: Point3): Point3 {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
    z: (start.z + end.z) / 2,
  };
}
