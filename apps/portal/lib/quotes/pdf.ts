import 'server-only';

import {
  PDFDocument,
  rgb,
  type Color,
  type PDFImage,
  type PDFPage,
  type PDFFont,
} from 'pdf-lib';
import { SANCTUARY_ARTIFACT_BRAND } from '@/lib/customerArtifacts/brand';
import fontkit from './fontkit';
import {
  drawDebugOverlay,
  drawRule,
  type RuleDrawn,
  type TableBounds,
  type TotalsBounds,
} from './pdfLayout';
import {
  QUOTE_PDF_FONT_FILES,
  QUOTE_PDF_LOGO_FILE,
  readQuotePdfFont,
  readQuotePdfImage,
} from './quotePdfAssets';
import {
  buildPdfQuoteViewModel,
  type PdfQuoteViewModel,
} from './quotePdfViewModel';
import type { QuoteVersionDetail } from './types';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_LEFT = 49;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 48;
const MARGIN_BOTTOM = 38;
const CONTENT_X0 = MARGIN_LEFT;
const CONTENT_X1 = PAGE_WIDTH - MARGIN_RIGHT;
const CONTENT_W = CONTENT_X1 - CONTENT_X0;
const CONTENT_BOTTOM_Y = 78;
const RAIL_WIDTH = 8;

const DESCRIPTION_W = 300;
const QTY_W = 48;
const UNIT_W = 73;
const AMOUNT_W = CONTENT_W - DESCRIPTION_W - QTY_W - UNIT_W;
const DESCRIPTION_X = CONTENT_X0;
const QTY_X = DESCRIPTION_X + DESCRIPTION_W;
const UNIT_X = QTY_X + QTY_W;
const AMOUNT_X = UNIT_X + UNIT_W;
const QTY_RIGHT = QTY_X + QTY_W;
const UNIT_RIGHT = UNIT_X + UNIT_W;
const AMOUNT_RIGHT = AMOUNT_X + AMOUNT_W;

const FONT_SIZES = {
  wordmark: 10,
  title: 31,
  quoteRef: 11,
  eyebrow: 7.5,
  metaValue: 10,
  body: 9.6,
  section: 8,
  tableHeader: 8,
  itemHeading: 10,
  itemBody: 8.8,
  numeric: 8.8,
  totalLabel: 8.5,
  totalValue: 10,
  totalStrong: 16,
  footer: 7.8,
} as const;

const LINE_HEIGHTS = {
  metaValue: 13,
  body: 13.5,
  itemHeading: 13,
  itemBody: 11.5,
  terms: 12.5,
} as const;

type PdfFonts = {
  regular: PDFFont;
  medium: PDFFont;
  semibold: PDFFont;
};

type RowTextLine = {
  text: string;
  kind: 'heading' | 'section' | 'bullet';
  prefix?: string;
};

type PreparedRow = {
  heading: string;
  lines: RowTextLine[];
  qtyText: string;
  unitPrice: string;
  amount: string;
};

type QuotePdfLayoutPage = {
  hasPageBackground: boolean;
  hasLeftRail: boolean;
  pageNumber: number;
  contentBottomY?: number;
  headerClientName?: { text: string; xRight: number; y: number };
  headerClientAddress?: { lines: string[]; xRight: number; y: number };
  headerWarehouseAddress?: { lines: string[]; xRight: number; y: number };
  tableBounds?: TableBounds | null;
  totalsBounds?: TotalsBounds | null;
  paymentBlock?: { topY: number; bottomY: number; lineCount: number };
  termLineCount?: number;
  rules: RuleDrawn[];
};

type QuotePdfLayout = {
  pages: QuotePdfLayoutPage[];
};

type GeneratePdfOptions = {
  collectLayout?: boolean;
  debugBounds?: boolean;
};

const brandColors = {
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
  const value = hex.replace('#', '').trim();
  if (!/^[\da-f]{6}$/i.test(value)) return rgb(0, 0, 0);
  return rgb(
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  );
}

function drawText(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    size: number;
    font: PDFFont;
    color?: Color;
  },
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

function drawRightAligned(
  page: PDFPage,
  text: string,
  xRight: number,
  y: number,
  size: number,
  font: PDFFont,
  color: Color = brandColors.ink,
) {
  if (!text) return;
  drawText(page, text, {
    x: xRight - font.widthOfTextAtSize(text, size),
    y,
    size,
    font,
    color,
  });
}

