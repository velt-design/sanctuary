import type { Point3, RoofPlane3D } from './contracts';
import type { RoofFinishMesh } from './representativeRoofFinishTypes';
import { roofProfileSection, type RepresentativeRoofProfile } from './representativeRoofProfiles';

export const dotRoof = (a: Point3, b: Point3) => a.x * b.x + a.y * b.y + a.z * b.z;
export function roofCoordinates(roof: RoofPlane3D) {
  const sign = roof.plane.normal.z < 0 ? -1 : 1;
  const n = { x: roof.plane.normal.x * sign, y: roof.plane.normal.y * sign, z: roof.plane.normal.z * sign };
  const length = Math.hypot(roof.fallVector.x, roof.fallVector.y, roof.fallVector.z);
  const v = { x: roof.fallVector.x / length, y: roof.fallVector.y / length, z: roof.fallVector.z / length };
  let u = { x: -v.y, y: v.x, z: 0 };
  const horizontal = Math.hypot(u.x, u.y);
  const direction = (Math.abs(u.x) > Math.abs(u.y) ? u.x : u.y) < 0 ? -1 : 1;
  u = { x: u.x / horizontal * direction, y: u.y / horizontal * direction, z: 0 };
  const datum = dotRoof(roof.boundary[0], n);
  const point = (a: number, b: number, offset = 0): Point3 => ({
    x: u.x * a + v.x * b + n.x * (datum + offset),
    y: u.y * a + v.y * b + n.y * (datum + offset),
    z: u.z * a + v.z * b + n.z * (datum + offset),
  });
  const us = roof.boundary.map(p => dotRoof(p, u)), vs = roof.boundary.map(p => dotRoof(p, v));
  return { n, u, v, point, lo: Math.min(...us), hi: Math.max(...us), near: Math.min(...vs), far: Math.max(...vs) };
}
export type RoofCoordinates = ReturnType<typeof roofCoordinates>;
export type RoofRectangle = { a: number; b: number; c: number; d: number };
export function roofRectangleBoundary(frame: RoofCoordinates, r: RoofRectangle, offset = 0) {
  return [frame.point(r.a, r.c, offset), frame.point(r.b, r.c, offset), frame.point(r.b, r.d, offset), frame.point(r.a, r.d, offset)];
}
export function roofMesh(id: string, kind: RoofFinishMesh['kind']): RoofFinishMesh { return { id, kind, positions: [], indices: [] }; }
export function roofQuad(mesh: RoofFinishMesh, points: Point3[]) {
  const i = mesh.positions.length / 3;
  for (const p of points) mesh.positions.push(p.x, p.y, p.z);
  mesh.indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
}
export function roofSlab(mesh: RoofFinishMesh, frame: RoofCoordinates, r: RoofRectangle, bottom: number, top: number) {
  const a = roofRectangleBoundary(frame, r, bottom), b = roofRectangleBoundary(frame, r, top);
  roofQuad(mesh, a.slice().reverse()); roofQuad(mesh, b);
  for (let i = 0; i < 4; i++) roofQuad(mesh, [a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]]);
}
export function addProfiledRoof(mesh: RoofFinishMesh, frame: RoofCoordinates, r: RoofRectangle, profile: RepresentativeRoofProfile, trayWidth: 300 | 400 | 500) {
  const section = roofProfileSection(profile, r.a, r.b, trayWidth);
  for (let i = 1; i < section.length; i++) {
    const a = section[i - 1], b = section[i];
    roofQuad(mesh, [frame.point(a.across, r.c, a.height + 1), frame.point(b.across, r.c, b.height + 1),
      frame.point(b.across, r.d, b.height + 1), frame.point(a.across, r.d, a.height + 1)]);
  }
}
