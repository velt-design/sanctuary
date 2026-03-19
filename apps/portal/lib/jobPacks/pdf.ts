import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { PORTAL_COMPANY_PROFILE } from '@/lib/company/profile';
import {
  buildJobPackPdfGroups,
  resolveVisibleJobPackColumns,
  type JobPackCellKey,
  type JobPackRow,
  type JobPackSheetKey,
  type JobPackWorkbook,
} from './workbook';

const A4_PORTRAIT: [number, number] = [595.28, 841.89];

const COLOR = {
  text: rgb(0.13, 0.13, 0.14),
  muted: rgb(0.43, 0.43, 0.45),
  border: rgb(0.83, 0.83, 0.85),
  softBorder: rgb(0.9, 0.9, 0.92),
  headerBg: rgb(0.97, 0.96, 0.94),
  tableHeaderBg: rgb(0.95, 0.95, 0.93),
  accent: rgb(0.48, 0.29, 0.18),
} as const;

type RenderState = {
  pdf: PDFDocument;
  page: PDFPage;
  width: number;
  height: number;
  y: number;
  marginLeft: number;
  marginRight: number;
  marginBottom: number;
  contentWidth: number;
  font: PDFFont;
  fontBold: PDFFont;
  logo: PDFImage | null;
};

type HeaderMeta = {
  projectName: string;
  siteAddress: string;
  quoteRef: string;
  versionLabel: string;
  sheetTitle: string;
  generatedAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
};

function pageSizeForPdf(): [number, number] {
  return A4_PORTRAIT;
}

function fallbackFilename(workbook: JobPackWorkbook, sheet: JobPackSheetKey): string {
  const quoteRef = workbook.snapshot.project.quoteRef?.trim();
  const base = quoteRef || workbook.snapshot.project.projectName.trim() || 'job-pack';
  const safeBase = base.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'job-pack';
  return `${safeBase}-${workbook.detail.versionLabel}-${sheet}.pdf`;
}

function formatGeneratedDate(value: Date): string {
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Pacific/Auckland',
  }).format(value);
}

function cellText(row: JobPackRow, key: JobPackCellKey): string {
  const value = row.cells[key];
  return typeof value === 'string' ? value : '';
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const source = text.replace(/\r/g, '').split('\n');
  const lines: string[] = [];

  for (const paragraph of source) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of trimmed.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }

      if (current) lines.push(current);

      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word;
        continue;
      }

      let segment = '';
      for (const char of word) {
        const next = segment + char;
        if (font.widthOfTextAtSize(next, size) <= maxWidth) {
          segment = next;
          continue;
        }
        if (segment) lines.push(segment);
        segment = char;
      }
      current = segment;
    }

    if (current) lines.push(current);
  }

  return lines.length ? lines : [''];
}

async function readLogoBytes(filename: string): Promise<Uint8Array | null> {
  const candidates = [
    path.resolve(process.cwd(), 'public', filename),
    path.resolve(process.cwd(), 'apps', 'portal', 'public', filename),
  ];

  for (const candidate of candidates) {
    try {
      return await readFile(candidate);
    } catch {
      // Try next path.
    }
  }

  return null;
}

