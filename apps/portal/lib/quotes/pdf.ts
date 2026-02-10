import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, rgb, type Color } from 'pdf-lib';
import fontkit from './fontkit';
import type { QuoteStatus, QuoteVersionDetail } from './types';
import { fromCents } from './utils';

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;

const MARGIN_L = 56;
const MARGIN_R = 56;
const MARGIN_B = 48;
const TOP_BAR_HEIGHT = 18;
const CONTENT_TOP_Y = PAGE_HEIGHT - TOP_BAR_HEIGHT - 24;

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
    rule: rgb(0.84, 0.84, 0.84),
    accent: rgb(0.502, 0.251, 0.224),
  },
  sizes: {
    brand: 12,
    title: 18,
    ref: 10,
    status: 9,
    section: 9,
    tableHeader: 8.5,
    descHeading: 8.5,
    bullet: 8,
    numeric: 8.5,
    totalsLabel: 8.5,
    totalsValue: 8.5,
    totalsTotal: 10,
    terms: 8.5,
    footer: 8,
    client: 12,
    date: 8.5,
    miniHeader: 10,
    intro: 8.5,
  },
  lineHeights: {
    brand: 14,
    title: 22,
    ref: 13,
    status: 12,
    section: 12,
    tableHeader: 11,
    descHeading: 11,
    bullet: 10,
    numeric: 11,
    totalsLabel: 11,
    totalsValue: 11,
    totalsTotal: 13,
    terms: 11,
    footer: 10,
    client: 14,
    date: 11,
    miniHeader: 12,
    intro: 11,
  },
  spacing: {
    headerBrandToQuote: 2,
    headerQuoteToRef: 12,
    headerRefToStatus: 10,
    headerToItems: 18,
    sectionToHeader: 6,
    headerToRows: 6,
    rowGap: 6,
    bulletGap: 2,
    footerTerms: 16,
    termsTotals: 18,
    totalsItems: 18,
    introGap: 12,
    totalsRuleGap: 6,
    continuationHeaderGap: 12,
  },
};

const FONT_FILES = {
  regular: 'Inter-Regular.ttf',
  medium: 'Inter-Medium.ttf',
  semibold: 'Inter-SemiBold.ttf',
};

const fontCache = new Map<string, Uint8Array>();

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

function formatMoneyFromCents(cents: number): string {
  return MONEY_FORMAT.format(fromCents(cents));
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

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^[-—–\s]+$/,
  /\bundefined\b/i,
  /\bnull\b/i,
  /\bdefault\b/i,
  /[—-]\s*mm\s*x\s*[—-]\s*mm/i,
  /\benter\b/i,
];

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

function sanitizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isPlaceholder(trimmed)) return null;
  const compact = trimmed.replace(/\s+/g, ' ');
  if (isPlaceholder(compact)) return null;
  return compact;
}

function toTitleCaseToken(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)\S/g, (m) => m.toUpperCase());
}

function ensureTrailingColon(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'Item:';
  return trimmed.endsWith(':') ? trimmed : `${trimmed}:`;
}

function formatHeadingValue(value: string): string {
  const clean = sanitizeText(value) ?? value.trim();
  if (!clean) return value;
  if (clean === clean.toLowerCase() || /[_-]/.test(clean)) {
    return toTitleCaseToken(clean);
  }
  return clean;
}

const CONNECTION_KEY_LABELS: Record<string, string> = {
  house: 'House connection',
  posts: 'Post fixings',
};

const CONNECTION_VALUE_LABELS: Record<string, string> = {
  soffit: 'Soffit brackets',
  deck_bracket: 'Deck brackets',
};

function mapTokenValue(value: string): string {
  const lower = value.toLowerCase();
  if (CONNECTION_VALUE_LABELS[lower]) return CONNECTION_VALUE_LABELS[lower];
  if (/[_-]/.test(value)) return toTitleCaseToken(value);
  return value;
}

function mapTokenKey(value: string): string {
  const lower = value.toLowerCase();
  if (CONNECTION_KEY_LABELS[lower]) return CONNECTION_KEY_LABELS[lower];
  if (/[_-]/.test(value)) return toTitleCaseToken(value);
  return value;
}

