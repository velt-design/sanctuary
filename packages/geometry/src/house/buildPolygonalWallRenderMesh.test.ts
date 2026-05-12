import { describe, expect, it } from 'vitest';
import type { Point3, Polygon3, Vector3 } from '../contracts';
import { crossProduct, normalizeVector, subtractPoints } from '../math3d';
import { buildPolygonalWallRenderMesh } from './roofSolids';

function point(x: number, y: number, z: number): Point3 {
  return { x, y, z };
}

function vector(x: number, y: number, z: number): Vector3 {
  return { x, y, z };
}

// Build a rectangular wall lying in the YZ plane (normal pointing along +X).
// Eave along Y from 0 to 6000mm, wall height 2400mm.
function flatTopWallBoundary(): Polygon3 {
  return [
    point(0, 0, 0),
    point(0, 6000, 0),
    point(0, 6000, 2400),
    point(0, 0, 2400),
  ];
}

// Build a pentagonal gable end wall in the YZ plane: eave along Y, ridge apex
// rising to 3600mm above the eave midpoint.
function gablePentagonBoundary(): Polygon3 {
  return [
    point(0, 0, 0),
    point(0, 6000, 0),
    point(0, 6000, 2400),
    point(0, 3000, 3600),
    point(0, 0, 2400),
  ];
}

function planeNormalFromBoundary(boundary: Polygon3): Vector3 {
  // For a planar polygon, the plane normal is the cross product of two edges
  // sharing a vertex. We use boundary[1] - boundary[0] and boundary[2] - boundary[0].
  const edge1 = subtractPoints(boundary[1]!, boundary[0]!);
  const edge2 = subtractPoints(boundary[2]!, boundary[0]!);
  return normalizeVector(crossProduct(edge1, edge2));
}

