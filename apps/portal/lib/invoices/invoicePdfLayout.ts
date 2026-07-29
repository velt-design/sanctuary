import {
  rgb,
  type Color,
  type PDFImage,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";
import { SANCTUARY_ARTIFACT_BRAND } from "../customerArtifacts/brand";
import type { DepositInvoiceArtifactViewModel } from "./invoiceArtifactViewModel";

export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
const MARGIN_LEFT = 49;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 48;
const MARGIN_BOTTOM = 38;
export const CONTENT_X0 = MARGIN_LEFT;
export const CONTENT_X1 = PAGE_WIDTH - MARGIN_RIGHT;
export const CONTENT_W = CONTENT_X1 - CONTENT_X0;
export const CONTENT_BOTTOM_Y = 92;
export const RAIL_WIDTH = 8;

export const FONT_SIZES = {
  wordmark: 10,
  title: 30,
  eyebrow: 7.5,
  headerRef: 10.5,
  body: 9.4,
  bodySmall: 8.7,
  metaValue: 9.6,
  amount: 26,
  amountLabel: 8,
  summaryValue: 11,
  tableLabel: 9,
  tableValue: 9.4,
  totalLabel: 9.2,
  totalValue: 15,
  footer: 7.8,
} as const;

export const LINE_HEIGHTS = {
  body: 13,
  bodySmall: 12,
  meta: 13,
  summary: 14,
  payment: 12.5,
} as const;

export type PdfFonts = {
  regular: PDFFont;
  medium: PDFFont;
  semibold: PDFFont;
};

type DepositInvoicePdfLayoutPage = {
  pageNumber: number;
  hasPageBackground: boolean;
  hasLeftRail: boolean;
  contentBottomY?: number;
  hasPaymentSummary?: boolean;
  hasCalculation?: boolean;
  paymentSegmentCount: number;
};

export type DepositInvoicePdfLayout = {
  pages: DepositInvoicePdfLayoutPage[];
};

type DrawTextOptions = {
  x: number;
  y: number;
  size: number;
  font: PDFFont;
  color?: Color;
};

type MetaLine = {
  text: string;
  font: PDFFont;
  color: Color;
};

export type PaymentFlowItem =
  | {
      kind: "line";
      text: string;
      height: number;
    }
  | {
      kind: "spacer";
      height: number;
    }
  | {
      kind: "note";
      text: string;
      height: number;
    };

export const brandColors = {
  canvas: rgbFromHex(SANCTUARY_ARTIFACT_BRAND.colors.canvas),
  paper: rgbFromHex(SANCTUARY_ARTIFACT_BRAND.colors.paper),
  paperStrong: rgbFromHex(SANCTUARY_ARTIFACT_BRAND.colors.paperStrong),
  ink: rgbFromHex(SANCTUARY_ARTIFACT_BRAND.colors.ink),
  muted: rgbFromHex(SANCTUARY_ARTIFACT_BRAND.colors.inkMuted),
  rule: rgbFromHex(SANCTUARY_ARTIFACT_BRAND.colors.rule),
  ruleStrong: rgbFromHex(SANCTUARY_ARTIFACT_BRAND.colors.ruleStrong),
  accent: rgb(
    SANCTUARY_ARTIFACT_BRAND.pdf.accent.r,
    SANCTUARY_ARTIFACT_BRAND.pdf.accent.g,
    SANCTUARY_ARTIFACT_BRAND.pdf.accent.b,
  ),
};

function rgbFromHex(hex: string): Color {
  const value = hex.replace("#", "").trim();
  if (!/^[\da-f]{6}$/i.test(value)) return rgb(0, 0, 0);
  return rgb(
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  );
}

export function drawText(
  page: PDFPage,
  text: string,
  options: DrawTextOptions,
) {
  if (!text) return;
  page.drawText(text, {
    x: options.x,
    y: options.y,
    size: options.size,
    font: options.font,
    color: options.color ?? brandColors.ink,
  });
}

export function drawRightAligned(
  page: PDFPage,
  text: string,
  xRight: number,
  y: number,
  size: number,
  font: PDFFont,
  color: Color = brandColors.ink,
) {
  drawText(page, text, {
    x: xRight - font.widthOfTextAtSize(text, size),
    y,
    size,
    font,
    color,
  });
}

function splitLongToken(
  font: PDFFont,
  token: string,
  size: number,
  maxWidth: number,
): string[] {
  if (font.widthOfTextAtSize(token, size) <= maxWidth) return [token];

  const fragments: string[] = [];
  let fragment = "";
  for (const character of token) {
    const candidate = `${fragment}${character}`;
    if (fragment && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      fragments.push(fragment);
      fragment = character;
    } else {
      fragment = candidate;
    }
  }
  if (fragment) fragments.push(fragment);
  return fragments;
}

export function wrapText(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number,
): string[] {
  if (maxWidth <= 0) return [text];

  const wrapped: string[] = [];
  for (const paragraph of String(text ?? "").split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      wrapped.push("");
      continue;
    }

    let line = "";
    for (const word of words) {
      for (const part of splitLongToken(font, word, size, maxWidth)) {
        const candidate = line ? `${line} ${part}` : part;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
          line = candidate;
        } else {
          if (line) wrapped.push(line);
          line = part;
        }
      }
    }
    if (line) wrapped.push(line);
  }
  return wrapped;
}

