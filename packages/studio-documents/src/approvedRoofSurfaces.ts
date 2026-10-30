import type { StudioDocumentProduct } from "./contract";

/** Covering may also contain spaced under-rafter battens. Its presence alone
 * does not establish an opaque roof or a continuous ceiling. */
export function approvedRoofSurfaces(product: StudioDocumentProduct) {
  const solidRegions =
    product.covering?.regions.filter((region) => region.material === "solid") ??
    [];
  const meshes = product.covering?.meshes ?? [];
  const hasOpaqueRoof = solidRegions.length > 0;
  const fullAcrylicRoof =
    product.drawingDetails?.finish.material === "acrylic" && !hasOpaqueRoof;
  const hasOpenBattens = meshes.some((mesh) =>
    mesh.id.startsWith("roof-battens-"),
  );
  const hasContinuousCeiling =
    hasOpaqueRoof &&
    meshes.some(
      (mesh) => mesh.kind === "cedar" && !mesh.id.startsWith("roof-battens-"),
    );
  return {
    solidRegions,
    hasOpaqueRoof,
    fullAcrylicRoof,
    hasOpenBattens,
    hasContinuousCeiling,
  };
}

/** Explicit canonical panes take precedence. A mono acrylic roof is a single
 * real roof plane; its rafter bays are a glazing convention, not fabricated cuts. */
export function approvedGlazingBoundaries(product: StudioDocumentProduct) {
  if (product.assembly.roofCladdingPanels.length)
    return product.assembly.roofCladdingPanels.map((panel) => panel.boundary);
  if (!approvedRoofSurfaces(product).fullAcrylicRoof) return [];
  const roof = product.assembly.roofPlanes[0];
  if (!roof) return [];
  const xs = product.assembly.members
    .filter((member) => member.role === "rafter")
    .map((member) => (member.centerline.start.x + member.centerline.end.x) / 2)
    .sort((a, b) => a - b);
  const ys = roof.boundary.map((point) => point.y);
  return xs.slice(1).map((x, index) => [
    { x: xs[index], y: Math.min(...ys), z: 0 },
    { x, y: Math.min(...ys), z: 0 },
    { x, y: Math.max(...ys), z: 0 },
    { x: xs[index], y: Math.max(...ys), z: 0 },
  ]);
}

/** Pick clear glazing in the material body, away from the central rafter/fall
 * annotation. Open timber battens retain their own physical clear gaps. */
export function approvedAcrylicPlanTarget(product: StudioDocumentProduct) {
  const boundaries = approvedGlazingBoundaries(product);
  const centre = (points: (typeof boundaries)[number]) =>
    points.reduce(
      (sum, point) => ({
        x: sum.x + point.x / points.length,
        y: sum.y + point.y / points.length,
        z: sum.z + point.z / points.length,
      }),
      { x: 0, y: 0, z: 0 },
    );
  const preferred = { x: product.widthMm * 0.4, y: product.projectionMm * 0.7 };
  const pane = boundaries.reduce<(typeof boundaries)[number] | undefined>(
    (best, boundary) => {
      const distance = (points: typeof boundary) => {
        const p = centre(points);
        return (p.x - preferred.x) ** 2 + (p.y - preferred.y) ** 2;
      };
      return !best || distance(boundary) < distance(best) ? boundary : best;
    },
    undefined,
  );
  if (!pane) throw Error("Canonical acrylic glazing surface unavailable");
  const target = centre(pane);
  if (!product.assembly.roofCladdingPanels.length) {
    const bands = (product.covering?.battenBoundaries ?? [])
      .map((boundary) => ({
        low: Math.min(...boundary.map((point) => point.y)),
        high: Math.max(...boundary.map((point) => point.y)),
      }))
      .sort((a, b) => a.low - b.low);
    const clearCentres = bands
      .slice(1)
      .map((band, index) => (bands[index].high + band.low) / 2);
    target.y = clearCentres.length
      ? clearCentres.reduce((best, y) =>
          Math.abs(y - preferred.y) < Math.abs(best - preferred.y) ? y : best,
        )
      : preferred.y;
    const plane = product.assembly.roofPlanes[0].plane;
    target.z =
      plane.origin.z -
      ((target.x - plane.origin.x) * plane.normal.x +
        (target.y - plane.origin.y) * plane.normal.y) /
        plane.normal.z;
  }
  return target;
}
