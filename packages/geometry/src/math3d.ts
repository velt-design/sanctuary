import type { DatumFrame3, Line3, Plane3, Point3, Polygon3, Vector3 } from './contracts';

export const GEOMETRY_EPSILON = 1e-6;

export function subtractPoints(a: Point3, b: Point3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scaleVector(vector: Vector3, factor: number): Vector3 {
  return { x: vector.x * factor, y: vector.y * factor, z: vector.z * factor };
}

export function dotProduct(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function crossProduct(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function magnitude(vector: Vector3): number {
  return Math.sqrt(dotProduct(vector, vector));
}

export function normalizeVector(vector: Vector3): Vector3 {
  const length = magnitude(vector);
  if (length <= GEOMETRY_EPSILON) return { x: 0, y: 0, z: 0 };
  return scaleVector(vector, 1 / length);
}

export function lineDirection(line: Line3): Vector3 {
  return normalizeVector(subtractPoints(line.end, line.start));
}

export function lineLength(line: Line3): number {
  return magnitude(subtractPoints(line.end, line.start));
}

export function planeFromOriginAxes(origin: Point3, xAxis: Vector3, yAxis: Vector3): Plane3 {
  return {
    origin,
    xAxis,
    yAxis,
    normal: normalizeVector(crossProduct(xAxis, yAxis)),
  };
}

export function planeFromPoints(origin: Point3, pointOnX: Point3, pointOnY: Point3): Plane3 {
  const xAxis = subtractPoints(pointOnX, origin);
  const yAxis = subtractPoints(pointOnY, origin);
  return planeFromOriginAxes(origin, xAxis, yAxis);
}

export function polygonArea(polygon: Polygon3): number {
  if (polygon.length < 3) return 0;

  const origin = polygon[0]!;
  let area = 0;
  for (let index = 1; index < polygon.length - 1; index += 1) {
    const a = subtractPoints(polygon[index]!, origin);
    const b = subtractPoints(polygon[index + 1]!, origin);
    area += magnitude(crossProduct(a, b)) / 2;
  }
  return area;
}

export function makeDatumFrame(origin: Point3, xAxis: Vector3, yAxis: Vector3, zAxis: Vector3): DatumFrame3 {
  return { origin, xAxis, yAxis, zAxis };
}
