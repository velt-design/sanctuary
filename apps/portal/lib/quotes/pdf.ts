import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, rgb, type Color, type PDFImage } from 'pdf-lib';
import { formatQuoteIntroText, formatQuoteLineDescription, formatQuoteTermsText } from '@sp/quote-format';
import { BRAND_ACCENT_PDF_RGB } from '@sp/theme';
import fontkit from './fontkit';
import {
  drawDebugOverlay,
  drawRule,
  type RuleDrawn,
  type TableBounds,
  type TotalsBounds,
} from './pdfLayout';
import type { QuoteStatus, QuoteVersionDetail } from './types';
import { fromCents } from './utils';

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;

const MARGIN_TOP = 54;
const MARGIN_RIGHT = 56;
const MARGIN_BOTTOM = 48;
const MARGIN_LEFT = 48;

const RAIL_WIDTH = 9;

const CONTENT_X0 = MARGIN_LEFT;
const CONTENT_X1 = PAGE_WIDTH - MARGIN_RIGHT;
const CONTENT_W = CONTENT_X1 - CONTENT_X0;

const MONEY_FORMAT = new Intl.NumberFormat('en-NZ', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type PdfQuoteViewModel = {
  header: {
    quoteNumber: string;
    versionNumber: number;
    status: QuoteStatus;
  };
  client: {
    name?: string;
  };
  issueDate?: string;
  expiryDate?: string;
  intro?: string;
  items: Array<{
    heading: string;
    bullets: string[];
    qty: number;
    qtyText: string;
    unitPrice: string;
    amount: string;
  }>;
  totals: {
    inc: string;
    ex: string;
    gst: string;
  };
  terms: string[];
  footer: string[];
};

const theme = {
  colors: {
    textPrimary: rgb(0.1, 0.1, 0.12),
    textMuted: rgb(0.42, 0.42, 0.42),
    accent: rgb(BRAND_ACCENT_PDF_RGB.r, BRAND_ACCENT_PDF_RGB.g, BRAND_ACCENT_PDF_RGB.b),
  },
  sizes: {
    brand: 13.5,
    title: 19.5,
    ref: 11,
    status: 9.5,
    section: 10,
    tableHeader: 9.5,
    descHeading: 10,
    bullet: 9.25,
    numeric: 10,
    totalsLabel: 10,
    totalsValue: 10,
    totalsTotal: 12,
    terms: 9.5,
    footer: 9,
    client: 12,
    date: 9.5,
    miniHeader: 10,
    intro: 10,
  },
  lineHeights: {
    brand: 16,
    title: 24,
    ref: 14,
    status: 12,
    section: 13,
    tableHeader: 12,
    descHeading: 12,
    bullet: 11,
    numeric: 12,
    totalsLabel: 12,
    totalsValue: 12,
    totalsTotal: 14,
    terms: 12,
    footer: 11,
    client: 15,
    date: 12,
    miniHeader: 12,
    intro: 13,
  },
  spacing: {
    headerBrandToQuote: 3,
    headerQuoteToClient: 4,
    headerClientToRef: 8,
    headerQuoteToRef: 10,
    headerRefToStatus: 8,
    headerLogoToDates: 10,
    headerToIntro: 12,
    introToItems: 18,
    sectionToHeader: 6,
    headerToRows: 6,
    bulletGap: 2,
    itemSeparatorOffset: 8,
    itemSeparatorGap: 10,
    itemsToTotalsRule: 18,
    ruleToTotalsLabel: 12,
    totalsToTerms: 18,
    termsToFooter: 16,
    totalsRuleGap: 6,
    continuationHeaderGap: 12,
  },
};

const FONT_FILES = {
  regular: 'Inter-Regular.ttf',
  medium: 'Inter-Medium.ttf',
  semibold: 'Inter-SemiBold.ttf',
};
const HEADER_LOGO_FILE = 'sp_dark_icon.png';

const fontCache = new Map<string, Uint8Array>();
const imageCache = new Map<string, Uint8Array | null>();

async function readFontFile(filename: string): Promise<Uint8Array> {
  if (fontCache.has(filename)) return fontCache.get(filename)!;
  const candidates = [
    path.resolve(process.cwd(), 'assets', 'fonts', filename),
    path.resolve(process.cwd(), 'apps', 'portal', 'assets', 'fonts', filename),
  ];

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const data = await readFile(candidate);
      fontCache.set(filename, data);
      return data;
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(`Missing font file ${filename}. Last error: ${String(lastError)}`);
}

async function readImageFile(filename: string): Promise<Uint8Array | null> {
  if (imageCache.has(filename)) return imageCache.get(filename) ?? null;
  const candidates = [
    path.resolve(process.cwd(), 'public', 'images', filename),
    path.resolve(process.cwd(), 'apps', 'portal', 'public', 'images', filename),
  ];

  for (const candidate of candidates) {
    try {
      const data = await readFile(candidate);
      imageCache.set(filename, data);
      return data;
    } catch {
      // Try the next candidate path.
    }
  }

  imageCache.set(filename, null);
  return null;
}

function formatMoneyFromCents(cents: number): string {
  return `$${MONEY_FORMAT.format(fromCents(cents))}`;
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function addDays(value: string, days: number): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function buildPdfQuoteViewModel(quote: QuoteVersionDetail): PdfQuoteViewModel {
  const issueDate = quote.sentAt ? formatDate(quote.sentAt) : null;
  let expiryDate: string | null = null;
  if (issueDate && quote.sentAt) {
    expiryDate = formatDate(quote.expiresAt ?? null);
    if (!expiryDate) {
      const fallback = addDays(quote.sentAt, 30);
      expiryDate = fallback ? formatDate(fallback) : null;
    }
  }

  const items = quote.lineItems.map((item, index) => {
    const { heading, bullets } = formatQuoteLineDescription(item.description, index);
    const rawQty = Number.isFinite(item.qty) ? item.qty : 0;
    const displayQty = Math.ceil(rawQty);
    const amountCents = Number.isFinite(item.lineTotalIncGstCents) ? item.lineTotalIncGstCents : 0;
    const unitPriceCents = displayQty > 0 ? Math.round(amountCents / displayQty) : 0;
    return {
      heading,
      bullets,
      qty: displayQty,
      qtyText: String(displayQty),
      unitPrice: formatMoneyFromCents(unitPriceCents),
      amount: formatMoneyFromCents(amountCents),
    };
  });

  const terms = formatQuoteTermsText(quote.termsText, { sentAt: quote.sentAt });

  const footer: string[] = ['sanctuarypergolas.co.nz', 'info@sanctuarypergolas.co.nz'];

  const client = {
    name: formatQuoteIntroText(quote.customerName ?? quote.contact.name) ?? undefined,
  };

  return {
    header: {
      quoteNumber: quote.quoteRef,
      versionNumber: quote.versionNumber,
      status: quote.status,
    },
    client,
    issueDate: issueDate ?? undefined,
    expiryDate: expiryDate ?? undefined,
    intro: formatQuoteIntroText(quote.introText) ?? undefined,
    items,
    totals: {
      inc: formatMoneyFromCents(quote.totals.totalIncGstCents),
      ex: formatMoneyFromCents(quote.totals.totalExGstCents),
      gst: formatMoneyFromCents(quote.totals.gstCents),
    },
    terms,
    footer,
  };
}

function wrapText(font: any, text: string, fontSize: number, maxWidth: number): string[] {
  if (maxWidth <= 0) return [text];
  const lines: string[] = [];
  const safeText = typeof text === 'string' ? text : '';
  const paragraphs = safeText.split('\n');

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }

    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, fontSize);
      if (width <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }

  return lines;
}