export function fitTextSize(
  font: PDFFont,
  text: string,
  preferredSize: number,
  minimumSize: number,
  maxWidth: number,
): number {
  let size = preferredSize;
  while (size > minimumSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

function drawLogo(
  page: PDFPage,
  logo: PDFImage | null,
  xRight: number,
  yTop: number,
  maxSize: number,
) {
  if (!logo) return;
  const scale = Math.min(maxSize / logo.width, maxSize / logo.height, 1);
  const width = logo.width * scale;
  const height = logo.height * scale;
  page.drawImage(logo, {
    x: xRight - width,
    y: yTop - height,
    width,
    height,
    opacity: 0.86,
  });
}

export function drawFirstPageHeader(
  page: PDFPage,
  vm: DepositInvoiceArtifactViewModel,
  fonts: PdfFonts,
  logo: PDFImage | null,
): number {
  const topY = PAGE_HEIGHT - MARGIN_TOP;

  drawText(page, "SANCTUARY PERGOLAS", {
    x: CONTENT_X0,
    y: topY,
    size: FONT_SIZES.wordmark,
    font: fonts.medium,
    color: brandColors.accent,
  });
  drawLogo(page, logo, CONTENT_X1, topY + 5, 30);

  drawText(page, vm.header.title, {
    x: CONTENT_X0,
    y: topY - 60,
    size: FONT_SIZES.title,
    font: fonts.semibold,
  });

  const referenceWidth = 188;
  const referenceX = CONTENT_X1 - referenceWidth;
  drawText(page, "INVOICE NUMBER", {
    x: referenceX,
    y: topY - 28,
    size: FONT_SIZES.eyebrow,
    font: fonts.medium,
    color: brandColors.accent,
  });
  const referenceLines = wrapText(
    fonts.medium,
    vm.header.invoiceRef,
    FONT_SIZES.headerRef,
    referenceWidth,
  );
  let referenceY = topY - 47;
  for (const line of referenceLines) {
    drawRightAligned(
      page,
      line,
      CONTENT_X1,
      referenceY,
      FONT_SIZES.headerRef,
      fonts.medium,
    );
    referenceY -= 13;
  }

  const headerRuleY = Math.min(topY - 78, referenceY - 3);
  page.drawLine({
    start: { x: CONTENT_X0, y: headerRuleY },
    end: { x: CONTENT_X1, y: headerRuleY },
    thickness: 0.85,
    color: brandColors.ruleStrong,
  });
  return headerRuleY - 22;
}

export function drawContinuationHeader(
  page: PDFPage,
  vm: DepositInvoiceArtifactViewModel,
  fonts: PdfFonts,
  logo: PDFImage | null,
): number {
  const topY = PAGE_HEIGHT - MARGIN_TOP;
  drawText(page, "SANCTUARY PERGOLAS", {
    x: CONTENT_X0,
    y: topY,
    size: FONT_SIZES.wordmark,
    font: fonts.medium,
    color: brandColors.accent,
  });
  drawLogo(page, logo, CONTENT_X1, topY + 4, 20);

  const referenceText = `DEPOSIT INVOICE / ${vm.header.invoiceRef}`;
  const referenceSize = fitTextSize(
    fonts.medium,
    referenceText,
    FONT_SIZES.headerRef,
    7,
    290,
  );
  drawRightAligned(
    page,
    referenceText,
    CONTENT_X1,
    topY - 29,
    referenceSize,
    fonts.medium,
  );

  const ruleY = topY - 43;
  page.drawLine({
    start: { x: CONTENT_X0, y: ruleY },
    end: { x: CONTENT_X1, y: ruleY },
    thickness: 0.7,
    color: brandColors.rule,
  });
  return ruleY - 27;
}

export function drawPageFooter(
  page: PDFPage,
  vm: DepositInvoiceArtifactViewModel,
  fonts: PdfFonts,
  pageNumber: number,
  pageCount: number,
) {
  const ruleY = MARGIN_BOTTOM + 20;
  page.drawLine({
    start: { x: CONTENT_X0, y: ruleY },
    end: { x: CONTENT_X1, y: ruleY },
    thickness: 0.6,
    color: brandColors.rule,
  });
  drawText(page, `${vm.footer.website}  /  ${vm.footer.email}`, {
    x: CONTENT_X0,
    y: MARGIN_BOTTOM,
    size: FONT_SIZES.footer,
    font: fonts.regular,
    color: brandColors.muted,
  });
  drawRightAligned(
    page,
    `Page ${pageNumber} of ${pageCount}`,
    CONTENT_X1,
    MARGIN_BOTTOM,
    FONT_SIZES.footer,
    fonts.medium,
    brandColors.muted,
  );
}

export function prepareMetaLines(
  vm: DepositInvoiceArtifactViewModel,
  fonts: PdfFonts,
  columnWidths: readonly number[],
): Array<{ label: string; lines: MetaLine[] }> {
  const customerLines = wrapText(
    fonts.medium,
    vm.customer.name,
    FONT_SIZES.metaValue,
    columnWidths[0]!,
  ).map((text) => ({
    text,
    font: fonts.medium,
    color: brandColors.ink,
  }));

  const projectLines: MetaLine[] = wrapText(
    fonts.medium,
    vm.project.name,
    FONT_SIZES.metaValue,
    columnWidths[1]!,
  ).map((text) => ({
    text,
    font: fonts.medium,
    color: brandColors.ink,
  }));
  for (const address of vm.project.addressLines) {
    projectLines.push(
      ...wrapText(
        fonts.regular,
        address,
        FONT_SIZES.bodySmall,
        columnWidths[1]!,
      ).map((text) => ({
        text,
        font: fonts.regular,
        color: brandColors.muted,
      })),
    );
  }

  const invoiceDetails = [
    `Issued ${vm.dates.issue}`,
    `Quote ${vm.header.quoteRef} v${vm.header.quoteVersionNumber}`,
    `Deposit ${vm.deposit.percent}%`,
    "Currency NZD",
  ].flatMap((value) =>
    wrapText(fonts.regular, value, FONT_SIZES.bodySmall, columnWidths[2]!).map(
      (text) => ({
        text,
        font: fonts.regular,
        color: brandColors.muted,
      }),
    ),
  );

  return [
    { label: "Prepared for", lines: customerLines },
    { label: "Project", lines: projectLines },
    { label: "Invoice details", lines: invoiceDetails },
  ];
}

export function buildPaymentFlow(
  vm: DepositInvoiceArtifactViewModel,
  fonts: PdfFonts,
): PaymentFlowItem[] {
  const innerWidth = CONTENT_W - 36;
  const items: PaymentFlowItem[] = [];

  for (const sourceLine of vm.payment.lines) {
    for (const line of wrapText(
      fonts.regular,
      sourceLine,
      FONT_SIZES.body,
      innerWidth,
    )) {
      items.push({
        kind: "line",
        text: line,
        height: LINE_HEIGHTS.payment,
      });
    }
  }

  items.push({ kind: "spacer", height: 6 });
  for (const line of wrapText(
    fonts.regular,
    vm.payment.nextStep,
    FONT_SIZES.bodySmall,
    innerWidth,
  )) {
    items.push({
      kind: "note",
      text: line,
      height: LINE_HEIGHTS.bodySmall,
    });
  }
  return items;
}