async function buildInitialState(pdf: PDFDocument): Promise<RenderState> {
  const [width, height] = pageSizeForPdf();
  const page = pdf.addPage([width, height]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const logoBytes = await readLogoBytes(PORTAL_COMPANY_PROFILE.logoFilename);
  let logo: PDFImage | null = null;
  if (logoBytes) {
    try {
      logo = await pdf.embedPng(logoBytes);
    } catch {
      logo = null;
    }
  }

  const marginLeft = 42;
  const marginRight = 42;
  const marginBottom = 34;

  return {
    pdf,
    page,
    width,
    height,
    y: height - 34,
    marginLeft,
    marginRight,
    marginBottom,
    contentWidth: width - marginLeft - marginRight,
    font,
    fontBold,
    logo,
  };
}

function drawHeader(state: RenderState, meta: HeaderMeta): number {
  const { page, width, y, marginLeft, marginRight, contentWidth, font, fontBold, logo } = state;
  const top = y;
  const headerHeight = 102;
  const boxY = top - headerHeight;

  page.drawRectangle({
    x: marginLeft,
    y: boxY,
    width: contentWidth,
    height: headerHeight,
    color: COLOR.headerBg,
    borderColor: COLOR.border,
    borderWidth: 1,
  });

  const innerX = marginLeft + 14;
  const innerWidth = contentWidth - 28;
  const companyWidth = innerWidth * 0.34;
  const customerWidth = innerWidth * 0.28;
  const customerX = innerX + companyWidth + 10;
  const jobX = customerX + customerWidth + 10;

  if (logo) {
    const maxHeight = 24;
    const scale = maxHeight / logo.height;
    page.drawImage(logo, {
      x: innerX,
      y: top - 31,
      width: logo.width * scale,
      height: logo.height * scale,
    });
  }

  page.drawText('Company', {
    x: innerX,
    y: top - 14,
    size: 8.5,
    font: fontBold,
    color: COLOR.accent,
  });
  page.drawText(PORTAL_COMPANY_PROFILE.name, {
    x: innerX,
    y: top - 44,
    size: 12,
    font: fontBold,
    color: COLOR.text,
  });

  const companyLines = [...PORTAL_COMPANY_PROFILE.addressLines, PORTAL_COMPANY_PROFILE.email, PORTAL_COMPANY_PROFILE.phone];
  companyLines.forEach((line, index) => {
    page.drawText(line, {
      x: innerX,
      y: top - 60 - index * 11,
      size: 8.7,
      font,
      color: COLOR.muted,
    });
  });

  page.drawText('Customer', {
    x: customerX,
    y: top - 14,
    size: 8.5,
    font: fontBold,
    color: COLOR.accent,
  });
  const customerLines = [meta.customerName || '-', meta.customerEmail || '-', meta.customerPhone || '-'];
  customerLines.forEach((line, index) => {
    page.drawText(line, {
      x: customerX,
      y: top - 32 - index * 13,
      size: index === 0 ? 10.5 : 8.7,
      font: index === 0 ? fontBold : font,
      color: index === 0 ? COLOR.text : COLOR.muted,
    });
  });

  page.drawText('Job', {
    x: jobX,
    y: top - 14,
    size: 8.5,
    font: fontBold,
    color: COLOR.accent,
  });

  const jobPairs: Array<[string, string]> = [
    ['Project', meta.projectName || '-'],
    ['Site', meta.siteAddress || '-'],
    ['Quote ref', meta.quoteRef || '-'],
    ['Version', meta.versionLabel || '-'],
    ['Sheet', meta.sheetTitle],
    ['Generated', meta.generatedAt],
  ];

  jobPairs.forEach(([label, value], index) => {
    const rowY = top - 32 - index * 11;
    page.drawText(`${label}:`, {
      x: jobX,
      y: rowY,
      size: 8.5,
      font: fontBold,
      color: COLOR.text,
    });
    const labelWidth = fontBold.widthOfTextAtSize(`${label}:`, 8.5);
    page.drawText(value, {
      x: jobX + labelWidth + 6,
      y: rowY,
      size: 8.5,
      font,
      color: COLOR.muted,
      maxWidth: width - marginRight - (jobX + labelWidth + 6),
    });
  });

  const nextY = boxY - 18;
  page.drawText(meta.sheetTitle, {
    x: marginLeft,
    y: nextY,
    size: 15,
    font: fontBold,
    color: COLOR.text,
  });

  return nextY - 10;
}

function drawTableHeader(state: RenderState, columnWidths: number[], columnLabels: string[]): number {
  const { page, y, marginLeft, fontBold } = state;
  const rowHeight = 24;
  page.drawRectangle({
    x: marginLeft,
    y: y - rowHeight,
    width: columnWidths.reduce((sum, width) => sum + width, 0),
    height: rowHeight,
    color: COLOR.tableHeaderBg,
    borderColor: COLOR.border,
    borderWidth: 1,
  });

  let x = marginLeft;
  columnWidths.forEach((width, index) => {
    if (index > 0) {
      page.drawLine({
        start: { x, y: y - rowHeight },
        end: { x, y },
        thickness: 0.75,
        color: COLOR.border,
      });
    }
    page.drawText(columnLabels[index] ?? '', {
      x: x + 6,
      y: y - 15,
      size: 8.5,
      font: fontBold,
      color: COLOR.text,
      maxWidth: width - 12,
    });
    x += width;
  });

  return rowHeight;
}

function drawRow(state: RenderState, row: JobPackRow, columnKeys: JobPackCellKey[], columnWidths: number[]): number {
  const { page, y, marginLeft, font, fontBold } = state;
  const fontForRow = row.tone === 'total' ? fontBold : font;
  const textColor = row.tone === 'muted' ? COLOR.muted : COLOR.text;
  const lineHeight = 10.5;
  const paddingY = 6;

  const lineMatrix = columnKeys.map((key, index) =>
    wrapText(cellText(row, key), fontForRow, 8.4, Math.max(columnWidths[index] - 12, 8)),
  );
  const maxLines = Math.max(1, ...lineMatrix.map((lines) => lines.length));
  const rowHeight = paddingY * 2 + maxLines * lineHeight;

  page.drawRectangle({
    x: marginLeft,
    y: y - rowHeight,
    width: columnWidths.reduce((sum, width) => sum + width, 0),
    height: rowHeight,
    borderColor: COLOR.softBorder,
    borderWidth: 0.75,
  });

  let x = marginLeft;
  columnWidths.forEach((width, index) => {
    if (index > 0) {
      page.drawLine({
        start: { x, y: y - rowHeight },
        end: { x, y },
        thickness: 0.5,
        color: COLOR.softBorder,
      });
    }

    lineMatrix[index]?.forEach((line, lineIndex) => {
      page.drawText(line, {
        x: x + 6,
        y: y - paddingY - 8.4 - lineIndex * lineHeight,
        size: 8.4,
        font: fontForRow,
        color: textColor,
        maxWidth: width - 12,
      });
    });
    x += width;
  });

  return rowHeight;
}

function scaleColumnWidths(rawWidths: number[], availableWidth: number): number[] {
  const total = rawWidths.reduce((sum, width) => sum + width, 0) || 1;
  return rawWidths.map((width) => (width / total) * availableWidth);
}

function hasAnyRows(groups: Array<{ rows: JobPackRow[] }>): boolean {
  return groups.some((group) => group.rows.length > 0);
}

export async function generateJobPackPdf(args: {
  workbook: JobPackWorkbook;
  sheetKey: JobPackSheetKey;
  showNotesColumn: boolean;
}): Promise<{ bytes: Uint8Array; filename: string }> {
  const pdf = await PDFDocument.create();
  let state = await buildInitialState(pdf);
  const visibleSheet = args.workbook.sheets[args.sheetKey];
  const columns = resolveVisibleJobPackColumns(visibleSheet, args.showNotesColumn);
  const groups = buildJobPackPdfGroups(visibleSheet);
  const columnKeys = columns.map((column) => column.key);
  const columnWidths = scaleColumnWidths(columns.map((column) => column.widthPx), state.contentWidth);
  const headerMeta: HeaderMeta = {
    projectName: args.workbook.snapshot.project.projectName || '',
    siteAddress: args.workbook.snapshot.project.siteAddress || '',
    quoteRef: args.workbook.snapshot.project.quoteRef || '',
    versionLabel: args.workbook.detail.versionLabel,
    sheetTitle: visibleSheet.title,
    generatedAt: formatGeneratedDate(new Date()),
    customerName: args.workbook.snapshot.contact.displayName || '',
    customerEmail: args.workbook.snapshot.contact.email || '',
    customerPhone: args.workbook.snapshot.contact.phone || '',
  };

  const resetPage = () => {
    state.y = drawHeader(state, headerMeta);
    state.y -= drawTableHeader(
      state,
      columnWidths,
      columns.map((column) => column.label),
    );
  };

  resetPage();

  if (!hasAnyRows(groups)) {
    state.page.drawText(visibleSheet.emptyMessage, {
      x: state.marginLeft,
      y: state.y - 16,
      size: 10,
      font: state.font,
      color: COLOR.muted,
      maxWidth: state.contentWidth,
    });
  } else {
    for (const group of groups) {
      if (group.showHeader !== false) {
        const needed = 18;
        if (state.y - needed < state.marginBottom) {
          state = await buildInitialState(pdf);
          resetPage();
        }
        state.page.drawText(group.label, {
          x: state.marginLeft,
          y: state.y - 14,
          size: 10.5,
          font: state.fontBold,
          color: COLOR.accent,
        });
        state.y -= 20;
      }

      for (const row of group.rows) {
        const lineMatrix = columnKeys.map((key, index) =>
          wrapText(cellText(row, key), row.tone === 'total' ? state.fontBold : state.font, 8.4, Math.max(columnWidths[index] - 12, 8)),
        );
        const maxLines = Math.max(1, ...lineMatrix.map((lines) => lines.length));
        const rowHeight = 12 + maxLines * 10.5;
        if (state.y - rowHeight < state.marginBottom) {
          state = await buildInitialState(pdf);
          resetPage();
        }
        state.y -= drawRow(state, row, columnKeys, columnWidths);
      }

      state.y -= 8;
    }
  }

  return {
    bytes: await pdf.save(),
    filename: fallbackFilename(args.workbook, args.sheetKey),
  };
}
