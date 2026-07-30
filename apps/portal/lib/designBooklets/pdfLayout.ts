import "server-only";

import {
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  type Color,
  type PDFDocument,
  type PDFImage,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";
import { SANCTUARY_ARTIFACT_BRAND } from "@/lib/customerArtifacts/brand";

export const DESIGN_BOOKLET_PDF_PAGE_SIZE = {
  width: 841.89,
  height: 595.28,
} as const;

export const DESIGN_BOOKLET_PDF_LEFT = 44;
export const DESIGN_BOOKLET_PDF_RIGHT = 44;
const DESIGN_BOOKLET_PDF_TOP = 40;
export const DESIGN_BOOKLET_PDF_BOTTOM = 23;
export const DESIGN_BOOKLET_PDF_CONTENT_WIDTH =
  DESIGN_BOOKLET_PDF_PAGE_SIZE.width -
  DESIGN_BOOKLET_PDF_LEFT -
  DESIGN_BOOKLET_PDF_RIGHT;

export type DesignBookletPdfFonts = {
  regular: PDFFont;
  medium: PDFFont;
  semibold: PDFFont;
};

function colorFromHex(hex: string): Color {
  const value = hex.replace("#", "");
  return rgb(
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  );
}

export const DESIGN_BOOKLET_PDF_COLORS = {
  canvas: colorFromHex(SANCTUARY_ARTIFACT_BRAND.colors.canvas),
  paper: colorFromHex(SANCTUARY_ARTIFACT_BRAND.colors.paper),
  paperStrong: colorFromHex(SANCTUARY_ARTIFACT_BRAND.colors.paperStrong),
  ink: colorFromHex(SANCTUARY_ARTIFACT_BRAND.colors.ink),
  muted: colorFromHex(SANCTUARY_ARTIFACT_BRAND.colors.inkMuted),
  rule: colorFromHex(SANCTUARY_ARTIFACT_BRAND.colors.rule),
  ruleStrong: colorFromHex(SANCTUARY_ARTIFACT_BRAND.colors.ruleStrong),
  accent: rgb(
    SANCTUARY_ARTIFACT_BRAND.pdf.accent.r,
    SANCTUARY_ARTIFACT_BRAND.pdf.accent.g,
    SANCTUARY_ARTIFACT_BRAND.pdf.accent.b,
  ),
};

export function safeDesignBookletPdfText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const paragraphs = safeDesignBookletPdfText(text).split(/\n+/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }

  return lines;
}

export function drawDesignBookletWrappedText(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    width: number;
    font: PDFFont;
    size: number;
    lineHeight: number;
    color?: Color;
    maxLines?: number;
  },
): number {
  const lines = wrapText(text, options.font, options.size, options.width);
  const visible =
    options.maxLines && lines.length > options.maxLines
      ? lines.slice(0, options.maxLines)
      : lines;
  let y = options.y;
  for (const line of visible) {
    page.drawText(line, {
      x: options.x,
      y,
      font: options.font,
      size: options.size,
      color: options.color ?? DESIGN_BOOKLET_PDF_COLORS.ink,
    });
    y -= options.lineHeight;
  }
  return y;
}

export function drawDesignBookletEyebrow(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  fonts: DesignBookletPdfFonts,
  color: Color = DESIGN_BOOKLET_PDF_COLORS.accent,
) {
  page.drawText(safeDesignBookletPdfText(text).toUpperCase(), {
    x,
    y,
    font: fonts.semibold,
    size: 7.5,
    color,
  });
}

export function drawDesignBookletRule(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  color: Color = DESIGN_BOOKLET_PDF_COLORS.rule,
) {
  page.drawLine({
    start: { x, y },
    end: { x: x + width, y },
    thickness: 0.65,
    color,
  });
}

function drawPageBase(page: PDFPage) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: DESIGN_BOOKLET_PDF_PAGE_SIZE.width,
    height: DESIGN_BOOKLET_PDF_PAGE_SIZE.height,
    color: DESIGN_BOOKLET_PDF_COLORS.paper,
  });
  page.drawRectangle({
    x: 0,
    y: DESIGN_BOOKLET_PDF_PAGE_SIZE.height - 4,
    width: DESIGN_BOOKLET_PDF_PAGE_SIZE.width,
    height: 4,
    color: DESIGN_BOOKLET_PDF_COLORS.accent,
  });
}