export function quotePdfFilename(quoteRef: string, versionNumber: number): string {
  return `${quoteRef}-v${versionNumber}.pdf`;
}

type QuotePdfLayoutPage = {
  hasLeftRail: boolean;
  headerClientName?: { text: string; xRight: number; y: number };
  tableBounds?: TableBounds | null;
  totalsBounds?: TotalsBounds | null;
  rules: RuleDrawn[];
};

export type QuotePdfLayout = {
  pages: QuotePdfLayoutPage[];
};

type GeneratePdfOptions = {
  collectLayout?: boolean;
  debugBounds?: boolean;
};

async function generateQuotePdf(quote: QuoteVersionDetail, options: GeneratePdfOptions = {}) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const [regularData, mediumData, semiboldData] = await Promise.all([
    readFontFile(FONT_FILES.regular),
    readFontFile(FONT_FILES.medium),
    readFontFile(FONT_FILES.semibold),
  ]);

  const fontRegular = await pdfDoc.embedFont(regularData);
  const fontMedium = await pdfDoc.embedFont(mediumData);
  const fontSemiBold = await pdfDoc.embedFont(semiboldData);
  const logoBytes = await readImageFile(HEADER_LOGO_FILE);
  let headerLogo: PDFImage | null = null;
  if (logoBytes) {
    try {
      headerLogo = await pdfDoc.embedPng(logoBytes);
    } catch {
      // Keep PDF generation resilient if the logo asset is invalid.
      headerLogo = null;
    }
  }

  const vm = buildPdfQuoteViewModel(quote);
  const debugBounds = options.debugBounds ?? process.env.PDF_DEBUG_BOUNDS === '1';
  const collectLayout = Boolean(options.collectLayout);
  const layout: QuotePdfLayout | null = collectLayout ? { pages: [] } : null;
  let pageIndex = 0;

  const tableX0 = CONTENT_X0;
  const tableX1 = CONTENT_X1;
  const tableWidth = tableX1 - tableX0;
  const descW = tableWidth * 0.62;
  const qtyW = tableWidth * 0.12;
  const unitW = tableWidth * 0.13;
  const amtW = tableWidth * 0.13;
  const descX = tableX0;
  const qtyX = descX + descW;
  const unitX = qtyX + qtyW;
  const amtX = unitX + unitW;
  const qtyRight = qtyX + qtyW;
  const unitRight = unitX + unitW;
  const amtRight = amtX + amtW;
  const bulletIndent = fontRegular.widthOfTextAtSize('- ', theme.sizes.bullet) + 2;
  const totalsValueRightX = CONTENT_X1;
  const totalsColGap = 18;
  const totalsLabels = ['SUBTOTAL NZD', 'INCLUDES GST 15%', 'TOTAL NZD'];
  const maxLabelW = Math.max(
    ...totalsLabels.map((label) => fontMedium.widthOfTextAtSize(label, theme.sizes.totalsLabel)),
  );
  const maxValueW = Math.max(
    fontRegular.widthOfTextAtSize(vm.totals.ex, theme.sizes.totalsValue),
    fontRegular.widthOfTextAtSize(vm.totals.gst, theme.sizes.totalsValue),
    fontSemiBold.widthOfTextAtSize(vm.totals.inc, theme.sizes.totalsTotal),
  );
  const totalsLabelLeftX = totalsValueRightX - maxValueW - totalsColGap - maxLabelW;
  const totalsX0 = totalsLabelLeftX;
  const totalsX1 = totalsValueRightX;

  type RowLayout = {
    headingLines: string[];
    bulletLines: string[][];
    bulletLineCount: number;
    blockHeight: number;
    qtyText: string;
    unitPrice: string;
    amount: string;
  };

  const rowLayouts: RowLayout[] = vm.items.map((item) => {
    const headingLines = wrapText(fontMedium, item.heading, theme.sizes.descHeading, descW);
    const bulletLines = item.bullets.map((bullet) =>
      wrapText(fontRegular, bullet, theme.sizes.bullet, descW - bulletIndent),
    );
    const bulletLineCount = bulletLines.reduce((sum, lines) => sum + lines.length, 0);
    const contentHeight =
      headingLines.length * theme.lineHeights.descHeading +
      (bulletLineCount ? theme.spacing.bulletGap + bulletLineCount * theme.lineHeights.bullet : 0);
    const lastLineHeight = bulletLineCount ? theme.lineHeights.bullet : theme.lineHeights.descHeading;
    const blockHeight = contentHeight - lastLineHeight + theme.spacing.itemSeparatorOffset;
    return {
      headingLines,
      bulletLines,
      bulletLineCount,
      blockHeight,
      qtyText: item.qtyText,
      unitPrice: item.unitPrice,
      amount: item.amount,
    };
  });

  const tableHeaderHeight =
    theme.lineHeights.section + theme.spacing.sectionToHeader + theme.lineHeights.tableHeader + theme.spacing.headerToRows;

  const termsLines: string[] = [];
  vm.terms.forEach((term) => {
    const wrapped = wrapText(fontRegular, term, theme.sizes.terms, CONTENT_W);
    termsLines.push(...wrapped);
  });

  const footerLines = vm.footer;
  const footerTopY = footerLines.length
    ? MARGIN_BOTTOM + (footerLines.length - 1) * theme.lineHeights.footer
    : MARGIN_BOTTOM;

  const termsBottomY = footerTopY + theme.spacing.termsToFooter;
  const termsTopY = termsLines.length
    ? termsBottomY + theme.lineHeights.section + theme.spacing.sectionToHeader + theme.lineHeights.terms * Math.max(termsLines.length - 1, 0)
    : termsBottomY;

  const totalsRuleInset = 2;
  const totalsRuleBelowRatio = 0.7;
  const totalsRowGap = theme.lineHeights.totalsLabel;
  const totalsBlockHeight =
    theme.lineHeights.section +
    theme.spacing.sectionToHeader +
    theme.lineHeights.totalsLabel +
    theme.lineHeights.totalsLabel +
    totalsRuleInset +
    theme.spacing.totalsRuleGap +
    totalsRowGap * totalsRuleBelowRatio;

  const totalsBlockBottomY = termsTopY + theme.spacing.totalsToTerms;
  const totalsTopY = totalsBlockBottomY + totalsBlockHeight;

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const firstPage = page;

  const toText = (value: unknown): string | null => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return null;
  };

  const drawTextSafe = (value: unknown, options: { x: number; y: number; size: number; font: any; color: Color }) => {
    const text = toText(value);
    if (!text) return;
    page.drawText(text, options);
  };

  const measureText = (font: any, value: unknown, size: number) => {
    const text = toText(value) ?? '';
    return font.widthOfTextAtSize(text, size);
  };

  const drawRightAligned = (value: unknown, xRight: number, y: number, size: number, font: any, color: Color) => {
    const text = toText(value);
    if (!text) return;
    const width = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: xRight - width, y, size, font, color });
  };

  const ensureLayoutPage = (index: number) => {
    if (!layout) return null;
    if (!layout.pages[index]) {
      layout.pages[index] = { hasLeftRail: false, rules: [] };
    }
    return layout.pages[index];
  };

  const currentLayoutPage = () => ensureLayoutPage(pageIndex);

  const recordRule = (kind: Parameters<typeof drawRule>[1], bounds: Parameters<typeof drawRule>[2]) => {
    const rule = drawRule(page, kind, bounds);
    const layoutPage = currentLayoutPage();
    if (layoutPage) {
      layoutPage.rules.push(rule);
    }
  };

  const drawLeftRail = () => {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: RAIL_WIDTH,
      height: PAGE_HEIGHT,
      color: theme.colors.accent,
    });
    const layoutPage = currentLayoutPage();
    if (layoutPage) {
      layoutPage.hasLeftRail = true;
    }
  };

  const drawStatusBadge = (text: string, x: number, y: number) => {
    const safeText = toText(text) ?? 'DRAFT';
    const size = theme.sizes.status;
    const paddingX = 5;
    const paddingY = 2;
    const width = measureText(fontMedium, safeText, size) + paddingX * 2;
    const height = size + paddingY * 2;

    page.drawRectangle({
      x,
      y: y - paddingY,
      width,
      height,
      borderWidth: 0.6,
      borderColor: theme.colors.accent,
    });

    drawTextSafe(safeText, {
      x: x + paddingX,
      y,
      size,
      font: fontMedium,
      color: theme.colors.accent,
    });

    return y - paddingY;
  };

  const itemsHeaderUnderlineOffset = 6;

  const layoutItemsTable = (params: { topY: number; rows: RowLayout[] }): TableBounds => {
    let y = params.topY;

    y -= theme.lineHeights.section;
    y -= theme.spacing.sectionToHeader;

    const headerBaselineY = y;
    const headerRuleY = headerBaselineY - itemsHeaderUnderlineOffset;

    y = headerBaselineY - theme.lineHeights.tableHeader;
    y -= theme.spacing.headerToRows;

    const rowRuleYs: number[] = [];
    let bottomBaselineY = y;

    params.rows.forEach((row, idx) => {
      let rowY = y;
      let lastBaselineY = rowY;
      row.headingLines.forEach(() => {
        lastBaselineY = rowY;
        rowY -= theme.lineHeights.descHeading;
      });

      if (row.bulletLineCount) {
        rowY -= theme.spacing.bulletGap;
        row.bulletLines.forEach((lines) => {
          lines.forEach(() => {
            lastBaselineY = rowY;
            rowY -= theme.lineHeights.bullet;
          });
        });
      }

      const itemSeparatorY = lastBaselineY - theme.spacing.itemSeparatorOffset;
      rowRuleYs.push(itemSeparatorY);
      bottomBaselineY = itemSeparatorY;

      if (idx < params.rows.length - 1) {
        rowY = itemSeparatorY - theme.spacing.itemSeparatorGap;
      } else {
        rowY = itemSeparatorY;
      }

      y = rowY;
    });

    return {
      x0: tableX0,
      x1: tableX1,
      headerBaselineY,
      headerRuleY,
      rowRuleYs,
      topY: params.topY,
      bottomY: bottomBaselineY,
    };
  };

  const drawItemsTable = (params: { topY: number; rows: RowLayout[]; sectionTitle: string; bounds: TableBounds }) => {
    let y = params.bounds.topY;

    drawTextSafe(params.sectionTitle, {
      x: CONTENT_X0,
      y,
      size: theme.sizes.section,
      font: fontMedium,
      color: theme.colors.accent,
    });
    y -= theme.lineHeights.section;
    y -= theme.spacing.sectionToHeader;

    const headerY = params.bounds.headerBaselineY;
    drawTextSafe('Description', {
      x: descX,
      y: headerY,
      size: theme.sizes.tableHeader,
      font: fontMedium,
      color: theme.colors.textPrimary,
    });
    drawRightAligned('Quantity', qtyRight, headerY, theme.sizes.tableHeader, fontMedium, theme.colors.textPrimary);
    drawRightAligned('Unit Price', unitRight, headerY, theme.sizes.tableHeader, fontMedium, theme.colors.textPrimary);
    drawRightAligned('Amount NZD', amtRight, headerY, theme.sizes.tableHeader, fontMedium, theme.colors.textPrimary);

    recordRule('itemsHeaderUnderline', { x0: tableX0, x1: tableX1, y: params.bounds.headerRuleY });

    y = headerY - theme.lineHeights.tableHeader;
    y -= theme.spacing.headerToRows;

    let ruleIndex = 0;

    params.rows.forEach((row, idx) => {
      let rowY = y;
      let lastBaselineY = rowY;
      row.headingLines.forEach((line, lineIndex) => {
        lastBaselineY = rowY;
        drawTextSafe(line, {
          x: descX,
          y: rowY,
          size: theme.sizes.descHeading,
          font: fontMedium,
          color: theme.colors.textPrimary,
        });

        if (lineIndex === 0) {
          drawRightAligned(row.qtyText, qtyRight, rowY, theme.sizes.numeric, fontRegular, theme.colors.textPrimary);
          drawRightAligned(row.unitPrice, unitRight, rowY, theme.sizes.numeric, fontRegular, theme.colors.textPrimary);
          drawRightAligned(row.amount, amtRight, rowY, theme.sizes.numeric, fontRegular, theme.colors.textPrimary);
        }

        rowY -= theme.lineHeights.descHeading;
      });

      if (row.bulletLineCount) {
        rowY -= theme.spacing.bulletGap;
        row.bulletLines.forEach((lines) => {
          lines.forEach((line, lineIndex) => {
            lastBaselineY = rowY;
            if (lineIndex === 0) {
              drawTextSafe('- ', {
                x: descX,
                y: rowY,
                size: theme.sizes.bullet,
                font: fontRegular,
                color: theme.colors.textMuted,
              });
            }
            drawTextSafe(line, {
              x: descX + bulletIndent,
              y: rowY,
              size: theme.sizes.bullet,
              font: fontRegular,
              color: theme.colors.textMuted,
            });
            rowY -= theme.lineHeights.bullet;
          });
        });
      }

      const ruleY = params.bounds.rowRuleYs[ruleIndex] ?? (lastBaselineY - theme.spacing.itemSeparatorOffset);
      recordRule('itemsRowSeparator', { x0: tableX0, x1: tableX1, y: ruleY });
      ruleIndex += 1;
      if (idx < params.rows.length - 1) {
        rowY = ruleY - theme.spacing.itemSeparatorGap;
      } else {
        rowY = ruleY;
      }

      y = rowY;
    });
  };

  const layoutTotalsBlock = (topY: number): TotalsBounds => {
    const headerBaselineY = topY;
    const subtotalBaselineY = headerBaselineY - theme.lineHeights.section - theme.spacing.sectionToHeader;
    const gstBaselineY = subtotalBaselineY - theme.lineHeights.totalsLabel;
    const totalBaselineY = gstBaselineY - theme.lineHeights.totalsLabel - totalsRuleInset - theme.spacing.totalsRuleGap;
    const ceilingRuleY = headerBaselineY + theme.spacing.ruleToTotalsLabel;
    const minClearance = 3;
    const gstTextY = gstBaselineY;
    const totalTextY = totalBaselineY;
    const totalFontSize = Math.max(theme.sizes.totalsLabel, theme.sizes.totalsTotal);
    const totalTopY = totalTextY + totalFontSize;
    const gstBottomY = gstTextY;
    const gap = gstBottomY - totalTopY;
    const aboveTotalRuleY =
      gap > 2 * minClearance ? totalTopY + gap / 2 : totalTopY + minClearance;
    const rowGap = subtotalBaselineY - gstBaselineY;
    const belowTotalRuleY = totalBaselineY - rowGap * totalsRuleBelowRatio;

    return {
      x0: totalsX0,
      x1: totalsX1,
      headerBaselineY,
      ceilingRuleY,
      subtotalBaselineY,
      gstBaselineY,
      totalBaselineY,
      aboveTotalRuleY,
      belowTotalRuleY,
    };
  };

  const drawTotalsBlock = (bounds: TotalsBounds) => {
    drawTextSafe('TOTALS', {
      x: totalsX0,
      y: bounds.headerBaselineY,
      size: theme.sizes.section,
      font: fontMedium,
      color: theme.colors.accent,
    });

    drawTextSafe('SUBTOTAL NZD', {
      x: totalsX0,
      y: bounds.subtotalBaselineY,
      size: theme.sizes.totalsLabel,
      font: fontMedium,
      color: theme.colors.textPrimary,
    });
    drawRightAligned(
      vm.totals.ex,
      totalsX1,
      bounds.subtotalBaselineY,
      theme.sizes.totalsValue,
      fontRegular,
      theme.colors.textPrimary,
    );

    drawTextSafe('INCLUDES GST 15%', {
      x: totalsX0,
      y: bounds.gstBaselineY,
      size: theme.sizes.totalsLabel,
      font: fontMedium,
      color: theme.colors.textPrimary,
    });
    drawRightAligned(
      vm.totals.gst,
      totalsX1,
      bounds.gstBaselineY,
      theme.sizes.totalsValue,
      fontRegular,
      theme.colors.textPrimary,
    );

    recordRule('totalsAboveTotal', { x0: totalsX0, x1: totalsX1, y: bounds.aboveTotalRuleY });

    drawTextSafe('TOTAL NZD', {
      x: totalsX0,
      y: bounds.totalBaselineY,
      size: theme.sizes.totalsLabel,
      font: fontMedium,
      color: theme.colors.textPrimary,
    });
    drawRightAligned(
      vm.totals.inc,
      totalsX1,
      bounds.totalBaselineY,
      theme.sizes.totalsTotal,
      fontSemiBold,
      theme.colors.textPrimary,
    );

    recordRule('totalsBelowTotal', { x0: totalsX0, x1: totalsX1, y: bounds.belowTotalRuleY });
  };

  const drawTermsBlock = (topY: number) => {
    if (!termsLines.length) return topY;
    let y = topY;
    drawTextSafe('TERMS', {
      x: tableX0,
      y,
      size: theme.sizes.section,
      font: fontMedium,
      color: theme.colors.accent,
    });
    y -= theme.lineHeights.section;
    y -= theme.spacing.sectionToHeader;
    termsLines.forEach((line) => {
      drawTextSafe(line, {
        x: tableX0,
        y,
        size: theme.sizes.terms,
        font: fontRegular,
        color: theme.colors.textPrimary,
      });
      y -= theme.lineHeights.terms;
    });
    return y + theme.lineHeights.terms;
  };

  const drawFooterBlock = (bottomY: number) => {
    if (!footerLines.length) return bottomY;
    let y = bottomY;
    for (let i = footerLines.length - 1; i >= 0; i -= 1) {
      drawTextSafe(footerLines[i], {
        x: CONTENT_X0,
        y,
        size: theme.sizes.footer,
        font: fontRegular,
        color: theme.colors.textMuted,
      });
      y += theme.lineHeights.footer;
    }
    return y - theme.lineHeights.footer;
  };

  const drawContinuationHeader = () => {
    let y = PAGE_HEIGHT - MARGIN_TOP;
    drawTextSafe('SANCTUARY PERGOLAS', {
      x: CONTENT_X0,
      y,
      size: theme.sizes.miniHeader,
      font: fontMedium,
      color: theme.colors.textMuted,
    });
    const refLine = `${vm.header.quoteNumber} • v${vm.header.versionNumber}`;
    drawRightAligned(refLine, CONTENT_X1, y, theme.sizes.miniHeader, fontMedium, theme.colors.textMuted);
    y -= theme.lineHeights.miniHeader;
    y -= theme.spacing.continuationHeaderGap;
    return y;
  };

  const fitRowsToHeight = (availableHeight: number, rows: RowLayout[]) => {
    let used = 0;
    let count = 0;
    rows.forEach((row) => {
      const add = row.blockHeight + (count > 0 ? theme.spacing.itemSeparatorGap : 0);
      if (used + add <= availableHeight) {
        used += add;
        count += 1;
      }
    });
    return count;
  };

  drawLeftRail();

  let cursorY = PAGE_HEIGHT - MARGIN_TOP;
  const headerClientMaxWidth = CONTENT_W * 0.58;
  const headerLogoMaxWidth = 84;
  const headerLogoMaxHeight = 52;

  // Header left column
  let leftY = cursorY;
  drawTextSafe('SANCTUARY PERGOLAS', {
    x: CONTENT_X0,
    y: leftY,
    size: theme.sizes.brand,
    font: fontMedium,
    color: theme.colors.textMuted,
  });

  leftY -= theme.lineHeights.brand;
  leftY -= theme.spacing.headerBrandToQuote;

  drawTextSafe('Quote', {
    x: CONTENT_X0,
    y: leftY,
    size: theme.sizes.title,
    font: fontSemiBold,
    color: theme.colors.textPrimary,
  });

  leftY -= theme.lineHeights.title;
  if (vm.client.name) {
    leftY -= theme.spacing.headerQuoteToClient;
    const clientLines = wrapText(fontSemiBold, vm.client.name, theme.sizes.client, headerClientMaxWidth);
    if (clientLines.length) {
      const layoutPage = currentLayoutPage();
      if (layoutPage) {
        layoutPage.headerClientName = {
          text: vm.client.name,
          xRight: CONTENT_X0 + headerClientMaxWidth,
          y: leftY,
        };
      }
      clientLines.forEach((line) => {
        drawTextSafe(line, {
          x: CONTENT_X0,
          y: leftY,
          size: theme.sizes.client,
          font: fontSemiBold,
          color: theme.colors.textPrimary,
        });
        leftY -= theme.lineHeights.client;
      });
      leftY -= theme.spacing.headerClientToRef;
    } else {
      leftY -= theme.spacing.headerQuoteToRef;
    }
  } else {
    leftY -= theme.spacing.headerQuoteToRef;
  }

  const refLine = `${vm.header.quoteNumber} • v${vm.header.versionNumber}`;
  drawTextSafe(refLine, {
    x: CONTENT_X0,
    y: leftY,
    size: theme.sizes.ref,
    font: fontMedium,
    color: theme.colors.textMuted,
  });

  leftY -= theme.lineHeights.ref;
  leftY -= theme.spacing.headerRefToStatus;

  const leftBottomY = drawStatusBadge(vm.header.status, CONTENT_X0, leftY);

  // Header right column
  let rightY = cursorY;
  let rightBottomY = cursorY;

  if (headerLogo) {
    const logoScale = Math.min(
      headerLogoMaxWidth / headerLogo.width,
      headerLogoMaxHeight / headerLogo.height,
      1,
    );
    const logoWidth = headerLogo.width * logoScale;
    const logoHeight = headerLogo.height * logoScale;
    const logoX = CONTENT_X1 - logoWidth;
    const logoTopY = cursorY + theme.lineHeights.brand + 2;
    const logoY = logoTopY - logoHeight;
    page.drawImage(headerLogo, {
      x: logoX,
      y: logoY,
      width: logoWidth,
      height: logoHeight,
    });
    rightY = logoY - theme.spacing.headerLogoToDates;
    rightBottomY = logoY;
  }

  if (vm.issueDate) {
    drawRightAligned(`Issue date ${vm.issueDate}`, CONTENT_X1, rightY, theme.sizes.date, fontRegular, theme.colors.textMuted);
    rightBottomY = Math.min(rightBottomY, rightY);
    rightY -= theme.lineHeights.date;
  }

  if (vm.expiryDate) {
    drawRightAligned(`Expiry ${vm.expiryDate}`, CONTENT_X1, rightY, theme.sizes.date, fontRegular, theme.colors.textMuted);
    rightBottomY = Math.min(rightBottomY, rightY);
  }

  cursorY = Math.min(leftBottomY, rightBottomY);

  if (vm.intro) {
    const introLines = wrapText(fontRegular, vm.intro, theme.sizes.intro, CONTENT_W);
    if (introLines.length) {
      cursorY -= theme.spacing.headerToIntro;
      introLines.forEach((line) => {
        drawTextSafe(line, {
          x: CONTENT_X0,
          y: cursorY,
          size: theme.sizes.intro,
          font: fontRegular,
          color: theme.colors.textMuted,
        });
        cursorY -= theme.lineHeights.intro;
      });
      cursorY += theme.lineHeights.intro;
    }
  }

  const GAP_ITEMS_TO_TOTALS_MIN = 36;
  const GAP_ITEMS_TO_TOTALS_MAX = 72;
  const GAP_ITEMS_TO_TOTALS_TARGET = 54;
  const ITEMS_START_SHIFT_LIMIT = 24;
  const INTRO_ITEMS_GAP_MIN = 12;
  const INTRO_ITEMS_GAP_MAX = 30;

  const clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const introBottomY = cursorY;
  const itemsTopY = introBottomY - theme.spacing.introToItems;
  const totalsBounds = layoutTotalsBlock(totalsTopY);
  const itemsBottomLimitY = totalsBounds.ceilingRuleY + GAP_ITEMS_TO_TOTALS_MIN;
  let itemsStartY = itemsTopY;

  const planItemsLayout = (startY: number, rows: RowLayout[]) => {
    const availableHeight = startY - itemsBottomLimitY;
    const availableRowsHeight = Math.max(0, availableHeight - tableHeaderHeight);
    let rowsOnPage = fitRowsToHeight(availableRowsHeight, rows);

    if (rowsOnPage === 0 && rows.length && availableRowsHeight > 0) {
      rowsOnPage = 1;
    }

    let tableBounds = rowsOnPage ? layoutItemsTable({ topY: startY, rows: rows.slice(0, rowsOnPage) }) : null;
    while (rowsOnPage > 0 && tableBounds && tableBounds.bottomY < itemsBottomLimitY) {
      rowsOnPage -= 1;
      tableBounds = rowsOnPage ? layoutItemsTable({ topY: startY, rows: rows.slice(0, rowsOnPage) }) : null;
    }

    const pageRows = rows.slice(0, rowsOnPage);
    const remainingRows = rows.slice(rowsOnPage);

    return { tableBounds, pageRows, remainingRows };
  };

  let plannedLayout = rowLayouts.length ? planItemsLayout(itemsStartY, rowLayouts) : null;
  if (plannedLayout?.tableBounds && plannedLayout.remainingRows.length === 0) {
    const lastItemBottomY = plannedLayout.tableBounds.bottomY;
    const totalsCeilingY = totalsBounds.ceilingRuleY;
    const currentGap = lastItemBottomY - totalsCeilingY;

    let deltaY = 0;
    if (currentGap > GAP_ITEMS_TO_TOTALS_MAX) {
      const shiftDown = Math.min(currentGap - GAP_ITEMS_TO_TOTALS_TARGET, currentGap - GAP_ITEMS_TO_TOTALS_MIN);
      deltaY = -shiftDown;
    } else if (currentGap < GAP_ITEMS_TO_TOTALS_MIN) {
      const shiftUp = Math.min(GAP_ITEMS_TO_TOTALS_MIN - currentGap, GAP_ITEMS_TO_TOTALS_TARGET - currentGap);
      deltaY = shiftUp;
    }

    if (deltaY !== 0) {
      deltaY = clampValue(deltaY, -ITEMS_START_SHIFT_LIMIT, ITEMS_START_SHIFT_LIMIT);
      const minStartY = introBottomY - INTRO_ITEMS_GAP_MAX;
      const maxStartY = introBottomY - INTRO_ITEMS_GAP_MIN;
      const adjustedStartY = clampValue(itemsStartY + deltaY, minStartY, maxStartY);
      if (adjustedStartY !== itemsStartY) {
        const adjustedLayout = planItemsLayout(adjustedStartY, rowLayouts);
        if (adjustedLayout.remainingRows.length === 0) {
          itemsStartY = adjustedStartY;
          plannedLayout = adjustedLayout;
        }
      }
    }
  }
  let pageOneTableBounds: TableBounds | null = null;
  const pageOneLayout = currentLayoutPage();
  if (pageOneLayout) {
    pageOneLayout.totalsBounds = totalsBounds;
  }

  if (rowLayouts.length) {
    const effectiveLayout = plannedLayout ?? planItemsLayout(itemsStartY, rowLayouts);
    const { tableBounds, pageRows, remainingRows } = effectiveLayout;

    if (pageRows.length && tableBounds) {
      drawItemsTable({ topY: itemsStartY, rows: pageRows, sectionTitle: 'ITEMS', bounds: tableBounds });
      pageOneTableBounds = tableBounds;
      const layoutPage = currentLayoutPage();
      if (layoutPage) {
        layoutPage.tableBounds = tableBounds;
      }
    }

    if (remainingRows.length) {
      let overflowRows = remainingRows;
      while (overflowRows.length) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        pageIndex += 1;
        drawLeftRail();

        const continuationTopY = drawContinuationHeader();
        const continuationAvailable = Math.max(0, continuationTopY - MARGIN_BOTTOM - tableHeaderHeight);
        let rowsCount = fitRowsToHeight(continuationAvailable, overflowRows);
        if (rowsCount === 0) rowsCount = Math.min(1, overflowRows.length);
        const nextRows = overflowRows.slice(0, rowsCount);
        overflowRows = overflowRows.slice(rowsCount);

        const continuationBounds = layoutItemsTable({ topY: continuationTopY, rows: nextRows });
        drawItemsTable({
          topY: continuationTopY,
          rows: nextRows,
          sectionTitle: 'ITEMS (continued)',
          bounds: continuationBounds,
        });
        const layoutPage = currentLayoutPage();
        if (layoutPage) {
          layoutPage.tableBounds = continuationBounds;
        }
        if (debugBounds) {
          drawDebugOverlay(page, { tableBounds: continuationBounds, totalsBounds: null, font: fontRegular });
        }
      }
    }
  }

  page = firstPage;
  pageIndex = 0;
  recordRule('totalsCeiling', { x0: tableX0, x1: tableX1, y: totalsBounds.ceilingRuleY });
  drawTotalsBlock(totalsBounds);
  drawTermsBlock(termsTopY);
  drawFooterBlock(MARGIN_BOTTOM);
  if (debugBounds) {
    drawDebugOverlay(page, {
      tableBounds: pageOneTableBounds,
      totalsBounds,
      font: fontRegular,
    });
  }

  const bytes = await pdfDoc.save();
  return { bytes, layout };
}

export async function generateQuotePdfBytes(quote: QuoteVersionDetail): Promise<Uint8Array> {
  const result = await generateQuotePdf(quote);
  return result.bytes;
}

export async function generateQuotePdfBytesWithLayout(
  quote: QuoteVersionDetail,
): Promise<{ bytes: Uint8Array; layout: QuotePdfLayout }> {
  const result = await generateQuotePdf(quote, { collectLayout: true });
  if (!result.layout) {
    throw new Error('PDF layout collection was not enabled.');
  }
  return { bytes: result.bytes, layout: result.layout };
}