function expandConnections(raw: string): string[] {
  const pairs = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const lines: string[] = [];
  pairs.forEach((pair) => {
    const [rawKey, rawValue] = pair.split('=').map((part) => part.trim());
    if (!rawKey || !rawValue) return;
    const keyLabel = mapTokenKey(rawKey);
    const valueClean = sanitizeText(rawValue);
    if (!valueClean) return;
    const valueLabel = mapTokenValue(valueClean);
    if (!sanitizeText(valueLabel)) return;
    lines.push(`${keyLabel}: ${valueLabel}`);
  });

  return lines;
}

function sanitizeBulletLine(raw: string): string[] {
  const stripped = raw.replace(/^[-•]\s*/, '').trim();
  if (!stripped) return [];
  if (isPlaceholder(stripped)) return [];

  const connectionMatch = stripped.match(/^Connections\s*:\s*(.+)$/i);
  if (connectionMatch) {
    return expandConnections(connectionMatch[1]);
  }

  const kvMatch = stripped.match(/^([^:]+):\s*(.+)$/);
  if (kvMatch) {
    const key = sanitizeText(kvMatch[1]);
    const value = sanitizeText(kvMatch[2]);
    if (!key || !value) return [];
    const valueLabel = mapTokenValue(value);
    if (!sanitizeText(valueLabel)) return [];
    return [`${key}: ${valueLabel}`];
  }

  const clean = sanitizeText(stripped);
  return clean ? [clean] : [];
}