export function drawDesignBookletFooter(
  page: PDFPage,
  pageNumber: number,
  pageCount: number,
  customerName: string,
  fonts: DesignBookletPdfFonts,
) {
  drawDesignBookletRule(
    page,
    DESIGN_BOOKLET_PDF_LEFT,
    40,
    DESIGN_BOOKLET_PDF_CONTENT_WIDTH,
  );
  page.drawText(
    `SANCTUARY / DESIGN BOOKLET / ${safeDesignBookletPdfText(customerName).toUpperCase()}`,
    {
      x: DESIGN_BOOKLET_PDF_LEFT,
      y: DESIGN_BOOKLET_PDF_BOTTOM,
      size: 6.8,
      font: fonts.medium,
      color: DESIGN_BOOKLET_PDF_COLORS.muted,
    },
  );
  const pageText = `${pageNumber} / ${pageCount}`;
  page.drawText(pageText, {
    x:
      DESIGN_BOOKLET_PDF_PAGE_SIZE.width -
      DESIGN_BOOKLET_PDF_RIGHT -
      fonts.medium.widthOfTextAtSize(pageText, 7.2),
    y: DESIGN_BOOKLET_PDF_BOTTOM,
    size: 7.2,
    font: fonts.medium,
    color: DESIGN_BOOKLET_PDF_COLORS.muted,
  });
}

export function drawDesignBookletImageCover(
  page: PDFPage,
  image: PDFImage,
  frame: { x: number; y: number; width: number; height: number },
) {
  const scale = Math.max(
    frame.width / image.width,
    frame.height / image.height,
  );
  const width = image.width * scale;
  const height = image.height * scale;
  const x = frame.x + (frame.width - width) / 2;
  const y = frame.y + (frame.height - height) / 2;

  page.pushOperators(
    pushGraphicsState(),
    rectangle(frame.x, frame.y, frame.width, frame.height),
    clip(),
    endPath(),
  );
  page.drawImage(image, { x, y, width, height });
  page.pushOperators(popGraphicsState());
}

export function drawDesignBookletImageContain(
  page: PDFPage,
  image: PDFImage,
  frame: { x: number; y: number; width: number; height: number },
  background: Color = DESIGN_BOOKLET_PDF_COLORS.paperStrong,
) {
  page.drawRectangle({ ...frame, color: background });
  const scale = Math.min(
    frame.width / image.width,
    frame.height / image.height,
  );
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, {
    x: frame.x + (frame.width - width) / 2,
    y: frame.y + (frame.height - height) / 2,
    width,
    height,
  });
  page.drawRectangle({
    ...frame,
    borderColor: DESIGN_BOOKLET_PDF_COLORS.rule,
    borderWidth: 0.6,
  });
}

export function drawDesignBookletBulletList(
  page: PDFPage,
  items: readonly string[],
  options: {
    x: number;
    y: number;
    width: number;
    fonts: DesignBookletPdfFonts;
    size?: number;
    lineHeight?: number;
    itemGap?: number;
  },
): number {
  const size = options.size ?? 8.3;
  const lineHeight = options.lineHeight ?? 11.2;
  const itemGap = options.itemGap ?? 7;
  let y = options.y;

  for (const item of items) {
    const lines = wrapText(
      item,
      options.fonts.regular,
      size,
      options.width - 16,
    );
    page.drawRectangle({
      x: options.x,
      y: y + 3,
      width: 4,
      height: 4,
      color: DESIGN_BOOKLET_PDF_COLORS.accent,
    });
    for (const line of lines) {
      page.drawText(line, {
        x: options.x + 15,
        y,
        font: options.fonts.regular,
        size,
        color: DESIGN_BOOKLET_PDF_COLORS.ink,
      });
      y -= lineHeight;
    }
    y -= itemGap;
  }
  return y;
}

export function addDesignBookletPage(pdf: PDFDocument): PDFPage {
  const page = pdf.addPage([
    DESIGN_BOOKLET_PDF_PAGE_SIZE.width,
    DESIGN_BOOKLET_PDF_PAGE_SIZE.height,
  ]);
  drawPageBase(page);
  return page;
}
