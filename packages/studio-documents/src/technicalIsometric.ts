import type { Point3 } from "@sp/geometry";
import type { DocumentTriangle } from "./mesh";
/** Presentation lighting only. Geometry, projection and depth remain canonical. */
export function technicalFaceShade(points: readonly Point3[]) {
  const [p, q, r] = points,
    a = { x: q.x - p.x, y: q.y - p.y, z: q.z - p.z },
    b = { x: r.x - p.x, y: r.y - p.y, z: r.z - p.z },
    n = {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    },
    length = Math.hypot(n.x, n.y, n.z) || 1;
  return (
    0.62 +
    (0.36 *
      (0.3 * Math.abs(n.x) + 0.58 * Math.abs(n.y) + 0.98 * Math.abs(n.z))) /
      length
  );
}
/** A soft graphic grounding cue, without a slab outline or invented site work. */
export async function drawIsometricGroundCue(options: {
  triangles: readonly DocumentTriangle[];
  width: number;
  height: number;
  rgb: Uint8Array;
  project: (point: Point3) => { x: number; y: number };
  signal?: AbortSignal;
}) {
  const { triangles, width, height, rgb, project, signal } = options;
  let lowest = Infinity;
  for (const triangle of triangles)
    for (const point of triangle.points) lowest = Math.min(lowest, point.z);
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    count = 0;
  for (const triangle of triangles)
    for (const point of triangle.points)
      if (point.z <= lowest + 0.5) {
        const p = project(point);
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
        count++;
      }
  if (!count) return;
  const cx = (minX + maxX) / 2,
    cy = (minY + maxY) / 2,
    rx = Math.max(20, (maxX - minX) / 2 + 25),
    ry = Math.max(15, (maxY - minY) / 2 + 18);
  for (
    let y = Math.max(0, Math.floor(cy - ry * 1.3));
    y < Math.min(height, cy + ry * 1.3);
    y++
  ) {
    for (
      let x = Math.max(0, Math.floor(cx - rx * 1.3));
      x < Math.min(width, cx + rx * 1.3);
      x++
    ) {
      const r = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (r > 1.7) continue;
      const value = 255 - Math.round(10 * Math.exp(-1.9 * r));
      rgb.set(
        [value, value + Math.min(1, 255 - value), value],
        (y * width + x) * 3,
      );
    }
    if (y % 48 === 0) {
      await new Promise<void>((resolve) => setImmediate(resolve));
      signal?.throwIfAborted();
    }
  }
}