describe('buildPolygonalWallRenderMesh', () => {
  it('returns undefined for invalid inputs', () => {
    expect(buildPolygonalWallRenderMesh([], vector(1, 0, 0), 100)).toBeUndefined();
    expect(buildPolygonalWallRenderMesh([point(0, 0, 0), point(1, 0, 0)], vector(1, 0, 0), 100)).toBeUndefined();
    expect(buildPolygonalWallRenderMesh(flatTopWallBoundary(), vector(1, 0, 0), 0)).toBeUndefined();
    expect(buildPolygonalWallRenderMesh(flatTopWallBoundary(), vector(1, 0, 0), -10)).toBeUndefined();
    expect(buildPolygonalWallRenderMesh(flatTopWallBoundary(), vector(0, 0, 0), 100)).toBeUndefined();
    expect(buildPolygonalWallRenderMesh(flatTopWallBoundary(), vector(NaN, 0, 0), 100)).toBeUndefined();
  });

  it('builds 8 vertices and 12 faces for a 4-vertex flat-top wall', () => {
    // Rectangular wall: 4 boundary verts × 2 (outer/inner) = 8 vertices.
    // Faces: 2 outer + 2 inner + 4 sides × 2 = 12.
    const mesh = buildPolygonalWallRenderMesh(flatTopWallBoundary(), vector(1, 0, 0), 90);
    expect(mesh).toBeDefined();
    expect(mesh!.vertices.length).toBe(8);
    expect(mesh!.faces.length).toBe(12);
  });

  it('builds 10 vertices and 16 faces for a 5-vertex pentagonal gable wall', () => {
    // 5 boundary verts × 2 = 10 vertices.
    // Faces: 3 outer + 3 inner + 5 sides × 2 = 16.
    const mesh = buildPolygonalWallRenderMesh(gablePentagonBoundary(), vector(1, 0, 0), 90);
    expect(mesh).toBeDefined();
    expect(mesh!.vertices.length).toBe(10);
    expect(mesh!.faces.length).toBe(16);
  });

  it('offsets vertices by ±halfThickness along the plane normal', () => {
    const boundary = flatTopWallBoundary();
    const normal = vector(1, 0, 0);
    const thickness = 90;
    const mesh = buildPolygonalWallRenderMesh(boundary, normal, thickness)!;
    // Outer vertex 0 should be original + (thickness/2) * normal.
    expect(mesh.vertices[0]).toEqual({ x: 45, y: 0, z: 0 });
    // Inner vertex 0 (index = boundary.length = 4) should be original - half thickness.
    expect(mesh.vertices[4]).toEqual({ x: -45, y: 0, z: 0 });
  });

  it('places gable apex on both outer and inner faces at full apex height', () => {
    const boundary = gablePentagonBoundary();
    const mesh = buildPolygonalWallRenderMesh(boundary, vector(1, 0, 0), 90)!;
    // Apex is boundary index 3 (y=3000, z=3600). Outer copy at index 3, inner at index 8.
    expect(mesh.vertices[3]).toEqual({ x: 45, y: 3000, z: 3600 });
    expect(mesh.vertices[8]).toEqual({ x: -45, y: 3000, z: 3600 });
  });

  it('produces a closed manifold: every edge is shared by exactly two faces', () => {
    const mesh = buildPolygonalWallRenderMesh(gablePentagonBoundary(), vector(1, 0, 0), 90)!;
    const edgeCount = new Map<string, number>();
    for (const [a, b, c] of mesh.faces) {
      for (const [u, v] of [[a, b], [b, c], [c, a]] as Array<[number, number]>) {
        const key = u < v ? `${u}-${v}` : `${v}-${u}`;
        edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
      }
    }
    for (const [edge, count] of edgeCount) {
      expect(count, `edge ${edge} appears ${count} times`).toBe(2);
    }
  });

  it('orients outer face normals along the +planeNormal direction', () => {
    const boundary = gablePentagonBoundary();
    const planeNormal = planeNormalFromBoundary(boundary);
    const mesh = buildPolygonalWallRenderMesh(boundary, planeNormal, 90)!;
    // First outer face is faces[0] = [0, 1, 2] — boundary edge 0→1, edge 0→2.
    const outerFace = mesh.faces[0]!;
    const v0 = mesh.vertices[outerFace[0]]!;
    const v1 = mesh.vertices[outerFace[1]]!;
    const v2 = mesh.vertices[outerFace[2]]!;
    const faceNormal = normalizeVector(
      crossProduct(subtractPoints(v1, v0), subtractPoints(v2, v0)),
    );
    // Dot product with the plane normal should be ~+1 (same direction).
    const dot =
      faceNormal.x * planeNormal.x + faceNormal.y * planeNormal.y + faceNormal.z * planeNormal.z;
    expect(dot).toBeGreaterThan(0.99);
  });

  it('orients inner face normals along the -planeNormal direction', () => {
    const boundary = gablePentagonBoundary();
    const planeNormal = planeNormalFromBoundary(boundary);
    const mesh = buildPolygonalWallRenderMesh(boundary, planeNormal, 90)!;
    // The first inner face is the (N-2)th face (N = boundary.length = 5).
    // Outer faces: 3 triangles (indices 0..2). Inner faces start at index 3.
    const innerFace = mesh.faces[3]!;
    const v0 = mesh.vertices[innerFace[0]]!;
    const v1 = mesh.vertices[innerFace[1]]!;
    const v2 = mesh.vertices[innerFace[2]]!;
    const faceNormal = normalizeVector(
      crossProduct(subtractPoints(v1, v0), subtractPoints(v2, v0)),
    );
    const dot =
      faceNormal.x * planeNormal.x + faceNormal.y * planeNormal.y + faceNormal.z * planeNormal.z;
    expect(dot).toBeLessThan(-0.99);
  });

  it('all generated vertices are finite', () => {
    const mesh = buildPolygonalWallRenderMesh(gablePentagonBoundary(), vector(1, 0, 0), 90)!;
    for (const v of mesh.vertices) {
      expect(Number.isFinite(v.x)).toBe(true);
      expect(Number.isFinite(v.y)).toBe(true);
      expect(Number.isFinite(v.z)).toBe(true);
    }
  });
});
