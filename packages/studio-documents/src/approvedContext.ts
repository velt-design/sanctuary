import type { Point3 } from '@sp/geometry';
import type { PDFPage } from 'pdf-lib';
import type {
  StudioClientDocumentSource,
  StudioDocumentProduct,
} from './contract';
import { line, text, MUTED, type Fonts } from './layout';

type Point = { x: number; y: number };
/** Only an actual attachment makes house context relevant on an individual
 * roof sheet. Detached surroundings do not resize the primary drawing. Visible
 * context is clipped at its real coordinates, never fitted by shrinking the
 * primary pergola or moving the house. */
export function relevantHouseContext(
  source: StudioClientDocumentSource,
  product: StudioDocumentProduct,
) {
  if (
    !product.assembly.attachmentEdge &&
    !product.assembly.house.attachmentTarget
  )
    return [];
  const angle = (-product.pose.rotation * Math.PI) / 180;
  return source.houses.map((h) =>
    h.footprint.map((p) => {
      const x = p.x - product.pose.x,
        y = p.y - product.pose.y;
      return {
        x: x * Math.cos(angle) - y * Math.sin(angle),
        y: x * Math.sin(angle) + y * Math.cos(angle),
        z: p.z,
      };
    }),
  );
}
function clippedSegment(
  a: Point,
  b: Point,
  bounds: { left: number; right: number; top: number; bottom: number },
): [Point, Point] | null {
  let low = 0,
    high = 1;
  const dx = b.x - a.x,
    dy = b.y - a.y;
  for (const [p, q] of [
    [-dx, a.x - bounds.left],
    [dx, bounds.right - a.x],
    [-dy, a.y - bounds.top],
    [dy, bounds.bottom - a.y],
  ]) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) low = Math.max(low, t);
    else high = Math.min(high, t);
    if (low > high) return null;
  }
  return [
    { x: a.x + dx * low, y: a.y + dy * low },
    { x: a.x + dx * high, y: a.y + dy * high },
  ];
}
export function drawRelevantHouseContext(
  page: PDFPage,
  source: StudioClientDocumentSource,
  product: StudioDocumentProduct,
  fonts: Fonts,
  map: (p: Point3) => Point,
) {
  const houses = relevantHouseContext(source, product);
  if (!houses.length) return false;
  const a = map({ x: 0, y: 0, z: 0 }),
    b = map({ x: product.widthMm, y: 0, z: 0 }),
    bounds = {
      left: a.x - 15,
      right: b.x + 15,
      top: a.y - 66,
      bottom: a.y + 2,
    };
  let visible = false;
  for (const house of houses)
    for (let index = 0; index < house.length; index++) {
      const segment = clippedSegment(
        map(house[index]),
        map(house[(index + 1) % house.length]),
        bounds,
      );
      if (!segment) continue;
      visible = true;
      line(
        page,
        segment[0].x,
        segment[0].y,
        segment[1].x,
        segment[1].y,
        0.45,
        MUTED,
      );
    }
  if (visible) {
    page.drawLine({
      start: { x: bounds.left, y: 841.89 - bounds.top },
      end: { x: bounds.right, y: 841.89 - bounds.top },
      thickness: 0.4,
      color: MUTED,
      dashArray: [5, 3],
    });
    text(
      page,
      source.layoutVersion === 'studio-booklet-layout.v4'
        ? 'SAVED HOUSE CONTEXT / CLIPPED TO THIS VIEW'
        : 'SAVED HOUSE CONTEXT / CONTINUES ON OVERVIEW',
      bounds.left + 6,
      bounds.top + 8,
      7.1,
      fonts.medium,
      MUTED,
    );
  }
  return visible;
}
