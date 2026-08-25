import * as THREE from "three";
import type { Point3 } from "@sp/geometry";
import { isFinitePoint } from "../scene";

/**
 * Small THREE.BufferGeometry constructors shared by every renderer and
 * overlay in the viewport. These four are deliberately the only line/
 * point-level builders here -- the polygon/slab/clipped-prism builders
 * have heavier dependencies (polygon-frame derivation, ear-clip
 * triangulation, projected-polygon math) and live in the not-yet-split
 * `buildGeometries` chunk inside `index.tsx`.
 *
 * Pure: no React, no scene model coupling. Point3 ⇄ THREE.Vector3
 * conversions stay close to the builders that consume them so the
 * THREE-side primitives don't leak into the cameraState / measurement
 * interaction layer.
 */

export function buildLineGeometry(points: Point3[]): THREE.BufferGeometry {
  const finitePoints = points.filter(isFinitePoint);
  if (finitePoints.length < 2) return new THREE.BufferGeometry();
  return new THREE.BufferGeometry().setFromPoints(
    finitePoints.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
  );
}

export function emptyGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
  return geometry;
}

export function vectorFromPoint(point: Point3): THREE.Vector3 {
  return new THREE.Vector3(point.x, point.y, point.z);
}

export function buildClosedLineGeometry(points: Point3[]): THREE.BufferGeometry {
  if (points.length === 0) {
    return new THREE.BufferGeometry();
  }
  return buildLineGeometry([...points, points[0]!]);
}
