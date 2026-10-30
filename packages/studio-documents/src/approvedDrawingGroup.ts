import type { PDFDocument, PDFPage } from 'pdf-lib';
import { PAPER } from './layout';

/** Measure the complete PDF drawing group before placing it. The sidebar,
 * heading and footer never move with the model. Real context is part of the
 * group's bounds; an absent house does not reserve an empty context band. */
export async function centredDrawingGroup(
  pdf: PDFDocument,
  page: PDFPage,
  field: { x: number; y: number; width: number; height: number },
  draw: (scratch: PDFPage) => Promise<void>,
) {
  const index = pdf.getPageCount(),
    scratch = pdf.addPage([PAPER.width, PAPER.height]);
  let left = Infinity,
    bottom = Infinity,
    right = -Infinity,
    top = -Infinity;
  const include = (x: number, y: number, w: number, h: number) => {
    left = Math.min(left, x);
    bottom = Math.min(bottom, y);
    right = Math.max(right, x + w);
    top = Math.max(top, y + h);
  };
  const drawLine = scratch.drawLine.bind(scratch);
  scratch.drawLine = (options) => {
    include(
      Math.min(options.start!.x, options.end!.x),
      Math.min(options.start!.y, options.end!.y),
      Math.abs(options.start!.x - options.end!.x),
      Math.abs(options.start!.y - options.end!.y),
    );
    return drawLine(options);
  };
  const drawText = scratch.drawText.bind(scratch);
  scratch.drawText = (value, options) => {
    if (!options?.font || !options.size)
      throw Error('Drawing text needs explicit font metrics');
    include(
      options.x ?? 0,
      (options.y ?? 0) - options.size * 0.25,
      options.font.widthOfTextAtSize(value, options.size),
      options.size * 1.25,
    );
    return drawText(value, options);
  };
  const drawImage = scratch.drawImage.bind(scratch);
  scratch.drawImage = (image, options) => {
    include(
      options?.x ?? 0,
      options?.y ?? 0,
      options?.width ?? image.width,
      options?.height ?? image.height,
    );
    return drawImage(image, options);
  };
  const drawRectangle = scratch.drawRectangle.bind(scratch);
  scratch.drawRectangle = (options) => {
    include(
      options?.x ?? 0,
      options?.y ?? 0,
      options?.width ?? 0,
      options?.height ?? 0,
    );
    return drawRectangle(options);
  };
  const drawCircle = scratch.drawCircle.bind(scratch);
  scratch.drawCircle = (options) => {
    const radius = options?.size ?? 0;
    include(
      (options?.x ?? 0) - radius,
      (options?.y ?? 0) - radius,
      radius * 2,
      radius * 2,
    );
    return drawCircle(options);
  };
  await draw(scratch);
  if (
    ![left, bottom, right, top].every(Number.isFinite) ||
    right - left > field.width + 1 ||
    top - bottom > field.height + 1
  )
    throw Error(
      `Complete drawing ${Math.ceil(right - left)} x ${Math.ceil(top - bottom)} exceeds its ${field.width} x ${Math.floor(field.height)} pt field`,
    );
  const embedded = await pdf.embedPage(scratch, {
    left: left - 1,
    bottom: bottom - 1,
    right: right + 1,
    top: top + 1,
  });
  pdf.removePage(index);
  const x = field.x + (field.width - embedded.width) / 2,
    y = PAPER.height - field.y - (field.height + embedded.height) / 2;
  page.drawPage(embedded, {
    x,
    y,
    width: embedded.width,
    height: embedded.height,
  });
  return {
    bounds: { left, bottom, right, top },
    translation: { x: x - left + 1, y: y - bottom + 1 },
  };
}
