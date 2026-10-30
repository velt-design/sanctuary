import type { Point3 } from "@sp/geometry";
import type { WebsitePhysicalProduct } from "./websiteProductPhysical";
import { houseWorld, type StudioHouseGeometry } from "./studioHouseGeometry";

type Pose = { x: number; y: number; rotation: number };
type Face = {
  id: string;
  points: Point3[];
  bounds: { x0: number; x1: number; y0: number; y1: number };
  dx: number;
  dy: number;
};
type StudioFacadeClearanceHouse = { faces: Face[] };
const cross = (a: Point3, b: Point3, p: Point3) =>
  (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
function face(id: string, points: Point3[]): Face | null {
  const [a, b, c] = points,
    area = cross(a, b, c);
  if (Math.abs(area) < 1e-7) return null;
  const dx = ((b.z - a.z) * (c.y - a.y) - (c.z - a.z) * (b.y - a.y)) / area;
  const dy = ((b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z)) / area;
  return {
    id,
    points,
    bounds: {
      x0: Math.min(...points.map((p) => p.x)),
      x1: Math.max(...points.map((p) => p.x)),
      y0: Math.min(...points.map((p) => p.y)),
      y1: Math.max(...points.map((p) => p.y)),
    },
    dx,
    dy,
  };
}
/** Actual finite house meshes. Both slab faces are retained; the lowest physical
 * surface above the same roof point establishes its underside, independently of
 * mesh winding. A vertical fascia wall has no roof-above area. */
export function prepareStudioFacadeClearance(
  geometry: StudioHouseGeometry,
): StudioFacadeClearanceHouse {
  const faces: Face[] = [];
  const append = (id: string, points: Point3[]) => {
    const result = face(id, points);
    if (result) faces.push(result);
  };
  for (const solid of [
    ...geometry.model.solids!.surfaceSolids,
    ...geometry.model.solids!.linearSolids,
  ]) {
    if (solid.kind === "wall" || solid.kind === "deck" || !solid.renderMesh)
      continue;
    const mesh = solid.renderMesh;
    for (const indexes of mesh.faces)
      append(
        solid.id,
        indexes.map((i) => houseWorld(geometry.house, mesh.vertices[i])),
      );
  }
  for (const [index, polygon] of geometry.soffits.entries())
    for (let i = 1; i < polygon.length - 1; i++)
      append("soffit-" + index, [polygon[0], polygon[i], polygon[i + 1]]);
  return { faces };
}
function clip(points: Point3[], boundary: Point3[]) {
  let result = points;
  const orientation = Math.sign(cross(boundary[0], boundary[1], boundary[2]));
  for (let i = 0; i < boundary.length && result.length; i++) {
    const a = boundary[i],
      b = boundary[(i + 1) % boundary.length],
      next: Point3[] = [];
    for (let j = 0; j < result.length; j++) {
      const p = result[j],
        q = result[(j + 1) % result.length],
        dp = cross(a, b, p) * orientation,
        dq = cross(a, b, q) * orientation;
      const inside = dp >= -1e-7,
        other = dq >= -1e-7;
      if (inside) next.push(p);
      if (inside !== other) {
        const t = Math.max(0, Math.min(1, dp / (dp - dq)));
        next.push({
          x: p.x + (q.x - p.x) * t,
          y: p.y + (q.y - p.y) * t,
          z: p.z + (q.z - p.z) * t,
        });
      }
    }
    result = next;
  }
  return result;
}
/** Minimum vertical separation of the complete physical roof and the actual
 * overlapping house underside. Touching XY sections are retained too, so a
 * zero-overhang house uses its real connection section, never a distant apex. */
export function measureStudioFacadeClearance(
  house: StudioFacadeClearanceHouse,
  physical: Pick<WebsitePhysicalProduct, "roofFaces">,
  pose: Pose,
) {
  if (!physical.roofFaces?.length)
    throw Error("The actual pergola roof surfaces are unavailable.");
  const angle = (pose.rotation * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle);
  const world = (p: Point3) => ({
    x: pose.x + p.x * c - p.y * s,
    y: pose.y + p.x * s + p.y * c,
    z: p.z,
  });
  let gapMm = Infinity,
    witness: { house: string; roof: string } | null = null;
  for (const roof of physical.roofFaces) {
    const triangle = face(roof.id, roof.points.map(world));
    if (!triangle) continue;
    const b = triangle.bounds;
    for (const underside of house.faces) {
      const h = underside.bounds;
      if (
        b.x1 < h.x0 - 1e-7 ||
        b.x0 > h.x1 + 1e-7 ||
        b.y1 < h.y0 - 1e-7 ||
        b.y0 > h.y1 + 1e-7
      )
        continue;
      for (const point of clip(triangle.points, underside.points)) {
        const origin = underside.points[0],
          value =
            origin.z +
            underside.dx * (point.x - origin.x) +
            underside.dy * (point.y - origin.y) -
            point.z;
        if (value < gapMm) {
          gapMm = value;
          witness = { house: underside.id, roof: roof.id };
        }
      }
    }
  }
  if (!Number.isFinite(gapMm))
    throw Error(
      "No actual house underside meets the pergola connection section.",
    );
  return { gapMm, witness };
}