function splitLongToken(font: PDFFont, token: string, size: number, maxWidth: number): string[] {
  if (font.widthOfTextAtSize(token, size) <= maxWidth) return [token];
  const fragments: string[] = [];
  let fragment = '';
  for (const char of token) {
    const candidate = `${fragment}${char}`;
    if (fragment && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      fragments.push(fragment);
      fragment = char;
    } else {
      fragment = candidate;
    }
  }
  if (fragment) fragments.push(fragment);
  return fragments;
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  if (maxWidth <= 0) return [text];
  const wrapped: string[] = [];
  for (const paragraph of String(text ?? '').split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      wrapped.push('');
      continue;
    }

    let line = '';
    for (const rawWord of words) {
      const parts = splitLongToken(font, rawWord, size, maxWidth);
      for (const part of parts) {
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

function prepareRows(vm: PdfQuoteViewModel, fonts: PdfFonts): PreparedRow[] {
  const bulletPrefixWidth = fonts.regular.widthOfTextAtSize('- ', FONT_SIZES.itemBody);
  return vm.items.map((item) => {
    const lines: RowTextLine[] = wrapText(
      fonts.medium,
      item.heading,
      FONT_SIZES.itemHeading,
      DESCRIPTION_W - 8,
    ).map((text) => ({ text, kind: 'heading' as const }));

    for (const entry of item.entries) {
      const kind = entry.kind === 'section' ? 'section' : 'bullet';
      const font = kind === 'section' ? fonts.medium : fonts.regular;
      const maxWidth =
        kind === 'section'
          ? DESCRIPTION_W - 8
          : DESCRIPTION_W - 8 - bulletPrefixWidth;
      const entryLines = wrapText(
        font,
        entry.text,
        kind === 'section' ? FONT_SIZES.itemHeading : FONT_SIZES.itemBody,
        maxWidth,
      );
      entryLines.forEach((text, index) => {
        lines.push({
          text,
          kind,
          prefix: kind === 'bullet' && index === 0 ? '- ' : undefined,
        });
      });
    }

    return {
      heading: item.heading,
      lines,
      qtyText: item.qtyText,
      unitPrice: item.unitPrice,
      amount: item.amount,
    };
  });
}

function continuationHeader(
  page: PDFPage,
  vm: PdfQuoteViewModel,
  fonts: PdfFonts,
  logo: PDFImage | null,
) {
  const topY = PAGE_HEIGHT - MARGIN_TOP;
  drawText(page, 'SANCTUARY PERGOLAS', {
    x: CONTENT_X0,
    y: topY,
    size: FONT_SIZES.wordmark,
    font: fonts.medium,
    color: brandColors.accent,
  });
  drawRightAligned(
    page,
    `${vm.header.quoteNumber} / V${vm.header.versionNumber}`,
    CONTENT_X1,
    topY,
    FONT_SIZES.quoteRef,
    fonts.medium,
    brandColors.ink,
  );

  if (logo) {
    const scale = Math.min(20 / logo.width, 20 / logo.height, 1);
    const width = logo.width * scale;
    const height = logo.height * scale;
    page.drawImage(logo, {
      x: CONTENT_X1 - width,
      y: topY + 14,
      width,
      height,
      opacity: 0.85,
    });
  }

  page.drawLine({
    start: { x: CONTENT_X0, y: topY - 15 },
    end: { x: CONTENT_X1, y: topY - 15 },
    thickness: 0.7,
    color: brandColors.rule,
  });
  return topY - 38;
}

function drawFirstPageHeader(params: {
  page: PDFPage;
  vm: PdfQuoteViewModel;
  fonts: PdfFonts;
  logo: PDFImage | null;
  layoutPage: QuotePdfLayoutPage | null;
}) {
  const { page, vm, fonts, logo, layoutPage } = params;
  const topY = PAGE_HEIGHT - MARGIN_TOP;

  drawText(page, 'SANCTUARY PERGOLAS', {
    x: CONTENT_X0,
    y: topY,
    size: FONT_SIZES.wordmark,
    font: fonts.medium,
    color: brandColors.accent,
  });

  if (logo) {
    const scale = Math.min(31 / logo.width, 31 / logo.height, 1);
    const width = logo.width * scale;
    const height = logo.height * scale;
    page.drawImage(logo, {
      x: CONTENT_X1 - width,
      y: topY - 5,
      width,
      height,
      opacity: 0.86,
    });
  }

  drawText(page, 'Quote', {
    x: CONTENT_X0,
    y: topY - 58,
    size: FONT_SIZES.title,
    font: fonts.semibold,
    color: brandColors.ink,
  });
  drawRightAligned(
    page,
    `${vm.header.quoteNumber} / V${vm.header.versionNumber}`,
    CONTENT_X1,
    topY - 49,
    FONT_SIZES.quoteRef,
    fonts.medium,
    brandColors.ink,
  );

  const titleRuleY = topY - 73;
  page.drawLine({
    start: { x: CONTENT_X0, y: titleRuleY },
    end: { x: CONTENT_X1, y: titleRuleY },
    thickness: 0.8,
    color: brandColors.ruleStrong,
  });

  const colGap = 24;
  const leftW = 150;
  const middleW = 185;
  const rightW = CONTENT_W - leftW - middleW - colGap * 2;
  const leftX = CONTENT_X0;
  const middleX = leftX + leftW + colGap;
  const rightX = middleX + middleW + colGap;
  const metaTopY = titleRuleY - 28;

  const drawMetaLabel = (label: string, x: number, y: number) => {
    drawText(page, label.toUpperCase(), {
      x,
      y,
      size: FONT_SIZES.eyebrow,
      font: fonts.medium,
      color: brandColors.accent,
    });
  };

  drawMetaLabel('Prepared for', leftX, metaTopY);
  let leftY = metaTopY - 18;
  const clientName = vm.client.name ?? 'Customer';
  const clientNameLines = wrapText(fonts.medium, clientName, FONT_SIZES.metaValue, leftW);
  if (layoutPage) {
    layoutPage.headerClientName = {
      text: clientName,
      xRight: leftX + leftW,
      y: leftY,
    };
  }
  for (const line of clientNameLines) {
    drawText(page, line, {
      x: leftX,
      y: leftY,
      size: FONT_SIZES.metaValue,
      font: fonts.medium,
    });
    leftY -= LINE_HEIGHTS.metaValue;
  }
  const clientAddressLines = vm.client.addressLines.flatMap((line) =>
    wrapText(fonts.regular, line, FONT_SIZES.body, leftW),
  );

  drawMetaLabel('Project', middleX, metaTopY);
  let middleY = metaTopY - 18;
  const projectLines = wrapText(
    fonts.medium,
    vm.header.projectName,
    FONT_SIZES.metaValue,
    middleW,
  );
  for (const line of projectLines) {
    drawText(page, line, {
      x: middleX,
      y: middleY,
      size: FONT_SIZES.metaValue,
      font: fonts.medium,
    });
    middleY -= LINE_HEIGHTS.metaValue;
  }
  if (layoutPage && clientAddressLines.length) {
    layoutPage.headerClientAddress = {
      lines: clientAddressLines,
      xRight: middleX + middleW,
      y: middleY - 2,
    };
  }
  for (const line of clientAddressLines) {
    drawText(page, line, {
      x: middleX,
      y: middleY - 2,
      size: FONT_SIZES.body,
      font: fonts.regular,
      color: brandColors.muted,
    });
    middleY -= LINE_HEIGHTS.body;
  }

  drawMetaLabel('Quote details', rightX, metaTopY);
  let rightY = metaTopY - 18;
  const rightRows = [
    vm.issueDate ? `Issued ${vm.issueDate}` : null,
    vm.expiryDate ? `Valid until ${vm.expiryDate}` : null,
    'Currency NZD',
  ].filter((value): value is string => Boolean(value));
  for (const line of rightRows) {
    for (const wrapped of wrapText(fonts.regular, line, FONT_SIZES.body, rightW)) {
      drawText(page, wrapped, {
        x: rightX,
        y: rightY,
        size: FONT_SIZES.body,
        font: fonts.regular,
        color: brandColors.muted,
      });
      rightY -= LINE_HEIGHTS.body;
    }
  }

  const sanctuaryLines = vm.sanctuaryAddressLines.flatMap((line) =>
    wrapText(fonts.regular, line, FONT_SIZES.body, rightW),
  );
  if (layoutPage) {
    layoutPage.headerWarehouseAddress = {
      lines: vm.sanctuaryAddressLines,
      xRight: rightX + rightW,
      y: rightY - 6,
    };
  }

  const metaBottomY = Math.min(leftY, middleY, rightY);
  let cursorY = metaBottomY - 25;

  if (vm.intro) {
    const introLines = wrapText(fonts.regular, vm.intro, FONT_SIZES.body, CONTENT_W);
    for (const line of introLines) {
      drawText(page, line, {
        x: CONTENT_X0,
        y: cursorY,
        size: FONT_SIZES.body,
        font: fonts.regular,
        color: brandColors.muted,
      });
      cursorY -= LINE_HEIGHTS.body;
    }
    cursorY -= 10;
  }

  return cursorY;
}

function drawPageFooter(params: {
  page: PDFPage;
  vm: PdfQuoteViewModel;
  fonts: PdfFonts;
  pageNumber: number;
  pageCount: number;
}) {
  const { page, vm, fonts, pageNumber, pageCount } = params;
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

export function quotePdfFilename(quoteRef: string, versionNumber: number): string {
  return `${quoteRef}-v${versionNumber}.pdf`;
}

async function generateQuotePdf(
  quote: QuoteVersionDetail,
  options: GeneratePdfOptions = {},
) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  pdfDoc.setTitle(`${quote.quoteRef} v${quote.versionNumber} - Sanctuary Pergolas`);
  pdfDoc.setAuthor('Sanctuary Pergolas');
  pdfDoc.setSubject('Customer quote');
  pdfDoc.setCreator('Sanctuary Pergolas');

  const [regularData, mediumData, semiboldData, logoBytes] = await Promise.all([
    readQuotePdfFont(QUOTE_PDF_FONT_FILES.regular),
    readQuotePdfFont(QUOTE_PDF_FONT_FILES.medium),
    readQuotePdfFont(QUOTE_PDF_FONT_FILES.semibold),
    readQuotePdfImage(QUOTE_PDF_LOGO_FILE),
  ]);

  const fonts: PdfFonts = {
    regular: await pdfDoc.embedFont(regularData, { subset: true }),
    medium: await pdfDoc.embedFont(mediumData, { subset: true }),
    semibold: await pdfDoc.embedFont(semiboldData, { subset: true }),
  };

  let logo: PDFImage | null = null;
  if (logoBytes) {
    try {
      logo = await pdfDoc.embedPng(logoBytes);
    } catch {
      logo = null;
    }
  }

  const vm = buildPdfQuoteViewModel(quote);
  const preparedRows = prepareRows(vm, fonts);
  const layout: QuotePdfLayout | null = options.collectLayout ? { pages: [] } : null;
  const debugBounds = options.debugBounds ?? process.env.PDF_DEBUG_BOUNDS === '1';

  let page!: PDFPage;
  let pageIndex = -1;
  let cursorY = 0;

  const ensureLayoutPage = (): QuotePdfLayoutPage | null => {
    if (!layout) return null;
    if (!layout.pages[pageIndex]) {
      layout.pages[pageIndex] = {
        hasPageBackground: false,
        hasLeftRail: false,
        pageNumber: pageIndex + 1,
        rules: [],
      };
    }
    return layout.pages[pageIndex];
  };

  const recordBottom = (y: number) => {
    const layoutPage = ensureLayoutPage();
    if (!layoutPage) return;
    layoutPage.contentBottomY =
      typeof layoutPage.contentBottomY === 'number'
        ? Math.min(layoutPage.contentBottomY, y)
        : y;
  };

  const recordRule = (
    kind: Parameters<typeof drawRule>[1],
    bounds: Parameters<typeof drawRule>[2],
  ) => {
    const rule = drawRule(page, kind, bounds);
    ensureLayoutPage()?.rules.push(rule);
  };

  const addPage = (first = false) => {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageIndex += 1;
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      color: brandColors.paper,
    });
    page.drawRectangle({
      x: 0,
      y: 0,
      width: RAIL_WIDTH,
      height: PAGE_HEIGHT,
      color: brandColors.accent,
    });
    const layoutPage = ensureLayoutPage();
    if (layoutPage) {
      layoutPage.hasPageBackground = true;
      layoutPage.hasLeftRail = true;
    }

    cursorY = first
      ? drawFirstPageHeader({ page, vm, fonts, logo, layoutPage })
      : continuationHeader(page, vm, fonts, logo);
    recordBottom(cursorY);
  };

  const ensureSpace = (height: number) => {
    if (cursorY - height >= CONTENT_BOTTOM_Y) return false;
    addPage(false);
    return true;
  };

  const drawSectionLabel = (label: string) => {
    drawText(page, label.toUpperCase(), {
      x: CONTENT_X0,
      y: cursorY,
      size: FONT_SIZES.section,
      font: fonts.medium,
      color: brandColors.accent,
    });
    cursorY -= 16;
  };

  const drawItemsHeader = (continued: boolean) => {
    drawSectionLabel(continued ? 'Scope of work - continued' : 'Scope of work');
    const headerY = cursorY;
    drawText(page, 'Description', {
      x: DESCRIPTION_X,
      y: headerY,
      size: FONT_SIZES.tableHeader,
      font: fonts.medium,
      color: brandColors.muted,
    });
    drawRightAligned(
      page,
      'Qty',
      QTY_RIGHT,
      headerY,
      FONT_SIZES.tableHeader,
      fonts.medium,
      brandColors.muted,
    );
    drawRightAligned(
      page,
      'Unit price',
      UNIT_RIGHT,
      headerY,
      FONT_SIZES.tableHeader,
      fonts.medium,
      brandColors.muted,
    );
    drawRightAligned(
      page,
      'Amount NZD',
      AMOUNT_RIGHT,
      headerY,
      FONT_SIZES.tableHeader,
      fonts.medium,
      brandColors.muted,
    );
    const ruleY = headerY - 8;
    recordRule('itemsHeaderUnderline', {
      x0: CONTENT_X0,
      x1: CONTENT_X1,
      y: ruleY,
    });
    cursorY = ruleY - 17;

    const layoutPage = ensureLayoutPage();
    if (layoutPage) {
      layoutPage.tableBounds = {
        x0: CONTENT_X0,
        x1: CONTENT_X1,
        headerBaselineY: headerY,
        headerRuleY: ruleY,
        rowRuleYs: [],
        topY: headerY + 16,
        bottomY: cursorY,
      };
    }
  };

  const startItemsContinuationPage = (rowHeading?: string) => {
    addPage(false);
    drawItemsHeader(true);
    if (rowHeading) {
      const label = `${rowHeading} - continued`;
      for (const line of wrapText(
        fonts.medium,
        label,
        FONT_SIZES.itemHeading,
        DESCRIPTION_W - 8,
      )) {
        drawText(page, line, {
          x: DESCRIPTION_X,
          y: cursorY,
          size: FONT_SIZES.itemHeading,
          font: fonts.medium,
        });
        cursorY -= LINE_HEIGHTS.itemHeading;
      }
      cursorY -= 3;
    }
  };

  addPage(true);
  if (preparedRows.length) {
    ensureSpace(70);
    drawItemsHeader(pageIndex > 0);
  }

  for (const row of preparedRows) {
    const firstLineHeight =
      row.lines[0]?.kind === 'heading'
        ? LINE_HEIGHTS.itemHeading
        : LINE_HEIGHTS.itemBody;
    if (cursorY - firstLineHeight - 16 < CONTENT_BOTTOM_Y) {
      startItemsContinuationPage();
    }

    let numbersDrawn = false;
    for (let lineIndex = 0; lineIndex < row.lines.length; lineIndex += 1) {
      const line = row.lines[lineIndex];
      const isHeading = line.kind === 'heading' || line.kind === 'section';
      const lineHeight = isHeading ? LINE_HEIGHTS.itemHeading : LINE_HEIGHTS.itemBody;
      if (cursorY - lineHeight < CONTENT_BOTTOM_Y) {
        startItemsContinuationPage(row.heading);
      }

      const textX = line.kind === 'bullet' ? DESCRIPTION_X + 11 : DESCRIPTION_X;
      if (line.prefix) {
        drawText(page, line.prefix, {
          x: DESCRIPTION_X,
          y: cursorY,
          size: FONT_SIZES.itemBody,
          font: fonts.regular,
          color: brandColors.muted,
        });
      }
      drawText(page, line.text, {
        x: textX,
        y: cursorY,
        size: isHeading ? FONT_SIZES.itemHeading : FONT_SIZES.itemBody,
        font: isHeading ? fonts.medium : fonts.regular,
        color: isHeading ? brandColors.ink : brandColors.muted,
      });

      if (!numbersDrawn) {
        drawRightAligned(
          page,
          row.qtyText,
          QTY_RIGHT,
          cursorY,
          FONT_SIZES.numeric,
          fonts.regular,
        );
        drawRightAligned(
          page,
          row.unitPrice,
          UNIT_RIGHT,
          cursorY,
          FONT_SIZES.numeric,
          fonts.regular,
        );
        drawRightAligned(
          page,
          row.amount,
          AMOUNT_RIGHT,
          cursorY,
          FONT_SIZES.numeric,
          fonts.medium,
        );
        numbersDrawn = true;
      }

      cursorY -= lineHeight;
      recordBottom(cursorY);
      const tableBounds = ensureLayoutPage()?.tableBounds;
      if (tableBounds) tableBounds.bottomY = cursorY;
    }

    const separatorY = cursorY - 5;
    recordRule('itemsRowSeparator', {
      x0: CONTENT_X0,
      x1: CONTENT_X1,
      y: separatorY,
    });
    const tableBounds = ensureLayoutPage()?.tableBounds;
    if (tableBounds) {
      tableBounds.rowRuleYs.push(separatorY);
      tableBounds.bottomY = separatorY;
    }
    cursorY = separatorY - 13;
    recordBottom(cursorY);
  }

  ensureSpace(184);
  cursorY -= 6;
  const totalsTopY = cursorY;
  recordRule('totalsCeiling', {
    x0: CONTENT_X0,
    x1: CONTENT_X1,
    y: totalsTopY,
  });
  cursorY -= 22;
  drawText(page, 'COMMERCIAL SUMMARY', {
    x: CONTENT_X0,
    y: cursorY,
    size: FONT_SIZES.section,
    font: fonts.medium,
    color: brandColors.accent,
  });

  const totalsX0 = CONTENT_X1 - 238;
  const totalsX1 = CONTENT_X1;
  const totalsHeaderY = cursorY;
  cursorY -= 22;
  const subtotalY = cursorY;
  drawText(page, 'Subtotal excl. GST', {
    x: totalsX0,
    y: subtotalY,
    size: FONT_SIZES.totalLabel,
    font: fonts.medium,
    color: brandColors.muted,
  });
  drawRightAligned(
    page,
    vm.totals.ex,
    totalsX1,
    subtotalY,
    FONT_SIZES.totalValue,
    fonts.regular,
  );

  cursorY -= 18;
  const gstY = cursorY;
  drawText(page, 'GST 15%', {
    x: totalsX0,
    y: gstY,
    size: FONT_SIZES.totalLabel,
    font: fonts.medium,
    color: brandColors.muted,
  });
  drawRightAligned(
    page,
    vm.totals.gst,
    totalsX1,
    gstY,
    FONT_SIZES.totalValue,
    fonts.regular,
  );

  const aboveTotalRuleY = cursorY - 10;
  recordRule('totalsAboveTotal', {
    x0: totalsX0,
    x1: totalsX1,
    y: aboveTotalRuleY,
  });
  cursorY = aboveTotalRuleY - 24;
  const totalY = cursorY;
  drawText(page, 'Total incl. GST', {
    x: totalsX0,
    y: totalY + 3,
    size: FONT_SIZES.totalLabel,
    font: fonts.medium,
    color: brandColors.ink,
  });
  drawRightAligned(
    page,
    vm.totals.inc,
    totalsX1,
    totalY,
    FONT_SIZES.totalStrong,
    fonts.semibold,
  );
  const belowTotalRuleY = cursorY - 10;
  recordRule('totalsBelowTotal', {
    x0: totalsX0,
    x1: totalsX1,
    y: belowTotalRuleY,
  });
  cursorY = belowTotalRuleY - 24;

  const totalsBounds: TotalsBounds = {
    x0: totalsX0,
    x1: totalsX1,
    headerBaselineY: totalsHeaderY,
    ceilingRuleY: totalsTopY,
    subtotalBaselineY: subtotalY,
    gstBaselineY: gstY,
    totalBaselineY: totalY,
    aboveTotalRuleY,
    belowTotalRuleY,
  };
  const totalsLayoutPage = ensureLayoutPage();
  if (totalsLayoutPage) totalsLayoutPage.totalsBounds = totalsBounds;
  recordBottom(cursorY);

  const nextStepLines = wrapText(
    fonts.regular,
    vm.deposit.nextStep,
    FONT_SIZES.body,
    CONTENT_W - 32,
  );
  const nextStepHeight = 29 + nextStepLines.length * LINE_HEIGHTS.body + 13;
  if (ensureSpace(nextStepHeight)) cursorY -= 3;
  const nextStepTopY = cursorY;
  page.drawRectangle({
    x: CONTENT_X0,
    y: cursorY - nextStepHeight + 8,
    width: CONTENT_W,
    height: nextStepHeight,
    color: brandColors.paperStrong,
    borderColor: brandColors.rule,
    borderWidth: 0.7,
  });
  drawText(page, 'AFTER ACCEPTANCE', {
    x: CONTENT_X0 + 16,
    y: cursorY - 17,
    size: FONT_SIZES.section,
    font: fonts.medium,
    color: brandColors.accent,
  });
  cursorY -= 37;
  for (const line of nextStepLines) {
    drawText(page, line, {
      x: CONTENT_X0 + 16,
      y: cursorY,
      size: FONT_SIZES.body,
      font: fonts.regular,
      color: brandColors.ink,
    });
    cursorY -= LINE_HEIGHTS.body;
  }
  const nextStepBottomY = cursorY;
  const paymentLayoutPage = ensureLayoutPage();
  if (paymentLayoutPage) {
    paymentLayoutPage.paymentBlock = {
      topY: nextStepTopY,
      bottomY: nextStepBottomY,
      lineCount: nextStepLines.length,
    };
  }
  cursorY -= 18;
  recordBottom(cursorY);

  if (vm.terms.length) {
    const drawTermsHeader = (continued: boolean) => {
      drawText(page, continued ? 'TERMS - CONTINUED' : 'TERMS', {
        x: CONTENT_X0,
        y: cursorY,
        size: FONT_SIZES.section,
        font: fonts.medium,
        color: brandColors.accent,
      });
      cursorY -= 19;
    };

    ensureSpace(50);
    drawTermsHeader(false);

    for (const term of vm.terms) {
      const wrapped = wrapText(
        fonts.regular,
        term,
        FONT_SIZES.body,
        CONTENT_W - 17,
      );
      for (let index = 0; index < wrapped.length; index += 1) {
        if (cursorY - LINE_HEIGHTS.terms < CONTENT_BOTTOM_Y) {
          addPage(false);
          drawTermsHeader(true);
        }
        if (index === 0) {
          drawText(page, '- ', {
            x: CONTENT_X0,
            y: cursorY,
            size: FONT_SIZES.body,
            font: fonts.regular,
            color: brandColors.accent,
          });
        }
        drawText(page, wrapped[index], {
          x: CONTENT_X0 + 17,
          y: cursorY,
          size: FONT_SIZES.body,
          font: fonts.regular,
          color: brandColors.ink,
        });
        cursorY -= LINE_HEIGHTS.terms;
        const termsLayoutPage = ensureLayoutPage();
        if (termsLayoutPage) {
          termsLayoutPage.termLineCount = (termsLayoutPage.termLineCount ?? 0) + 1;
        }
        recordBottom(cursorY);
      }
      cursorY -= 3;
    }
  }

  const pageCount = pdfDoc.getPageCount();
  pdfDoc.getPages().forEach((pdfPage, index) => {
    drawPageFooter({
      page: pdfPage,
      vm,
      fonts,
      pageNumber: index + 1,
      pageCount,
    });
    if (debugBounds) {
      const pageLayout = layout?.pages[index];
      drawDebugOverlay(pdfPage, {
        tableBounds: pageLayout?.tableBounds,
        totalsBounds: pageLayout?.totalsBounds,
        font: fonts.regular,
      });
    }
  });

  const bytes = await pdfDoc.save();
  return { bytes, layout };
}

export async function generateQuotePdfBytes(
  quote: QuoteVersionDetail,
): Promise<Uint8Array> {
  const result = await generateQuotePdf(quote);
  return result.bytes;
}

export async function generateQuotePdfBytesWithLayout(
  quote: QuoteVersionDetail,
): Promise<{ bytes: Uint8Array; layout: QuotePdfLayout }> {
  const result = await generateQuotePdf(quote, { collectLayout: true });
  if (!result.layout) throw new Error('PDF layout collection was not enabled.');
  return { bytes: result.bytes, layout: result.layout };
}