function buildItemDescription(raw: string, index: number): { heading: string; bullets: string[] } {
  const lines = String(raw ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const rawTitle = lines[0] ?? `Item ${index + 1}`;
  const title = sanitizeText(rawTitle) ?? `Item ${index + 1}`;

  const bullets: string[] = [];
  lines.slice(1).forEach((line) => {
    const expanded = sanitizeBulletLine(line);
    expanded.forEach((bullet) => {
      const clean = sanitizeText(bullet);
      if (clean) bullets.push(clean);
    });
  });

  let styleValue: string | null = null;
  let styleIndex = -1;
  let locationValue: string | null = null;
  let locationIndex = -1;

  bullets.forEach((bullet, idx) => {
    const styleMatch = bullet.match(/^Style:\s*(.+)$/i);
    if (styleMatch && styleIndex === -1) {
      styleValue = styleMatch[1].trim();
      styleIndex = idx;
      return;
    }
    const locationMatch = bullet.match(/^(Location|Position|Placement):\s*(.+)$/i);
    if (locationMatch && locationIndex === -1) {
      locationValue = locationMatch[2].trim();
      locationIndex = idx;
    }
  });

  let heading = title;
  let usedStyle = false;
  let usedLocation = false;

  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('electrical')) {
    heading = 'Electrical and Lighting';
  } else if (lowerTitle.includes('blind')) {
    if (locationValue) {
      heading = `${formatHeadingValue(locationValue)} Blind`;
      usedLocation = true;
    }
  } else if (lowerTitle.includes('pergola')) {
    const baseTitle = title.replace(/module/gi, '').replace(/\s+/g, ' ').trim();
    if (styleValue) {
      const style = formatHeadingValue(styleValue);
      if (/pergola/i.test(style)) {
        heading = style;
      } else {
        heading = `${style} Pergola`;
      }
      usedStyle = true;
    } else {
      heading = baseTitle || 'Pergola';
    }
  }

  heading = ensureTrailingColon(heading);

  const drop = new Set<number>();
  if (usedStyle && styleIndex >= 0) drop.add(styleIndex);
  if (usedLocation && locationIndex >= 0) drop.add(locationIndex);

  const filteredBullets = bullets.filter((_, idx) => !drop.has(idx));

  return { heading, bullets: filteredBullets };
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
    const { heading, bullets } = buildItemDescription(item.description, index);
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

  const terms = String(quote.termsText ?? '')
    .split('\n')
    .map((line) => line.replace(/^[-•]\s*/, '').trim())
    .map((line) => sanitizeText(line))
    .filter((line): line is string => Boolean(line));

  const footer: string[] = ['info@sanctuarypergolas.co.nz', 'sanctuarypergolas.co.nz'];

  const client = {
    name: sanitizeText(quote.contact.name) ?? undefined,
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
    intro: sanitizeText(quote.introText ?? '') ?? undefined,
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

export async function generateQuotePdfBytes(quote: QuoteVersionDetail): Promise<Uint8Array> {
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

  const vm = buildPdfQuoteViewModel(quote);

  const contentWidth = PAGE_WIDTH - MARGIN_L - MARGIN_R;
  const leftX = MARGIN_L;
  const rightX = PAGE_WIDTH - MARGIN_R;

  const tableWidth = contentWidth;
  const descW = tableWidth * 0.62;
  const qtyW = tableWidth * 0.12;
  const unitW = tableWidth * 0.13;
  const amtW = tableWidth * 0.13;
  const descX = leftX;
  const qtyX = descX + descW;
  const unitX = qtyX + qtyW;
  const amtX = unitX + unitW;
  const qtyRight = qtyX + qtyW;
  const unitRight = unitX + unitW;
  const amtRight = amtX + amtW;
  const bulletIndent = fontRegular.widthOfTextAtSize('- ', theme.sizes.bullet) + 2;

  type RowLayout = {
    headingLines: string[];
    bulletLines: string[][];
    bulletLineCount: number;
    contentHeight: number;
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
    return {
      headingLines,
      bulletLines,
      bulletLineCount,
      contentHeight,
      qtyText: item.qtyText,
      unitPrice: item.unitPrice,
      amount: item.amount,
    };
  });

  const rowsHeight = rowLayouts.length
    ? rowLayouts.reduce((sum, row) => sum + row.contentHeight, 0) + theme.spacing.rowGap * (rowLayouts.length - 1)
    : 0;

  const tableHeaderHeight =
    theme.lineHeights.section + theme.spacing.sectionToHeader + theme.lineHeights.tableHeader + theme.spacing.headerToRows;

  const tableHeight = rowLayouts.length ? tableHeaderHeight + rowsHeight : 0;

  const termsLines: string[] = [];
  vm.terms.forEach((term) => {
    const wrapped = wrapText(fontRegular, term, theme.sizes.terms, contentWidth);
    termsLines.push(...wrapped);
  });

  const footerLines = vm.footer;
  const footerTopY = footerLines.length
    ? MARGIN_B + (footerLines.length - 1) * theme.lineHeights.footer
    : MARGIN_B;

  const termsBlockHeight = termsLines.length
    ? theme.lineHeights.section + theme.spacing.sectionToHeader + theme.lineHeights.terms * Math.max(termsLines.length - 1, 0)
    : 0;

  const termsBottomY = termsLines.length ? footerTopY + theme.spacing.footerTerms : footerTopY;
  const termsTopY = termsLines.length ? termsBottomY + termsBlockHeight : termsBottomY;

  const totalsBlockHeight = (() => {
    let y = 0;
    y -= theme.lineHeights.section;
    y -= theme.spacing.totalsRuleGap;
    y -= theme.spacing.totalsRuleGap;
    y -= theme.lineHeights.totalsLabel;
    y -= theme.lineHeights.totalsLabel;
    y -= theme.spacing.totalsRuleGap;
    y -= theme.lineHeights.totalsTotal;
    return -y + 2;
  })();

  const totalsBottomY = termsTopY + theme.spacing.termsTotals;
  const totalsTopY = totalsBottomY + totalsBlockHeight;
  const itemsRegionBottomY = totalsTopY + theme.spacing.totalsItems;

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

  const drawDivider = (params: { x: number; y: number; width: number; color: Color }) => {
    page.drawLine({
      start: { x: params.x, y: params.y },
      end: { x: params.x + params.width, y: params.y },
      thickness: 0.6,
      color: params.color,
    });
  };

  const drawTopBar = () => {
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - TOP_BAR_HEIGHT,
      width: PAGE_WIDTH,
      height: TOP_BAR_HEIGHT,
      color: theme.colors.accent,
    });
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

  const drawItemsTable = (params: {
    topY: number;
    rows: RowLayout[];
    sectionTitle: string;
  }) => {
    let y = params.topY;

    drawTextSafe(params.sectionTitle, {
      x: leftX,
      y,
      size: theme.sizes.section,
      font: fontMedium,
      color: theme.colors.accent,
    });
    y -= theme.lineHeights.section;
    y -= theme.spacing.sectionToHeader;

    const headerY = y;
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

    y = headerY - theme.lineHeights.tableHeader;
    drawDivider({ x: leftX, y: y - 2, width: tableWidth, color: theme.colors.rule });
    y -= theme.spacing.headerToRows;

    params.rows.forEach((row, idx) => {
      let rowY = y;
      row.headingLines.forEach((line, lineIndex) => {
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

      const contentBottomY = rowY;
      if (idx < params.rows.length - 1) {
        drawDivider({ x: leftX, y: contentBottomY - 3, width: tableWidth, color: theme.colors.rule });
        rowY = contentBottomY - theme.spacing.rowGap;
      }

      y = rowY;
    });

    return y;
  };

  const drawTotalsBlock = (topY: number) => {
    const blockWidth = 210;
    const labelX = rightX - blockWidth;
    let y = topY;

    drawTextSafe('TOTALS', {
      x: leftX,
      y,
      size: theme.sizes.section,
      font: fontMedium,
      color: theme.colors.accent,
    });

    y -= theme.lineHeights.section;
    y -= theme.spacing.totalsRuleGap;
    drawDivider({ x: labelX, y, width: blockWidth, color: theme.colors.rule });
    y -= theme.spacing.totalsRuleGap;

    drawTextSafe('SUBTOTAL NZD', {
      x: labelX,
      y,
      size: theme.sizes.totalsLabel,
      font: fontMedium,
      color: theme.colors.textPrimary,
    });
    drawRightAligned(vm.totals.ex, rightX, y, theme.sizes.totalsValue, fontRegular, theme.colors.textPrimary);
    y -= theme.lineHeights.totalsLabel;

    drawTextSafe('INCLUDES GST 15%', {
      x: labelX,
      y,
      size: theme.sizes.totalsLabel,
      font: fontMedium,
      color: theme.colors.textPrimary,
    });
    drawRightAligned(vm.totals.gst, rightX, y, theme.sizes.totalsValue, fontRegular, theme.colors.textPrimary);
    y -= theme.lineHeights.totalsLabel;

    drawDivider({ x: labelX, y: y - 2, width: blockWidth, color: theme.colors.rule });
    y -= theme.spacing.totalsRuleGap;

    drawTextSafe('TOTAL NZD', {
      x: labelX,
      y,
      size: theme.sizes.totalsLabel,
      font: fontMedium,
      color: theme.colors.textPrimary,
    });
    drawRightAligned(vm.totals.inc, rightX, y, theme.sizes.totalsTotal, fontSemiBold, theme.colors.textPrimary);
    y -= theme.lineHeights.totalsTotal;

    drawDivider({ x: labelX, y: y - 2, width: blockWidth, color: theme.colors.rule });

    return y - 2;
  };

  const drawTermsBlock = (topY: number) => {
    if (!termsLines.length) return topY;
    let y = topY;
    drawTextSafe('TERMS', {
      x: leftX,
      y,
      size: theme.sizes.section,
      font: fontMedium,
      color: theme.colors.accent,
    });
    y -= theme.lineHeights.section;
    y -= theme.spacing.sectionToHeader;
    termsLines.forEach((line) => {
      drawTextSafe(line, {
        x: leftX,
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
        x: leftX,
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
    let y = CONTENT_TOP_Y;
    drawTextSafe('SANCTUARY PERGOLAS', {
      x: leftX,
      y,
      size: theme.sizes.miniHeader,
      font: fontMedium,
      color: theme.colors.textMuted,
    });
    const refLine = `${vm.header.quoteNumber} • v${vm.header.versionNumber}`;
    drawRightAligned(refLine, rightX, y, theme.sizes.miniHeader, fontMedium, theme.colors.textMuted);
    y -= theme.lineHeights.miniHeader;
    y -= theme.spacing.continuationHeaderGap;
    return y;
  };

  const fitRowsToHeight = (availableHeight: number, rows: RowLayout[]) => {
    let used = 0;
    let count = 0;
    rows.forEach((row) => {
      const add = row.contentHeight + (count > 0 ? theme.spacing.rowGap : 0);
      if (used + add <= availableHeight) {
        used += add;
        count += 1;
      }
    });
    return count;
  };

  drawTopBar();

  // Header stack (top-left)
  const brandY = CONTENT_TOP_Y;
  drawTextSafe('SANCTUARY PERGOLAS', {
    x: leftX,
    y: brandY,
    size: theme.sizes.brand,
    font: fontMedium,
    color: theme.colors.textMuted,
  });

  // Client name + dates (top-right)
  let rightBottomY = brandY;
  let rightCursorY = brandY;
  const showDates = Boolean(vm.issueDate);
  if (vm.client.name) {
    drawRightAligned(vm.client.name, rightX, rightCursorY, theme.sizes.client, fontSemiBold, theme.colors.textPrimary);
    rightBottomY = rightCursorY;
    rightCursorY -= theme.lineHeights.client;
    if (showDates) rightCursorY -= 4;
  }

  if (vm.issueDate) {
    drawRightAligned(`Issue date ${vm.issueDate}`, rightX, rightCursorY, theme.sizes.date, fontRegular, theme.colors.textMuted);
    rightBottomY = rightCursorY;
    rightCursorY -= theme.lineHeights.date;
  }
  if (vm.expiryDate) {
    drawRightAligned(`Expiry ${vm.expiryDate}`, rightX, rightCursorY, theme.sizes.date, fontRegular, theme.colors.textMuted);
    rightBottomY = rightCursorY;
  }

  const quoteY = brandY - theme.lineHeights.brand - theme.spacing.headerBrandToQuote;
  drawTextSafe('Quote', {
    x: leftX,
    y: quoteY,
    size: theme.sizes.title,
    font: fontSemiBold,
    color: theme.colors.textPrimary,
  });

  const refY = quoteY - theme.lineHeights.title - theme.spacing.headerQuoteToRef;
  const refLine = `${vm.header.quoteNumber} • v${vm.header.versionNumber}`;
  drawTextSafe(refLine, {
    x: leftX,
    y: refY,
    size: theme.sizes.ref,
    font: fontMedium,
    color: theme.colors.textMuted,
  });

  const statusY = refY - theme.lineHeights.ref - theme.spacing.headerRefToStatus;
  const leftBottomY = drawStatusBadge(vm.header.status, leftX, statusY);

  let headerBottomY = Math.min(leftBottomY, rightBottomY);

  if (vm.intro) {
    const introLines = wrapText(fontRegular, vm.intro, theme.sizes.intro, contentWidth);
    if (introLines.length) {
      let y = headerBottomY - theme.spacing.introGap;
      introLines.forEach((line) => {
        drawTextSafe(line, {
          x: leftX,
          y,
          size: theme.sizes.intro,
          font: fontRegular,
          color: theme.colors.textMuted,
        });
        y -= theme.lineHeights.intro;
      });
      headerBottomY = y + theme.lineHeights.intro;
    }
  }

  const itemsRegionTopY = headerBottomY - theme.spacing.headerToItems;

  if (rowLayouts.length) {
    const regionHeight = itemsRegionTopY - itemsRegionBottomY;
    const fitsOnPage = tableHeight <= regionHeight;

    if (fitsOnPage) {
      const tableTopY = itemsRegionBottomY + tableHeight;
      drawItemsTable({ topY: tableTopY, rows: rowLayouts, sectionTitle: 'ITEMS' });
    } else {
      const tableTopY = itemsRegionTopY;
      const availableRowsHeight = Math.max(0, itemsRegionTopY - itemsRegionBottomY - tableHeaderHeight);
      const rowsOnPage = fitRowsToHeight(availableRowsHeight, rowLayouts);
      const pageRows = rowLayouts.slice(0, rowsOnPage);
      const remainingRows = rowLayouts.slice(rowsOnPage);

      drawItemsTable({ topY: tableTopY, rows: pageRows, sectionTitle: 'ITEMS' });

      if (remainingRows.length) {
        let overflowRows = remainingRows;
        while (overflowRows.length) {
          page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          drawTopBar();

          const continuationTopY = drawContinuationHeader();
          const continuationAvailable = Math.max(
            0,
            continuationTopY - MARGIN_B - tableHeaderHeight,
          );
          const rowsCount = fitRowsToHeight(continuationAvailable, overflowRows);
          const nextRows = overflowRows.slice(0, rowsCount);
          overflowRows = overflowRows.slice(rowsCount);

          drawItemsTable({
            topY: continuationTopY,
            rows: nextRows,
            sectionTitle: 'ITEMS (continued)',
          });
        }
      }
    }
  }

  page = firstPage;
  drawTotalsBlock(totalsTopY);
  drawTermsBlock(termsTopY);
  drawFooterBlock(MARGIN_B);

  return pdfDoc.save();
}
