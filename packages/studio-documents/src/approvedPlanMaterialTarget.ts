import type { Point3 } from "@sp/geometry";
import type { StudioDocumentProduct } from "./contract";
import { headingInkBounds } from "./assets";
import { approvedLeaderRoute, type PaperPoint } from "./approvedAnnotations";
import {
  approvedAcrylicPlanTarget,
  approvedGlazingBoundaries,
} from "./approvedRoofSurfaces";
import { refinedHeightFacts } from "./refinedFacts";
import type { Fonts } from "./layout";

type MapPoint = (point: Point3) => PaperPoint;
type Bounds = { left: number; right: number; top: number; bottom: number };
const centre = (points: Point3[]): Point3 =>
  points.reduce(
    (sum, p) => ({
      x: sum.x + p.x / points.length,
      y: sum.y + p.y / points.length,
      z: sum.z + p.z / points.length,
    }),
    { x: 0, y: 0, z: 0 },
  );

/** Identical source locations and font metrics to the fall arrows drawn on Plan. */
export function approvedPitchFootprints(
  product: StudioDocumentProduct,
  map: MapPoint,
  fonts: Fonts,
): Bounds[] {
  const label = `${refinedHeightFacts(product).pitch.toFixed(1)}°`;
  return product.assembly.roofPlanes.flatMap((plane) => {
    const a = map(centre(plane.boundary));
    const v = plane.fallVector;
    const length = Math.hypot(v.x, v.y) || 1;
    const b = { x: a.x + (v.x / length) * 31, y: a.y + (v.y / length) * 31 };
    return [
      {
        left: Math.min(a.x, b.x) - 6,
        right: Math.max(a.x, b.x) + 6,
        top: Math.min(a.y, b.y) - 6,
        bottom: Math.max(a.y, b.y) + 6,
      },
      {
        left: a.x + 7,
        right: a.x + 13 + fonts.medium.widthOfTextAtSize(label, 8.4),
        top: (a.y + b.y) / 2 - 3,
        bottom: (a.y + b.y) / 2 + 12,
      },
    ];
  });
}

export function segmentCrossesBounds(
  a: PaperPoint,
  b: PaperPoint,
  bounds: Bounds,
) {
  let from = 0,
    to = 1;
  for (const [origin, delta, low, high] of [
    [a.x, b.x - a.x, bounds.left, bounds.right],
    [a.y, b.y - a.y, bounds.top, bounds.bottom],
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < low || origin > high) return false;
    } else {
      const first = (low - origin) / delta,
        second = (high - origin) / delta;
      from = Math.max(from, Math.min(first, second));
      to = Math.min(to, Math.max(first, second));
      if (from > to) return false;
    }
  }
  return true;
}

/** Select the actual material body whose complete fixed-standard leader clears
 * the known pitch annotation. No roof-family offsets or geometry are invented. */
export async function approvedPlanMaterialTarget(
  product: StudioDocumentProduct,
  material: "solid" | "acrylic",
  map: MapPoint,
  fonts: Fonts,
  side: "left" | "right",
  heading: string,
  vertical: 1 | -1 = -1,
) {
  const boundaries =
    material === "solid"
      ? (product.covering?.regions
          .filter((region) => region.material === "solid")
          .map((region) => region.boundary) ?? [])
      : approvedGlazingBoundaries(product);
  const candidates: Point3[] = [];
  if (material === "acrylic")
    candidates.push(approvedAcrylicPlanTarget(product));
  for (const boundary of boundaries) {
    const middle = centre(boundary);
    candidates.push(middle);
    for (const point of boundary)
      candidates.push({
        x: middle.x * 0.55 + point.x * 0.45,
        y: middle.y * 0.55 + point.y * 0.45,
        z: middle.z * 0.55 + point.z * 0.45,
      });
  }
  if (material === "acrylic" && !product.assembly.roofCladdingPanels.length) {
    const clear = approvedAcrylicPlanTarget(product);
    const plane = product.assembly.roofPlanes[0].plane;
    // Bay centres avoid rafters; the existing target supplies a real open gap
    // between any under-rafter battens, rather than an arbitrary roof Y offset.
    candidates.splice(
      1,
      candidates.length - 1,
      ...boundaries.map((boundary) => {
        const x = centre(boundary).x,
          y = clear.y;
        return {
          x,
          y,
          z:
            plane.origin.z -
            ((x - plane.origin.x) * plane.normal.x +
              (y - plane.origin.y) * plane.normal.y) /
              plane.normal.z,
        };
      }),
    );
  }
  const ink = await headingInkBounds(heading, 8.8);
  const obstacles = approvedPitchFootprints(product, map, fonts);
  const headingX = side === "left" ? 280 : 1014;
  for (const candidate of candidates) {
    let route;
    try {
      route = approvedLeaderRoute(
        map(candidate),
        side,
        vertical,
        headingX,
        ink,
      );
    } catch {
      continue;
    }
    if (
      obstacles.every(
        (bounds) =>
          !segmentCrossesBounds(route.anchor, route.elbow, bounds) &&
          !segmentCrossesBounds(route.elbow, route.tail, bounds),
      )
    )
      return candidate;
  }
  throw Error("Material annotation has no clear route around roof pitch");
}
