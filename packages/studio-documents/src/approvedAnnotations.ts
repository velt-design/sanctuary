import { type PDFPage } from 'pdf-lib';
import { headingInkBounds } from './assets';
import { line, text, INK, MUTED, type Fonts } from './layout';

export type PaperPoint = { x: number; y: number };
export const LEADER_LENGTH_PT = (19 * 72) / 25.4;
export function approvedLeaderRoute(
  anchor: PaperPoint,
  side: 'left' | 'right',
  vertical: 1 | -1,
  headingX: number,
  ink: { left: number; right: number },
) {
  const direction = side === 'left' ? -1 : 1;
  const elbow = {
    x: anchor.x + direction * LEADER_LENGTH_PT * Math.cos(Math.PI / 6),
    y: anchor.y + (vertical * LEADER_LENGTH_PT) / 2,
  };
  const tail = {
    x: headingX + (side === 'left' ? ink.right + 2.5 : ink.left - 2.5),
    y: elbow.y,
  };
  if ((elbow.x - tail.x) * direction > 0)
    throw Error('Drawing leader exceeds its annotation field');
  return { anchor, elbow, tail, labelY: tail.y - 7 };
}
export async function approvedLeader(
  page: PDFPage,
  fonts: Fonts,
  anchor: PaperPoint,
  side: 'left' | 'right',
  heading: string,
  description: string[] = [],
  vertical: 1 | -1 = -1,
) {
  const x = side === 'left' ? 280 : 1014,
    ink = await headingInkBounds(heading, 8.8);
  const route = approvedLeaderRoute(anchor, side, vertical, x, ink);
  line(page, anchor.x, anchor.y, route.elbow.x, route.elbow.y, 0.5, INK);
  line(
    page,
    route.elbow.x,
    route.elbow.y,
    route.tail.x,
    route.tail.y,
    0.5,
    INK,
  );
  const angle = Math.atan2(route.elbow.y - anchor.y, route.elbow.x - anchor.x);
  for (const a of [angle - 0.4, angle + 0.4])
    line(
      page,
      anchor.x,
      anchor.y,
      anchor.x + 3.5 * Math.cos(a),
      anchor.y + 3.5 * Math.sin(a),
      0.55,
      INK,
    );
  text(page, heading, x, route.labelY, 8.8, fonts.medium);
  description.forEach((value, index) =>
    text(
      page,
      value,
      x,
      route.labelY + (index + 1) * 11.5,
      8.5,
      fonts.regular,
      MUTED,
    ),
  );
  return route;
}
export function horizontalDrawingDimension(
  page: PDFPage,
  fonts: Fonts,
  a: number,
  b: number,
  originY: number,
  y: number,
  label: string,
) {
  for (const x of [a, b]) {
    line(page, x, originY + 3, x, y + 7, 0.3, MUTED);
    line(page, x - 3, y + 3, x + 3, y - 3, 0.55, INK);
  }
  const width = fonts.medium.widthOfTextAtSize(label, 9),
    middle = (a + b) / 2;
  line(page, Math.min(a, b), y, middle - width / 2 - 7, y, 0.45, INK);
  line(page, middle + width / 2 + 7, y, Math.max(a, b), y, 0.45, INK);
  text(page, label, middle - width / 2, y - 12, 9, fonts.medium);
}
export function verticalDrawingDimension(
  page: PDFPage,
  fonts: Fonts,
  a: number,
  b: number,
  originX: number,
  x: number,
  label: string,
) {
  for (const y of [a, b]) {
    line(page, originX + 3, y, x + 7, y, 0.3, MUTED);
    line(page, x - 3, y + 3, x + 3, y - 3, 0.55, INK);
  }
  line(page, x, a, x, b, 0.45, INK);
  text(page, label, x + 7, (a + b) / 2 - 5, 9, fonts.medium);
}
