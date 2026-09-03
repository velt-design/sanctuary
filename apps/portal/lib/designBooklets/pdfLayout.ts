import "server-only";

import {
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  setCharacterSpacing,
  type Color,
  type PDFDocument,
  type PDFImage,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";
import { SANCTUARY_ARTIFACT_BRAND } from "@/lib/customerArtifacts/brand";
import {
  DESIGN_BOOKLET_PRESENTATION,
  normalizeDesignBookletMultilinePresentationText,
  normalizeDesignBookletPresentationText,
} from "./presentation";
import { designBookletPageGeometry } from "./paperGeometry";
import type { DesignBookletPaperSizeId } from "./types";
import {
  DESIGN_BOOKLET_BULLET_GEOMETRY,
  DESIGN_BOOKLET_BULLET_GLYPH,
  parseDesignBookletEditorialText,
} from "./editorialText";

export const DESIGN_BOOKLET_PDF_PAGE_SIZE = DESIGN_BOOKLET_PRESENTATION.page;

export function applyDesignBookletPdfPaperSize(
  pdf: PDFDocument,
  paperSize: DesignBookletPaperSizeId,
) {
  const geometry = designBookletPageGeometry(paperSize);
  for (const page of pdf.getPages()) {
    if (geometry.scaleX !== 1 || geometry.scaleY !== 1) {
      page.scaleContent(geometry.scaleX, geometry.scaleY);
    }
    page.setSize(geometry.width, geometry.height);
  }
}

export const DESIGN_BOOKLET_PDF_LEFT =
  DESIGN_BOOKLET_PRESENTATION.chrome.insetLeft;
export const DESIGN_BOOKLET_PDF_RIGHT =
  DESIGN_BOOKLET_PRESENTATION.chrome.insetRight;
const DESIGN_BOOKLET_PDF_BOTTOM =
  DESIGN_BOOKLET_PDF_PAGE_SIZE.height -
  DESIGN_BOOKLET_PRESENTATION.chrome.footer.labelBaseline;
const DESIGN_BOOKLET_PDF_CONTENT_WIDTH =
  DESIGN_BOOKLET_PDF_PAGE_SIZE.width -
  DESIGN_BOOKLET_PDF_LEFT -
  DESIGN_BOOKLET_PDF_RIGHT;

export type DesignBookletPdfFonts = {
  display: PDFFont;
  brand: PDFFont;
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
  return normalizeDesignBookletPresentationText(value);
}

export function designBookletPdfTextLines(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  tracking = 0,
  preserveLineBreaks = false,
): string[] {
  const paragraphs = (
    preserveLineBreaks
      ? normalizeDesignBookletMultilinePresentationText(text)
      : safeDesignBookletPdfText(text)
  ).split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      if (designBookletPdfTextWidth(word, font, size, tracking) > maxWidth) {
        if (line) {
          lines.push(line);
          line = "";
        }
        let chunk = "";
        for (const character of Array.from(word)) {
          const candidate = `${chunk}${character}`;
          if (
            chunk &&
            designBookletPdfTextWidth(candidate, font, size, tracking) >
              maxWidth
          ) {
            lines.push(chunk);
            chunk = character;
          } else {
            chunk = candidate;
          }
        }
        line = chunk;
        continue;
      }
      const candidate = line ? `${line} ${word}` : word;
      if (
        !line ||
        designBookletPdfTextWidth(candidate, font, size, tracking) <= maxWidth
      ) {
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

export function designBookletPdfTextWidth(
  text: string,
  font: PDFFont,
  size: number,
  tracking = 0,
): number {
  const characterCount = Array.from(text).length;
  return (
    font.widthOfTextAtSize(text, size) +
    Math.max(0, characterCount - 1) * tracking * size
  );
}

export function drawDesignBookletTrackedText(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    font: PDFFont;
    size: number;
    color?: Color;
    tracking?: number;
  },
) {
  const tracking = options.tracking ?? 0;
  page.pushOperators(
    pushGraphicsState(),
    setCharacterSpacing(tracking * options.size),
  );
  page.drawText(safeDesignBookletPdfText(text), {
    x: options.x,
    y: options.y,
    font: options.font,
    size: options.size,
    color: options.color ?? DESIGN_BOOKLET_PDF_COLORS.ink,
  });
  page.pushOperators(popGraphicsState());
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
    tracking?: number;
    preserveLineBreaks?: boolean;
  },
): number {
  const lines = designBookletPdfTextLines(
    text,
    options.font,
    options.size,
    options.width,
    options.tracking,
    options.preserveLineBreaks,
  );
  const visible =
    options.maxLines && lines.length > options.maxLines
      ? (() => {
          const truncated = lines.slice(0, options.maxLines);
          const lastIndex = truncated.length - 1;
          let finalLine = truncated[lastIndex].trimEnd();
          while (
            finalLine &&
            designBookletPdfTextWidth(
              `${finalLine}...`,
              options.font,
              options.size,
              options.tracking,
            ) > options.width
          ) {
            finalLine = finalLine.slice(0, -1).trimEnd();
          }
          truncated[lastIndex] = `${finalLine}...`;
          return truncated;
        })()
      : lines;
  let y = options.y;
  for (const line of visible) {
    drawDesignBookletTrackedText(page, line, {
      x: options.x,
      y,
      font: options.font,
      size: options.size,
      color: options.color ?? DESIGN_BOOKLET_PDF_COLORS.ink,
      tracking: options.tracking,
    });
    y -= options.lineHeight;
  }
  return y;
}

export function drawDesignBookletEditorialText(
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
  const lines: Array<{
    text: string;
    x: number;
    width: number;
    marker: boolean;
  }> = [];

  for (const block of parseDesignBookletEditorialText(text)) {
    if (block.kind === "paragraph") {
      lines.push(
        ...designBookletPdfTextLines(
          block.text,
          options.font,
          options.size,
          options.width,
          0,
          true,
        ).map((line) => ({
          text: line,
          x: options.x,
          width: options.width,
          marker: false,
        })),
      );
      continue;
    }

    for (const item of block.items) {
      const itemLines = designBookletPdfTextLines(
        item,
        options.font,
        options.size,
        options.width - DESIGN_BOOKLET_BULLET_GEOMETRY.textInset,
      );
      (itemLines.length ? itemLines : [""]).forEach((line, index) => {
        lines.push({
          text: line,
          x: options.x + DESIGN_BOOKLET_BULLET_GEOMETRY.textInset,
          width: options.width - DESIGN_BOOKLET_BULLET_GEOMETRY.textInset,
          marker: index === 0,
        });
      });
    }
  }

  const visible = lines.slice(0, options.maxLines ?? lines.length);
  if (visible.length < lines.length && visible.length) {
    const last = visible.at(-1)!;
    let finalLine = last.text.trimEnd();
    while (
      finalLine &&
      designBookletPdfTextWidth(`${finalLine}...`, options.font, options.size) >
        last.width
    ) {
      finalLine = finalLine.slice(0, -1).trimEnd();
    }
    last.text = `${finalLine}...`;
  }

  let y = options.y;
  for (const line of visible) {
    if (line.marker) {
      drawDesignBookletTrackedText(page, DESIGN_BOOKLET_BULLET_GLYPH, {
        x: options.x,
        y,
        font: options.font,
        size: options.size,
        color: options.color ?? DESIGN_BOOKLET_PDF_COLORS.ink,
      });
    }
    if (line.text) {
      drawDesignBookletTrackedText(page, line.text, {
        x: line.x,
        y,
        font: options.font,
        size: options.size,
        color: options.color ?? DESIGN_BOOKLET_PDF_COLORS.ink,
      });
    }
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
  size = DESIGN_BOOKLET_PRESENTATION.typography.eyebrowSize,
  tracking = 0.15,
) {
  drawDesignBookletTrackedText(
    page,
    safeDesignBookletPdfText(text).toUpperCase(),
    {
      x,
      y,
      font: fonts.semibold,
      size,
      color,
      tracking,
    },
  );
}

export function drawDesignBookletRule(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  color: Color = DESIGN_BOOKLET_PDF_COLORS.rule,
  thickness = 0.65,
) {
  page.drawLine({
    start: { x, y },
    end: { x: x + width, y },
    thickness,
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
}

export function drawDesignBookletFooter(
  page: PDFPage,
  pageNumber: number,
  pageCount: number,
  customerName: string,
  fonts: DesignBookletPdfFonts,
  tone: "dark" | "light" | "split" = "dark",
) {
  const leftTextColor =
    tone === "light"
      ? DESIGN_BOOKLET_PDF_COLORS.paperStrong
      : tone === "split"
        ? DESIGN_BOOKLET_PDF_COLORS.paperStrong
        : DESIGN_BOOKLET_PDF_COLORS.muted;
  const rightTextColor =
    tone === "light"
      ? DESIGN_BOOKLET_PDF_COLORS.paperStrong
      : DESIGN_BOOKLET_PDF_COLORS.muted;
  const ruleY =
    DESIGN_BOOKLET_PDF_PAGE_SIZE.height -
    DESIGN_BOOKLET_PRESENTATION.chrome.footer.ruleTop;
  if (tone === "split") {
    const splitX = DESIGN_BOOKLET_PRESENTATION.review.image.width;
    drawDesignBookletRule(
      page,
      DESIGN_BOOKLET_PDF_LEFT,
      ruleY,
      splitX - DESIGN_BOOKLET_PDF_LEFT,
      DESIGN_BOOKLET_PDF_COLORS.paperStrong,
    );
    drawDesignBookletRule(
      page,
      splitX,
      ruleY,
      DESIGN_BOOKLET_PDF_PAGE_SIZE.width - DESIGN_BOOKLET_PDF_RIGHT - splitX,
      DESIGN_BOOKLET_PDF_COLORS.rule,
    );
  } else {
    drawDesignBookletRule(
      page,
      DESIGN_BOOKLET_PDF_LEFT,
      ruleY,
      DESIGN_BOOKLET_PDF_CONTENT_WIDTH,
      tone === "light"
        ? DESIGN_BOOKLET_PDF_COLORS.paperStrong
        : DESIGN_BOOKLET_PDF_COLORS.rule,
    );
  }
  drawDesignBookletTrackedText(
    page,
    `SANCTUARY / DESIGN BOOKLET / ${safeDesignBookletPdfText(customerName).toUpperCase()}`,
    {
      x: DESIGN_BOOKLET_PDF_LEFT,
      y: DESIGN_BOOKLET_PDF_BOTTOM,
      size: DESIGN_BOOKLET_PRESENTATION.chrome.footer.labelSize,
      font: fonts.medium,
      color: leftTextColor,
      tracking: 0.05,
    },
  );
  const numberWidth = Math.max(2, String(pageCount).length);
  const pageText = `${String(pageNumber).padStart(numberWidth, "0")} / ${String(pageCount).padStart(numberWidth, "0")}`;
  const pageNumberSize =
    DESIGN_BOOKLET_PRESENTATION.chrome.footer.pageNumberSize;
  drawDesignBookletTrackedText(page, pageText, {
    x:
      DESIGN_BOOKLET_PDF_PAGE_SIZE.width -
      DESIGN_BOOKLET_PDF_RIGHT -
      designBookletPdfTextWidth(pageText, fonts.medium, pageNumberSize, 0.05),
    y: DESIGN_BOOKLET_PDF_BOTTOM,
    size: pageNumberSize,
    font: fonts.medium,
    color: rightTextColor,
    tracking: 0.05,
  });
}

export function drawDesignBookletImageCover(
  page: PDFPage,
  image: PDFImage,
  frame: { x: number; y: number; width: number; height: number },
  focalPoint: { x: number; y: number } = { x: 50, y: 50 },
) {
  const scale = Math.max(
    frame.width / image.width,
    frame.height / image.height,
  );
  const width = image.width * scale;
  const height = image.height * scale;
  const focalX = Math.min(100, Math.max(0, focalPoint.x)) / 100;
  const focalY = Math.min(100, Math.max(0, focalPoint.y)) / 100;
  const x = frame.x - (width - frame.width) * focalX;
  const y = frame.y - (height - frame.height) * (1 - focalY);

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
  borderWidth = 0.6,
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
    borderWidth,
  });
}

export function addDesignBookletPage(pdf: PDFDocument): PDFPage {
  const page = pdf.addPage([
    DESIGN_BOOKLET_PDF_PAGE_SIZE.width,
    DESIGN_BOOKLET_PDF_PAGE_SIZE.height,
  ]);
  drawPageBase(page);
  return page;
}
