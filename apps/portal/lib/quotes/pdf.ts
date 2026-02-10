import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fontkit from './fontkit';
import { PDFDocument, rgb } from 'pdf-lib';
import type { QuoteStatus, QuoteVersionDetail } from './types';
import { fromCents } from './utils';

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;

type PdfQuoteViewModel = {
  header: {
    quoteNumber: string;
    versionNumber: number;
    status: QuoteStatus;
  };
  client: {
    name?: string;
    email?: string;
    phone?: string;
  };
  project: {
    name?: string;
    address?: string;
    suburb?: string;
  };
  issueDate?: string;
  expiryDate?: string;
  intro?: string;
  items: Array<{
    titleLeft: string;
    amountIncGst: string;
    bullets: string[];
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
  page: {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    marginX: 56,
    marginTop: 64,
    marginBottom: 64,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  fonts: {
    logo: 9,
    title: 28,
    subtitle: 12,
    body: 10.5,
    small: 9,
    label: 9,
    itemTitle: 12,
    totalValue: 18,
  },
  lineHeights: {
    logo: 12,
    title: 32,
    subtitle: 16,
    body: 14,
    small: 12,
    label: 12,
    itemTitle: 16,
    totalValue: 22,
  },
  colors: {
    textPrimary: rgb(0.1, 0.1, 0.12),
    textMuted: rgb(0.46, 0.46, 0.48),
    rule: rgb(0.86, 0.86, 0.88),
    accent: rgb(0.502, 0.251, 0.224),
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
  return `$${fromCents(cents).toFixed(2)}`;
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

function buildPdfQuoteViewModel(quote: QuoteVersionDetail): PdfQuoteViewModel {
  const issueDate = quote.sentAt ? formatDate(quote.sentAt) : null;
  let expiryDate = formatDate(quote.expiresAt ?? null);
  if (!expiryDate && quote.status === 'SENT' && quote.sentAt) {
    const fallback = addDays(quote.sentAt, 30);
    expiryDate = fallback ? formatDate(fallback) : null;
  }

  const items = quote.lineItems.map((item, index) => {
    const lines = String(item.description ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const rawTitle = lines[0] ?? `Item ${index + 1}`;
    const titleLeft = sanitizeText(rawTitle) ?? `Item ${index + 1}`;
    const bullets: string[] = [];

    lines.slice(1).forEach((line) => {
      const expanded = sanitizeBulletLine(line);
      expanded.forEach((bullet) => {
        const clean = sanitizeText(bullet);
        if (clean) bullets.push(clean);
      });
    });

    return {
      titleLeft,
      amountIncGst: formatMoneyFromCents(item.lineTotalIncGstCents),
      bullets,
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
    email: sanitizeText(quote.contact.email) ?? undefined,
    phone: sanitizeText(quote.contact.phone ?? '') ?? undefined,
  };

  const project = {
    name: sanitizeText(quote.project.name) ?? undefined,
    address: sanitizeText(quote.project.siteAddress ?? '') ?? undefined,
    suburb: sanitizeText(quote.project.region ?? '') ?? undefined,
  };

  return {
    header: {
      quoteNumber: quote.quoteRef,
      versionNumber: quote.versionNumber,
      status: quote.status,
    },
    client,
    project,
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

  const contentWidth = theme.page.width - theme.page.marginX * 2;
  const leftX = theme.page.marginX;
  const rightX = leftX + contentWidth;
  const metaWidth = 190;
  const metaX = rightX - metaWidth;

  let page = pdfDoc.addPage([theme.page.width, theme.page.height]);
  let cursorY = theme.page.height - theme.page.marginTop;
  let pageIndex = 0;

  const toText = (value: unknown): string | null => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return null;
  };

  const drawTextSafe = (value: unknown, options: { x: number; y: number; size: number; font: any; color: { r: number; g: number; b: number } }) => {
    const text = toText(value);
    if (!text) return;
    page.drawText(text, options);
  };

  const measureText = (font: any, value: unknown, size: number) => {
    const text = toText(value) ?? '';
    return font.widthOfTextAtSize(text, size);
  };

  const drawTextBlock = (params: {
    lines: string[];
    x: number;
    y: number;
    lineHeight: number;
    color: { r: number; g: number; b: number };
    font: any;
    size: number;
  }) => {
    let y = params.y;
    params.lines.forEach((line) => {
      drawTextSafe(line, {
        x: params.x,
        y,
        size: params.size,
        font: params.font,
        color: params.color,
      });
      y -= params.lineHeight;
    });
    return y;
  };

  const drawKeyValue = (params: {
    key: string;
    value: string;
    x: number;
    y: number;
    keyWidth: number;
    keyFont?: any;
    valueFont?: any;
    keySize?: number;
    valueSize?: number;
    keyColor?: { r: number; g: number; b: number };
    valueColor?: { r: number; g: number; b: number };
    lineHeight?: number;
  }) => {
    const keyFont = params.keyFont ?? fontMedium;
    const valueFont = params.valueFont ?? fontRegular;
    const keySize = params.keySize ?? theme.fonts.label;
    const valueSize = params.valueSize ?? theme.fonts.body;
    const keyColor = params.keyColor ?? theme.colors.textMuted;
    const valueColor = params.valueColor ?? theme.colors.textPrimary;
    const lineHeight = params.lineHeight ?? theme.lineHeights.label;

    drawTextSafe(params.key, {
      x: params.x,
      y: params.y,
      size: keySize,
      font: keyFont,
      color: keyColor,
    });

    drawTextSafe(params.value, {
      x: params.x + params.keyWidth,
      y: params.y,
      size: valueSize,
      font: valueFont,
      color: valueColor,
    });

    return params.y - lineHeight;
  };

  const drawDivider = (params: { x: number; y: number; width: number; color: { r: number; g: number; b: number } }) => {
    page.drawLine({
      start: { x: params.x, y: params.y },
      end: { x: params.x + params.width, y: params.y },
      thickness: 0.6,
      color: params.color,
    });
  };

  const drawStatusBadge = (text: string, x: number, y: number) => {
    const safeText = toText(text) ?? 'DRAFT';
    const size = theme.fonts.small;
    const paddingX = 6;
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

    return height;
  };

  const drawContinuationHeader = () => {
    const headerText = `Quote ${vm.header.quoteNumber} • v${vm.header.versionNumber}`;
    drawTextSafe(headerText, {
      x: leftX,
      y: cursorY,
      size: theme.fonts.subtitle,
      font: fontMedium,
      color: theme.colors.textMuted,
    });
    cursorY -= theme.lineHeights.subtitle;
    cursorY -= theme.spacing.sm;
    drawDivider({ x: leftX, y: cursorY, width: contentWidth, color: theme.colors.rule });
    cursorY -= theme.spacing.lg;
  };

  const startNewPage = () => {
    pageIndex += 1;
    page = pdfDoc.addPage([theme.page.width, theme.page.height]);
    cursorY = theme.page.height - theme.page.marginTop;
    drawContinuationHeader();
  };

  const ensureSpace = (heightNeeded: number) => {
    if (cursorY - heightNeeded < theme.page.marginBottom) {
      startNewPage();
    }
  };

  const drawItemBlock = (params: { titleLeft: string; amountRight: string; bullets: string[] }) => {
    const amountReserve = 90;
    const titleMaxWidth = Math.max(120, contentWidth - amountReserve - theme.spacing.sm);
    const titleLines = wrapText(fontMedium, params.titleLeft, theme.fonts.itemTitle, titleMaxWidth);

    const bulletIndent = 10;
    const bulletLineGroups = params.bullets.map((bullet) =>
      wrapText(fontRegular, bullet, theme.fonts.body, contentWidth - bulletIndent),
    );
    const bulletLineCount = bulletLineGroups.reduce((sum, lines) => sum + lines.length, 0);

    const titleHeight = titleLines.length * theme.lineHeights.itemTitle;
    const bulletHeight = bulletLineCount ? theme.spacing.xs + bulletLineCount * theme.lineHeights.body : 0;
    const blockHeight = titleHeight + bulletHeight + theme.spacing.md;

    ensureSpace(blockHeight);

    let y = cursorY;

    titleLines.forEach((line, idx) => {
      drawTextSafe(line, {
        x: leftX,
        y,
        size: theme.fonts.itemTitle,
        font: fontMedium,
        color: theme.colors.textPrimary,
      });

      if (idx === 0) {
        const amountWidth = measureText(fontSemiBold, params.amountRight, theme.fonts.itemTitle);
        drawTextSafe(params.amountRight, {
          x: rightX - amountWidth,
          y,
          size: theme.fonts.itemTitle,
          font: fontSemiBold,
          color: theme.colors.textPrimary,
        });
      }

      y -= theme.lineHeights.itemTitle;
    });

    cursorY = y;

    if (bulletLineCount) {
      cursorY -= theme.spacing.xs;
      params.bullets.forEach((bullet, bulletIndex) => {
        const bulletLines = bulletLineGroups[bulletIndex] ?? [];
        bulletLines.forEach((line, lineIndex) => {
          if (lineIndex === 0) {
            drawTextSafe('•', {
              x: leftX,
              y: cursorY,
              size: theme.fonts.body,
              font: fontRegular,
              color: theme.colors.textMuted,
            });
          }
          drawTextSafe(line, {
            x: leftX + bulletIndent,
            y: cursorY,
            size: theme.fonts.body,
            font: fontRegular,
            color: theme.colors.textMuted,
          });
          cursorY -= theme.lineHeights.body;
        });
      });
    }

    cursorY -= theme.spacing.md;
  };

  // Header
  const headerStartY = cursorY;
  const metaRows: Array<{ key: string; value: string }> = [];
  if (vm.client.name) metaRows.push({ key: 'Client', value: vm.client.name });

  const projectLine = vm.project.name ?? vm.project.address ?? vm.project.suburb;
  if (projectLine) metaRows.push({ key: 'Project', value: projectLine });

  if (vm.issueDate) metaRows.push({ key: 'Issue date', value: vm.issueDate });
  if (vm.expiryDate) metaRows.push({ key: 'Expiry date', value: vm.expiryDate });

  const metaRowHeight = theme.lineHeights.label + theme.spacing.xs;
  const metaHeight = metaRows.length ? metaRows.length * metaRowHeight - theme.spacing.xs : 0;

  const statusHeight = theme.fonts.small + 4;
  const headerLeftHeight =
    theme.lineHeights.logo +
    theme.spacing.xs +
    theme.lineHeights.title +
    theme.spacing.xs +
    theme.lineHeights.subtitle +
    theme.spacing.sm +
    statusHeight;

  const headerHeight = Math.max(headerLeftHeight, metaHeight);

  let leftY = headerStartY;
  drawTextSafe('SANCTUARY PERGOLAS', {
    x: leftX,
    y: leftY,
    size: theme.fonts.logo,
    font: fontMedium,
    color: theme.colors.textMuted,
  });
  leftY -= theme.lineHeights.logo;
  leftY -= theme.spacing.xs;

  drawTextSafe('Quote', {
    x: leftX,
    y: leftY,
    size: theme.fonts.title,
    font: fontSemiBold,
    color: theme.colors.textPrimary,
  });
  leftY -= theme.lineHeights.title;
  leftY -= theme.spacing.xs;

  const refLine = `${vm.header.quoteNumber} • v${vm.header.versionNumber}`;
  drawTextSafe(refLine, {
    x: leftX,
    y: leftY,
    size: theme.fonts.subtitle,
    font: fontMedium,
    color: theme.colors.textMuted,
  });
  leftY -= theme.lineHeights.subtitle;
  leftY -= theme.spacing.sm;

  drawStatusBadge(vm.header.status, leftX, leftY);

  let metaY = headerStartY;
  metaRows.forEach((row, idx) => {
    drawKeyValue({
      key: row.key,
      value: row.value,
      x: metaX,
      y: metaY,
      keyWidth: 70,
      keySize: theme.fonts.label,
      valueSize: theme.fonts.body,
    });
    metaY -= theme.lineHeights.label;
    if (idx < metaRows.length - 1) metaY -= theme.spacing.xs;
  });

  cursorY = headerStartY - headerHeight - theme.spacing.lg;

  drawDivider({ x: leftX, y: cursorY, width: contentWidth, color: theme.colors.rule });
  cursorY -= theme.spacing.lg;

  if (vm.intro) {
    const introLines = wrapText(fontRegular, vm.intro, theme.fonts.body, contentWidth);
    ensureSpace(introLines.length * theme.lineHeights.body + theme.spacing.lg);
    cursorY = drawTextBlock({
      lines: introLines,
      x: leftX,
      y: cursorY,
      lineHeight: theme.lineHeights.body,
      font: fontRegular,
      size: theme.fonts.body,
      color: theme.colors.textMuted,
    });
    cursorY -= theme.spacing.lg;
  }

  if (vm.items.length) {
    ensureSpace(theme.lineHeights.label + theme.spacing.sm);
    drawTextSafe('ITEMS', {
      x: leftX,
      y: cursorY,
      size: theme.fonts.label,
      font: fontMedium,
      color: theme.colors.accent,
    });
    cursorY -= theme.lineHeights.label;
    cursorY -= theme.spacing.sm;

    vm.items.forEach((item) => {
      drawItemBlock(item);
    });
  }

  ensureSpace(theme.spacing.lg + theme.lineHeights.label);
  drawDivider({ x: leftX, y: cursorY, width: contentWidth, color: theme.colors.rule });
  cursorY -= theme.spacing.lg;

  const totalsLabelHeight = theme.lineHeights.label + theme.spacing.sm;
  const totalsHeight =
    totalsLabelHeight + theme.lineHeights.totalValue + theme.spacing.xs + theme.lineHeights.body * 2 + theme.spacing.md;
  ensureSpace(totalsHeight);

  drawTextSafe('TOTALS', {
    x: leftX,
    y: cursorY,
    size: theme.fonts.label,
    font: fontMedium,
    color: theme.colors.accent,
  });
  cursorY -= theme.lineHeights.label;
  cursorY -= theme.spacing.sm;

  const totalsLabelX = rightX - 210;

  drawTextSafe('Total (inc GST)', {
    x: totalsLabelX,
    y: cursorY,
    size: theme.fonts.body,
    font: fontMedium,
    color: theme.colors.textMuted,
  });
  const totalIncWidth = measureText(fontSemiBold, vm.totals.inc, theme.fonts.totalValue);
  drawTextSafe(vm.totals.inc, {
    x: rightX - totalIncWidth,
    y: cursorY,
    size: theme.fonts.totalValue,
    font: fontSemiBold,
    color: theme.colors.textPrimary,
  });
  cursorY -= theme.lineHeights.totalValue;

  drawTextSafe('Total (ex GST)', {
    x: totalsLabelX,
    y: cursorY,
    size: theme.fonts.body,
    font: fontMedium,
    color: theme.colors.textMuted,
  });
  const totalExWidth = measureText(fontMedium, vm.totals.ex, theme.fonts.body);
  drawTextSafe(vm.totals.ex, {
    x: rightX - totalExWidth,
    y: cursorY,
    size: theme.fonts.body,
    font: fontMedium,
    color: theme.colors.textPrimary,
  });
  cursorY -= theme.lineHeights.body;

  drawTextSafe('GST (15%)', {
    x: totalsLabelX,
    y: cursorY,
    size: theme.fonts.body,
    font: fontMedium,
    color: theme.colors.textMuted,
  });
  const gstWidth = measureText(fontMedium, vm.totals.gst, theme.fonts.body);
  drawTextSafe(vm.totals.gst, {
    x: rightX - gstWidth,
    y: cursorY,
    size: theme.fonts.body,
    font: fontMedium,
    color: theme.colors.textPrimary,
  });
  cursorY -= theme.lineHeights.body;
  cursorY -= theme.spacing.md;

  if (vm.terms.length) {
    const termsLines: string[] = [];
    vm.terms.forEach((term) => {
      const wrapped = wrapText(fontRegular, term, theme.fonts.body, contentWidth);
      termsLines.push(...wrapped);
    });

    ensureSpace(theme.lineHeights.label + theme.spacing.sm + termsLines.length * theme.lineHeights.body + theme.spacing.lg);

    drawTextSafe('TERMS', {
      x: leftX,
      y: cursorY,
      size: theme.fonts.label,
      font: fontMedium,
      color: theme.colors.accent,
    });
    cursorY -= theme.lineHeights.label;
    cursorY -= theme.spacing.sm;

    cursorY = drawTextBlock({
      lines: termsLines,
      x: leftX,
      y: cursorY,
      lineHeight: theme.lineHeights.body,
      font: fontRegular,
      size: theme.fonts.body,
      color: theme.colors.textMuted,
    });
    cursorY -= theme.spacing.lg;
  }

  const footerHeight = vm.footer.length
    ? vm.footer.length * theme.lineHeights.small + (vm.footer.length - 1) * theme.spacing.xs + theme.spacing.lg
    : 0;

  if (vm.footer.length) {
    ensureSpace(footerHeight);
    drawDivider({ x: leftX, y: cursorY, width: contentWidth, color: theme.colors.rule });
    cursorY -= theme.spacing.md;

    vm.footer.forEach((line) => {
      drawTextSafe(line, {
        x: leftX,
        y: cursorY,
        size: theme.fonts.small,
        font: fontRegular,
        color: theme.colors.textMuted,
      });
      cursorY -= theme.lineHeights.small;
      cursorY -= theme.spacing.xs;
    });
  }

  return pdfDoc.save();
}
