import type { Point3 } from "@sp/geometry";
import type { PDFFont } from "pdf-lib";
import type { StudioDocumentProduct } from "./contract";
import type { PaperPoint } from "./approvedAnnotations";

type Bounds = { left: number; right: number; top: number; bottom: number };
type Blind = NonNullable<
  StudioDocumentProduct["drawingDetails"]
>["blinds"][number];
type MapPoint = (point: Point3) => PaperPoint;
const bounds = (points: PaperPoint[]): Bounds => ({
  left: Math.min(...points.map((p) => p.x)),
  right: Math.max(...points.map((p) => p.x)),
  top: Math.min(...points.map((p) => p.y)),
  bottom: Math.max(...points.map((p) => p.y)),
});
export function blindLabelIntersects(a: Bounds, b: Bounds, clearance = 0) {
  return (
    a.left < b.right + clearance &&
    a.right > b.left - clearance &&
    a.top < b.bottom + clearance &&
    a.bottom > b.top - clearance
  );
}

/** Labels describe selected blinds, but their ink must clear the actual rail
 * and track geometry. A partial drop is not centred on its whole opening. */
export function approvedBlindLabel(
  product: StudioDocumentProduct,
  blind: Blind,
  number: number,
  map: MapPoint,
  font: PDFFont,
) {
  const size = 8.8,
    clearance = 2.5;
  const meshes = product.accessories.filter((mesh) =>
    mesh.id.startsWith(`${blind.opening.id}:blind:`),
  );
  const points = (positions: number[]) =>
    Array.from({ length: positions.length / 3 }, (_, i) =>
      map({
        x: positions[i * 3],
        y: positions[i * 3 + 1],
        z: positions[i * 3 + 2],
      }),
    );
  const fabricPoints = meshes
    .filter((mesh) => mesh.kind === "fabric")
    .flatMap((mesh) => points(mesh.positions));
  const fabric = fabricPoints.length ? bounds(fabricPoints) : null;
  const hardware = meshes
    .filter((mesh) => mesh.kind === "frame")
    .flatMap((mesh) => {
      const projected = points(mesh.positions),
        result: Bounds[] = [];
      for (let i = 0; i < mesh.indices.length; i += 3)
        result.push(
          bounds(mesh.indices.slice(i, i + 3).map((index) => projected[index])),
        );
      return result;
    });
  const o = blind.opening;
  const opening = bounds(
    [o.start, o.end].flatMap((point) => [
      map({ ...point, z: 0 }),
      map({ ...point, z: o.top }),
    ]),
  );
  const ascent = font.heightAtSize(size, { descender: false });
  const descent = font.heightAtSize(size, { descender: true }) - ascent;
  const height = ascent + descent;
  for (const [kind, area] of [
    ["fabric", fabric],
    ["opening", opening],
  ] as const) {
    if (!area) continue;
    for (const label of [
      `B${number} / ${blind.lowered}% lowered`,
      `B${number} / ${blind.lowered}%`,
      `B${number}`,
    ]) {
      const width = font.widthOfTextAtSize(label, size);
      if (
        width + 2 * clearance > area.right - area.left ||
        height + 2 * clearance > area.bottom - area.top
      )
        continue;
      const x = (area.left + area.right - width) / 2;
      const low = area.top + clearance,
        high = area.bottom - clearance - height;
      for (const top of [(low + high) / 2, low, high]) {
        const ink = { left: x, right: x + width, top, bottom: top + height };
        if (hardware.some((rail) => blindLabelIntersects(ink, rail, clearance)))
          continue;
        return {
          label,
          x,
          y: top + ascent - size,
          ink,
          fabric,
          hardware,
          placement: kind,
          size,
        };
      }
    }
  }
  throw Error("Selected blind has no clear label area");
}
