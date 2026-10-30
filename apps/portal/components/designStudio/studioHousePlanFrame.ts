/** Explicit world-to-Plan projection: world +Y is up, SVG +Y is down. */
export function studioPlanPoint<T extends { x: number; y: number }>(
  point: T,
): T {
  return { ...point, x: point.x, y: -point.y };
}
export type StudioPlanCamera = {
  x: number;
  y: number;
  units: number;
  viewport?: { width: number; height: number };
};
export function initialStudioPlanCamera(
  points: ReadonlyArray<{ x: number; y: number }>,
  viewport: { width: number; height: number },
): StudioPlanCamera {
  // Persistent Fit uses actual scene bounds and screen-space label clearance.
  // The legacy drawing frame below intentionally retains its historic extents.
  const projected = points
    .map(studioPlanPoint)
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const xs = projected.map((p) => p.x),
    ys = projected.map((p) => p.y);
  const minX = projected.length ? Math.min(...xs) : -3000,
    maxX = projected.length ? Math.max(...xs) : 3000,
    minY = projected.length ? Math.min(...ys) : -1500,
    maxY = projected.length ? Math.max(...ys) : 1500;
  const width = Math.max(1, viewport.width),
    height = Math.max(1, viewport.height),
    margin = Math.min(32, width * 0.1, height * 0.1);
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    units: Math.max(
      0.1,
      (maxX - minX) / (width - 2 * margin),
      (maxY - minY) / (height - 2 * margin),
    ),
    viewport: { width, height },
  };
}
/** Keep the explored rectangle contained across layout changes, reversibly. */
export function studioPlanUnits(
  camera: StudioPlanCamera,
  viewport: { width: number; height: number },
) {
  return (
    camera.units *
    (camera.viewport
      ? Math.max(
          camera.viewport.width / Math.max(1, viewport.width),
          camera.viewport.height / Math.max(1, viewport.height),
        )
      : 1)
  );
}
export function studioPlanViewBox(
  camera: StudioPlanCamera,
  viewport: { width: number; height: number },
): string {
  const units = studioPlanUnits(camera, viewport),
    w = viewport.width * units,
    h = viewport.height * units;
  return [camera.x - w / 2, camera.y - h / 2, w, h].join(" ");
}
/** Legacy explicit-fit helper. Persistent Studio cameras capture this only once. */
export function captureStudioHousePlanFrame(
  points: ReadonlyArray<{ x: number; y: number }>,
  viewport?: { width: number; height: number },
): string {
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const x = Math.min(-1000, ...xs) - 1200,
    y = Math.min(-1000, ...ys) - 1200;
  const width = Math.max(6000, ...xs) - x + 1200,
    height = Math.max(3000, ...ys) - y + 1200;
  if (!viewport || viewport.width <= 0 || viewport.height <= 0)
    return [x, y, width, height].join(" ");
  // Screen-readable target labels need real pixel clearance, especially on a
  // tall joined arrangement in the narrower tablet drawable rectangle.
  const marginX = Math.min(96, viewport.width * 0.2),
    marginY = Math.min(40, viewport.height * 0.15);
  const units = Math.max(
    width / (viewport.width - 2 * marginX),
    height / (viewport.height - 2 * marginY),
  );
  return [
    x - marginX * units,
    y - marginY * units,
    width + 2 * marginX * units,
    height + 2 * marginY * units,
  ].join(" ");
}
