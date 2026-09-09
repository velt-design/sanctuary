type Point = { x: number; y: number };
const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** Test the projected product envelope, excluding the empty corners of its bounding rectangle. */
export function foliageOverlapsProduct(corners: Point[], centre: Point, radiusX: number, radiusY: number): boolean {
  if (radiusX <= 0 || radiusY <= 0 || corners.length < 3) return false;
  const points = corners.map(p => ({ x: (p.x - centre.x) / radiusX, y: (p.y - centre.y) / radiusY }))
    .sort((a, b) => a.x - b.x || a.y - b.y);
  const chain = (list: Point[]) => {
    const result: Point[] = [];
    for (const point of list) {
      while (result.length >= 2 && cross(result[result.length - 2]!, result[result.length - 1]!, point) <= 0) result.pop();
      result.push(point);
    }
    result.pop(); return result;
  };
  const hull = [...chain(points), ...chain([...points].reverse())];
  const origin = { x: 0, y: 0 };
  if (hull.length >= 3 && hull.every((a, i) => cross(a, hull[(i + 1) % hull.length]!, origin) >= 0)) return true;
  return hull.some((a, i) => {
    const b = hull[(i + 1) % hull.length]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSquared)) : 0;
    return Math.hypot(a.x + t * dx, a.y + t * dy) <= 1;
  });
}
